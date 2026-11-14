// Shared by the popup (live preview) and the content script (real pages).
// Pure logic only: no DOM and no extension APIs, so it can be unit tested in Node.
(function (root) {
  "use strict";

  const DEFAULTS = {
    bionicOn: false,      // master switch
    bionicAuto: false,    // auto-apply on every page load (needs host permission)
    bionicStrength: 40,   // % of each word to bold (20-80); 40 = "Medium" preset
    bionicSize: 100,      // page zoom % while bionic is on (100-200)
    bionicSpacing: 0,     // line-height while bionic is on; 0 = leave the page's own
    bionicLetter: 0,      // letter-spacing in em while bionic is on; 0 = leave the page's own
    bionicMode: "original", // "original" keeps the page font; "rounded" / "editorial" swap it
    bionicContrast: false,  // push formatted text toward black or white for more contrast
  };

  // Starting points for experimentation, not validated optimal settings.
  const PRESETS = { low: 25, medium: 40, high: 55 };

  // Font stacks for the page text. Only used on text REden formats; null = keep the page's font.
  // System fonts only: nothing is downloaded, and installed Nunito / Newsreader are used if present.
  const FONT_STACKS = {
    original: null,
    rounded: '"Nunito Sans", Nunito, ui-rounded, "SF Pro Rounded", "Avenir Next Rounded", "Varela Round", system-ui, sans-serif',
    editorial: 'Newsreader, Lora, "Iowan Old Style", Charter, "Palatino Linotype", Georgia, serif',
  };

  // Parse "rgb(r, g, b)" / "rgba(...)" and return a text color pushed toward black or white, or null.
  function contrastColor(cssColor) {
    const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(cssColor || "");
    if (!m) return null;
    const lum = (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255;
    return lum < 0.5 ? "#000" : "#fff";
  }

  // Elements whose text must never be touched: code, form fields, editable areas, our own output,
  // and page "chrome" (menus, buttons, toolbars, sidebars, footers). Only article text is formatted.
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

  // If the page has an article/main region, only text inside it is formatted.
  const SCOPE_SELECTOR = 'article, main, [role="main"]';
  // Icon fonts draw symbols from text ("star", "menu"); never touch those.
  const ICON_FONT_RE = /icon|symbol|glyph|awesome|material|dingbat|webdings/i;

  // Only scripts where "bold the first letters" makes sense. CJK, Thai, Arabic etc. are left alone.
  const L = "\\p{Script=Latin}\\p{Script=Cyrillic}\\p{Script=Greek}";
  const WORD_RE = new RegExp(
    `(?<![\\p{L}\\p{M}\\p{N}_])[${L}][${L}\\p{M}]*(?:['’][${L}][${L}\\p{M}]*)*(?![\\p{L}\\p{N}_])`,
    "gu"
  );
  const LETTER_RE = new RegExp(`[${L}]`, "u");
  const MARK_RE = /^\p{M}$/u;

  function clampPct(p) {
    const n = Number(p);
    return Math.min(80, Math.max(20, Number.isFinite(n) ? n : DEFAULTS.bionicStrength));
  }

  // Number of characters (code points) to bold in a word of this many characters.
  function boldCount(chars, pct) {
    const len = chars.length;
    let n = Math.min(len, Math.max(1, Math.ceil((len * clampPct(pct)) / 100)));
    while (n < len && MARK_RE.test(chars[n])) n++; // never split a letter from its accent
    return n;
  }

  // "reading" -> ["Read", "ing"]
  function splitWord(word, pct) {
    const chars = Array.from(word);
    const n = boldCount(chars, pct);
    return [chars.slice(0, n).join(""), chars.slice(n).join("")];
  }

  // Break text into [{text, bold}] pieces. Joining all `text` values gives back the input exactly.
  function segments(text, pct) {
    const out = [];
    let last = 0;
    for (const m of text.matchAll(WORD_RE)) {
      if (m.index > last) out.push({ text: text.slice(last, m.index), bold: false });
      const [head, tail] = splitWord(m[0], pct);
      out.push({ text: head, bold: true });
      if (tail) out.push({ text: tail, bold: false });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ text: text.slice(last), bold: false });
    return out;
  }

  // The backend answers with [start, end, rating, boldLen] per word to emphasise. Turn that into one
  // number per UTF-16 unit of `text`: 0 = plain, 1 or 2 = bold (the word's rating).
  // `pct` scales the backend's bold length: 40 = as the backend chose, 20 = half, 80 = double.
  function applyTiers(text, marks, pct) {
    const flags = new Uint8Array(text.length);
    if (!Array.isArray(marks)) return flags;
    const scale = clampPct(pct) / 40;
    for (const m of marks) {
      if (!Array.isArray(m)) continue;
      const [s, e, rating, len] = m;
      if (!Number.isInteger(s) || !Number.isInteger(e) || s < 0 || e <= s || e > text.length) continue;
      if (rating !== 1 && rating !== 2) continue;
      const chars = Array.from(text.slice(s, e));
      if (!LETTER_RE.test(chars[0])) continue;
      const base = Number.isInteger(len) && len > 0 ? len : boldCount(chars, 40);
      let n = Math.min(chars.length, Math.max(1, Math.round(base * scale)));
      while (n < chars.length && MARK_RE.test(chars[n])) n++;
      flags.fill(rating, s, s + chars.slice(0, n).join("").length);
    }
    return flags;
  }

  // Split `text` (which starts at `offset` inside the flags array) into runs of equal flag: [{text, tier}].
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

  // Every word in a text, in reading order (any script, duplicates kept). Used by "Page words".
  const ANY_WORD_RE = /\p{L}[\p{L}\p{M}]*(?:['’]\p{L}[\p{L}\p{M}]*)*/gu;
  function collectWords(text) {
    return typeof text === "string" ? text.match(ANY_WORD_RE) || [] : [];
  }

  // Can an extension change this page? Returns {ok:true} or {ok:false, reason}.
  function checkUrl(url) {
    let u;
    try { u = new URL(url); } catch (_) {
      return { ok: false, reason: "REden can't tell which page this is." };
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, reason: "Browser pages, new tabs and local files can't be changed by extensions." };
    }
    const h = u.hostname;
    if (h === "chromewebstore.google.com" || h === "addons.mozilla.org" ||
        h === "microsoftedge.microsoft.com" ||
        (h === "chrome.google.com" && u.pathname.startsWith("/webstore"))) {
      return { ok: false, reason: "Browsers don't let extensions change extension store pages." };
    }
    if (/\.pdf$/i.test(u.pathname)) {
      return { ok: false, reason: "PDF viewers don't allow extensions to change their text." };
    }
    return { ok: true };
  }

  const api = { DEFAULTS, PRESETS, FONT_STACKS, contrastColor, SKIP_SELECTOR, SCOPE_SELECTOR, ICON_FONT_RE, applyTiers, segmentsFromFlags, WORD_RE, LETTER_RE, clampPct, boldCount, splitWord, segments, collectWords, checkUrl };
  root.REdenCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
