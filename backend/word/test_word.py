"""运行：uv run python -m unittest word.test_word -v"""
import math
import unittest

from wordfreq import top_n_list

from word.word import word

SAMPLE = [w for w in top_n_list("en", 3000) if w.isascii() and w.isalpha() and len(w) >= 4]


class TestWord(unittest.TestCase):
    def test_examples(self):
        self.assertEqual(word("reading"), [0, 1, 2, 3])  # read|ing
        self.assertEqual(word("children"), [0, 1, 2, 3, 4])  # child|ren
        self.assertEqual(word("quickly"), [0, 1, 2, 3, 4])  # quick|ly
        self.assertEqual(word("information"), [0, 1, 2, 3, 4, 5])  # inform|ation

    def test_short_and_unknown(self):
        self.assertEqual(word(""), [])
        self.assertEqual(word("a"), [0])
        self.assertEqual(word("to"), [0])
        self.assertEqual(word("zxqvbnm"), [0, 1, 2])  # 词表外：固定约 45%
        self.assertEqual(word("café"), [0, 1])

    def test_indexes_are_a_prefix_inside_the_window(self):
        for w in SAMPLE:
            idx = word(w)
            self.assertEqual(idx, list(range(len(idx))), w)
            self.assertTrue(math.ceil(len(w) * 0.45) <= len(idx) <= math.floor(len(w) * 0.75), w)

    def test_most_words_between_50_and_70_percent(self):
        ratios = [len(word(w)) / len(w) for w in SAMPLE]
        self.assertTrue(0.55 <= sum(ratios) / len(ratios) <= 0.65)
        self.assertGreaterEqual(sum(0.5 <= r <= 0.7 for r in ratios) / len(ratios), 0.8)

    def test_three_letter_words_do_not_crash(self):
        for w in ("the", "and", "are", "you"):
            self.assertTrue(1 <= len(word(w)) <= 2, w)

    def test_case_insensitive_and_deterministic(self):
        self.assertEqual(word("Reading"), word("reading"))
        self.assertEqual(word("UNHAPPY"), word("unhappy"))
        self.assertEqual(word("understanding"), word("understanding"))


if __name__ == "__main__":
    unittest.main()
