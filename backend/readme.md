  cd backend
  python -m venv venv
  .\venv\Scripts\Activate.ps1
  pip install -r requirements.txt

  python app.py   # serves http://127.0.0.1:5050 for the extension

  如果装了uv的话，直接`uv sync`

## Page words
`POST /page` with `{"url", "title", "words": [...]}` stores the words of the page the extension just collected (and prints them in this terminal). `GET /page` returns the last one.

## Bionic formatting (what the extension uses on web pages)
`POST /bionic` with `{"paragraphs": ["...", ...]}` returns `{"paragraphs": [[[start, end, rating, bold_len], ...], ...]}`: for each paragraph, the words to bold
(`rating` 2 = most important, 1 = secondary; unlisted words are left plain) and how many leading letters to bold (from `word/word.py`).
The extension does nothing on a page while this server is not reachable. Run `python -m unittest tests.test_bionic` for the offline logic tests.
