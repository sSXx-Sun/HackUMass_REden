  cd backend
  python -m venv venv
  .\venv\Scripts\Activate.ps1
  pip install -r requirements.txt

  python server.py   # serves http://127.0.0.1:5000 for the extension

  如果装了uv的话，直接`uv sync`

## Line-break layout: `POST /get_sentence_layout` (not used by the extension right now)
Input (one sentence): `{"items": [...words], "punctuation": [[i, ","]]}` (words only; marks after word i).
Output: one int per word. `-1` = no line break; `n >= 0` = start a new line before this word, indented `n` levels (`sentence/layout.py`).
One line per clause from the spaCy dependency parse; inner clauses are indented and the main clause returns to the left after them.
Only long sentences (>= 20 words, or clauses nested 2+ deep) are changed; others come back as all `-1`. Lists are never split.

```
    When the war ended,
the city
    that had been destroyed
was rebuilt by the people
    who had stayed,
    although many of them had lost everything.
```
Try it: `python -m sentence.layout`. Tests: `python -m unittest tests.test_layout tests.test_roles -v` (load the spaCy model, ~5 s).

## `POST /get_sentence_roles` (not used by the extension right now)
Input (one sentence, same shape as `/get_sentence_highlight`): `{"items": ["She", "did", "not", "answer"], "punctuation": [[3, "."]]}`
Output: one role per word, from the spaCy dependency parse (`sentence/roles.py`):

| role | meaning | extension shows |
|---|---|---|
| `main` | main clause subject / verb / object (+ `not`) | (was) heaviest bold |
| `sub` | subordinate clause subject / verb / object | bold |
| `rare` | uncommon word (wordfreq zipf < 3.0) | bold |
| `aside` | parenthetical: in commas/brackets/dashes, trailing `, which ...`, sentence-opening `However,` | faded |
| `""` | everything else | untouched |

The extension does nothing on a page while this server is not reachable.

**The extension uses `/get_sentence_rating` and `/get_word_highlight` (letters to bold).**

`POST /get_sentence_rating` (`sentence/rating.py`): same input/output as `/get_sentence_highlight` (0/1/2 per item) but more accurate:
2 = each clause's subject / verb / object / `not` (copula sentences: the complement, not `is`); 0 = auxiliaries, copulas, pronoun subjects, weak adverbs, numbers;
1 = other content words; names, dates and hyphenated words get one score as a whole. Items may include numbers.
Try `python -m sentence.rating`; tests `python -m unittest tests.test_rating -v`.
`app.py` (port 5050: `/bionic`, `/page`, `/sentences`, `/word`) is the old API and is not used by the extension.

## Vocabulary level and unknown words (`vocab/vocab.py`, wordfreq)
- `GET /vocab/info` → `{"total": 92683}` — size of the word list the test searches (English, letters only, 3–15 long, most common first).
- `GET /vocab/word?index=N` → `{"index", "word", "zipf"}` — a quiz word at or just after N (names, international words and inflected forms are skipped).
- `GET /vocab/threshold?index=N` → `{"index", "zipf"}` — the user's level as a word frequency.
- `POST /vocab/unknown` `{"words": [...], "zipf": 3.6}` → `{"unknown": [true/false, ...]}` — rarer than the level (names/international words never count).
- `POST /translate` `{"word", "context" | "sentence", "to_language"?}` → `{"word", "translation"}` — Gemini (`google-genai`), meaning chosen from the
  context sentence, default language Simplified Chinese. Needs `GEMINI_API_KEY` in `backend/.env` (git-ignored); model `GEMINI_MODEL` (default
  `gemini-3.5-flash-lite`, the bigger flash models timed out on 2026-11-14). 15 s limit, no retries, results cached in memory. Any failure →
  `translation: null` + `error`, and the extension simply shows nothing. The extension shows a string in brackets after the word.
Tests: `python -m unittest tests.test_vocab -v`.
