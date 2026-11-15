"""More accurate sentence rating (what the extension uses). Needs spaCy + en_core_web_trf (~5 s to load).

Run:  cd backend && python -m unittest tests.test_rating -v
"""
import re
import unittest

from sentence.rating import get_sentence_rating

ITEM = re.compile(r"[^\W\d_]+(?:['’][^\W\d_]+)*|\d+(?:[.,]\d+)*")


def split(sentence):
    """Same shape the extension sends: words and numbers + punctuation after item i."""
    spans = [m.span() for m in ITEM.finditer(sentence)]
    items = [sentence[a:b] for a, b in spans]
    punctuation = []
    for i, (_, end) in enumerate(spans):
        nxt = spans[i + 1][0] if i + 1 < len(spans) else len(sentence)
        marks = "".join(c for c in sentence[end:nxt] if not c.isspace())
        if marks:
            punctuation.append([i, marks])
    return items, punctuation


def rate(sentence):
    items, punctuation = split(sentence)
    out = get_sentence_rating(items, punctuation)
    assert len(out) == len(items)
    return list(zip(items, out))


def score(pairs, word, nth=0):
    return [r for w, r in pairs if w == word][nth]


class TestRating(unittest.TestCase):
    def test_copula_gives_the_complement_not_is(self):
        r = rate("It is important to remember the rules.")
        self.assertEqual((score(r, "It"), score(r, "is"), score(r, "important")), (0, 0, 2))

    def test_passive_bolds_the_verb_not_the_auxiliary(self):
        r = rate("It was first widely distributed in July 2000 and was later approved by Ecma in 2002.")
        self.assertEqual((score(r, "was"), score(r, "distributed"), score(r, "approved")), (0, 2, 2))
        self.assertEqual(score(r, "in", 1), 0)  # numbers are sent, so "in 2002" parses normally
        self.assertEqual(score(r, "2000"), 0)   # numbers are never bolded

    def test_names_get_one_score(self):
        r = rate("The principal designers were Anders Hejlsberg, Scott Wiltamuth, and Peter Golde from Microsoft.")
        self.assertEqual(score(r, "Anders"), score(r, "Hejlsberg"))
        self.assertEqual(score(r, "Peter"), score(r, "Golde"))
        self.assertEqual(score(r, "were"), 0)

    def test_hyphenated_words_and_negation(self):
        r = rate("Microsoft released a platform that is free and open-source.")
        self.assertEqual(score(r, "open"), score(r, "source"))
        r = rate("She did not answer the letter.")
        self.assertEqual((score(r, "She"), score(r, "not"), score(r, "answer"), score(r, "letter")), (0, 2, 2, 2))

    def test_empty(self):
        self.assertEqual(get_sentence_rating([], []), [])


if __name__ == "__main__":
    unittest.main()
