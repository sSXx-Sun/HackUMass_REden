from flask import Flask, jsonify, request

from sentence.sentence import SentenceAnalyzer
from sentence.roles import get_sentence_roles
from sentence.layout import get_sentence_layout
from sentence.rating import get_sentence_rating
from sentence.depth import get_sentence_depth
from vocab import vocab
from word.word import WordAnalyzer, analyze_word


app = Flask(__name__)
analyzer = SentenceAnalyzer()  # 模型懒加载，第一次请求时才 load，之后复用
word_analyzer = WordAnalyzer()  # 启动时预热一次（约 3~4 秒），之后每个词很快


@app.get("/health")
def health():
    return jsonify(status="ok")


# @app.post("/init_process_paragraph")
# def init_process_paragraph():
#     """We are processing the entire paragraph, return every single sen"""
#     return ""
# Abandoned, because this can be done much easier on the extension side


@app.post("/get_word_highlight")
def get_word_highlight():
    """Single word highlight, return an array of every single index of that word that should be highlighted, starting from 0. For example: hello will return [0,1,2]"""
    # 支持 JSON {"word": "hello"}，也支持直接把单词当请求体发（text/plain）
    data = request.get_json(force=True, silent=True)
    if isinstance(data, dict):
        w = data.get("word", "")
    elif isinstance(data, str):
        w = data
    else:
        w = request.get_data(as_text=True)
    if not isinstance(w, str) or not w.strip():
        return jsonify(error="word is required"), 400

    return jsonify(word_analyzer.bold(w.strip()[:100]))


@app.post("/get_sentence_highlight")
def get_sentence_highlight():
    """
    Return an array of sentence highlight rating from 0 to 2, 0 is no highlight and 2 is highest priority of highlight. The post input should be an array of words in form of array with all special characters removed, like {"items": ["what", "about", "you"]}
    There is another paramter which is {"punctuation": [[2, ","]]}, and insert "," after 2. No matter how many punctuations there are, the index of the word keeps the same, just for helping spaCy analyzation only.
    """
    # print(request.data)
    data = request.get_json(force=True, silent=True) or {}
    items = data.get("items", [])
    punctuation = data.get("punctuation", [])

    return jsonify(analyzer.get_sentence_highlight(items, punctuation))


@app.post("/get_sentence_roles")
def sentence_roles():
    """
    What the extension uses. Same input as /get_sentence_highlight: {"items": ["what", "about", "you"], "punctuation": [[2, "?"]]}
    Returns one role per word: "main" (main clause subject/verb/object), "sub" (subordinate clause subject/verb/object),
    "rare" (uncommon word), "aside" (parenthetical: in commas/brackets/dashes, or a sentence-opening "However,"), or "".
    """
    data = request.get_json(force=True, silent=True) or {}
    items = data.get("items", [])
    punctuation = data.get("punctuation", [])
    if not isinstance(items, list) or not all(isinstance(w, str) for w in items):
        return jsonify(error="items must be a list of strings"), 400
    return jsonify(get_sentence_roles(items[:500], punctuation, analyzer))


@app.post("/get_sentence_layout")
def sentence_layout():
    """
    What the extension uses. Same input as /get_sentence_highlight: {"items": [...words], "punctuation": [[i, ","]]}
    Returns one int per word: -1 = no line break; n >= 0 = start a new line before this word, indented n levels.
    One line per clause, inner clauses indented. Short simple sentences come back as all -1 (left as they are).
    """
    data = request.get_json(force=True, silent=True) or {}
    items = data.get("items", [])
    punctuation = data.get("punctuation", [])
    if not isinstance(items, list) or not all(isinstance(w, str) for w in items):
        return jsonify(error="items must be a list of strings"), 400
    return jsonify(get_sentence_layout(items[:500], punctuation, analyzer))


@app.post("/get_sentence_rating")
def sentence_rating():
    """
    What the extension uses. Same input and output shape as /get_sentence_highlight: {"items": [...], "punctuation": [[i, ","]]} -> [0|1|2, ...]
    but more accurate (sentence/rating.py): 2 only for each clause's subject / verb / object (copula sentences: the complement, not "is"),
    names and dates get one score as a whole, pronoun subjects and auxiliaries get 0. Items may include numbers.
    """
    data = request.get_json(force=True, silent=True) or {}
    items = data.get("items", [])
    punctuation = data.get("punctuation", [])
    if not isinstance(items, list) or not all(isinstance(w, str) for w in items):
        return jsonify(error="items must be a list of strings"), 400
    return jsonify(get_sentence_rating(items[:500], punctuation, analyzer))


@app.post("/get_sentence_depth")
def sentence_depth():
    """
    "Sentence tree" style. Same input as /get_sentence_rating: {"items": [...], "punctuation": [[i, ","]]}
    Returns one int per item: how deep the word is in the spaCy dependency tree (root = 0). The extension makes deeper words lighter.
    """
    data = request.get_json(force=True, silent=True) or {}
    items = data.get("items", [])
    punctuation = data.get("punctuation", [])
    if not isinstance(items, list) or not all(isinstance(w, str) for w in items):
        return jsonify(error="items must be a list of strings"), 400
    return jsonify(get_sentence_depth(items[:500], punctuation, analyzer))


# ---------- vocabulary level + unknown words (vocab/vocab.py, wordfreq) ----------
@app.get("/vocab/info")
def vocab_info():
    """How many words the test runs over (the popup binary-searches [0, total))."""
    return jsonify(total=vocab.total())


@app.get("/vocab/word")
def vocab_word():
    """Quiz word at (or just after) ?index=N in the frequency list: {"index", "word", "zipf"}."""
    try:
        index = int(request.args.get("index", "0"))
    except ValueError:
        return jsonify(error="index must be a number"), 400
    return jsonify(vocab.word_at(index))


@app.get("/vocab/threshold")
def vocab_threshold():
    """The word frequency (zipf) at ?index=N: words rarer than this are probably unknown to the user."""
    try:
        index = int(request.args.get("index", "0"))
    except ValueError:
        return jsonify(error="index must be a number"), 400
    return jsonify(index=index, zipf=vocab.zipf_at(index))


@app.post("/vocab/unknown")
def vocab_unknown():
    """{"words": [...], "zipf": 3.6} -> {"unknown": [true/false per word]} (rarer than the user's level, names and international words skipped)."""
    data = request.get_json(silent=True) or {}
    words = data.get("words")
    if not isinstance(words, list):
        return jsonify(error="words must be a list"), 400
    return jsonify(unknown=vocab.unknown(words[:5000], data.get("zipf", 0)))


@app.post("/translate")
def translate():
    """Placeholder: {"word": "...", "sentence": "...", "to": "zh"} -> {"word", "translation": null}. Not implemented yet."""
    data = request.get_json(silent=True) or {}
    return jsonify(word=str(data.get("word", ""))[:100], translation=None)


# ---------- used by the popup (moved here from the old app.py) ----------
MAX_CHARS = 20000
MAX_WORDS = 200000
LAST_PAGE = {"url": "", "title": "", "count": 0, "words": []}  # most recent page the popup sent


@app.post("/sentences")
def sentences():
    """Read tab, "Split selection into sentences": {"text": "..."} -> {"sentences": [...], "count": n}"""
    text = (request.get_json(silent=True) or {}).get("text", "")
    if not isinstance(text, str) or not text.strip():
        return jsonify(error="text is required"), 400
    result = analyzer.split_sentences(text[:MAX_CHARS])
    return jsonify(sentences=result, count=len(result))


@app.post("/word")
def word_info():
    """Words tab look-up: {"word": "running"} -> {"word", "lemma", "pos", "is_stop", "is_alpha"}"""
    w = (request.get_json(silent=True) or {}).get("word", "")
    if not isinstance(w, str) or not w.strip():
        return jsonify(error="word is required"), 400
    info = analyze_word(w[:100])
    if info is None:
        return jsonify(error="no token found"), 400
    return jsonify(info)


@app.post("/page")
def receive_page():
    """Read tab, "Collect words from this page": {"url", "title", "words": [...]} is stored and printed here."""
    data = request.get_json(silent=True) or {}
    words = data.get("words")
    if not isinstance(words, list) or not all(isinstance(w, str) for w in words):
        return jsonify(error="words must be a list of strings"), 400
    words = words[:MAX_WORDS]
    LAST_PAGE.update(url=str(data.get("url", ""))[:2000], title=str(data.get("title", ""))[:500], count=len(words), words=words)
    print(f"[page] {len(words)} words from {LAST_PAGE['url']}")
    print("[page] " + " ".join(words[:60]) + (" ..." if len(words) > 60 else ""), flush=True)
    return jsonify(count=len(words))


@app.get("/page")
def last_page():
    """Read back the last page the popup sent."""
    return jsonify(LAST_PAGE)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
