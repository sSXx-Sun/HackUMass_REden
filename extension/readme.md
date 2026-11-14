# REden browser extension

Bionic reading for the web. REden reads the article's paragraphs, asks the local backend (`backend/server.py`) which words matter
and which letters to bold, then bolds key words and fades filler words. Manifest V3; Chrome, Edge, Brave, Firefox 128+.

**The backend must be running.** If it isn't, REden does nothing to the page.

```bash
cd backend
.venv\Scripts\activate        # Windows  (macOS/Linux: source .venv/bin/activate)
python server.py              # http://127.0.0.1:5000; the first page takes ~30 s while spaCy loads
```

## How it works
For every paragraph of the article (inside `article`/`main` if the page has one; menus, buttons, footers, code and forms are skipped):

1. Split the paragraph into sentences (`Intl.Segmenter`), each sentence into words (`core.sentencesOf`, `core.wordsOf`).
2. `POST /get_sentence_highlight` `{"items": ["what","about","you"], "punctuation": [[2,"?"]]}` → `[0, 1, 2]`, once per sentence.
3. `POST /get_word_highlight` `{"word": "reading"}` → `[0, 1, 2, 3]`, once per distinct word (cached).
4. Draw (only font-weight and opacity change): the word's bold letters get weight 500 / 650 / 800 for sentence rating 0 / 1 / 2;
   the rest of the word is at 75% opacity. Tweak `WEIGHT` and `FADE_OPACITY` at the top of `content/bionic.js`.

Requests go through `background/background.js` (pages can't call `127.0.0.1`), at most 6 at a time, 3 paragraphs in parallel.
Any failed request puts the page back and the popup says the backend can't be reached.
Text nodes are swapped for `<span class="reden-w">`; the original node is put back when you turn it off.

## Files
- `manifest.json`: permissions (`storage`, `activeTab`, `scripting`, host `127.0.0.1:5000`)
- `shared/core.js`: pure logic (sentence/word splitting, styles), unit tested
- `content/bionic.js`: finds paragraphs, calls the backend, draws, restores
- `background/background.js`: the only code that calls the backend
- `popup/`: on/off switch + status
- `tests/core.test.js`: unit tests (`node --test extension/tests/core.test.js`)

## Load it
1. Chrome/Edge: open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, pick this `extension/` folder.
   Firefox: `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → `manifest.json`.
2. Start the backend (above).
3. Open an article, click the REden icon, turn on **Bionic reading**. The status line shows progress.

After changing code, click the extension's reload button and reload the web page.
