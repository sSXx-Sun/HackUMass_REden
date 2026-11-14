import threading
import time

import spacy
from spacy.language import Language


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


def build_text(items: list[str], punctuation: list[list] | None = None) -> tuple[str, list[int]]:
    """把单词和标点拼成句子，返回 (text, 每个单词在 text 中的起始字符位置)。
    punctuation 形如 [[2, ","]]：在第 2 个词后面插入 ","，不影响单词下标。"""
    puncs: dict[int, str] = {}
    for idx, mark in punctuation or []:
        puncs[int(idx)] = puncs.get(int(idx), "") + mark

    parts: list[str] = []
    starts: list[int] = []
    pos = 0
    for i, word in enumerate(items):
        starts.append(pos)
        piece = word + puncs.get(i, "") + " "
        parts.append(piece)
        pos += len(piece)
    return "".join(parts).rstrip(), starts


# token_tier: 1 = 骨架, 2 = 次重点；接口约定 2 = 最高优先级，所以要翻转
TIER_TO_RATING = {0: 0, 1: 2, 2: 1}


class SentenceAnalyzer:
    """封装 spaCy 模型。模型按名字缓存在类上，同一进程里不管 new 多少个实例都只加载一次；
    并且是懒加载：第一次真正用到时才 load（Flask debug 的 reloader 父进程不会白加载一遍）。"""

    _models: dict[str, Language] = {}
    _lock = threading.Lock()

    def __init__(self, model_name: str = "en_core_web_trf"):
        self.model_name = model_name

    @property
    def nlp(self) -> Language:
        model = SentenceAnalyzer._models.get(self.model_name)
        if model is None:
            with SentenceAnalyzer._lock:  # 防止多个请求同时触发加载
                model = SentenceAnalyzer._models.get(self.model_name)
                if model is None:
                    model = spacy.load(self.model_name)
                    SentenceAnalyzer._models[self.model_name] = model
        return model

    def warmup(self) -> None:
        """提前加载模型，避免第一个请求很慢。"""
        _ = self.nlp

    def split_sentences(self, text: str) -> list[str]:
        doc = self.nlp(text)
        return [sent.text.strip() for sent in doc.sents]

    def get_sentence_highlight(self, items: list[str], punctuation: list[list] | None = None) -> list[int]:
        """返回和 items 等长的数组，每个元素 0~2：0 不标，2 最高优先级。"""
        if not items:
            return []
        text, starts = build_text(items, punctuation)
        ends = [s + len(w) for s, w in zip(starts, items)]
        doc = self.nlp(text)

        ratings = [0] * len(items)
        w = 0
        for token in doc:
            # 找到 token 所在的单词（标点 token 落在单词范围外，自动跳过）
            while w < len(items) and token.idx >= ends[w]:
                w += 1
            if w >= len(items):
                break
            if token.idx < starts[w]:
                continue
            # 一个词可能被拆成多个 token（如 "cannot"），取最高分
            ratings[w] = max(ratings[w], TIER_TO_RATING[token_tier(token)])
        return ratings


if __name__ == "__main__":
    start = time.perf_counter()
    analyzer = SentenceAnalyzer()
    items = ["A", "great", "river", "with", "wide", "waves", "and", "the", "breeze", "carries",
             "the", "fragrance", "of", "rice", "blossoms", "across", "both", "banks"]
    punctuation = [[5, ","], [17, "."]]

    ratings = analyzer.get_sentence_highlight(items, punctuation)
    print(ratings)

    # 终端预览：**2 最高**  *1 次重点*
    marks = {0: "{}", 1: "*{}*", 2: "**{}**"}
    print(" ".join(marks[r].format(word) for word, r in zip(items, ratings)))

    # 第二个实例共用同一个模型，不会重新加载
    assert SentenceAnalyzer().nlp is analyzer.nlp
    print(f"elapsed: {time.perf_counter() - start:.3f}s")
