"""Turn page paragraphs into bolding instructions for the browser extension.

For every paragraph the extension sends, we return one entry per highlighted word:
    [start, end, rating, bold_len]
  start, end  character offsets of the word in the paragraph (UTF-16 units, as JavaScript counts them)
  rating      1 or 2 from the sentence analyzer (2 = most important; 0 words are left out)
  bold_len    how many leading letters to bold, from the fixation engine in word/word.py

The pure helpers here (no spaCy, no Flask) are unit tested in tests/test_bionic.py.
"""
import re

# A word = letters (any script), optionally joined by apostrophes (don't, l'été).
WORD = re.compile(r"[^\W\d_]+(?:['’][^\W\d_]+)*")


def locate_words(text: str):
    """Return (items, spans, punctuation) for the sentence analyzer.

    items        the words, in order
    spans        [(start, end)] of each word in `text` (Python code-point offsets)
    punctuation  [[word_index, "marks"]] for punctuation that follows a word
    """
    matches = list(WORD.finditer(text))
    items = [m.group() for m in matches]
    spans = [(m.start(), m.end()) for m in matches]
    punctuation = []
    for i, m in enumerate(matches):
        nxt = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        marks = "".join(ch for ch in text[m.end():nxt] if not ch.isspace() and not ch.isalnum())
        if marks:
            punctuation.append([i, marks])
    return items, spans, punctuation


def utf16_index(text: str):
    """Function turning a code-point offset into a UTF-16 offset (what JavaScript string indexes use)."""
    if all(ord(c) <= 0xFFFF for c in text):
        return lambda i: i
    prefix = [0]
    for c in text:
        prefix.append(prefix[-1] + (2 if ord(c) > 0xFFFF else 1))
    return lambda i: prefix[i]


def build_marks(text: str, items, spans, ratings, bold_fn):
    """Combine ratings and per-word bold lengths into the response entries."""
    to16 = utf16_index(text)
    marks = []
    for word, (s, e), rating in zip(items, spans, ratings):
        if rating not in (1, 2):
            continue
        bold_len = max(1, len(bold_fn(word)))
        marks.append([to16(s), to16(e), int(rating), min(bold_len, len(word))])
    return marks


def analyze_paragraphs(paragraphs, analyzer, bold_fn):
    """paragraphs: list[str] -> list[list[mark]] (same length and order)."""
    out = []
    for text in paragraphs:
        items, spans, punctuation = locate_words(text)
        if not items:
            out.append([])
            continue
        ratings = analyzer.get_sentence_highlight(items, punctuation)
        out.append(build_marks(text, items, spans, ratings, bold_fn))
    return out
