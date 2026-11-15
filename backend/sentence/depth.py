"""句子树深度：每个词在 spaCy 依存树里离根有多远（根 = 0）。扩展的 "Sentence tree" 模式用它：越深的词越浅。

输入和 /get_sentence_rating 一样：items（单词和数字）+ punctuation（[[i, ","]]）。
输出：和 items 等长的整数数组。一个词被拆成多个 token（"Don't" = Do + n't）时取最浅的那个。
"""
from sentence.roles import build_text
from sentence.sentence import SentenceAnalyzer


def token_depth(token):
    d = 0
    while token.head.i != token.i and d < 100:  # 根的 head 是它自己（spaCy 每次返回新对象，所以比下标，不能用 is）
        token = token.head
        d += 1
    return d


def get_sentence_depth(items, punctuation=None, analyzer=None):
    if not items:
        return []
    analyzer = analyzer or SentenceAnalyzer()
    text, starts = build_text(items, punctuation)
    ends = [s + len(w) for s, w in zip(starts, items)]
    doc = analyzer.nlp(text)

    out = [None] * len(items)
    w = 0
    for token in doc:
        while w < len(items) and token.idx >= ends[w]:
            w += 1
        if w >= len(items):
            break
        if token.idx < starts[w] or token.is_punct:
            continue
        d = token_depth(token)
        out[w] = d if out[w] is None else min(out[w], d)
    # 极少数没对上 token 的词：跟前一个词一样深
    last = 0
    for i, d in enumerate(out):
        if d is None:
            out[i] = last
        last = out[i]
    return out


if __name__ == "__main__":
    import re

    WORD = re.compile(r"[^\W\d_]+(?:['’][^\W\d_]+)*|\d+(?:[.,]\d+)*")
    a = SentenceAnalyzer()
    a.warmup()
    for s in [
        "It is important to remember that whether a greedy algorithm does, in fact, produce an optimal solution depends on the structure of the problem.",
        "It was first widely distributed in July 2000 and was later approved as an international standard by Ecma in 2002.",
        "She did not answer the letter.",
    ]:
        spans = [m.span() for m in WORD.finditer(s)]
        items = [s[x:y] for x, y in spans]
        depths = get_sentence_depth(items, None, a)
        print(" ".join(f"{w}/{d}" for w, d in zip(items, depths)))
