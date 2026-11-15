"""长句排版：只用断行和缩进显示句子结构（类似 VSTF / Live Ink）。

输入和 /get_sentence_highlight 一样：items（只有单词）+ punctuation（[[i, ","]]）。
输出：和 items 等长的整数数组。-1 = 不换行；n >= 0 = 在这个词前面换行，缩进 n 级。
8 个词以内的句子（少于 MIN_SENTENCE_WORDS）全部是 -1，保持原样。

做法：
1. 每个词归属到它所在的分句（沿依存树往上找到最近的分句核心：ROOT、从句动词、并列动词）。
2. 连续属于同一分句的词是一行；缩进 = 分句的嵌套深度。从句结束后，主句剩下的部分回到原来的缩进，
   所以 "whether ... solution / depends on ..." 会把很长的主语从句和谓语分开。
3. 太短的行（<= 2 个词，例如 "that"、"to remember"）并到上一行；太长的行（> MAX_LINE_WORDS）在逗号或介词短语处再切。
"""
from sentence.roles import build_text
from sentence.sentence import SentenceAnalyzer

MIN_SENTENCE_WORDS = 9  # 句子要多于 8 个词才分行（用户要求）
MAX_LINE_WORDS = 15    # 一行最多这么多词，超过就在逗号/介词处再切（不切开并列的名词）
MIN_LINE_WORDS = 3     # 少于这么多词的行并到上一行

CLAUSE_DEPS = {"ccomp", "csubj", "csubjpass", "advcl", "relcl", "xcomp", "acl", "parataxis"}
PREDICATE_POS = {"VERB", "AUX"}
SPLIT_DEPS = {"prep", "agent", "cc", "mark"}


def _is_clause_head(t):
    if t.dep_ == "ROOT":
        return True
    if t.pos_ not in PREDICATE_POS:
        return False
    if t.dep_ in CLAUSE_DEPS:
        return True
    return t.dep_ == "conj" and _is_clause_head(t.head)  # 并列的分句：X happened, and Y happened


def _owner(t):
    while not _is_clause_head(t):
        t = t.head
    return t


def _depth(head, memo):
    if head.i in memo:
        return memo[head.i]
    if head.dep_ == "ROOT" or head.head is head:
        d = 0
    else:
        d = _depth(_owner(head.head), memo) + (0 if head.dep_ == "conj" else 1)
    memo[head.i] = d
    return d


def _split_long(seg, word_tok, punct_after):
    """把超过 MAX_LINE_WORDS 的一行在逗号或介词短语处切开（同样的缩进）。"""
    start, end, depth = seg
    if end - start <= MAX_LINE_WORDS:
        return [seg]
    best, best_score = None, None
    mid = (start + end) / 2
    for p in range(start + MIN_LINE_WORDS, end - MIN_LINE_WORDS + 1):
        t = word_tok[p]
        if t is None:
            continue
        in_list = t.dep_ in {"conj", "cc"} and t.head.pos_ not in PREDICATE_POS  # A, B, and C / compiler and runtime
        if in_list:
            continue
        if any(m in punct_after.get(p - 1, "") for m in ",;:"):
            score = abs(p - mid)  # 逗号优先
        elif t.dep_ in SPLIT_DEPS:
            score = abs(p - mid) + (end - start)  # 介词/连词其次
        else:
            continue
        if best_score is None or score < best_score:
            best, best_score = p, score
    if best is None:
        return [seg]
    return _split_long((start, best, depth), word_tok, punct_after) + _split_long((best, end, depth), word_tok, punct_after)


def get_sentence_layout(items, punctuation=None, analyzer=None):
    n = len(items)
    if not n:
        return []
    analyzer = analyzer or SentenceAnalyzer()
    text, starts = build_text(items, punctuation)
    ends = [s + len(w) for s, w in zip(starts, items)]
    doc = analyzer.nlp(text)

    # 每个词对应的第一个 token
    word_tok = [None] * n
    w = 0
    for token in doc:
        while w < n and token.idx >= ends[w]:
            w += 1
        if w >= n:
            break
        if token.idx >= starts[w] and word_tok[w] is None and not token.is_punct:
            word_tok[w] = token

    memo = {}
    owners, depths = [], []
    for i in range(n):
        t = word_tok[i]
        if t is None:  # 罕见：没对上 token，跟着前一个词
            owners.append(owners[-1] if owners else None)
            depths.append(depths[-1] if depths else 0)
            continue
        h = _owner(t)
        owners.append(h.i)
        depths.append(_depth(h, memo))

    if n < MIN_SENTENCE_WORDS:
        return [-1] * n

    # 1. 连续属于同一分句的词 = 一行
    segs = []
    for i in range(n):
        if i == 0 or owners[i] != owners[i - 1]:
            segs.append([i, i + 1, depths[i]])
        else:
            segs[-1][1] = i + 1

    # 2. 太短的行并到上一行（第一行太短就并到下一行，用下一行的缩进）
    # 但回到外层分句的短行（"began,"、"the city"）不能并进更深的上一行，否则主句动词会被缩进
    merged = []
    for s in segs:
        if merged and s[1] - s[0] < MIN_LINE_WORDS and s[2] >= merged[-1][2]:
            merged[-1][1] = s[1]
        elif merged and merged[-1][1] - merged[-1][0] < MIN_LINE_WORDS and len(merged) == 1:
            merged[-1] = [merged[-1][0], s[1], s[2]]
        else:
            merged.append(list(s))

    # 3. 行尾的 and / but / or 挪到下一行开头
    for a, b in zip(merged, merged[1:]):
        last = word_tok[a[1] - 1]
        if a[1] - a[0] > 1 and last is not None and last.dep_ == "cc":
            a[1] -= 1
            b[0] -= 1

    # 4. 太长的行再切
    punct_after = {}
    for idx, mark in punctuation or []:
        punct_after[int(idx)] = punct_after.get(int(idx), "") + str(mark)
    lines = []
    for s in merged:
        lines.extend(_split_long(tuple(s), word_tok, punct_after))
    if len(lines) < 2:
        return [-1] * n

    # 5. 深度 -> 缩进：用栈压缩成连续的级数（从句结束后回到外层的缩进）
    out = [-1] * n
    stack = [0]
    for start, _, d in lines:
        while len(stack) > 1 and stack[-1] > d:
            stack.pop()
        if stack[-1] < d:
            stack.append(d)
        out[start] = len(stack) - 1
    return out


def render(items, layout, punctuation=None):
    """终端预览：按 layout 把句子排成多行。"""
    after = {}
    for idx, mark in punctuation or []:
        after[int(idx)] = after.get(int(idx), "") + str(mark)
    lines, cur = [], ""
    for i, w in enumerate(items):
        if layout[i] >= 0 and cur:
            lines.append(cur.rstrip())
            cur = ""
        if layout[i] >= 0:
            cur = "    " * layout[i]
        cur += w + after.get(i, "") + " "
    lines.append(cur.rstrip())
    return "\n".join(lines)


if __name__ == "__main__":
    import re
    import time

    WORD = re.compile(r"[^\W\d_]+(?:['’][^\W\d_]+)*")

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
    samples = [
        "It is important to remember that whether a greedy algorithm does, in fact, produce an optimal solution depends on the structure of the problem.",
        "The principal inventors of the C# programming language were Anders Hejlsberg, Scott Wiltamuth, and Peter Golde from Microsoft.",
        "It was first widely distributed in July 2000 and was later approved as an international standard by Ecma in 2002 and ISO in 2003.",
        "Four years later, in 2004, a free and open-source project called Microsoft Mono began, providing a cross-platform compiler and runtime environment for the C# programming language.",
        "A decade later, Microsoft released Visual Studio Code, Roslyn, and the unified .NET platform, all of which support C# and are free, open-source, and cross-platform.",
        "When the war ended, the city that had been destroyed was rebuilt by the people who had stayed, although many of them had lost everything.",
        "She did not answer the letter, which had arrived on Monday.",
    ]
    for s in samples:
        items, punctuation = split(s)
        t = time.perf_counter()
        layout = get_sentence_layout(items, punctuation, a)
        ms = (time.perf_counter() - t) * 1000
        print(render(items, layout, punctuation), f"\n   [{len(items)} words, {ms:.0f} ms]\n")
