"""Vocabulary test helpers (wordfreq only, no spaCy; ~1 s).

Run:  cd backend && python -m unittest tests.test_vocab -v
"""
import unittest

from vocab import vocab


class TestVocab(unittest.TestCase):
    def test_quiz_words_skip_names_and_inflections(self):
        n = vocab.total()
        self.assertGreater(n, 50_000)
        for i in range(0, n, n // 40):
            w = vocab.word_at(i)["word"]
            self.assertFalse(vocab.is_international(w), w)
        self.assertTrue(vocab.is_international("pelosi"))
        self.assertTrue(vocab.is_international("internet"))
        self.assertFalse(vocab.is_international("fathom"))

    def test_ten_questions_find_the_level(self):
        n = vocab.total()
        for true_level in (3000, 12000, 40000):
            lo, hi = 0, n
            for _ in range(10):
                w = vocab.word_at((lo + hi) // 2)
                if w["index"] < true_level:
                    lo = w["index"]
                else:
                    hi = w["index"]
            self.assertLess(abs((lo + hi) // 2 - true_level), n // 200, true_level)

    def test_unknown_uses_the_threshold(self):
        t = vocab.zipf_at(12000)
        self.assertEqual(vocab.unknown(["the", "consider", "intractable", "pelosi", "Fathom"], t), [False, False, True, False, True])
        self.assertEqual(vocab.unknown(["intractable"], 0), [False])  # not tested yet


if __name__ == "__main__":
    unittest.main()
