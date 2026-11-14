// Pure logic shared by the content script and the tests. No DOM, no extension APIs.
(function (root) {
  "use strict";

  // Never touch: code, form fields, editable areas, page chrome (menus, buttons, sidebars, footers), our own output.
  const SKIP_SELECTOR = [
    "script", "style", "noscript", "template", "iframe", "svg", "math",
    "code", "pre", "kbd", "samp", "textarea", "input", "select", "option",
    "nav", "aside", "footer", "button", "label",
    '[contenteditable]:not([contenteditable="false"])',
    '[role="textbox"]', '[role="button"]', '[role="navigation"]', '[role="banner"]', '[role="menu"]',
    '[role="menubar"]', '[role="menuitem"]', '[role="toolbar"]', '[role="tab"]', '[role="tablist"]',
    '[role="contentinfo"]', '[role="complementary"]', '[role="search"]', '[aria-hidden="true"]',
    ".reden-w",
  ].join(",");

  // If the page has an article/main region, only text inside it is used.
  const SCOPE_SELECTOR = 'article, main, [role="main"]';
  // Icon fonts draw symbols from text ("star", "menu"); never touch those.
  const ICON_FONT_RE = /icon|symbol|glyph|awesome|material|dingbat|webdings/i;
  const LETTER_RE = /\p{L}/u;
  const MARK_RE = /^\p{M}$/u;

  // A word: letters, optionally joined by apostrophes (don't, l'été). Numbers and symbols are not words.
  const WORD_RE = /\p{L}[\p{L}\p{M}]*(?:['’]\p{L}[\p{L}\p{M}]*)*/gu;

  function countWords(text) {
    return typeof text === "string" ? (text.match(WORD_RE) || []).length : 0;
  }

  // Paragraph -> sentences: [{start, end}] as UTF-16 offsets into `text`.
  function sentencesOf(text) {
    const out = [];
    if (typeof text !== "string" || !text) return out;
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      for (const s of new Intl.Segmenter("en", { granularity: "sentence" }).segment(text)) {
        out.push({ start: s.index, end: s.index + s.segment.length });
      }
      return out;
    }
    const re = /[^.!?]*(?:[.!?]+["')\]’”]*\s+|[^.!?]+$)/g; // fallback: split after . ! ? and a space
    let m;
    while ((m = re.exec(text)) && m[0]) out.push({ start: m.index, end: m.index + m[0].length });
    return out;
  }

  // Sentence -> words, in the shape server.py's /get_sentence_highlight wants:
  //   items        ["what", "about", "you"]   special characters removed
  //   punctuation  [[2, "?"]]                  marks after word 2 (only helps spaCy, word indexes don't move)
  //   spans        [[start, end]]              where each word is in `text` (for drawing)
  function wordsOf(text, start = 0, end = text.length) {
    const part = text.slice(start, end);
    const matches = [...part.matchAll(WORD_RE)];
    const items = [], spans = [], punctuation = [];
    matches.forEach((m, i) => {
      items.push(m[0]);
      spans.push([start + m.index, start + m.index + m[0].length]);
      const next = i + 1 < matches.length ? matches[i + 1].index : part.length;
      const marks = part.slice(m.index + m[0].length, next).replace(/[\s\p{L}\p{N}]/gu, "");
      if (marks) punctuation.push([i, marks]);
    });
    return { items, spans, punctuation };
  }

  // One style number per UTF-16 unit of the paragraph:
  //   0 = untouched (spaces, punctuation, numbers)
  //   1 / 2 / 3 = a bold letter of a rating 0 / 1 / 2 word (light / medium / heavy bold)
  //   4 = FADED: a letter of a word that the word backend didn't bold
  // words: [{start, end, rating, idx}]  rating from the sentence backend, idx = letter indexes from the word backend.
  const FADED = 4;
  function buildFlags(text, words) {
    const flags = new Uint8Array(text.length);
    if (!Array.isArray(words)) return flags;
    for (const w of words) {
      if (!w || !Number.isInteger(w.start) || !Number.isInteger(w.end) || w.start < 0 || w.end <= w.start || w.end > text.length) continue;
      if (w.rating !== 0 && w.rating !== 1 && w.rating !== 2) continue;
      const bold = new Set(Array.isArray(w.idx) ? w.idx : []);
      if (!bold.size) continue; // no answer for this word: leave it as it is
      let pos = w.start, i = 0, prev = 0;
      for (const c of text.slice(w.start, w.end)) { // idx counts letters (code points), not UTF-16 units
        const f = prev && MARK_RE.test(c) ? prev : bold.has(i) ? w.rating + 1 : FADED; // accents follow their letter
        flags.fill(f, pos, pos + c.length);
        prev = f;
        i++;
        pos += c.length;
      }
    }
    return flags;
  }

  // Split `text` (starting at `offset` in flags) into runs of equal style: [{text, tier}].
  function segmentsFromFlags(text, flags, offset) {
    const out = [];
    let i = 0;
    while (i < text.length) {
      const tier = flags[offset + i] | 0;
      let j = i + 1;
      while (j < text.length && (flags[offset + j] | 0) === tier) j++;
      out.push({ text: text.slice(i, j), tier });
      i = j;
    }
    return out;
  }

  // Can an extension change this page? {ok:true} or {ok:false, reason}.
  function checkUrl(url) {
    let u;
    try { u = new URL(url); } catch (_) { return { ok: false, reason: "REden can't tell which page this is." }; }
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, reason: "Browser pages, new tabs and local files can't be changed by extensions." };
    }
    const h = u.hostname;
    if (h === "chromewebstore.google.com" || h === "addons.mozilla.org" || h === "microsoftedge.microsoft.com" ||
        (h === "chrome.google.com" && u.pathname.startsWith("/webstore"))) {
      return { ok: false, reason: "Browsers don't let extensions change extension store pages." };
    }
    if (/\.pdf$/i.test(u.pathname)) return { ok: false, reason: "PDF viewers don't allow extensions to change their text." };
    return { ok: true };
  }

  const api = { SKIP_SELECTOR, SCOPE_SELECTOR, ICON_FONT_RE, LETTER_RE, countWords, sentencesOf, wordsOf, FADED, buildFlags, segmentsFromFlags, checkUrl };
  root.REdenCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
