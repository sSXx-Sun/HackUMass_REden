"""词汇量测试 + 生词判断（wordfreq）。

词表：wordfreq 英语前 10 万词里只含字母、3~15 个字母的词，按词频从高到低排（约 9.3 万个）。
测试：扩展在 [0, total) 上二分查找。问"认识 word_at(mid) 吗？"，认识 → 往更难的方向（lo = mid），不认识 → 往简单的方向（hi = mid）。
      问 10 次后范围缩到约 total / 1024 ≈ 90 个词，阈值 = 那一位置的词频（zipf）。
生词：zipf_frequency(word) < 阈值 → 用户大概率不认识 → 需要翻译。
"""
import random
from functools import lru_cache

from wordfreq import top_n_list, zipf_frequency

OTHER_LANGS = ("fr", "de", "es", "it", "pt", "nl", "pl", "sv")
# 人名（pelosi、obama）和国际词（internet、hotel）在很多语言里都和英语差不多常见；普通英语词（parlour、fathom）几乎不会。
# 至少 INTERNATIONAL_LANGS 种语言的词频不低于英语 - 1.2，就当作人名/国际词：不出题，也不标成生词。
INTERNATIONAL_LANGS = 4
SEARCH_WINDOW = 60  # 随机范围里没有合适的词时，从 index 往后最多找这么多个词
JITTER = 15         # 出题位置在二分查找的中点上下随机浮动这么多个词，每次测试的题不一样


@lru_cache(maxsize=1)
def word_list():
    words = [w for w in top_n_list("en", 100_000) if w.isascii() and w.isalpha() and 3 <= len(w) <= 15]
    return words


@lru_cache(maxsize=1)
def _word_set():
    return set(word_list())


@lru_cache(maxsize=50_000)
def is_international(w):
    """人名、外语词、国际词：在很多其他语言里也一样常见。"""
    en = zipf_frequency(w, "en")
    close = sum(1 for lang in OTHER_LANGS if zipf_frequency(w, lang) >= en - 1.2)
    return close >= INTERNATIONAL_LANGS or any(zipf_frequency(w, lang) > en for lang in OTHER_LANGS[:4])


def _is_quiz_word(w):
    """适合出题：不是人名/外语词/国际词，也不是另一个词的变形（pandemics、dictating、noticed）。"""
    if is_international(w):
        return False
    if not any(c in "aeiouy" for c in w):  # abbreviations: hrs, mph, pls
        return False
    s = _word_set()
    for suffix, back in (("s", ""), ("es", ""), ("ies", "y"), ("ed", ""), ("ed", "e"), ("ied", "y"), ("ing", ""), ("ing", "e"), ("ly", "")):
        if w.endswith(suffix) and len(w) - len(suffix) >= 3 and (w[: -len(suffix)] + back) in s:
            return False
    for suffix in ("ed", "ing"):  # rubbed -> rub, running -> run
        stem = w[: -len(suffix)]
        if w.endswith(suffix) and len(stem) >= 4 and stem[-1] == stem[-2] and stem[:-1] in s:
            return False
    return True


def total():
    return len(word_list())


def word_at(index, lo=None, hi=None, jitter=JITTER, rng=random):
    """出题用：在 index 上下 jitter 个词的范围里随机挑一个适合出题的词。返回 {index, word, zipf}。
    lo / hi = 扩展当前的二分查找范围（开区间），随机位置不会跑出这个范围，否则这一题就白问了。
    范围里一个合适的词都没有时，退回到从 index 往后找第一个。"""
    words = word_list()
    n = len(words)
    i = min(max(0, int(index)), n - 1)
    a = max(0, i - jitter, int(lo) + 1 if lo is not None else 0)
    b = min(n - 1, i + jitter, int(hi) - 1 if hi is not None else n - 1)
    candidates = [j for j in range(a, b + 1) if _is_quiz_word(words[j])] if a <= b else []
    if candidates:
        j = rng.choice(candidates)
        return {"index": j, "word": words[j], "zipf": zipf_frequency(words[j], "en")}
    for j in range(i, min(n, i + SEARCH_WINDOW)):
        if _is_quiz_word(words[j]):
            return {"index": j, "word": words[j], "zipf": zipf_frequency(words[j], "en")}
    return {"index": i, "word": words[i], "zipf": zipf_frequency(words[i], "en")}


def zipf_at(index):
    words = word_list()
    i = min(max(0, int(index)), len(words) - 1)
    return zipf_frequency(words[i], "en")


def unknown(words, threshold):
    """每个词是否比阈值更罕见（= 用户大概率不认识）。threshold <= 0 表示还没测过：全部 False。"""
    t = float(threshold or 0)
    out = []
    for w in words:
        w = str(w)
        lw = w.lower()
        out.append(bool(t > 0 and w.isalpha() and len(w) >= 3 and zipf_frequency(lw, "en") < t and not is_international(lw)))
    return out
