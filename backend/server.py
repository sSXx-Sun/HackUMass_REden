from flask import Flask, jsonify, request

from sentence.sentence import SentenceAnalyzer
from word.word import WordAnalyzer


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


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
