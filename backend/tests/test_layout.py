"""Long-sentence layout (needs spaCy + en_core_web_trf; ~5 s to load).

Run:  cd backend && python -m unittest tests.test_layout -v
"""
import unittest

from sentence.layout import get_sentence_layout
from tests.test_roles import split


def lines(sentence):
    """[(indent, "words on that line"), ...]; [] if the sentence is left alone."""
    items, punctuation = split(sentence)
    layout = get_sentence_layout(items, punctuation)
    assert len(layout) == len(items)
    if all(v < 0 for v in layout):
        return []
    out = []
    for w, v in zip(items, layout):
        if v >= 0:
            out.append([v, []])
        out[-1][1].append(w)
    return [(i, " ".join(ws)) for i, ws in out]


class TestLayout(unittest.TestCase):
    def test_sentences_of_8_words_or_fewer_are_left_alone(self):
        self.assertEqual(lines("She did not answer the letter, which arrived."), [])  # 8 words

    def test_more_than_8_words_starts_the_layout(self):
        out = lines("She did not answer the letter, which had arrived on Monday.")  # 11 words
        self.assertEqual(out, [(0, "She did not answer the letter"), (1, "which had arrived on Monday")])
        self.assertEqual(get_sentence_layout([], []), [])

    def test_long_subject_clause_is_split_from_its_verb(self):
        out = lines("It is important to remember that whether a greedy algorithm does, in fact, produce an optimal solution depends on the structure of the problem.")
        self.assertEqual(out[0], (0, "It is important to remember that"))
        self.assertTrue(out[1][1].startswith("whether"))
        self.assertTrue(out[-1][1].startswith("depends"))

    def test_nested_clauses_cascade_and_main_clause_returns(self):
        out = lines("When the war ended, the city that had been destroyed was rebuilt by the people who had stayed, although many of them had lost everything.")
        self.assertEqual(out[:4], [(1, "When the war ended"), (0, "the city"), (1, "that had been destroyed"), (0, "was rebuilt by the people")])

    def test_lists_are_not_split(self):
        out = lines("A decade later, Microsoft released Visual Studio Code, Roslyn, and the unified NET platform, all of which support C and are free, open-source, and cross-platform.")
        self.assertTrue(any("Visual Studio Code Roslyn and the unified NET platform" in text for _, text in out))


if __name__ == "__main__":
    unittest.main()
