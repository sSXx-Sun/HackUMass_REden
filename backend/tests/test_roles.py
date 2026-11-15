"""Sentence role tagging (needs spaCy + en_core_web_trf; ~5 s to load).

Run:  cd backend && python -m unittest tests.test_roles -v
"""
import re
import unittest

from sentence.roles import build_text, get_sentence_roles

WORD = re.compile(r"[^\W\d_]+(?:'[^\W\d_]+)*")


def split(sentence):
    """Same shape the extension sends: words only + punctuation after word i."""
    spans = [m.span() for m in WORD.finditer(sentence)]
    items = [sentence[a:b] for a, b in spans]
    punctuation = []
    for i, (_, end) in enumerate(spans):
        nxt = spans[i + 1][0] if i + 1 < len(spans) else len(sentence)
        marks = "".join(c for c in sentence[end:nxt] if not c.isspace())
        if marks:
            punctuation.append([i, marks])
    return items, punctuation


def roles(sentence):
    items, punctuation = split(sentence)
    return dict(zip(items, get_sentence_roles(items, punctuation)))


class TestBuildText(unittest.TestCase):
    def test_brackets_go_before_the_next_word(self):
        text, starts = build_text(["cat", "a", "tabby", "slept"], [[0, "("], [2, ")"]])
        self.assertEqual(text, "cat (a tabby) slept")
        self.assertEqual([text[s:s + len(w)] for s, w in zip(starts, ["cat", "a", "tabby", "slept"])], ["cat", "a", "tabby", "slept"])


class TestRoles(unittest.TestCase):
    def test_long_subject_clause(self):
        r = roles("It is important to remember that whether a greedy algorithm does, in fact, produce an optimal solution depends on the structure of the problem.")
        self.assertEqual(r["is"], "main")
        self.assertEqual(r["depends"], "sub")
        self.assertEqual(r["algorithm"], "sub")
        self.assertEqual(r["in"], "aside")
        self.assertEqual(r["fact"], "aside")
        self.assertEqual(r["greedy"], "")

    def test_opener_brackets_and_trailing_which(self):
        self.assertEqual(roles("However, the results were surprising.")["However"], "aside")
        r = roles("The cat (a very old tabby) slept on the warm windowsill.")
        self.assertEqual((r["cat"], r["slept"], r["very"]), ("main", "main", "aside"))
        r = roles("She did not answer the letter, which had arrived on Monday.")
        self.assertEqual((r["not"], r["answer"], r["letter"], r["arrived"]), ("main", "main", "main", "aside"))

    def test_rare_words_and_length(self):
        items, punctuation = split("Researchers called the problem intractable.")
        out = get_sentence_roles(items, punctuation)
        self.assertEqual(len(out), len(items))
        self.assertIn(dict(zip(items, out))["intractable"], {"rare", "main"})
        self.assertEqual(get_sentence_roles([], []), [])


if __name__ == "__main__":
    unittest.main()
