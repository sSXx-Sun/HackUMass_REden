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
    bionicStyle: "weight",  // "weight": bold weight from the sentence rating; "tree": deeper in the sentence tree = lighter;
                            // "layout": sentences over 8 words get one line per clause, modifying clauses indented
    dimMin: 60,             // "tree" style: min_dim_thres, the faintest a word can get (opacity %, 50-90)
    vocabOn: false,         // add a translation in brackets after words rarer than the user's level
    vocabZipf: 0,           // the user's level as a word frequency (wordfreq zipf); 0 = not tested yet
  };

  // "tree" style: each level deeper in the sentence tree loses this much opacity, down to dimMin.
  // aaFloor (from minOpacityForContrast) keeps the faded text readable: it wins when it is higher than dimMin.
  const TREE_STEP = 0.1;
  const DIM_MIN_RANGE = [50, 90];
  function dimFor(depth, dimMin, aaFloor = 0) {
    const pct = Math.min(DIM_MIN_RANGE[1], Math.max(DIM_MIN_RANGE[0], Number(dimMin) || DEFAULTS.dimMin));
    const d = Math.max(0, Number(depth) || 0);
    return Math.min(1, Math.max(pct / 100, aaFloor, 1 - TREE_STEP * d));
  }

  // ---------- accessibility: never fade text below WCAG AA contrast ----------
  const AA_CONTRAST = 4.5; // WCAG 2.x AA for normal-size text
  function parseRgb(cssColor) {
    const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?/.exec(cssColor || "");
    if (!m) return null;
    let a = m[4] === undefined ? 1 : parseFloat(m[4]) / (m[4].endsWith("%") ? 100 : 1);
    return [Number(m[1]), Number(m[2]), Number(m[3]), a];
  }
  function relLuminance(rgb) {
    const [r, g, b] = rgb.slice(0, 3).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function contrastRatio(a, b) {
    const x = relLuminance(a), y = relLuminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  // Lowest opacity at which text of color fg, drawn over bg, still has `target` contrast. 1 if even full opacity can't.
  function minOpacityForContrast(fg, bg, target = AA_CONTRAST) {
    if (!fg || !bg) return 0;
    if (contrastRatio(fg, bg) < target) return 1;
    const blend = (t) => [0, 1, 2].map((i) => fg[i] * t + bg[i] * (1 - t));
    let lo = 0, hi = 1;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (contrastRatio(blend(mid), bg) >= target) hi = mid; else lo = mid;
    }
    return Math.min(1, Math.ceil(hi * 100) / 100);
  }

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
  // Only the FIRST font in a font-family list is the one actually used. Bootstrap's default stack ends with
  // "Segoe UI Symbol" as an emoji fallback, so testing the whole list skipped every paragraph on those sites.
  function isIconFont(fontFamily) {
    const first = String(fontFamily || "").split(",")[0].replace(/["']/g, "").trim();
    return ICON_FONT_RE.test(first);
  }

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

  // ---------- paragraph -> sentences -> items (what the content script sends to server.py) ----------
  // Sentences: [{start, end}] (UTF-16 offsets). Intl.Segmenter, but ".NET" / "Node.js" / "e.g. this" are not sentence ends.
  function sentencesOf(text) {
    const out = [];
    if (typeof text !== "string" || !text) return out;
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      for (const s of new Intl.Segmenter("en", { granularity: "sentence" }).segment(text)) {
        const prev = out[out.length - 1];
        if (prev && (!/\s$/.test(text.slice(prev.start, prev.end)) || /^\p{Ll}/u.test(s.segment))) prev.end = s.index + s.segment.length;
        else out.push({ start: s.index, end: s.index + s.segment.length });
      }
      return out;
    }
    const re = /[^.!?]*(?:[.!?]+["')\]’”]*\s+|[^.!?]+$)/g; // fallback: split after . ! ? and a space
    let m;
    while ((m = re.exec(text)) && m[0]) out.push({ start: m.index, end: m.index + m[0].length });
    return out;
  }

  // Items sent to spaCy: words, plus numbers ("2000", "3.5") so the parsed sentence is complete. Numbers are never bolded.
  const ITEM_RE = /\p{L}[\p{L}\p{M}]*(?:['’]\p{L}[\p{L}\p{M}]*)*|\p{N}+(?:[.,]\p{N}+)*/gu;

  // Sentence -> {items, spans, punctuation} in the shape server.py /get_sentence_rating wants.
  //   punctuation [[i, ","]] = marks after item i (they only help spaCy; indexes don't move)
  function wordsOf(text, start = 0, end = text.length) {
    const part = text.slice(start, end);
    const matches = [...part.matchAll(ITEM_RE)];
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

  // Which letters (code point indexes) of a word to bold: the word backend's answer, scaled by the Bold amount setting.
  function boldLetters(chars, idx, scale) {
    let bold = new Set(Array.isArray(idx) ? idx.filter((i) => Number.isInteger(i) && i >= 0 && i < chars.length) : []);
    if (!bold.size) return null;
    if (scale !== 1) {
      let n = Math.min(chars.length, Math.max(1, Math.round(bold.size * scale)));
      while (n < chars.length && MARK_RE.test(chars[n])) n++;
      bold = new Set([...Array(n).keys()]);
    }
    return bold;
  }

  // "tree" style: one number per UTF-16 unit. 0 = untouched; otherwise 1 + 2 * depth + (1 if the letter is bold).
  // Decode with treeFlag(v) -> {depth, bold}. words: [{start, end, depth, idx}].
  function treeFlags(text, words, pct) {
    const flags = new Uint8Array(text.length);
    if (!Array.isArray(words)) return flags;
    const scale = clampPct(pct) / 40;
    for (const w of words) {
      if (!w || !Number.isInteger(w.start) || !Number.isInteger(w.end) || w.start < 0 || w.end <= w.start || w.end > text.length) continue;
      if (!Number.isInteger(w.depth) || w.depth < 0) continue;
      const chars = Array.from(text.slice(w.start, w.end));
      const bold = boldLetters(chars, w.idx, scale);
      if (!bold) continue; // numbers and unanswered words stay as they are
      const base = 1 + 2 * Math.min(w.depth, 100);
      let pos = w.start, prevBold = false;
      chars.forEach((c, i) => {
        const b = (prevBold && MARK_RE.test(c)) || bold.has(i);
        flags.fill(base + (b ? 1 : 0), pos, pos + c.length);
        prevBold = b;
        pos += c.length;
      });
    }
    return flags;
  }
  const treeFlag = (v) => ({ depth: (v - 1) >> 1, bold: ((v - 1) & 1) === 1 });

  // One style number per UTF-16 unit of the paragraph:
  //   0 = untouched, 1 / 2 / 3 = bold letter of a rating 0 / 1 / 2 word, 4 = FADED (the rest of the word)
  // words: [{start, end, rating, idx}]  rating from /get_sentence_rating, idx = letter indexes from /get_word_highlight.
  // `pct` is the Bold amount setting: 40 = exactly what the backend chose, 20 = half as many letters, 80 = double.
  const FADED = 4;
  function buildFlags(text, words, pct) {
    const flags = new Uint8Array(text.length);
    if (!Array.isArray(words)) return flags;
    const scale = clampPct(pct) / 40;
    for (const w of words) {
      if (!w || !Number.isInteger(w.start) || !Number.isInteger(w.end) || w.start < 0 || w.end <= w.start || w.end > text.length) continue;
      if (w.rating !== 0 && w.rating !== 1 && w.rating !== 2) continue;
      const chars = Array.from(text.slice(w.start, w.end));
      const bold = boldLetters(chars, w.idx, scale);
      if (!bold) continue; // no answer for this word (e.g. a number): leave it as it is
      let pos = w.start, prev = 0;
      chars.forEach((c, i) => {
        const f = prev && MARK_RE.test(c) ? prev : bold.has(i) ? w.rating + 1 : FADED; // accents follow their letter
        flags.fill(f, pos, pos + c.length);
        prev = f;
        pos += c.length;
      });
    }
    return flags;
  }

  // "layout" style: turn server.py /get_sentence_layout answers into line breaks for the whole paragraph.
  // sentences: [{spans, layout}] in order; layout[i] = -1 (no break) or n >= 0 (new line before item i, indent n).
  // Returns [{offset, indent, newline}] sorted by offset. newline is false at the very start of the paragraph
  // (a <br> there would leave an empty line). A sentence that follows a broken-up one starts on its own line too.
  function layoutBreaks(text, sentences) {
    const out = [];
    let breakNext = false;
    for (const s of sentences || []) {
      if (!s || !Array.isArray(s.spans) || !s.spans.length || !Array.isArray(s.layout)) continue;
      const formatted = s.layout.some((v) => Number.isInteger(v) && v >= 0);
      s.spans.forEach(([offset], i) => {
        let indent = Number.isInteger(s.layout[i]) ? s.layout[i] : -1;
        if (i === 0 && indent < 0 && breakNext) indent = 0;
        if (indent < 0 || offset < 0 || offset > text.length) return;
        out.push({ offset, indent: Math.min(indent, 6), newline: text.slice(0, offset).trim() !== "" });
      });
      breakNext = formatted;
    }
    return out.sort((a, b) => a.offset - b.offset);
  }

  // Cut one text node's text (which starts at `start` in the paragraph) at the marks that fall inside it:
  // [{text} | {indent, newline} | {gloss}]. Joining the text parts gives back `piece` exactly.
  // Marks (sorted by offset): line breaks {offset, indent, newline} go *before* the character at offset;
  // glosses {offset, gloss} go *after* the character before offset (the end of a word), so a gloss at the very end
  // of a text node belongs to that node, not to the next one.
  function splitPiece(piece, start, breaks) {
    const out = [];
    let last = 0;
    for (const b of breaks || []) {
      const cut = b.offset - start;
      const isGloss = b.gloss !== undefined;
      if (isGloss ? cut <= 0 || cut > piece.length : cut < 0 || cut >= piece.length) continue;
      if (cut > last) out.push({ text: piece.slice(last, cut) });
      out.push(isGloss ? { gloss: b.gloss } : { indent: b.indent, newline: b.newline });
      last = cut;
    }
    if (last < piece.length) out.push({ text: piece.slice(last) });
    return out;
  }

  // ---------- vocabulary test: binary search over the word-frequency list ----------
  // Start in the middle (50 %). "I know it" -> the level is at least there (search the rarer half);
  // "I don't" -> the level is below (search the more common half). 10 answers narrow ~93 000 words to ~90.
  const VOCAB_QUESTIONS = 10;
  function vocabStart(total) {
    return { lo: 0, hi: Math.max(1, Math.floor(Number(total) || 0)), asked: 0, answers: [] };
  }
  function vocabNextIndex(q) {
    return Math.floor((q.lo + q.hi) / 2);
  }
  // shownIndex = the index of the word actually shown (the backend may skip ahead past names and inflected forms).
  function vocabAnswer(q, shownIndex, known) {
    const i = Math.min(q.hi, Math.max(q.lo, Math.floor(Number(shownIndex))));
    return {
      lo: known ? Math.max(q.lo, i) : q.lo,
      hi: known ? q.hi : Math.min(q.hi, i),
      asked: q.asked + 1,
      answers: q.answers.concat([[i, !!known]]),
    };
  }
  const vocabDone = (q) => q.asked >= VOCAB_QUESTIONS || q.hi - q.lo <= 1;
  const vocabEstimate = (q) => Math.floor((q.lo + q.hi) / 2);

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

  // Every word in a text, in reading order (any script, duplicates kept). Used by "Page words" and to skip tiny blocks.
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

  const api = { DEFAULTS, PRESETS, FONT_STACKS, contrastColor, SKIP_SELECTOR, SCOPE_SELECTOR, ICON_FONT_RE, isIconFont, sentencesOf, wordsOf, FADED, buildFlags, treeFlags, treeFlag, layoutBreaks, splitPiece, VOCAB_QUESTIONS, vocabStart, vocabNextIndex, vocabAnswer, vocabDone, vocabEstimate, dimFor, TREE_STEP, DIM_MIN_RANGE, AA_CONTRAST, parseRgb, contrastRatio, minOpacityForContrast, segmentsFromFlags, WORD_RE, LETTER_RE, clampPct, boldCount, splitWord, segments, collectWords, checkUrl };
  root.REdenCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
