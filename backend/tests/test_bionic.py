"""Run from the backend folder:  python -m unittest tests.test_bionic   (needs no spaCy or Flask)."""
import unittest

from bionic.bionic import analyze_paragraphs, build_marks, locate_words, utf16_index


class FakeAnalyzer:
    """Rates words by length so the tests don't need a language model."""

    def get_sentence_highlight(self, items, punctuation=None):
        return [2 if len(w) > 6 else 1 if len(w) > 3 else 0 for w in items]


def bold_half(word):
    return list(range(max(1, len(word) // 2)))


class LocateWords(unittest.TestCase):
    def test_words_spans_and_punctuation(self):
        items, spans, punct = locate_words("Hello, world! Don't stop.")
        self.assertEqual(items, ["Hello", "world", "Don't", "stop"])
        self.assertEqual(spans[0], (0, 5))
        self.assertEqual(punct, [[0, ","], [1, "!"], [3, "."]])

    def test_numbers_and_symbols_are_not_words(self):
        items, _, _ = locate_words("mp3 2024 $5 --")
        self.assertEqual(items, ["mp"])

    def test_empty(self):
        self.assertEqual(locate_words(""), ([], [], []))


class Utf16(unittest.TestCase):
    def test_plain_text_is_identity(self):
        self.assertEqual(utf16_index("hello")(3), 3)

    def test_emoji_counts_two_units(self):
        f = utf16_index("a😀b")
        self.assertEqual([f(0), f(1), f(2), f(3)], [0, 1, 3, 4])


class Marks(unittest.TestCase):
    def test_offsets_and_bold_length(self):
        text = "The researchers discovered it."
        marks = analyze_paragraphs([text], FakeAnalyzer(), bold_half)[0]
        # "researchers" (11 letters, rating 2) and "discovered" (10, rating 2); "The" and "it" are rating 0
        self.assertEqual(marks, [[4, 15, 2, 5], [16, 26, 2, 5]])
        for s, e, _, n in marks:
            self.assertTrue(text[s:e].isalpha() and 1 <= n <= e - s)

    def test_emoji_before_word_shifts_offsets_in_utf16(self):
        text = "😀 researchers"
        (s, e, _, _), = analyze_paragraphs([text], FakeAnalyzer(), bold_half)[0]
        self.assertEqual(text.encode("utf-16-le")[2 * s:2 * e].decode("utf-16-le"), "researchers")

    def test_bold_length_never_exceeds_word(self):
        marks = build_marks("abcdefg", ["abcdefg"], [(0, 7)], [2], lambda w: list(range(99)))
        self.assertEqual(marks, [[0, 7, 2, 7]])

    def test_paragraph_without_words(self):
        self.assertEqual(analyze_paragraphs(["123 ---"], FakeAnalyzer(), bold_half), [[]])


if __name__ == "__main__":
    unittest.main()
