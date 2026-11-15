# REden

Browser extension (product name **REden**, as in the logo; internal ids like `REdenCore`, `reden-w` keep the old spelling on purpose) that applies
**bionic reading** to web pages, driven by a Python backend. Built for HackUMass.

## Repo layout
- `extension/` – the browser extension (Manifest V3). The user spells it "extention" but the folder is `extension`.
  - `manifest.json`, `shared/core.js` (pure logic, no DOM/APIs), `content/bionic.js`, `background/background.js`, `popup/` (one switch + status), `icons/`, `tests/core.test.js`, `readme.md`
- `backend/` – **the extension's backend is `server.py`** (the user's choice; port 5000). `sentence/sentence.py` (spaCy ratings) and `word/word.py` (bold letters) are the logic.
  `app.py`, `bionic/`, `nlp.py`, `tests/test_bionic.py` are the old port-5050 API and are **no longer used by the extension** (not deleted; ask before removing).
- `UI` – empty 0-byte file at the repo root. Ignore it.

## Commands
```bash
node --test extension/tests/core.test.js         # unit tests (folder form `node --test extension/tests` fails on Node 24)
node --check extension/content/bionic.js         # quick syntax checks (same for popup/popup.js, background/background.js)

cd backend && .venv/Scripts/python.exe server.py # Windows; http://127.0.0.1:5000, spaCy loads on first request (~30 s)
```
Load the extension: `chrome://extensions` → Developer mode → Load unpacked → pick `extension/`. Reload it after code changes.

## Product decisions (don't undo without asking)
- **Stripped skeleton (2026-11-14, user's request "全部砍掉，大改骨架").** Removed: i18n/languages, Words/Notes/Stats/Settings tabs, translator, page words, sentence split
  button, word lookup, bold presets/slider, font size/spacing/fonts/contrast, automatic mode (optional host permissions), dark page, site tint, backend URL setting.
  **UI is English only, no i18n.** Don't bring features back unless asked.
- **Pipeline (user-specified):** paragraphs → sentences (`Intl.Segmenter`) → words → `POST /get_sentence_highlight {items, punctuation}` once per sentence
  → `POST /get_word_highlight {word}` for every word (cached per lower-case word) → draw.
  **Look (user-specified): only font-weight and opacity change.** Every word: its idx letters bold, weight by sentence rating 0/1/2 = 500/650/800;
  the rest of the word's letters faded a little (opacity .75, "not too faded"). Constants `WEIGHT`, `FADE_OPACITY` at the top of `content/bionic.js`.
  Numbers aren't words (not sent, left untouched).
  `items` are letters only (apostrophes inside words kept); `punctuation` is `[[wordIndex, marks]]` like server.py's docstring.
- **Backend unreachable → REden does nothing** (health check on start; any failed request restores the page, phase `offline`; reopening the popup retries).
- Popup: one switch (`bionicOn` in `storage.local`) + status line polled every 0.5 s. Dark mode follows the OS (`prefers-color-scheme`).

## How it works (content script)
- Requests go content script → `runtime.sendMessage` → `background.js` (fixed `http://127.0.0.1:5000`; host permission bypasses CORS, server.py has no CORS) → server.py.
  Messages: `reden:health`, `reden:sentence`, `reden:word`. Max 6 requests in flight, 3 paragraphs in parallel, `gen` counter drops late answers after turning off.
- Article only: if the page has `article, main, [role=main]` only text inside it; skips `core.SKIP_SELECTOR` (nav, aside, footer, button, code, forms, ARIA chrome,
  aria-hidden), page `header`, icon fonts, blocks with < 3 words. Blocks found by computed `display`; inline links/bold stay in the block text.
- Text nodes are replaced by `<span class="reden-w">` with `<b class="reden-b">` / `<span class="reden-f">` pieces; originals kept in a `WeakMap` and restored on off.
  A `MutationObserver` queues new text; our own spans are ignored.
- Verified: unit tests, and the core.js pipeline against the real server.py (Node script, 3 sentences, 16 word requests, 136 ms).
  **Not yet verified in a real loaded extension.**

## Permissions (keep minimal)
`storage`, `activeTab`, `scripting`; `host_permissions` only `http://127.0.0.1:5000/*`.

## Cross-browser rules
- `const api = globalThis.browser ?? globalThis.chrome`; call extension APIs without callbacks and treat the return as a promise (`call(() => api.x(...))`).
- Manifest lists both `service_worker` and `scripts` for the background. Unsupported pages are detected by `core.checkUrl` and explained in the popup.

## Design (popup)
- Palette: paper `#FCFAFE`, ink `#2F2A6B`, controls `#3B3294`, orange `#E8975A` (accent only), muted `#5E6585`, rule `#E6E1F0`; dark: paper `#1E1B3A`, ink `#ECE9FA`, blue `#A99CFF`.
- Serif stack for headings, rounded sans for controls; system fonts only, no bundled font files.
- Logo: the user's own (R + open book, indigo `#494188`, orange bar). Do not redesign. `icons/mark.png` is tinted via CSS mask.
- Copy: sentence case, plain active voice; errors say what happened and what to do. Never claim bionic reading is proven to speed reading.

## Known limitations
- Sites that re-render text nodes (React/Vue) can overwrite formatted text. No iframes or shadow DOM.
- Many requests per page (one per sentence + one per distinct important word); fine locally, would be slow over a network.

## Working with the user
- Beginner at extensions; give short numbered steps with exact paths and menu names, and say what they should see.
- Messages are often short/ambiguous (often in Chinese). If unclear, ask which thing they mean instead of guessing.
- Commit only when asked.
