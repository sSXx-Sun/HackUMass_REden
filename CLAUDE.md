# REden

Browser extension (product name **REden**, as in the logo; internal ids like `ReaDeNCore`, `readen-w`, `readen-bionic` keep the old spelling on purpose) that applies **bionic reading** (bolds the start of each word) to web pages, plus an optional
Python backend for sentence splitting and word lookup. Built for HackUMass.

## Repo layout
- `extension/` – the browser extension (Manifest V3). **This is the "extention" the user asked for; the folder is spelled `extension`.**
  - `manifest.json` – permissions and Firefox settings
  - `shared/core.js` – pure logic (word splitting, URL support check). Used by popup, content script and tests. No DOM, no extension APIs.
  - `content/bionic.js` – content script that formats the real page and restores it
  - `popup/popup.html|css|js` – the popup UI (single page, six sections)
  - `icons/` – generated PNG toolbar icons
  - `tests/core.test.js` – unit tests
  - `readme.md` – setup, permissions, manual test checklist, known limitations
- `backend/` – optional Flask + spaCy API (`app.py`, `nlp.py`, `sentence/sentence.py`, `word/word.py`)
- `UI` – empty 0-byte file at the repo root, not a folder. Ignore it (don't build on it).

## Commands
```bash
node --test extension/tests                      # unit tests (Node 18+)
node --check extension/popup/popup.js            # quick syntax checks
node --check extension/content/bionic.js

cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
python app.py                                    # http://127.0.0.1:5050 (not 5000: macOS AirPlay uses it)
```
Load the extension: `chrome://extensions` → Developer mode → Load unpacked → pick the `extension/` folder (the one containing
`manifest.json`). Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `manifest.json`. Reload the extension
after code changes.

## Product decisions (don't undo without asking)
- **Bionic reading must work without the backend.** The backend is only used by "Split selection into sentences" and the Words lookup.
  When it is down, show a plain explanation and still save the user's data.
- **One popup page, six sides** (Home, Read, Words, Notes, Stats, Settings), switched by clicking the icons. The user explicitly did *not*
  want separate HTML files/URLs per section.
- **Section switching is CSS-only** (hidden radio inputs `#t-<id>` + `:checked`). JS only remembers the last section. This keeps it working
  even when scripts are blocked or in static previews. Arrow keys work natively on the radios.
- **Dark mode** is applied by `body.dark` from JS *and* by a `body:has(#opt-dark:checked)` fallback. Keep both variable blocks in `popup.css` in sync.
  **Popup text size** is a slider (Settings, 12–22 px, key `popupSize`) that sets `--font-size` on `body` from JS; it replaced the old "Large text" checkbox (migrated: old `large` = 18 px).
- Bionic switch appears on **Home and Read** and both stay in sync. Home also has bold-intensity presets (Low 25 / Medium 40 / High 55, default 40) and
  page text style (Original default / Rounded / Editorial). Read has the fine slider, size, line spacing, letter spacing, high contrast, Automatic mode.
- Rounded/Editorial set `font-family` only on the `.readen-w` spans REden creates (so code, forms, buttons stay untouched) and therefore apply only while REden is on.
  High contrast sets the span color to black/white based on the parent's computed color (cached per parent).
- **Translator** (Words tab): English -> 10 languages using Chrome/Edge's on-device `Translator` API (138+). No text leaves the device and no permission is added.
  Not available in Firefox, shows a plain message. Sample sentence translations in `TR_LANGS` are hand-written. **Not verified in real Chrome** (only a stubbed `Translator`).
  A network translation API or backend model was deliberately not used (privacy); ask the user before adding one.
- Font size and line spacing apply only while Bionic reading is on. Font size uses CSS `zoom` on `<html>`.
- "Dark page" (Settings) is a one-off `insertCSS` for the current tab, not persisted across loads.

## How bionic reading works
- Replaces individual **text nodes** with `<span class="readen-w">` containing `<b class="readen-b">` pieces; the original text node is kept in a
  `WeakMap` and put back on restore. Never replaces page HTML wholesale.
- Skips `script, style, noscript, template, iframe, svg, math, code, pre, kbd, samp, textarea, input, select, option`, contenteditable,
  `role=textbox`, and our own `.readen-w`. Only Latin, Cyrillic and Greek words are formatted (CJK/Arabic/Thai untouched); words touching digits are skipped.
- Work is batched (~12 ms slices, `setTimeout`) for both formatting **and restoring**, so long pages don't freeze.
- A `MutationObserver` on `documentElement` formats added nodes and changed text nodes. Our own spans are ignored (no loops); a `WeakSet`
  prevents double queuing.
- Settings live in `chrome.storage.local` under flat keys: `bionicOn, bionicAuto, bionicStrength (20–80), bionicSize (100–200), bionicSpacing (0|1.5|1.8|2.1), bionicLetter (0|0.02|0.04|0.08 em), bionicMode (original|rounded|editorial), bionicContrast`.
  The content script listens to `storage.onChanged` and re-applies live (80 ms debounce). Strength changes restore first, then reformat.
- On enabling, the popup `await`s the storage write **before** injecting the script (the script reads storage on start).

## Permissions (keep minimal)
- `storage`, `activeTab`, `scripting`; `host_permissions` only for `127.0.0.1:5050` and `localhost:5050` (backend).
- `optional_host_permissions` `http://*/*`, `https://*/*` – requested **only** when the user turns on "Format every website automatically"
  (must be requested straight from the click, before any `await`). Automatic mode registers the content script with
  `scripting.registerContentScripts` (id `readen-bionic`); turning it off unregisters it and removes the permission. The popup re-checks
  `permissions.contains` on open in case the user revoked it in browser settings.
- No background script. Firefox needs `strict_min_version` 128 for optional host permissions.

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
  Set inline on `body` by `applyTint()` in `popup.js`; the logo and wordmark use `--brand` so they never change. Only checked with a stubbed page color, not on real sites.
- Type (popup): serif stack (Fraunces, Newsreader, Charter, Georgia) for wordmark/headings/specimen; rounded sans stack (Nunito Sans, ui-rounded, system-ui) for controls.
  **System/installed fonts only; no font files are bundled.** Bundling Fraunces/Nunito Sans needs a download the user hasn't approved yet.
- Logo: the user's own logo is the source of truth (R whose right half is an open book, indigo `#494188`, orange underline `#ED925F`, lavender `#EEE7FA`, rounded heavy "REden" wordmark).
  Do not redesign it. `extension/icons/mark.png` is the R/book mark traced from their PNG (white alpha mask); the popup tints it with `var(--ink)` via CSS mask,
  so it works in dark mode. Toolbar icons `icon{16,32,48,128}.png` = indigo `#494188` rounded square + that mark + orange bar. The logo source is only 438x200,
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
  The backend code has not been run (spaCy wasn't installed here).

## Working with the user
- The user is a beginner at extensions; give short numbered steps with exact paths and menu names, and say what they should see.
- Their messages are often short/ambiguous. If a request is unclear (e.g. "redo this step"), ask which step instead of guessing.
- Nothing has been committed yet; commit only when asked.
