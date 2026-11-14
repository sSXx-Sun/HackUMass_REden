"""WordAnalyzer 用法示例（给写 server 的人看）。

运行（在 backend 目录下）：
    python -m word.demo

要点：
1. WordAnalyzer() 在进程启动时创建一次，创建时会预热（约 3~4 秒），之后每次调用都很快。
2. 请求里只调用 analyzer.bold(word)，不要在请求里 new WordAnalyzer()。
3. 返回的是"要加粗的字母下标列表"，从 0 开始：bold("reading") -> [0, 1, 2, 3]（加粗 read）。
"""

import time

from word.word import WordAnalyzer

# ---- 1. 启动时创建一次（模块级变量），Flask 里就放在 app.py 顶部 ----
t0 = time.perf_counter()
analyzer = WordAnalyzer()
print(f"预热耗时: {time.perf_counter() - t0:.2f}s（只在启动时付一次）\n")


# ---- 2. 之后每次请求直接调用，不会冷启动 ----
def bold_html(w: str) -> str:
    """把一个单词变成 <b>前半</b>后半，演示怎么用返回的下标。"""
    idx = analyzer.bold(w)
    k = len(idx)  # 下标是 0..k-1，所以长度就是加粗的字母数
    return f"<b>{w[:k]}</b>{w[k:]}"


for w in ["reading", "unhappy", "running", "children", "a", "Zxqvt"]:
    t = time.perf_counter()
    result = analyzer.bold(w)
    ms = (time.perf_counter() - t) * 1000
    print(f"{w:10} -> {result!s:22} {bold_html(w):28} {ms:.2f} ms")

# ---- 3. 在 Flask 里的写法（示意，不会在这里运行）----
#
#   from word.word import WordAnalyzer
#   analyzer = WordAnalyzer()            # app.py 顶部，启动时预热
#
#   @app.post("/bold")
#   def bold():
#       w = (request.get_json(silent=True) or {}).get("word", "")
#       if not isinstance(w, str) or not w.strip():
#           return jsonify(error="word is required"), 400
#       return jsonify(word=w, bold=analyzer.bold(w.strip()[:100]))
