# REden browser extension

Bionic reading for the web: REden bolds the beginning of each word on the page you are reading
("**Rea**ding" → "**Rea**d**ing**") so text is easier to scan. Manifest V3; Chrome, Edge, Brave and
Firefox 128+.

Bionic reading needs the **Python backend** (`backend/server.py`): REden sends each sentence to it, spaCy rates how important every word is in its sentence, and the bold is heavier for more important words (the rest of each word is slightly lighter).
**If the backend is not running, REden does nothing to the page.** Start it with `python server.py` in `backend/` (see `../backend/readme.md`).

## Structure
- `manifest.json` – extension config and permissions
- `shared/core.js` – word splitting + page support check (used by popup and page script; unit tested)
- `content/bionic.js` – content script: extracts the article, asks the backend, bolds the answer, restores on off
- `background/background.js` – the only code that calls the backend (page scripts can't)
- `popup/` – popup UI (`popup.html`, `popup.css`, `popup.js`, `strings.js` = all popup text, English only): Home, Read, Words, Notes, Stats, Settings
- `icons/` – toolbar icons
- `tests/core.test.js` – unit tests

## Load it
- **Chrome / Edge / Brave:** open `chrome://extensions`, enable Developer mode, click "Load unpacked", pick this `extension/` folder.
- **Firefox:** open `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", pick `manifest.json`.

After changing code, click the extension's reload button and reopen the popup.

## Using it
1. Open a normal web page (an article works best), click the REden icon.
2. Turn on **Bionic reading** (Home or Read). The page changes immediately; turn it off to restore the
   original text without reloading.
3. On **Home**, pick **Bold intensity** (Low, Medium, High) and **Page text style** (Original keeps the site font; Rounded and Editorial change only the text REden formats). On **Read**, fine-tune **Bold amount**, **Font size**, **Line spacing**, **Letter spacing** and **High contrast text**. The live preview and the
   page update as you change them. Font size and line spacing apply only while Bionic reading is on.
4. Turn on **Automatic on every website** to format pages as soon as they load (see Permissions).

**Page words:** on Read, press "Collect words from this page". Every word on the page is printed to the page's console (F12 > Console) and sent to the local backend (`POST /page`; read it back with `GET /page`). Nothing is sent until you press the button.

**Translate:** on the Words tab, choose a language, type English text (or select text on the page and leave the box empty) and press Translate. It uses the browser's on-device translator (Chrome or Edge 138+); the first use downloads a small language pack.

Settings (including theme, notes and saved words) are saved in browser storage and survive closing the popup
and restarting the browser.

## Permissions
| Permission | Why |
|---|---|
| `storage` | Remember your settings, notes and words. |
| `activeTab` | When you click the REden icon, temporarily access **that tab only** so the switch can format it. No prompt, no access to other tabs. |
| `scripting` | Inject the formatting script into the current tab, and register it for Automatic mode. |
| `host_permissions`: `127.0.0.1:5000`, `localhost:5000` | Talk to the optional local Python backend. |
| `optional_host_permissions`: `http://*/*`, `https://*/*` | **Only requested when you turn on "Automatic on every website".** It lets the browser run the script on pages as they load. Turning Automatic off removes it again. |

Article text is sent only to the backend address in Settings (`http://127.0.0.1:5000`, your own computer, by default), never anywhere else.
The background worker exists only to make those calls. There is no remote code.

## How the formatting is applied
- Individual text nodes are replaced by a small `<span>` holding the bold and normal pieces; the original
  text node is kept and put back when you turn the feature off. Page HTML is never replaced wholesale.
- Skipped: `script`, `style`, `code`, `pre`, `kbd`, `samp`, form fields, `textarea`, editable areas,
  `svg`, `iframe`, and any text that is not Latin, Cyrillic or Greek (Chinese, Japanese, Arabic, … are left alone).
- Links, buttons, punctuation and whitespace are preserved.
- Work happens in ~12 ms batches, and a `MutationObserver` formats text added later (infinite scroll, chat, SPAs)
  exactly once.

## Run the checks
```bash
node --test extension/tests
```
(From the repo root. Requires Node 18+.)

## Manual test checklist
1. **Format / restore:** open any article → turn on Bionic reading → word starts turn bold → turn off → text
   is back to normal, no reload needed.
2. **Skipped content:** on a page with code blocks or a search box, confirm code and what you type are not bolded.
3. **Links & buttons:** click a bolded link and button; they still work.
4. **Controls:** change Bold amount, Font size, Line spacing; preview and page update. Close and reopen the popup; values are kept.
5. **Automatic mode:** turn on "Automatic on every website" → accept the browser prompt → turn Bionic reading on →
   open a different site or reload → it is formatted without opening the popup. Turn Automatic off → reload → not formatted.
6. **Dynamic content:** on a page that loads more content (a feed or infinite scroll), new text is formatted once, with no
   doubled bolding.
7. **Unsupported pages:** open `chrome://extensions` or the Chrome Web Store → popup explains the page can't be changed.
8. **Backend down:** with the backend stopped, turning Bionic reading on formats nothing and the popup says the backend isn't reachable; start it, reopen the popup and the page is formatted.
9. **Keyboard:** Tab to the section icons and use ←/→ to switch; Space toggles switches; focus rings are visible.
10. **Theme:** Settings → Dark mode / Large text change the popup and persist.

## Backend (optional)
See `../backend/readme.md`; then run `python server.py` (serves `http://127.0.0.1:5000`).

## Add a section
In `popup/popup.html` add a radio `<input class="tab-radio" id="t-x">`, a `<label class="tab" for="t-x">` in the nav and a matching
`<section id="x" class="panel">`, plus a focus/selected rule pair in `popup.css` (copy an existing `#t-…` pair).

## Known limitations
- Pages that re-render their own text nodes from a framework (some React/Vue apps) can overwrite a formatted node; new text is picked up
  again, but a node updated in place after formatting may show unformatted text until it changes again.
- Text inside iframes and shadow DOM is not formatted.
- Font size uses CSS `zoom` on the page (Chrome, Edge, Safari, Firefox 126+); older Firefox ignores it.
- The "Dark page" toggle (Settings) is a one-off style for the current tab and is not remembered across page loads.
- Automatic mode is for `http`/`https` pages; browser pages, extension stores and PDF viewers cannot be changed.
