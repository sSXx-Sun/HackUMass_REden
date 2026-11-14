"""Local API used by the browser extension.

Run:  python app.py   (listens on http://127.0.0.1:5050)
"""
from flask import Flask, jsonify, request
from flask_cors import CORS

from sentence.sentence import split_sentences
from word.word import analyze_word

app = Flask(__name__)
CORS(app)  # lets the extension popup (chrome-extension:// / moz-extension://) call us

MAX_CHARS = 20000


@app.get("/health")
def health():
    return jsonify(ok=True)


@app.post("/sentences")
def sentences():
    text = (request.get_json(silent=True) or {}).get("text", "")
    if not isinstance(text, str) or not text.strip():
        return jsonify(error="text is required"), 400
    result = split_sentences(text[:MAX_CHARS])
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


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050)
