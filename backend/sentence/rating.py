"""更准的句子打分（扩展现在用的就是这个）：每个词 0 / 1 / 2，前端按分数决定加粗多重。

    2  分句的主干：主语中心词、谓语动词、宾语、not；系动词句（X is Y）给表语 Y，不给 is
    1  其他实词（名词、专有名词、动词、形容词、副词）
    0  虚词、助动词、系动词、代词主语（It / they）、very/also 这类弱副词、数字

和 sentence.get_sentence_highlight 的区别：
- 主从句的主干都算 2，但只取中心词，修饰语（greedy、optimal）是 1。
- is / was / were 不再加粗；被动句 "was distributed" 只加粗 distributed。
- 名字、机构、日期等实体和复合专名（Anders Hejlsberg）整体同一个分数，不会一半粗一半细。
- 输入里可以有数字（"in July 2000"），spaCy 看到完整的句子才不会把 "in" 当成重点。

输入：items（单词和数字）+ punctuation（[[i, ","]] 第 i 个词后面的标点）。输出：和 items 等长的 0/1/2 数组。
"""
from sentence.roles import SUB_CLAUSE, build_text
from sentence.sentence import SentenceAnalyzer

CONTENT_POS = {"NOUN", "PROPN", "VERB", "ADJ", "ADV"}
WEAK_ADVS = {"very", "really", "so", "too", "quite", "just", "also", "even", "then", "rather",
             "pretty", "still", "now", "here", "there", "only", "first", "later", "not"}
SUBJ = {"nsubj", "nsubjpass"}
OBJ = {"dobj", "obj", "dative", "oprd"}
COMPLEMENT = {"attr", "acomp"}
NAME_ENTS = {"PERSON", "ORG", "GPE", "LOC", "PRODUCT", "EVENT", "WORK_OF_ART", "NORP", "FAC", "LAW", "LANGUAGE", "DATE", "TIME"}


def _clause_level(t):
    """t 是不是一个分句的核心（主句或从句）。"""
    h = t
    while h.dep_ == "conj" and h.head is not h:
        h = h.head
    return h.dep_ == "ROOT" or h.dep_ in SUB_CLAUSE


def _with_conj(token):
    out = [token]
    for c in token.children:
        if c.dep_ == "conj":
            out.extend(_with_conj(c))
    return out


def _core(doc):
    """分句主干的 token 下标集合。"""
    core = set()
    for h in doc:
        if not _clause_level(h):
            continue
        if h.pos_ in {"NOUN", "PROPN"} and h.dep_ == "ROOT":  # 标题、短语："Greedy algorithms"
            core.add(h.i)
            continue
        if h.pos_ not in {"VERB", "AUX"}:
            continue
        complements = [c for c in h.children if c.dep_ in COMPLEMENT]
        if h.pos_ == "AUX" or (h.lemma_ == "be" and complements):  # 系动词：给表语，不给 is
            for c in complements:
                core.update(x.i for x in _with_conj(c))
        else:
            core.add(h.i)
        for c in h.children:
            if c.dep_ in SUBJ or c.dep_ in OBJ:
                for x in _with_conj(c):
                    if x.is_punct or x.pos_ in {"SYM", "PUNCT"}:  # "C#" -> C + #：主语落在 # 上，改给 C
                        core.update(k.i for k in x.children if k.pos_ in {"PROPN", "NOUN"})
                    elif x.pos_ != "PRON":
                        core.add(x.i)
            elif c.dep_ == "neg":
                core.add(c.i)
    return core


def _base(token, core):
    if token.is_punct or token.like_num or token.pos_ == "NUM":
        return 0
    if token.i in core:
        return 2
    if token.pos_ in CONTENT_POS and token.lower_ not in WEAK_ADVS:
        return 1
    return 0


def _name_groups(doc):
    """要整体同分的 token 组：实体（人名、机构、日期……）和复合专名（Anders Hejlsberg）。"""
    groups = [[t.i for t in ent if not t.is_punct] for ent in doc.ents if ent.label_ in NAME_ENTS]
    for t in doc:
        if t.dep_ == "compound" and t.pos_ == "PROPN" and t.head.pos_ == "PROPN":
            groups.append([t.i, t.head.i])
    return groups


def score_doc(doc):
    """{token.i: 0/1/2}"""
    core = _core(doc)
    scores = {t.i: _base(t, core) for t in doc}
    for group in _name_groups(doc):
        # 组里的词（除了 the / a、数字）统一成组里最高的分
        members = [i for i in group if doc[i].pos_ in {"PROPN", "NOUN", "ADJ"}]
        if members:
            top = max(scores[i] for i in members)
            for i in members:
                scores[i] = top
    return scores


def get_sentence_rating(items, punctuation=None, analyzer=None):
    """返回和 items 等长的 0/1/2 数组。"""
    if not items:
        return []
    analyzer = analyzer or SentenceAnalyzer()
    text, starts = build_text(items, punctuation)
    ends = [s + len(w) for s, w in zip(starts, items)]
    doc = analyzer.nlp(text)
    scores = score_doc(doc)

    out = [0] * len(items)
    w = 0
    for token in doc:
        while w < len(items) and token.idx >= ends[w]:
            w += 1
        if w >= len(items):
            break
        if token.idx < starts[w] or token.is_punct:
            continue
        out[w] = max(out[w], scores[token.i])  # "Don't" = Do + n't：取最高

    # 连字符词（open-source、general-purpose）：前后两半同分
    for idx, mark in punctuation or []:
        i = int(idx)
        if str(mark) in {"-", "‐"} and 0 <= i < len(items) - 1 and items[i].isalpha() and items[i + 1].isalpha():
            out[i] = out[i + 1] = max(out[i], out[i + 1])
    return out


if __name__ == "__main__":
    import re

    WORD = re.compile(r"[^\W\d_]+(?:['’][^\W\d_]+)*|\d+(?:[.,]\d+)*")

    def split(s):
        spans = [m.span() for m in WORD.finditer(s)]
        items = [s[a:b] for a, b in spans]
        punctuation = []
        for i, (_, e) in enumerate(spans):
            nxt = spans[i + 1][0] if i + 1 < len(spans) else len(s)
            m = "".join(c for c in s[e:nxt] if not c.isspace())
            if m:
                punctuation.append([i, m])
        return items, punctuation

    a = SentenceAnalyzer()
    a.warmup()
    marks = {0: "{}", 1: "*{}*", 2: "**{}**"}
    for s in [
        "C# is a general-purpose high-level programming language supporting multiple paradigms.",
        "The principal designers of the language were Anders Hejlsberg, Scott Wiltamuth, and Peter Golde from Microsoft.",
        "It was first widely distributed in July 2000 and was later approved as an international standard by Ecma in 2002.",
        "A decade later, Microsoft released Visual Studio Code, Roslyn, and the unified .NET platform, all of which are free and open-source.",
        "It is important to remember that whether a greedy algorithm does, in fact, produce an optimal solution depends on the structure of the problem.",
        "She did not answer the letter.",
    ]:
        items, punctuation = split(s)
        r = get_sentence_rating(items, punctuation, a)
        print(" ".join(marks[x].format(w) for w, x in zip(items, r)))
