"""Explainable Adaptive Fixation Engine.

For each word, choose how many leading letters to emphasise (``bold_end``):
对每个单词，决定加粗前几个字母（bold_end）：

1. information curve - cum(k) = -log2 P(prefix): how much of the lexical search
                       space the first k letters have already removed.
   信息曲线：前 k 个字母已经把词典缩小了多少。
2. window            - only consider k in [ceil(LO*n), floor(HI*n)].
   窗口：只在词长的 25% 到 65% 之间选，避免只加粗一个字母或几乎整个词。
3. knee              - pick the k where the curve is furthest above the chord
                       joining its two ends: the point after which extra bold
                       letters stop helping identify the word much.
   拐点：曲线高出两端连线最多的位置，即再多加粗字母帮助不大的点。
4. morphemes         - snap the knee to a morpheme boundary if one is within
                       SNAP_WINDOW letters (inside the window); else keep it.
   词素吸附：拐点附近（2 个字母内）有词素边界就对齐过去，否则保持不变。

Unlike fixed-fraction bolding, the position follows each word's own
uniqueness profile. The result is a plain dict carrying the full explanation
so a UI can show *why* a boundary was chosen.
和固定比例不同，加粗位置跟随每个词自己的"唯一性"变化；返回值带完整解释，前端可以展示原因。

Honest scope: a hand-tuned heuristic, not validated to improve reading speed.
说明：这是手工调参的启发式，没有证明能提高阅读速度。
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from functools import lru_cache

from word import morphemes

# 单词 = 连续的字母（含 café 这类带重音的字母，不含数字和下划线）。
WORD = re.compile(r"[^\W\d_]+")
# 缩写的尾巴（don't 里的 t，it's 里的 s）：不当作独立单词，保持原样。
CLITICS = {"s", "t", "d", "m", "ll", "re", "ve"}

VOCAB_SIZE = 100_000  # 词表大小：wordfreq 前 10 万个英语词
WINDOW_LO = 0.25  # 最少加粗词长的 25%
WINDOW_HI = 0.65  # 最多加粗词长的 65%
FALLBACK_RATIO = 0.45  # 没有词频数据的词，固定加粗 45%
SNAP_WINDOW = 2  # 词素边界离拐点最多差 2 个字母才吸附，更远的忽略


class LexicalIndex:
    """
    前缀表：对每个前缀，记录以它开头的词的频率总和（mass）和词数（count）
    """

    def __init__(self, freqs: dict[str, float]):
        self.freqs = freqs  # {词: 频率}，同时也是"词表"，词素模块用它判断词干是不是词
        self.mass: dict[str, float] = {}
        self.count: dict[str, int] = {}
        for word, f in freqs.items():
            for k in range(1, len(word) + 1):
                p = word[:k]
                self.mass[p] = self.mass.get(p, 0.0) + f
                self.count[p] = self.count.get(p, 0) + 1

    @classmethod
    def from_wordfreq(cls, n: int = VOCAB_SIZE, lang: str = "en") -> "LexicalIndex":
        from wordfreq import top_n_list, word_frequency

        freqs = {}
        for w in top_n_list(lang, n):
            if w.isascii() and w.isalpha():  # 只保留纯 a-z 的词
                freqs[w] = word_frequency(w, lang)
        return cls(freqs)


def window(n: int) -> tuple[int, int]:
    """
    n 个字母的词允许加粗的长度范围。当前常数保证 1 <= lo <= hi <= n-1（测试里检查）
    """
    return math.ceil(n * WINDOW_LO), math.floor(n * WINDOW_HI)


@dataclass
class FixationEngine:
    index: LexicalIndex

    def analyze(self, word: str, snap_morphemes: bool = True) -> dict:
        """
        分析一个词，返回加粗位置和完整解释
        """
        n, key = len(word), word.lower()
        # 单个字母或词表里没有的词（人名、术语、带重音的词等）：没有频率可用，走回退。
        # 词表只含 a-z 的词，所以数字、符号、带重音的词也会落到这里。
        if n < 2 or key not in self.index.freqs:
            return self._fallback(word)
        lo, hi = window(n)

        # 第 1 步：信息曲线。cum[k-1] = -log2 P(前缀)，越大说明候选词被缩得越小。
        # wordfreq 的频率本身就是概率，不用再归一化；常数偏移会在"减弦"时抵消。
        cum = [-math.log2(self.index.mass[key[:k]]) for k in range(1, n)]

        # 第 2 步：曲线高出弦的距离。弦是 (1, cum[0]) 到 (n-1, cum[-1]) 的直线。
        gap = [
            cum[k - 1] - (cum[0] + (cum[-1] - cum[0]) * (k - 1) / max(n - 2, 1))
            for k in range(1, n)
        ]

        # 第 3 步：窗口内取 gap 最大的位置（并列时取靠后的），这就是拐点。
        knee = max(range(lo, hi + 1), key=lambda k: (gap[k - 1], k))

        # 第 4 步：词素吸附。窗口内、离拐点不超过 SNAP_WINDOW 的词素边界，
        # 取最近的一个（距离相同取靠后的）；没有就保持拐点。
        morphs = morphemes.boundaries(word, self.index.freqs)
        k, rule = knee, "knee"
        if snap_morphemes:
            near = [m for m in morphs if lo <= m <= hi and abs(m - knee) <= SNAP_WINDOW]
            if near:
                k = min(near, key=lambda m: (abs(m - knee), -m))
                rule = "morpheme"

        # 解释面板
        steps = [
            {
                "k": j,
                "prefix": word[:j],
                "candidates": self.index.count[key[:j]],  # 该前缀还剩多少个候选词
                "cum_bits": round(cum[j - 1], 3),
                "gap": round(gap[j - 1], 3),
                "in_window": lo <= j <= hi,
            }
            for j in range(1, n)
        ]
        reason = (
            f"Within the allowed window ({lo}-{hi} letters), '{word[:knee]}' is where "
            f"the information curve bends most: it leaves "
            f"{self.index.count[key[:knee]]} candidate word(s), and extra "
            f"bold letters help identify the word less after that."
        )
        if rule == "morpheme":
            reason += f" Snapped to the nearby morpheme boundary '{word[:k]}'."
        return {
            "word": word,
            "bold_end": k,  # 加粗 word[:k]
            "bold": word[:k],
            "regular": word[k:],
            "rule": rule,  # knee / morpheme / fallback
            "signals": {
                "knee_end": knee,
                "window": [lo, hi],
                "ratio": round(k / n, 3),
                "cum_bits": round(cum[k - 1], 3),
                "morpheme_boundaries": morphs,
            },
            "steps": steps,
            "reason": reason,
        }

    def analyze_text(self, text: str, snap_morphemes: bool = True) -> list[dict]:
        """
        切成"单词"和"非单词片段"；非单词片段原样返回，拼起来就是原文。
        """
        out, pos = [], 0
        for m in WORD.finditer(text):
            # don't / it's 里的 t、s 等缩写尾巴不单独分析，留在间隔文本里。
            is_clitic = (
                m.group().lower() in CLITICS
                and m.start() >= 2
                and text[m.start() - 1] in "'’"
                and text[m.start() - 2].isalpha()
            )
            if is_clitic:
                continue
            if m.start() > pos:
                out.append({"text": text[pos : m.start()], "is_word": False})
            out.append({"is_word": True, **self.analyze(m.group(), snap_morphemes)})
            pos = m.end()
        if pos < len(text):
            out.append({"text": text[pos:], "is_word": False})
        return out

    def _fallback(self, word: str) -> dict:
        """
        没有词频数据：单个字母整个加粗，其余按固定比例（约 45%）。
        """
        n = len(word)
        k = n if n < 2 else round(n * FALLBACK_RATIO)
        return {
            "word": word,
            "bold_end": k,
            "bold": word[:k],
            "regular": word[k:],
            "rule": "fallback",
            "signals": {},
            "steps": [],
            "reason": (
                f"No frequency data for '{word}' (single letter or not in the "
                f"vocabulary): emphasise ~{FALLBACK_RATIO:.0%} of it."
            ),
        }


@lru_cache(maxsize=1)
def get_engine() -> FixationEngine:
    """全局唯一的引擎（第一次调用时建词表，约 2 秒）。"""
    return FixationEngine(LexicalIndex.from_wordfreq())


def warm_up() -> FixationEngine:
    """
    服务启动时调用一次：建好词表并加载词形还原器，之后每个词约 0.3 毫秒。
    """
    morphemes.warm_up()
    return get_engine()
