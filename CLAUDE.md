# REden

Browser extension (product name **REden**, as in the logo; internal ids like `REdenCore`, `reden-w`, `reden-bionic` keep the old spelling on purpose) that applies
**bionic reading driven by sentence structure**: every word's start is bolded, and how heavy the bold is comes from a spaCy analysis of the sentence.
Python backend = `backend/server.py`. Built for HackUMass.

## Repo layout
- `extension/` – the browser extension (Manifest V3). The user spells it "extention" but the folder is `extension`.
  - `manifest.json` – permissions and Firefox settings
  - `shared/core.js` – pure logic (sentence/word splitting, bold styles, popup preview, URL support check). No DOM, no extension APIs. Used by popup, content script, tests.
  - `content/bionic.js` – content script that formats the real page and restores it
  - `background/background.js` – the only code the content script uses to reach the backend
  - `popup/popup.html|css|js` – the popup UI (one page, three sections: Home, Read, Settings); `popup/strings.js` – all popup text (English only)
  - `icons/` – generated PNG toolbar icons
  - `tests/core.test.js`, `tests/strings.test.js` – unit tests
- `backend/` – **the extension's backend is `server.py`** (the user's choice; port 5000). Everything the extension needs is there:
  - page bolding: `POST /get_sentence_rating` (`sentence/rating.py`, Claude's) + `POST /get_word_highlight` (`word/word.py`, teammates')
  - "Sentence tree" style: `POST /get_sentence_depth` (`sentence/depth.py`, Claude's): dependency-tree depth per item, root = 0
  - popup helpers (moved from the old `app.py`): `POST /sentences`, `POST /page`, `GET /page`; `POST /word` (`word.analyze_word` → `nlp.py`) is unused since the Words tab was removed
  - "Indent" style: `POST /get_sentence_layout` (`sentence/layout.py`, Claude's)
  - vocabulary (`vocab/vocab.py`, Claude's, wordfreq only): `GET /vocab/info`, `GET /vocab/word?index=`, `GET /vocab/threshold?index=`, `POST /vocab/unknown`;
    `POST /translate` (teammate's commit c597240): Gemini (`google-genai`, model `GEMINI_MODEL`, default gemini-3.5-flash-lite), `{word, sentence|context, to_language}`
    → `{translation}` (default Simplified Chinese; null on any error). **Key: `GEMINI_API_KEY` in `backend/.env`** (gitignored). It was once misplaced in
    `backend/word/.env`, which made every translation null; moved 2026-11-14 and verified ("intractable" → 难以解决的).
  - unused but kept (tried and set aside): `/get_sentence_highlight` (teammates' older rating), `/get_sentence_roles` (`roles.py`)
  - `app.py`, `bionic/`, `tests/test_bionic.py` are the old port-5050 API, unused (not deleted; ask before removing). `nlp.py` **is** used (by `analyze_word`).
- `UI` – empty 0-byte file at the repo root. Ignore it.

## Commands
```bash
node --test extension/tests/core.test.js extension/tests/strings.test.js   # unit tests (folder form `node --test extension/tests` fails on Node 24)
node --check extension/popup/popup.js            # quick syntax checks (same for content/bionic.js, background/background.js)

cd backend && venv/Scripts/python.exe server.py  # Windows; http://127.0.0.1:5000. Use `venv` (has google-genai + python-dotenv);
                                                 # `.venv` lacks them (run `uv sync` to update it). spaCy loads on first request
cd backend && .venv/Scripts/python.exe -m unittest tests.test_rating tests.test_depth tests.test_roles tests.test_layout -v   # loads the model, ~5 s
cd backend && .venv/Scripts/python.exe -m unittest tests.test_vocab -v   # wordfreq only, ~1 s
cd backend && .venv/Scripts/python.exe -m sentence.rating                # prints sample sentences with ratings
```
Load the extension: `chrome://extensions` → Developer mode → Load unpacked → pick the `extension/` folder (the one containing `manifest.json`).
Firefox: `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `manifest.json`. Reload the extension after code changes.

## Product decisions (don't undo without asking)
- **History (2026-11-14):** the user had Claude strip the extension to a one-switch skeleton, tried several looks, then asked for the **original six-tab popup back**
  (restored from commit `8f5425c`), keeping the new spaCy bolding. **English only**: the language screen, Settings > Language and `i18n.js` were removed on purpose;
  strings live in `popup/strings.js` (`tx(key, vars)`), static text is plain English in the HTML. Don't bring languages back unless asked.
- **Page look = "version C"** (user: "句子结构加粗+每个单词加粗"): every word's letters from `/get_word_highlight` are bold, weight by `/get_sentence_rating`
  0/1/2 = 500/650/800; the rest of each word at opacity .75. Constants `WEIGHT`, `FADE_OPACITY` at the top of `content/bionic.js`.
  **Bold amount and min_dim_thres are built in (2026-11-14, user):** `core.FIXED = {bionicStrength: 40, dimMin: 60}` is applied over stored settings by
  `core.withFixed` in the popup and the content script (old saved values are ignored). The Bold amount slider, the Home "Bold intensity" presets and the
  "Faintest words" slider were removed. 40 = exactly the letters the backend chose (`core.buildFlags(text, words, pct)` still supports scaling).
- **Three reading styles** (Home > Reading style: Weight / Tree / Indent, key `bionicStyle`): `weight` (above, default), **`tree`**, and `layout` (below). Tree (user: "句子树，越深越浅，但是有min_dim_thres", 2026-11-14):
  every word's opacity = max(min_dim_thres, AA floor, 1 − 0.1 × depth) (`core.dimFor`, `TREE_STEP` 0.1), bold letters from `word.py` at weight 700 (`TREE_WEIGHT`), no extra fade.
  min_dim_thres = `dimMin`, fixed at 60 % (user said 40 was too light; now built in, no slider).
  **Accessibility guard:** `core.minOpacityForContrast(fg, bg)` gives the lowest opacity that keeps WCAG AA 4.5:1 against the element's real background
  (`aaFloor()` in the content script, cached per parent; background = first ancestor with an opaque background color, else white). It applies to tree-style dimming
  and to the weight style's faded word ends. E.g. black text: floor 0.54; #333: 0.67; #555: 0.81; text already below AA is never faded. Changing the style restarts formatting (different backend data);
  (dimMin / Bold amount are fixed now). The popup preview does not show the tree style (it needs the backend).
- **Rating (`sentence/rating.py`, "make bold more accurate"):** 2 = each clause's subject head / verb / object / `not`; copula sentences give 2 to the complement, not `is`;
  auxiliaries, copulas, pronoun subjects, weak adverbs, numbers = 0; other content words = 1; named entities, compound proper names and hyphenated words share one score.
  Known tradeoff: coordinated lists (names, products) all get 2.
- **Third style `layout` ("Indent", user request 2026-11-14):** sentences of **more than 8 words** (`MIN_SENTENCE_WORDS` 9 in `layout.py`) get one line per clause;
  each clause that modifies another is indented one more step (`INDENT_EM` 1.5), the main clause returns left after an inner clause. Word starts are still bolded
  (weight 700, full opacity; `LAYOUT_BOLD = false` in `content/bionic.js` = indents only). Uses `/get_sentence_layout` + `core.layoutBreaks`/`splitPiece`.
  Earlier the same line-break idea as the *only* look was rejected ("太乱"); as an optional mode the user asked for it. Don't make it the default.
  **Wrapped lines keep their indent (hanging lines):** `planHang` + `hangLines` in `content/bionic.js` move whole child nodes of the container (the paragraph, or the one
  element all breaks sit in, e.g. `<p><span>…`) into `<span class="reden-line" style="display:block; padding-inline-start:N em; text-indent:0">`, so nothing is cut or cloned.
  A break inside a link/`<b>` snaps to that element's nearer edge (the link is never split). Only a container with block children falls back to inline `<br>` + spacer.
  Restore unwraps `.reden-line` first, then puts each original text node back once (a text node may have been split into several `.reden-w` pieces; later pieces are removed).
  Verified in headless Chrome (real core.js + bionic.js, stubbed APIs replaying real server.py answers, 360 px column): screenshot shows indented wrap lines;
  restore leaves the HTML byte-identical. Test page lives only in the temp dir (not committed).
- **Set aside:** whole-word bold/fade roles (`roles.py`).
- **Vocabulary level + unknown words (2026-11-14, user request):** Read tab > Vocabulary. "Test my vocabulary" = 10 yes/no questions over the wordfreq
  list (~92.7k English words, ascii letters, 3–15 long), **first question at 50 %** (`core.vocabStart/NextIndex/Answer/Done/Estimate/Range`, `VOCAB_QUESTIONS` 10).
  **Algorithm = Bayesian adaptive test, not binary search** (user worried one slip ruins binary search; simulated: with 5 % slips binary search was off
  by >2x in 15 % of tests, worst 5 % ≈6x; Bayesian 3 %, ≈1.8x). Posterior over the level on 400 log-spaced points; answer model
  P(know) = 0.05 + 0.9·logistic((log level − log index)/0.3); next question at the posterior median; estimate = median; shown range = 10th–90th percentile
  (contains the true level ~80–90 % in simulation). lo/hi sent to the backend = 5th–95th percentile. Saved: vocabZipf, vocabSize, vocabLow, vocabHigh;
  popup shows "about 12,000 English words (likely 8,600–17,000)" (rounded). Real popup run with the first answer deliberately wrong: 14,000 (true 12,000). The backend
  skips names/international words (`is_international`: about as common in ≥4 of fr/de/es/it/pt/nl/pl/sv, e.g. pelosi, internet) and inflected forms (pandemics,
  rubbed) and vowel-less abbreviations (hrs) when choosing the quiz word. **Random:** the word is picked at random among suitable words within ±15
  (`vocab.JITTER`) of the midpoint, kept inside the current search range (popup sends `&lo=&hi=`), so each test asks different words; the backend
  returns the index it actually used and the binary search continues from there. Place names like "peoria" can still appear (not filtered). Result saved as `vocabZipf` (threshold, core.DEFAULTS) + `vocabSize` (popup).
  Switch "Translate words I may not know" (`vocabOn`, needs a test first). **Mother language** text field above it (key `nativeLang` in core.DEFAULTS,
  default "Chinese", free text, saved 500 ms after typing; empty → Chinese) is sent as `to_language` to `/translate` (Gemini), so any language works;
  the translation cache and `vocabKey` include it (changing it re-formats). Glosses get `dir=auto` + `unicode-bidi: isolate` for RTL languages.
  Verified with the real backend + Gemini: intractable/dubious → (intratable)/(dudoso) for Spanish, (棘手的)/(可疑的) for Chinese. Content script (any style): lower-case letter words of the paragraph →
  `reden:vocab` (`/vocab/unknown`: zipf < threshold, not international) → `reden:translate` per unknown word (cached) → if a string comes back, insert
  `<span class="reden-gloss"> (translation)</span>` after the word (`core.splitPiece` gloss marks: after the word's last character). `/translate` returns null,
  (shows a bracket whenever Gemini returns a translation). Vocab failures are never fatal (no glosses). Changing vocabOn/vocabZipf restarts formatting.
  Verified in headless Chrome: popup quiz against the real server (simulated reader of 12,000 words → estimate 11,995, zipf 3.63); glosses render after
  "intractable"/"dubious" with a fake translation, also in the Indent style; with the real null translation nothing is added. Classic bionic reading has no evidence
  (Snell 2024, *Acta Psychologica*); never claim REden speeds reading.
- **Backend-driven: if the backend is unreachable REden does nothing** (no bold, no zoom, no spacing; the popup says so). The popup preview/specimen is drawn locally.
- **One popup page, three sides** (Home, Read, Settings), switched by clicking the icons. The user explicitly did *not* want separate HTML files/URLs.
  **Words (incl. word look-up and the on-device translator), Notes and Stats were removed at the user's request (2026-11-14)**; Settings lost "Clear words and notes".
- **Section switching is CSS-only** (hidden radio inputs `#t-<id>` + `:checked`). JS only remembers the last section. Arrow keys work natively on the radios.
- **Dark mode** is applied by `body.dark` from JS *and* by a `body:has(#opt-dark:checked)` fallback. Keep both variable blocks in `popup.css` in sync.
  **Popup text size** is a slider (Settings, 12–22 px, key `popupSize`).
- Bionic switch appears on **Home and Read** and both stay in sync. Home: reading style (Weight / Tree / Indent) and page text style
  (Original / Rounded / Editorial). Read: font size, line spacing, letter spacing, high contrast, Automatic mode, Vocabulary, Page words, Sentence analysis.
- Rounded/Editorial set `font-family` only on the `.reden-w` spans REden creates, so they apply only while REden is on. High contrast sets the span color to black/white.
- **Page words** (Read tab): on click, reads the tab's visible text, `core.collectWords` lists every word, logs it in the popup and page console, POSTs to `/page`.
- **Sentence analysis** (Read tab): selected text → `POST /sentences` (spaCy sentence split).
  The popup calls these directly with `fetch` to the Settings backend address (default `http://127.0.0.1:5000`; a saved old `:5050` is migrated on open).
- Font size and line spacing apply only while Bionic reading is on. Font size uses CSS `zoom` on `<html>`. "Dark page" is a one-off `insertCSS`, not persisted.

## How the page formatting works (content script)
- **Flow:** content script → `runtime.sendMessage` → `background.js` (reads `backendUrl` from storage; host permission bypasses CORS, server.py has no CORS) → server.py.
  Messages: `reden:health`, `reden:sentence` (→ `/get_sentence_rating`), `reden:depth` (→ `/get_sentence_depth`, tree), `reden:layout` (→ `/get_sentence_layout`, indent),
  `reden:word` (→ `/get_word_highlight`), `reden:vocab` (→ `/vocab/unknown`), `reden:translate` (→ `/translate`). The popup calls `/vocab/*` directly with fetch.
- Per paragraph: sentences (`core.sentencesOf`: `Intl.Segmenter`, merged back at `.NET` / `Node.js` / lowercase starts) → items = words **and numbers**
  (`core.wordsOf`, numbers give spaCy full context but are never bolded) → one rating request per sentence → one word request per distinct Latin/Cyrillic/Greek word (cached).
  Max 6 requests in flight, 3 paragraphs in parallel, `gen` counter drops late answers after turning off. Answers are kept in `rendered`, so changing Bold amount re-draws with no new request.
- **Lazy (2026-11-14, user: save tokens):** a paragraph is only analysed (backend + translation requests) once it comes within 300 px of the screen
  (`IntersectionObserver`, `VISIBLE_MARGIN`, `watchBlock`/`onVisible`); text that changes in a paragraph already seen is re-queued directly. Hidden/never-reached
  paragraphs cost nothing. Verified in headless Chrome driven over the DevTools protocol (real scrolling; virtual-time headless does not fire
  IntersectionObserver after scroll): 60-paragraph page → 10 sent at the top, 47 after 6 screens, 60 at the bottom, none twice; jumping straight to the
  bottom skips the paragraphs in between.
- **Article only:** if the page has `article, main, [role=main]` only text inside it; always skipped: `nav, aside, footer, button, label`, page `header`, ARIA chrome roles,
  `aria-hidden`, icon fonts, code/pre/form fields/editable areas, blocks with fewer than 3 words. Blocks found by computed `display`; inline links/bold stay in the block text.
- Text nodes are replaced by `<span class="reden-w">` with `<b class="reden-b">` / `<span class="reden-f">` pieces; originals kept in a `WeakMap` and restored on off (batched ~12 ms).
  A `MutationObserver` queues new text; our own spans are ignored. Settings live in `chrome.storage.local` (`core.DEFAULTS`); the script re-applies on `storage.onChanged` (80 ms debounce).
- **Backend down:** `reden:health` when turning on; any failed request mid-way → `goOffline()` (restore, phase `offline`). Opening the popup sends `reden:recheck`.

## Permissions (keep minimal)
- `storage`, `activeTab`, `scripting`; `host_permissions` only `127.0.0.1:5000` and `localhost:5000`.
- `optional_host_permissions` `http://*/*`, `https://*/*` – requested **only** when the user turns on "Format every website automatically" (requested straight from the click).
  Automatic mode registers the content script (`reden-bionic`); turning it off unregisters it and removes the permission.

## Cross-browser rules
- `const api = globalThis.browser ?? globalThis.chrome`; call extension APIs without callbacks and treat the return as a promise (`call(() => api.x(...))`).
- Manifest lists both `service_worker` and `scripts` for the background. Unsupported pages are detected by `core.checkUrl` and explained in the popup.

## Design system (REden brand)
- Flat, ruled, no gradients/card kit. Palette on `:root` / `body.dark`: paper `#FCFAFE`, ink `#2F2A6B`, controls `#3B3294`, selected `#EFEAF8`, orange `#E8975A` (accent only),
  muted `#5E6585`, rule `#E6E1F0`. Dark: paper `#1E1B3A`, ink `#ECE9FA`, blue `#A99CFF`, lavender `#34305F`, orange `#F0A872`.
- **Site-matched colors** (Settings `tintSite`, default on): the popup tints itself with a color read from the current page (`applyTint()` in `popup.js`).
- Serif stack for wordmark/headings/specimen, rounded sans for controls. System fonts only, no bundled font files.
- Logo: the user's own (R + open book, indigo `#494188`, orange bar). Do not redesign. `icons/mark.png` is tinted via CSS mask.
- Copy: sentence case, plain active voice, errors say what happened and what to do next.

## Testing notes / status
- spaCy gotcha: `token.head is token` is never true (new Python object per access); compare `token.head.i == token.i`.
- **Icon-font check uses only the FIRST font** (`core.isIconFont`). Bootstrap's default stack ends with `"Segoe UI Symbol"`, so testing the whole list made REden
  skip every paragraph on Bootstrap sites (found on https://rajagopalvenkat.com/teaching/resources/algo/ch6.html, fixed and verified there in headless Chrome).
- Verified: JS unit tests (28), Indent style end to end against the real server (text preserved across two text nodes), tree style end to end against the real server (core.js + `/get_sentence_depth` + `/get_word_highlight`), backend `tests.test_rating` + `test_roles` + `test_layout`, and every server.py endpoint the extension calls (`/health`, `/sentences`, `/word`,
  `/page` POST+GET, `/get_sentence_rating`, `/get_word_highlight`) with curl against the real server.
- **Not yet verified in a real loaded extension** after the restore (popup + content script merge). The restored popup code is the committed original apart from the
  language removal and the backend address.

## Known limitations
- Sites that re-render text nodes (React/Vue) can overwrite formatted text. No iframes or shadow DOM. Older Firefox ignores CSS `zoom`.
- One request per sentence plus one per distinct word; fine locally, would be slow over a network. English only (spaCy `en_core_web_trf`).

## Working with the user
- Beginner at extensions; give short numbered steps with exact paths and menu names, and say what they should see.
- Messages are often short/ambiguous (often in Chinese). If unclear, ask which thing they mean instead of guessing.
- Commit only when asked.
