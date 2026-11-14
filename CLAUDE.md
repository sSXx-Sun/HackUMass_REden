# REden

Browser extension (product name **REden**, as in the logo; internal ids like `REdenCore`, `reden-w`, `reden-bionic` keep the old spelling on purpose) that applies **bionic reading** (bolds the start of each word) to web pages, plus an optional
Python backend that decides which words to bold (plus sentence splitting and word lookup). Built for HackUMass.

## Repo layout
- `extension/` – the browser extension (Manifest V3). the user spells it "extention" but the folder is `extension`.
  - `manifest.json` – permissions and Firefox settings
  - `shared/core.js` – pure logic (word splitting, URL support check). Used by popup, content script and tests. No DOM, no extension APIs.
  - `content/bionic.js` – content script that formats the real page and restores it
  - `popup/popup.html|css|js` – the popup UI (single page, six sections)
  - `icons/` – generated PNG toolbar icons
  - `tests/core.test.js` – unit tests
  - `readme.md` – setup, permissions, manual test checklist, known limitations
- `backend/` – Flask + spaCy API, required for bionic reading (`app.py`, `nlp.py`, `bionic/bionic.py`, `sentence/sentence.py`, `word/`; teammates also own `server.py`, `word/fixation.py`)
- `UI` – empty 0-byte file at the repo root, not a folder. Ignore it (don't build on it).

## Commands
```bash
node --test extension/tests                      # unit tests (Node 18+)
cd backend && python -m unittest tests.test_bionic   # backend /bionic logic (no spaCy needed)
node --check extension/popup/popup.js            # quick syntax checks
node --check extension/content/bionic.js

cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
python app.py                                    # http://127.0.0.1:5050 (not 5000: macOS AirPlay uses it)
```
Load the extension: `chrome://extensions` → Developer mode → Load unpacked → pick the `extension/` folder (the one containing
`manifest.json`). Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `manifest.json`. Reload the extension
after code changes.

## Product decisions (don't undo without asking)
- **Bionic reading is backend-driven (decided by the user, replaces the old "works without the backend" rule).** The content script extracts the article text, sends
  it to the backend, and bolds exactly what the backend answers; **if the backend is unreachable REden does nothing** (no bold, no zoom, no spacing; the popup says so).
  The backend also serves "Split selection into sentences", the Words lookup and "Collect words from this page". The preview/specimen in the popup is still drawn locally.
- **One popup page, six sides** (Home, Read, Words, Notes, Stats, Settings), switched by clicking the icons. The user explicitly did *not*
  want separate HTML files/URLs per section.
- **Section switching is CSS-only** (hidden radio inputs `#t-<id>` + `:checked`). JS only remembers the last section. This keeps it working
  even when scripts are blocked or in static previews. Arrow keys work natively on the radios.
- **Dark mode** is applied by `body.dark` from JS *and* by a `body:has(#opt-dark:checked)` fallback. Keep both variable blocks in `popup.css` in sync.
  **Popup text size** is a slider (Settings, 12–22 px, key `popupSize`) that sets `--font-size` on `body` from JS; it replaced the old "Large text" checkbox (migrated: old `large` = 18 px).
- Bionic switch appears on **Home and Read** and both stay in sync. Home also has bold-intensity presets (Low 25 / Medium 40 / High 55, default 40) and
  page text style (Original default / Rounded / Editorial). Read has the fine slider, size, line spacing, letter spacing, high contrast, Automatic mode.
- Rounded/Editorial set `font-family` only on the `.reden-w` spans REden creates (so code, forms, buttons stay untouched) and therefore apply only while REden is on.
  High contrast sets the span color to black/white based on the parent's computed color (cached per parent).
- **Popup language**: first open shows a "Choose your language" screen (`#welcome`, buttons in each language's own name, browser language pre-highlighted); also in Settings > Language.
  Key `lang`. Strings live in `popup/i18n.js` (en, es, fr, pt, zh, ar, hi); static text uses `data-i18n` / `data-i18n-ph` / `data-i18n-aria`, messages use `tx(key, vars)` in `popup.js`.
  Missing keys fall back to English. Arabic sets `dir="rtl"`. To add a language: add it to `LANGS` and a full `S.xx` block; `tests/i18n.test.js` fails if any key or placeholder is missing.
  Choosing a language also sets the translator's target language when it is one of the 10 translator languages. Not translated: the bionic/translator sample sentences, the
  `checkUrl` reasons in `core.js`, and the backend's replies. The non-English strings were written by Claude and have not been reviewed by native speakers.
- **Page words** (Read tab, `initPageWords` in `popup.js`): on button click only, an injected function reads the tab's visible text (skips script/style/form fields/hidden; text pieces in one
  block are joined so REden's own `<b>` pieces never split a word), `core.collectWords` lists every word in order (duplicates kept, any script), it is `console.log`ged in the popup and in the
  page's console, then POSTed to the backend `POST /page` `{url,title,words}` (stored in memory and printed in the backend terminal; `GET /page` reads it back).
  Backend offline -> still printed, and the popup says it wasn't sent. "The background" was read as the Python backend; there is deliberately still no extension background script.
  Doesn't read iframes or shadow DOM. Backend side not run (spaCy/Flask not installed here); the request was verified against a fake local server.
- **Translator** (Words tab): English -> 10 languages using Chrome/Edge's on-device `Translator` API (138+). No text leaves the device and no permission is added.
  Not available in Firefox, shows a plain message. Sample sentence translations in `TR_LANGS` are hand-written. **Not verified in real Chrome** (only a stubbed `Translator`).
  A network translation API or backend model was deliberately not used (privacy); ask the user before adding one.
- Font size and line spacing apply only while Bionic reading is on. Font size uses CSS `zoom` on `<html>`.
- "Dark page" (Settings) is a one-off `insertCSS` for the current tab, not persisted across loads.

## How bionic reading works
- **Flow:** content script -> `runtime.sendMessage` -> `background/background.js` (the only thing that calls the backend; page scripts can't, mixed content/CORS) -> `POST /bionic` ->
  marks back -> content script renders. `POST /bionic` `{paragraphs:[str]}` -> `{paragraphs:[[[start,end,rating,boldLen],...],...]}` (UTF-16 offsets; rating 2 = key word, 1 = secondary;
  unlisted words stay plain). Backend logic: `backend/bionic/bionic.py` combines teammates' `SentenceAnalyzer.get_sentence_highlight` (rating) and `word.word.word` (bold letters).
- **Backend down:** `reden:health` is checked when REden turns on; any failed `/bionic` request mid-way calls `goOffline()` (restore everything, phase `offline`). Opening the popup
  sends `reden:recheck` so it retries. Phases: `off | checking | on | offline`.
- **Article only:** if the page has `article, main, [role=main]` only text inside it is used; always skipped: `nav, aside, footer, button, label`, page `header` (not an article's header),
  ARIA chrome roles, `aria-hidden`, icon fonts (computed font-family matches `core.ICON_FONT_RE`), code/pre/form fields/editable areas, and blocks with fewer than 3 words.
- Text is sent per **block** (paragraph/list item/heading, found by computed `display`); inline links/bold stay part of the block text so words never split. Batches of 40 blocks / 30k chars,
  one request in flight, a `gen` counter drops answers that arrive after turning off. Answers are cached in `rendered`, so changing "Bold amount" (a scale: 40% = backend's choice, 20% half,
  80% double) re-renders with **no new request**.
- Replaces individual **text nodes** with `<span class="reden-w">` containing `<b class="reden-b">` pieces; the original text node is kept in a `WeakMap` and put back on restore.
  Never replaces page HTML wholesale. Work is batched (~12 ms slices) for rendering **and restoring**.
- A `MutationObserver` on `documentElement` queues new/changed blocks. Our own spans are ignored (no loops).
- Settings live in `chrome.storage.local` under flat keys (see `core.DEFAULTS`); the content script listens to `storage.onChanged` and re-applies live (80 ms debounce).
- On enabling, the popup `await`s the storage write **before** injecting the script (the script reads storage on start).
- Verified in the browser pane with a fake backend (article vs chrome, icon fonts, offline, backend dying mid-way, no-request bold changes) **and with the real backend** (real `background.js` + content script + Flask; bold, strength 20/80, off, backend stopped -> no effect). Not yet tried on real websites or in a real loaded extension after the backend change.


## Permissions (keep minimal)
- `storage`, `activeTab`, `scripting`; `host_permissions` only for `127.0.0.1:5050` and `localhost:5050` (backend; the background worker uses them).
- `optional_host_permissions` `http://*/*`, `https://*/*` – requested **only** when the user turns on "Format every website automatically"
  (must be requested straight from the click, before any `await`). Automatic mode registers the content script with
  `scripting.registerContentScripts` (id `reden-bionic`); turning it off unregisters it and removes the permission. The popup re-checks
  `permissions.contains` on open in case the user revoked it in browser settings.
- A background worker exists only to call the backend (manifest lists both `service_worker` and `scripts` for Chrome and Firefox). Firefox needs `strict_min_version` 128 for optional host permissions.

## Cross-browser rules
- Use `const api = globalThis.browser ?? globalThis.chrome`.
- Call extension APIs **without callbacks** and treat the return as a promise (wrapper `call(() => api.x(...))`). Passing a callback to
  `browser.*` in Firefox breaks things.
- Unsupported pages (`chrome://`, `about:`, `file://`, extension stores, PDFs) are detected by `core.checkUrl` and explained in the popup.

## Design system (REden brand: from the logo + the user's design brief)
- Concept: modern reading utility with editorial character. Flat, ruled, no gradients/card kit. Popup styling never applies to websites.
- Palette (CSS variables on `:root` / `body.dark`): paper barely-purple `#FCFAFE`, ink indigo `#2F2A6B`, controls `#3B3294`, selected tab/choice a slightly darker soft purple `#EFEAF8`,
  orange `#E8975A` (small accent only: underlines, big-switch knob, logo bar), muted `#5E6585`, rule `#E6E1F0`.
  Dark: paper `#1E1B3A`, ink `#ECE9FA`, blue `#A99CFF`, lavender `#34305F`, orange `#F0A872`. Keep `body.dark` and the `:has(#opt-dark:checked)` block in sync.
- **Site-matched colors** (Settings switch `tintSite`, default on): on open, the popup reads a color from the current page (meta theme-color, then header/nav/body background, then
  first link color; must be saturated enough, else the REden purple above is used) and tints the popup with it using the same amounts as the purple design:
  paper 2%, selected 8%, rules 13% of the site color; ink/muted/controls are the site color darkened/lightened until contrast is 9/4.6/5. Dark mode mixes into a neutral dark base.
  Set inline on `body` by `applyTint()` in `popup.js`; the logo, wordmark, tagline and header rule use `--brand` (default indigo; with site colors it is the site color darkened to 60%, contrast ≥7). Only checked with a stubbed page color, not on real sites.
- Type (popup): serif stack (Fraunces, Newsreader, Charter, Georgia) for wordmark/headings/specimen; rounded sans stack (Nunito Sans, ui-rounded, system-ui) for controls.
  **System/installed fonts only; no font files are bundled.** Bundling Fraunces/Nunito Sans needs a download the user hasn't approved yet.
- Logo: the user's own logo is the source of truth (R whose right half is an open book, indigo `#494188`, orange underline `#ED925F`, lavender `#EEE7FA`, rounded heavy "REden" wordmark).
  Do not redesign it. `extension/icons/mark.png` is the R/book mark traced from their PNG (white alpha mask); the popup tints it with `var(--ink)` via CSS mask,
  so it works in dark mode. Toolbar icons `icon{16,32,48,128}.png` = the logo as is: lavender `#EEE7FA` rounded square + indigo `#494188` mark + orange bar. The logo source is only 438x200,
  so a higher-resolution or SVG original from the user would sharpen the 128px icon.
- Masthead: mark + orange bar, wordmark `<b>RE</b>den` in the rounded sans (heavy), italic serif tagline, double rule.
- Copy: sentence case, plain active voice, errors say what happened and what to do next. Never claim bionic reading is proven to speed reading.
- Motion: only the switch slide; `prefers-reduced-motion` disables it. Visible 3px focus rings.

## Testing notes
- `core.test.js` covers splitting, text preservation, apostrophes/accents, scripts, URL support, and a 900k-char speed check.
- Real-DOM and popup behaviour were verified in the built-in browser pane using **stubbed `chrome` APIs** served from a local
  `python3 -m http.server` (scratchpad copies, not committed). The pane's `file://` view is a static snapshot (no CSS/JS), so test via `http://127.0.0.1`.
- Browser-pane timers are throttled; use the `longtask` PerformanceObserver (not `setInterval` gaps) to judge main-thread blocking.
- **Not yet verified in a real browser:** loading unpacked, the real permission prompt, `registerContentScripts`, real tab injection, infinite-scroll sites.
  The Claude-in-Chrome connection was unavailable and can't drive Chrome's file picker anyway.

## Known limitations
- Sites that re-render text nodes (React/Vue) can overwrite a formatted node until it changes again.
- No iframes or shadow DOM. Older Firefox ignores CSS `zoom`.
- Backend deps: `requirements.txt` pins `spacy==3.8.18` (unverified that this version exists) and Python 3.14 may lack spaCy wheels; flask/flask-cors added.
  The backend now runs here: `backend/venv` (git-ignored, Python 3.14.3) with `pip install -r requirements.txt` (spacy 3.8.18 and both models install fine; `torch` prints a harmless 3.14 FutureWarning). Start it with `backend/venv/bin/python app.py` (loads the models first, about 30 s). `/health`, `/bionic`, `/sentences`, `/word` were tested with curl; `/bionic` answered in ~0.2 s for 3 short paragraphs.

## Working with the user
- The user is a beginner at extensions; give short numbered steps with exact paths and menu names, and say what they should see.
- Their messages are often short/ambiguous. If a request is unclear (e.g. "redo this step"), ask which step instead of guessing.
- Nothing has been committed yet; commit only when asked.
