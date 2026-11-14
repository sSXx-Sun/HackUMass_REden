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

  // Elements whose text must never be touched (code, form fields, editable areas, our own output).
  const SKIP_SELECTOR = [
    "script", "style", "noscript", "template", "iframe", "svg", "math",
    "code", "pre", "kbd", "samp", "textarea", "input", "select", "option",
    '[contenteditable]:not([contenteditable="false"])',
    '[role="textbox"]',
    ".readen-w",
  ].join(",");

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

  const api = { DEFAULTS, PRESETS, FONT_STACKS, contrastColor, SKIP_SELECTOR, WORD_RE, LETTER_RE, clampPct, boldCount, splitWord, segments, checkUrl };
  root.ReaDeNCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
