"""Sentence tree depth. Needs spaCy + en_core_web_trf (~5 s to load).

Run:  cd backend && python -m unittest tests.test_depth -v
"""
import unittest

from sentence.depth import get_sentence_depth
from tests.test_rating import split


class TestDepth(unittest.TestCase):
    def test_root_is_zero_and_modifiers_are_deeper(self):
        items, punctuation = split("She did not answer the letter.")
        d = dict(zip(items, get_sentence_depth(items, punctuation)))
        self.assertEqual(d["answer"], 0)
        self.assertEqual(d["She"], 1)
        self.assertEqual(d["letter"], 1)
        self.assertEqual(d["the"], 2)

    def test_same_length_and_numbers(self):
        items, punctuation = split("It was distributed in July 2000.")
        out = get_sentence_depth(items, punctuation)
        self.assertEqual(len(out), len(items))
        self.assertTrue(all(isinstance(x, int) and x >= 0 for x in out))
        self.assertEqual(get_sentence_depth([], []), [])


if __name__ == "__main__":
    unittest.main()
