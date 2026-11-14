"""Local API used by the browser extension.

Run:  python app.py   (listens on http://127.0.0.1:5050)
"""
from flask import Flask, jsonify, request
from flask_cors import CORS

from sentence.sentence import SentenceAnalyzer
from bionic.bionic import analyze_paragraphs
from word.word import WordAnalyzer, analyze_word, word as bold_indices

app = Flask(__name__)
analyzer = SentenceAnalyzer()
CORS(app)  # lets the extension popup (chrome-extension:// / moz-extension://) call us

MAX_CHARS = 20000
MAX_PARAGRAPHS = 200
MAX_PARAGRAPH_CHARS = 5000
MAX_WORDS = 200000
LAST_PAGE = {"url": "", "title": "", "count": 0, "words": []}  # most recent page the extension sent


@app.get("/health")
def health():
    return jsonify(ok=True)


@app.post("/sentences")
def sentences():
    text = (request.get_json(silent=True) or {}).get("text", "")
    if not isinstance(text, str) or not text.strip():
        return jsonify(error="text is required"), 400
    result = analyzer.split_sentences(text[:MAX_CHARS])
    return jsonify(sentences=result, count=len(result))


@app.post("/word")
def word():
    w = (request.get_json(silent=True) or {}).get("word", "")
    if not isinstance(w, str) or not w.strip():
        return jsonify(error="word is required"), 400
    info = analyze_word(w[:100])
    if info is None:
        return jsonify(error="no token found"), 400
    return jsonify(info)


@app.post("/bionic")
def bionic():
    """The extension sends the article's paragraphs; we answer which words to bold and how much.

    Request:  {"paragraphs": ["text", ...]}
    Response: {"paragraphs": [[[start, end, rating, bold_len], ...], ...]}  (same order and length)
    """
    paragraphs = (request.get_json(silent=True) or {}).get("paragraphs")
    if not isinstance(paragraphs, list) or not all(isinstance(p, str) for p in paragraphs):
        return jsonify(error="paragraphs must be a list of strings"), 400
    if len(paragraphs) > MAX_PARAGRAPHS:
        return jsonify(error=f"at most {MAX_PARAGRAPHS} paragraphs per request"), 400
    result = analyze_paragraphs([p[:MAX_PARAGRAPH_CHARS] for p in paragraphs], analyzer, bold_indices)
    return jsonify(paragraphs=result)


@app.post("/page")
def receive_page():
    """The extension's "Page words" button sends every word of the current page, in reading order."""
    data = request.get_json(silent=True) or {}
    words = data.get("words")
    if not isinstance(words, list) or not all(isinstance(w, str) for w in words):
        return jsonify(error="words must be a list of strings"), 400
    words = words[:MAX_WORDS]
    LAST_PAGE.update(url=str(data.get("url", ""))[:2000], title=str(data.get("title", ""))[:500],
                     count=len(words), words=words)
    print(f"[page] {len(words)} words from {LAST_PAGE['url']}")
    print("[page] " + " ".join(words[:60]) + (" ..." if len(words) > 60 else ""), flush=True)
    return jsonify(count=len(words))


@app.get("/page")
def last_page():
    """Read back the last page that was sent (handy for other code and for checking)."""
    return jsonify(LAST_PAGE)


if __name__ == "__main__":
    analyzer.warmup()   # load the language model now so the first page isn't slow
    WordAnalyzer()      # load the word list for bold lengths
    app.run(host="127.0.0.1", port=5050)
