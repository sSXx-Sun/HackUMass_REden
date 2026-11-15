"""句子成分标注：给每个单词一个角色，前端只靠加粗/变淡来显示。

角色（和 items 等长的字符串数组）：
    "main"   主句的主语 / 谓语 / 宾语（最粗）
    "sub"    从句的主语 / 谓语 / 宾语（次粗）
    "rare"   低频词，读者可能不认识
    "aside"  插入语：两边是逗号/括号/破折号的修饰成分，或句首的 However, / In fact,（变淡）
    ""       其他，不动
优先级：main > sub > rare > aside，但插入语里的从句主干算 aside（整段插入语一起变淡）。

输入和 /get_sentence_highlight 一样：items（只有单词）+ punctuation（[[i, ","]] 第 i 个词后面的标点）。
"""
from wordfreq import zipf_frequency

from sentence.sentence import SentenceAnalyzer

SUBJ = {"nsubj", "nsubjpass", "csubj", "csubjpass", "expl"}
OBJ = {"dobj", "obj", "attr", "acomp", "oprd", "dative"}
SUB_CLAUSE = {"ccomp", "csubj", "csubjpass", "advcl", "relcl"}  # 从句的核心词
PREDICATE_POS = {"VERB", "AUX"}
ASIDE_DEPS = {"prep", "advmod", "npadvmod", "appos", "parataxis", "relcl", "advcl", "intj", "acl"}
OPENERS = "([{“‘«"
CLOSERS = ")]}”’»"
ASIDE_MARKS = {",", "(", ")", "—", "–", "-", "[", "]"}
RARE_ZIPF = 3.0  # 词频低于这个（每十亿词约 1000 次以下）算生词；intractable≈2.5, greedy≈3.4
PRIORITY = {"main": 4, "sub": 3, "rare": 2, "aside": 1, "": 0}


def build_text(items, punctuation=None):
    """把单词和标点拼回句子，返回 (text, 每个单词的起始位置)。
    和 sentence.build_text 一样，但开括号/开引号放到下一个词前面（"foo (bar)" 而不是 "foo( bar)"），
    这样 spaCy 才能认出括号。"""
    after = {}
    for idx, mark in punctuation or []:
        after[int(idx)] = after.get(int(idx), "") + str(mark)
    parts, starts, pos, pending = [], [], 0, ""
    for i, word in enumerate(items):
        piece = pending + word
        starts.append(pos + len(pending))
        marks = after.get(i, "")
        opening = len(marks) - len(marks.rstrip(OPENERS))
        pending = marks[len(marks) - opening:] if opening else ""
        piece += marks[: len(marks) - opening] + " "
        parts.append(piece)
        pos += len(piece)
    return ("".join(parts) + pending).rstrip(), starts


def _level(head):
    """主句还是从句：沿 conj 往上找，碰到 ROOT 就是主句。"""
    t = head
    while t.dep_ == "conj" and t.head is not t:
        t = t.head
    if t.dep_ == "ROOT":
        return "main"
    if t.dep_ in SUB_CLAUSE:
        return "sub"
    return None


def _with_conj(token):
    """token 加上和它并列的词（Tom and Jerry）。"""
    out = [token]
    for c in token.children:
        if c.dep_ == "conj":
            out.extend(_with_conj(c))
    return out


def _core_tokens(doc):
    """{token.i: "main"/"sub"} 每个分句的谓语、主语、宾语（只取中心词）。"""
    roles = {}
    for head in doc:
        if head.pos_ not in PREDICATE_POS and not (head.pos_ == "ADJ" and head.dep_ in SUB_CLAUSE):
            continue
        level = _level(head)
        if not level:
            continue
        marked = [head]
        has_obj = False
        for c in head.children:
            if c.dep_ in SUBJ and c.pos_ not in PREDICATE_POS:  # csubj 是动词时它自己会作为从句处理
                marked.extend(_with_conj(c))
            elif c.dep_ in OBJ:
                marked.extend(_with_conj(c))
                has_obj = True
            elif c.dep_ == "neg":  # not / never 不能丢
                marked.append(c)
        if not has_obj:  # depends on X / consists of X：紧跟动词的介词，取它的宾语
            for c in head.children:
                if c.dep_ == "prep" and c.i == head.i + 1:
                    marked.extend(p for p in c.children if p.dep_ == "pobj")
        for t in marked:
            if t.is_punct:
                continue
            if PRIORITY[level] > PRIORITY[roles.get(t.i, "")]:
                roles[t.i] = level
    return roles


def _aside_tokens(doc):
    """插入语的 token 下标集合。"""
    out = set()
    for t in doc:
        if t.dep_ not in ASIDE_DEPS:
            continue
        sub = list(t.subtree)
        lo, hi = sub[0].i, sub[-1].i
        before = doc[lo - 1].text if lo > 0 else ""
        after = doc[hi + 1].text if hi + 1 < len(doc) else ""
        enclosed = before in ASIDE_MARKS and after in ASIDE_MARKS
        # 句尾的非限定从句/同位语：", which had arrived on Monday." / ", the capital of France."
        if before == "," and after in {"", ".", "!", "?", ";", ":"} and t.dep_ in {"relcl", "appos"}:
            enclosed = True
        # 句首的连接语：However, / In fact, / For example,
        opener = lo == doc[lo].sent.start and after == "," and hi - lo < 4 and t.dep_ in {"advmod", "prep", "npadvmod", "intj"}
        if enclosed or opener:
            out.update(x.i for x in sub if not x.is_punct)
    return out


def _is_rare(token):
    w = token.text
    if len(w) < 5 or token.pos_ == "PROPN" or not w.isalpha():
        return False
    return zipf_frequency(w.lower(), "en") < RARE_ZIPF


def get_sentence_roles(items, punctuation=None, analyzer=None):
    """返回和 items 等长的角色数组。"""
    if not items:
        return []
    analyzer = analyzer or SentenceAnalyzer()
    text, starts = build_text(items, punctuation)
    ends = [s + len(w) for s, w in zip(starts, items)]
    doc = analyzer.nlp(text)
    core = _core_tokens(doc)
    aside = _aside_tokens(doc)

    roles = [""] * len(items)
    w = 0
    for token in doc:
        while w < len(items) and token.idx >= ends[w]:
            w += 1
        if w >= len(items):
            break
        if token.idx < starts[w] or token.is_punct:
            continue
        if token.i in core and not (core[token.i] == "sub" and token.i in aside):
            role = core[token.i]  # 插入语里的从句主干（", which had arrived,"）跟着整段插入语变淡
        elif _is_rare(token):
            role = "rare"
        elif token.i in aside:
            role = "aside"
        else:
            role = ""
        if PRIORITY[role] > PRIORITY[roles[w]]:
            roles[w] = role
    return roles


if __name__ == "__main__":
    import time

    from sentence.sentence import SentenceAnalyzer as SA

    a = SA()
    t0 = time.perf_counter()
    a.warmup()
    print(f"model: {time.perf_counter() - t0:.1f}s")
    samples = [
        "It is important to remember that whether a greedy algorithm does, in fact, produce an optimal solution depends on the structure of the problem.",
        "However, the results were surprising.",
        "The cat (a very old tabby) slept on the warm windowsill.",
        "Many of these problems are intractable, so we settle for approximations.",
        "She did not answer the letter, which had arrived on Monday.",
    ]
    marks = {"main": "**{}**", "sub": "*{}*", "rare": "_{}_", "aside": "~{}~", "": "{}"}
    import re

    for s in samples:
        items = re.findall(r"[^\W\d_]+(?:'[^\W\d_]+)*", s)
        # 重建 punctuation：每个词后面跟着的非空白非字母字符
        punctuation, pos = [], 0
        spans = [m.span() for m in re.finditer(r"[^\W\d_]+(?:'[^\W\d_]+)*", s)]
        for i, (st, en) in enumerate(spans):
            nxt = spans[i + 1][0] if i + 1 < len(spans) else len(s)
            m = "".join(ch for ch in s[en:nxt] if not ch.isspace())
            if m:
                punctuation.append([i, m])
        t = time.perf_counter()
        roles = get_sentence_roles(items, punctuation, a)
        print(" ".join(marks[r].format(w) for w, r in zip(items, roles)), f"  ({(time.perf_counter() - t) * 1000:.0f} ms)")
