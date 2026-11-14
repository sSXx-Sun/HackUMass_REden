from flask import Flask, jsonify

app = Flask(__name__)


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
    """Single word highlight, return an array of every single index of that word that should be highlighted"""

@app.post("/get_sentence_highlight")
def get_sentence_highlight():
    """Return an array of sentence highlight rating from 0 to 2, 0 is no highlight and 2 is highest priority of highlight. The post input should be an array of words"""

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
