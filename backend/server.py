from flask import Flask, jsonify, request

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
    """
    Return an array of sentence highlight rating from 0 to 2, 0 is no highlight and 2 is highest priority of highlight. The post input should be an array of words in form of array with all special characters removed, like {"items": ["what", "about", "you"]}
    There is another paramter which is {"punctuation": [[2, ","]]}, and insert "," after 2. No matter how many punctuations there are, the index of the word keeps the same, just for helping spaCy analyzation only.
    """
    # print(request.data)
    data = request.get_json(force=True, silent=True) or {}
    items = data.get("items", [])
    punctuation = data.get("punctuation", [])

    print(items)
    print(punctuation)


    merged_sentence : str = ""
    for i in range(0, len(items)):
        merged_sentence += items[i] + " "
        for single_pun in punctuation: # it's very short here, please don't do shitty leetcode algorithm for O(1) effciency.
            if(single_pun[0] == i):
                merged_sentence += single_pun[1]
                break # let's assume there is only 1 pun

    print(merged_sentence)
    
    return jsonify(finished="true")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
