"""word(w)：输入一个单词，返回要加粗的字母下标列表（从 0 开始）。

例：word("reading") -> [0, 1, 2, 3]（加粗 read）

算法：
1. 信息曲线：前 k 个字母把词典（前 10 万个英语词，按词频加权）缩小了多少。
2. 窗口：只在词长的 25% 到 65% 之间选。
3. 拐点：曲线比"首尾连线"高得最多的位置（再多加粗，帮助变小）。
4. 词素吸附：拐点附近 2 个字母内有词素边界（un|happy、run|ning）就对齐过去。
词表里没有的词（人名、术语等）固定加粗 45%。第一次调用会加载词表，约 3 秒。
"""

import math
import os
from functools import lru_cache

LO, HI = 0.25, 0.65  # 加粗词长的 25% 到 65%
FALLBACK = 0.45  # 词表外的词固定加粗 45%
SNAP = 2  # 词素边界离拐点最多差 2 个字母才吸附
MIN_STEM = 3  # 词干至少 3 个字母
PREFIXES = [
    "anti", "auto", "counter", "dis", "en", "em", "extra", "fore", "in", "im",
    "inter", "mid", "mis", "non", "out", "over", "pre", "re", "semi", "sub",
    "super", "trans", "un", "under", "up",
]
SUFFIXES = [
    "able", "ible", "al", "ance", "ence", "ed", "en", "er", "ful",
    "ing", "ion", "tion", "sion", "ation", "ish", "ive", "less", "ly", "ment",
    "ness", "or", "ous", "es", "ity", "ize", "ise",
]


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
        if lemma != w and lemma in vocab
    ]
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
    lo, hi = math.ceil(n * LO), math.floor(n * HI)

    def gap(k):  # 曲线高出"首尾连线"多少
        return cum[k - 1] - (cum[0] + (cum[-1] - cum[0]) * (k - 1) / max(n - 2, 1))

    knee = max(range(lo, hi + 1), key=lambda k: (gap(k), k))  # 窗口内最高点，并列取靠后的

    near = [m for m in _morpheme_boundaries(key, freqs) if lo <= m <= hi and abs(m - knee) <= SNAP]
    if near:
        knee = min(near, key=lambda m: (abs(m - knee), -m))  # 最近的词素边界，距离相同取靠后的
    return list(range(knee))

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