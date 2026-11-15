"""词汇量测试 + 生词判断（wordfreq）。

词表：wordfreq 英语前 10 万词里只含字母、3~15 个字母的词，按词频从高到低排（约 9.3 万个）。
测试：扩展在 [0, total) 上二分查找。问"认识 word_at(mid) 吗？"，认识 → 往更难的方向（lo = mid），不认识 → 往简单的方向（hi = mid）。
      问 10 次后范围缩到约 total / 1024 ≈ 90 个词，阈值 = 那一位置的词频（zipf）。
生词：zipf_frequency(word) < 阈值 → 用户大概率不认识 → 需要翻译。
"""
from functools import lru_cache

from wordfreq import top_n_list, zipf_frequency

OTHER_LANGS = ("fr", "de", "es", "it", "pt", "nl", "pl", "sv")
# 人名（pelosi、obama）和国际词（internet、hotel）在很多语言里都和英语差不多常见；普通英语词（parlour、fathom）几乎不会。
# 至少 INTERNATIONAL_LANGS 种语言的词频不低于英语 - 1.2，就当作人名/国际词：不出题，也不标成生词。
INTERNATIONAL_LANGS = 4
SEARCH_WINDOW = 60  # 从 index 往后最多找这么多个词，挑一个适合出题的


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


def word_at(index):
    """出题用：index 附近（往后找）第一个适合出题的词。返回 {index, word, zipf}。"""
    words = word_list()
    i = min(max(0, int(index)), len(words) - 1)
    for j in range(i, min(len(words), i + SEARCH_WINDOW)):
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
