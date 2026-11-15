# REden

A browser extension that makes English web pages easier to read: it bolds the start of each word (heavier for the words that
carry the sentence), can lay long sentences out clause by clause, and can translate the words you probably don't know.
A small local Python server (spaCy + wordfreq + Gemini) does the language work.

## Run locally

You need both parts: the **backend** (a Python server on your computer) and the **extension** (loaded into your browser).
If the backend isn't running, the extension does nothing to the page.

### 1. Backend (`backend/`)

Requirements: **Python 3.14** and about 2 GB of disk space (spaCy's transformer model is large).

**Option A, with [uv](https://docs.astral.sh/uv/) (recommended):**

```bash
cd backend
uv sync                      # creates backend/.venv and installs everything, including the spaCy models
uv run python server.py
```

**Option B, with pip:**

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux
pip install -r requirements.txt
python server.py
```

The server runs at **http://127.0.0.1:5000**. Check it in a browser: http://127.0.0.1:5000/health should show `{"status": "ok"}`.
The first page you format takes a little longer (about 5–30 s) while spaCy loads its model; after that it's fast.

**Translation (optional).** Translating unknown words uses Google Gemini. Create the file `backend/.env` (it is git-ignored):

```
GEMINI_API_KEY=your-key-here
# GEMINI_MODEL=gemini-3.5-flash-lite   (optional, this is the default)
```

The file must be in `backend/`, next to `server.py`. Without a key everything else works; words just don't get a translation.

### 2. Extension (`extension/`)

No build step: the `extension/` folder is the extension.

**Chrome / Edge / Brave**
1. Open `chrome://extensions` (Edge: `edge://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension` folder (the one that contains `manifest.json`).
4. Pin REden: click the puzzle icon in the toolbar, then the pin next to REden.

**Firefox (128 or newer)**
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select `extension/manifest.json`.
   (Temporary add-ons are removed when Firefox closes.)

### 3. Use it

1. Start the backend (step 1) and keep it running.
2. Open an English article, click the REden icon, and turn on **Bionic reading** (Home tab).
3. Pick a **Reading style** on Home: *Weight* (heavier bold on key words), *Tree* (words deeper in the sentence's grammar are lighter)
   or *Indent* (sentences of more than 8 words get one line per clause).
4. Optional: on the **Read** tab, take the 10-question **vocabulary test**, then turn on **Translate words I may not know**.
   Words rarer than your level get a translation in brackets (needs the Gemini key). Type your mother language in
   **Your mother language** (default: Chinese); any language works, e.g. Spanish, 日本語, Tiếng Việt.

Paragraphs are processed as they scroll into view. If the backend runs somewhere other than `http://127.0.0.1:5000`,
set the address in **Settings > Backend**.

After changing extension code, click the reload button on the REden card in `chrome://extensions` and reload the web page.
After changing backend code, stop the server (`Ctrl+C`) and start it again.

### Tests

```bash
node --test extension/tests/core.test.js extension/tests/strings.test.js   # extension (Node 18+)

cd backend
python -m unittest tests.test_vocab -v                                       # fast, no spaCy
python -m unittest tests.test_rating tests.test_depth tests.test_layout -v   # loads the spaCy model (~5 s)
```

## Project layout

- `extension/` – the browser extension (Manifest V3): `content/bionic.js` formats the page, `background/background.js` talks to the
  backend, `popup/` is the toolbar popup, `shared/core.js` holds the pure logic.
- `backend/` – the Flask server `server.py`: `sentence/` (spaCy sentence analysis), `word/` (which letters to bold),
  `vocab/` (vocabulary level and unknown words). See `backend/readme.md` for the API.
