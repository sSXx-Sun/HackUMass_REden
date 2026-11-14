import time
import spacy

# nlp = spacy.load("en_core_web_lg")
nlp = spacy.load("en_core_web_trf")


def split_sentences(text: str) -> list[str]:
    doc = nlp(text)
    return [sent.text.strip() for sent in doc.sents]


# 实词：第二层候选
CONTENT_POS = {"NOUN", "PROPN", "VERB", "ADJ", "NUM", "ADV"}
# 句子骨架：直接挂在核心词下面时算第一层
CORE_DEPS = {"nsubj", "nsubjpass", "dobj", "attr", "acomp"}
# 程度/填充副词，不标
WEAK_ADVS = {"very", "really", "so", "too", "quite", "just", "also", "even",
             "then", "rather", "pretty", "still", "now", "here", "there"}


# 数量类实体（NER），里面的数字、符号、单位都算第一层
NUMERIC_ENTS = {"MONEY", "PERCENT", "QUANTITY", "CARDINAL"}


def is_number_or_unit(token) -> bool:
    if token.pos_ == "NUM":
        return True
    # $ % 等符号，或 kilometers/percent 这类单位名词；about/over/a 这类不算
    if token.ent_type_ in NUMERIC_ENTS and token.pos_ in {"SYM", "NOUN"}:
        return True
    # NER 没识别到时兜底：名词带着数字修饰（5 kilometers）
    return token.pos_ in {"NOUN", "SYM"} and any(c.dep_ == "nummod" for c in token.children)


def token_tier(token) -> int:
    """0 = 不标, 1 = 句子骨架（重点）, 2 = 其他实词（次重点）"""
    if token.dep_ == "neg":
        return 1
    if is_number_or_unit(token):
        return 1
    if token.pos_ not in CONTENT_POS:
        return 0
    if token.pos_ == "ADV" and token.lower_ in WEAK_ADVS:
        return 0
    root = token.sent.root
    if token == root:
        return 1
    if token.dep_ in CORE_DEPS and token.head == root:
        return 1
    if token.dep_ == "dobj":  # 宾语常挂在 buying 这类非核心动词下，也算骨架
        return 1
    return 2


def highlight(text: str) -> list[dict]:
    """返回每个词的层级；text + ws 依次拼接即可还原原文。"""
    doc = nlp(text)
    return [{"text": t.text, "ws": t.whitespace_, "tier": token_tier(t)} for t in doc]


if __name__ == "__main__":
    start = time.perf_counter()
    text = (
        "A great river with wide waves, and the breeze carries the fragrance of rice blossoms across both banks."
    )
    for i, sent in enumerate(split_sentences(text), 1):
        print(i, sent)

    # 终端预览：**第一层**  *第二层*
    marks = {0: "{}", 1: "**{}**", 2: "*{}*"}
    print("".join(marks[t["tier"]].format(t["text"]) + t["ws"] for t in highlight(text)))
    print(f"elapsed: {time.perf_counter() - start:.3f}s")
