"""word(w)：输入一个单词，返回要加粗的字母下标列表（从 0 开始）。

例：word("reading") -> [0, 1, 2, 3]（加粗 read）

算法：
1. 信息曲线：前 k 个字母把词典（前 10 万个英语词，按词频加权）缩小了多少。
2. 窗口：只在词长的 45% 到 75% 之间选（大多数词落在 50%~70%）。
3. 拐点：曲线比"首尾连线"高得最多的位置（再多加粗，帮助变小），
   再加一点向 60% 的拉力（前 5000 个常用词实测平均 60%，85% 的词落在 50%~70%）。
4. 词素吸附：窗口内有词素边界（read|ing、inform|ation、week|end）就对齐到离拐点最近的那个。
   复合词只认白名单成分（every、one、day、ship……），挡住 sea|son、car|pet 这类拆错。
   un|happy、run|ning 这类边界太靠前（不到 45%），不会被吸附。
词表里没有的词（人名、术语等）固定加粗 45%。第一次调用会加载词表，约 3 秒。
"""

import math
import os
import threading
from functools import lru_cache

LO, HI = 0.45, 0.75  # 加粗词长的 45% 到 75%
TARGET = 0.6  # 拐点向词长的 60% 靠拢
PULL = 0.5  # 拉力大小：0 = 纯拐点，越大越接近固定 60%
FALLBACK = 0.45  # 词表外的词固定加粗 45%
MIN_STEM = 3  # 词干至少 3 个字母
PREFIXES = [
    "anti", "auto", "counter", "dis", "extra", "fore", "inter", "mid", "mis", "non",
    "out", "over", "pre", "semi", "sub", "super", "trans", "under",
]
SUFFIXES = [
    "able", "ible", "al", "ance", "ence", "ed", "en", "er", "ful",
    "ing", "ion", "tion", "sion", "ation", "ish", "ive", "less", "ly", "ment",
    "ness", "or", "ous", "es", "ity", "ize", "ise",
]

# 复合词（every|one、week|end）：只认"至少一半是常见复合词成分"的拆法，避免 sea|son、car|pet 这类拆错。
COMPOUND_HEADS = {
    "every", "some", "any", "with", "down", "after", "there", "where", "here", "back",
    "off", "week", "birth", "foot", "hand", "head", "home", "house", "work", "news",
    "water", "sun", "moon", "fire", "air", "sea", "land", "life", "light", "black",
    "white", "green", "blue", "red", "gold", "high", "low", "short", "long", "side",
    "book", "break", "grand", "care", "night", "town", "wood",
}
COMPOUND_TAILS = {
    "one", "body", "time", "times", "day", "days", "way", "ways", "self", "out", "ever",
    "wise", "ward", "wards", "side", "end", "man", "men", "woman", "women", "ball", "work",
    "book", "ware", "house", "room", "land", "line", "light", "life", "point", "board",
    "place", "ship", "hood", "dom", "like", "worthy", "proof", "made", "yard", "shop",
    "town", "field", "ground", "water", "wood", "boy", "girl", "fish", "bird", "fly",
    "craft", "phone", "walk", "port", "fall", "stone", "mark", "box", "bag", "door",
}
COMPOUND_MIN_FREQ = 1e-5  # 不在白名单的那一半必须是常用词


def _is_compound(a, b, vocab):
    """a|b 是否像真的复合词。3 个字母的一半最容易拆错（sea|son、ran|dom），所以要求更严。"""
    if len(b) < 3:
        return False
    if b in COMPOUND_TAILS:  # every|one、free|dom：短的前半段（ran|dom）要在白名单里
        return vocab.get(a, 0) > COMPOUND_MIN_FREQ and (len(b) > 3 or len(a) > 3 or a in COMPOUND_HEADS)
    if a in COMPOUND_HEADS:  # with|draw、hand|some：后半段要 4 个字母以上（挡住 sea|son、off|ice）
        return len(b) >= 4 and vocab.get(b, 0) > COMPOUND_MIN_FREQ
    return False


@lru_cache(maxsize=1)
def _vocab():
    """freqs：{词: 频率}；mass：{前缀: 以它开头的所有词的频率之和}。"""
    from wordfreq import top_n_list, word_frequency

    freqs, mass = {}, {}
    for w in top_n_list("en", 100_000):
        if w.isascii() and w.isalpha():
            freqs[w] = f = word_frequency(w, "en")
            for k in range(1, len(w) + 1):
                mass[w[:k]] = mass.get(w[:k], 0) + f
    return freqs, mass


@lru_cache(maxsize=1)
def _lemmatizer():
    import spacy

    # 只要规则词形还原器；词性由我们自己设置，所以不跑其他组件（加载约 1 秒）。
    nlp = spacy.load(
        "en_core_web_sm",
        exclude=["tok2vec", "tagger", "attribute_ruler", "parser", "ner", "senter"],
    )
    return nlp, nlp.get_pipe("lemmatizer")


@lru_cache(maxsize=100_000)
def _lemmas(w):
    """单个词没有上下文、不知道词性，所以动词/名词/形容词/副词各问一遍。"""
    from spacy.tokens import Doc

    nlp, lemmatizer = _lemmatizer()
    out = set()
    for pos in ("VERB", "NOUN", "ADJ", "ADV"):
        token = Doc(nlp.vocab, words=[w])[0]
        token.pos_ = pos
        out.update(lemmatizer.rule_lemmatize(token))
    return frozenset(x.lower() for x in out)


def _morpheme_boundaries(w, vocab):
    """词素边界 k（w[:k] 是前缀或词根）。剩下的词干必须在词表里。"""
    # 前缀：un|happy
    found = {
        len(p) for p in PREFIXES
        if w.startswith(p) and len(w) - len(p) >= MIN_STEM and w[len(p):] in vocab
    }
    # 词形还原：边界取"原词与词根停止相同的位置"，所以 run|ning、child|ren 也对
    shared = [
        len(os.path.commonprefix([w, lemma]))
        for lemma in _lemmas(w)
        if lemma in vocab
    ]
    # 复合词：week|end、every|one
    found |= {k for k in range(1, len(w)) if _is_compound(w[:k], w[k:], vocab)}
    lemma_k = max((k for k in shared if MIN_STEM <= k < len(w)), default=None)
    if lemma_k is not None:
        found.add(lemma_k)
        return found
    # 后缀（词形还原没结果时才用）：inform|ation；去掉后缀后词干可能补 e、双写辅音或 i 变 y
    for s in SUFFIXES:
        base = w[: len(w) - len(s)]
        if w.endswith(s) and len(base) >= MIN_STEM:
            stems = [base, base + "e"]
            if base[-1] == base[-2]:
                stems.append(base[:-1])  # runn -> run
            if base[-1] == "i":
                stems.append(base[:-1] + "y")  # happi -> happy
            if any(x in vocab for x in stems):
                found.add(len(base))
    return found


def word(w: str) -> list[int]:
    freqs, mass = _vocab()
    key, n = w.lower(), len(w)
    if n < 2 or key not in freqs:  # 没有词频可用：单字母整个加粗，其余固定比例
        return list(range(n if n < 2 else round(n * FALLBACK)))

    cum = [-math.log2(mass[key[:k]]) for k in range(1, n)]  # cum[k-1]：前 k 个字母揭示的信息量
    lo, hi = math.ceil(n * LO), math.floor(n * HI)  # 改 LO/HI 时注意：窗口不能是空的（如 LO=0.45、HI=0.65 时 3 字母词会报错）
    span = abs(cum[-1] - cum[0]) or 1.0  # 把 gap 缩放到 0~1 左右，拉力才和词长、词频无关

    def gap(k):  # 曲线高出"首尾连线"多少（按曲线总高度归一化）
        return (cum[k - 1] - (cum[0] + (cum[-1] - cum[0]) * (k - 1) / max(n - 2, 1))) / span

    def score(k):  # 拐点越明显越好，离 50% 越远扣分越多
        return gap(k) - PULL * abs(k / n - TARGET)

    knee = max(range(lo, hi + 1), key=score)  # 窗口内得分最高

    near = [m for m in _morpheme_boundaries(key, freqs) if lo <= m <= hi]
    if near:
        knee = min(near, key=lambda m: (abs(m - knee), -m))  # 最近的词素边界，距离相同取靠后的
    return list(range(knee))


class WordAnalyzer:
    """初始化时预热一次（加载词表 + spaCy 词形还原器，并跑几个词把缓存热起来），
    之后 bold() 不再冷启动。底层缓存在模块级，所以 new 多个实例也只会预热一次。"""

    _lock = threading.Lock()
    _warm = False

    def __init__(self, warmup: bool = True):
        if warmup:
            self.warmup()

    def warmup(self) -> None:
        cls = WordAnalyzer
        if cls._warm:
            return
        with cls._lock:  # 防止多个线程同时预热
            if cls._warm:
                return
            _vocab()
            _lemmatizer()
            for w in ("reading", "running", "unhappy", "children"):  # 走一遍完整流程
                word(w)
            cls._warm = True

    def bold(self, w: str) -> list[int]:
        """返回要加粗的字母下标列表，同 word(w)。"""
        return word(w)

    __call__ = bold


def analyze_word(word_text: str) -> dict | None:
    """Return basic linguistic info for a single word, or None if empty (used by app.py /word)."""
    from nlp import get_nlp

    doc = get_nlp()(word_text.strip())
    if not len(doc):
        return None
    t = doc[0]
    return {
        "word": t.text,
        "lemma": t.lemma_,
        "pos": t.pos_,
        "is_stop": t.is_stop,
        "is_alpha": t.is_alpha,
    }