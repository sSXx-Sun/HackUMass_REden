// REden content script.
// For every paragraph of the article: split it into sentences and items (words + numbers), then through the
// background worker ask backend/server.py
//   POST /get_sentence_rating {items, punctuation}  once per sentence -> rating 0..2 per word (spaCy sentence structure)
//   POST /get_word_highlight {word}                 once per distinct word -> which letters to bold
// and draw: bold letters weighted by rating (0 light, 1 medium, 2 heavy), the rest of each word slightly faded.
// Second style ("Sentence tree", settings.bionicStyle = "tree"): instead of the rating, ask
//   POST /get_sentence_depth {items, punctuation} -> how deep each word is in the dependency tree (root = 0)
// and draw every word lighter the deeper it is (core.dimFor), never lighter than settings.dimMin (min_dim_thres).
// Third style ("Indent", settings.bionicStyle = "layout"): ask POST /get_sentence_layout, and for sentences of more than 8 words
// start a new line per clause, indenting each clause that modifies the one above it (INDENT_EM per level). Word starts are still bolded.
// Vocabulary (settings.vocabOn + vocabZipf from the popup test, any style): POST /vocab/unknown with the paragraph's words, then
// POST /translate for each unknown word and add " (translation)" after it. /translate returns null for now, so nothing is added yet.
// If the backend can't be reached, REden does nothing: no formatting, no zoom, no spacing.
// It never replaces page HTML wholesale: it swaps single text nodes for a small <span> and puts the
// original text node back when turned off.
(function () {
  "use strict";
  if (globalThis.__redenBionicLoaded) return; // injected twice? do nothing the second time
  globalThis.__redenBionicLoaded = true;

  const api = globalThis.browser ?? globalThis.chrome;
  const core = globalThis.REdenCore;
  if (!api || !api.storage || !api.runtime || !core) return;

  const SKIP = core.SKIP_SELECTOR;
  const SCOPE = core.SCOPE_SELECTOR;
  const SLICE_MS = 12;        // max time spent per rendering batch, so long pages never freeze
  const BLOCK_WORKERS = 3;    // paragraphs analysed at the same time
  const MAX_INFLIGHT = 6;     // backend requests open at the same time
  // Look: tweak these two.
  const WEIGHT = { 1: "500", 2: "650", 3: "800" }; // bold letters of rating 0 / 1 / 2 words (flag = rating + 1)
  const FADE_OPACITY = "0.75";                       // the letters that aren't bolded (1 = not faded)
  const TREE_WEIGHT = "700";                         // "tree" style: bold letters (depth shows as opacity, not weight)
  const INDENT_EM = 1.5;                             // "layout" style: width of one indent level
  const LAYOUT_BOLD = true;                          // "layout" style: also bold word starts (false = only line breaks + indents)
  const translationCache = new Map();                // lower-case word -> Promise of its translation (string or null)
  const MIN_WORDS = 3;        // shorter blocks (menus, labels, buttons) are not article text

  const originals = new WeakMap(); // wrapper span -> the original text node
  let settings = { ...core.DEFAULTS };
  // off: not formatting | checking: asking the backend if it is there | on: formatting | offline: backend unreachable
  let phase = "off";
  let gen = 0;                 // bumped on every stop/start; answers from older generations are ignored
  let appliedStrength = null;
  let appliedStyle = null;     // style the current page was analysed for; changing it needs new requests
  let appliedDim = null;
  let appliedVocab = null;     // "on|zipf" the page was analysed with; changing it needs new requests
  let observer = null;
  let queue = [];              // block elements waiting to be sent
  let queued = new WeakSet();
  // Lazy: a paragraph is only sent to the backend once it comes near the screen (saves backend work and translation tokens).
  const VISIBLE_MARGIN = "300px 0px"; // start a little before it scrolls into view, so it's ready when the reader gets there
  let visObserver = null;      // IntersectionObserver watching paragraphs that haven't been on screen yet
  let watched = new WeakSet(); // paragraphs being watched
  let seen = new WeakSet();    // paragraphs that have been near the screen at least once (later changes are queued directly)
  let workers = 0;             // block workers running
  let inflight = 0;            // backend requests open
  let waiting = [];            // requests waiting for a free slot
  const wordCache = new Map(); // lower-case word -> Promise of its bold indexes (each word asked once)
  let rendered = [];           // {nodes, pieces, text, words}: kept so a bold-amount change needs no new request
  let wordCount = 0;
  let savedZoom = null;
  let reconcileTimer = null;
  let restoring = false;
  let restoreList = [];
  let ri = 0;
  const afterRestore = new Set();
  let scopeCache = { t: -1e9, v: false };
  const fontCache = new WeakMap();
  const contrastCache = new WeakMap();
  const aaCache = new WeakMap(); // parent element -> lowest opacity that still meets WCAG AA (4.5:1) there

  // The page background behind an element: first ancestor with a non-transparent background color (white if none).
  function backgroundOf(el) {
    for (let e = el; e && e.nodeType === Node.ELEMENT_NODE; e = e.parentElement) {
      const c = core.parseRgb(getComputedStyle(e).backgroundColor);
      if (c && c[3] > 0.5) return c;
    }
    return [255, 255, 255, 1];
  }
  // Faded text must still be readable: opacity never goes below this for text inside `parent`.
  function aaFloor(parent) {
    if (!parent) return 0;
    if (!aaCache.has(parent)) {
      let fg = core.parseRgb(getComputedStyle(parent).color);
      if (settings.bionicContrast && fg) fg = core.parseRgb(core.contrastColor(getComputedStyle(parent).color) === "#000" ? "rgb(0,0,0)" : "rgb(255,255,255)");
      aaCache.set(parent, core.minOpacityForContrast(fg, backgroundOf(parent)));
    }
    return aaCache.get(parent);
  }

  // ---------- talking to the background worker ----------
  function send(msg) {
    return new Promise((resolve) => {
      try { Promise.resolve(api.runtime.sendMessage(msg)).then(resolve, () => resolve(null)); }
      catch (_) { resolve(null); }
    });
  }

  // send(), at most MAX_INFLIGHT at a time. Requests still waiting when REden turns off are dropped.
  async function ask(msg) {
    const myGen = gen;
    while (inflight >= MAX_INFLIGHT) {
      await new Promise((r) => waiting.push(r));
      if (myGen !== gen) return null;
    }
    if (myGen !== gen) return null;
    inflight++;
    try { return await send(msg); }
    finally {
      inflight--;
      const next = waiting.shift();
      if (next) next();
    }
  }

  function wordIndexes(word) {
    const key = word.toLowerCase();
    if (!wordCache.has(key)) {
      wordCache.set(key, ask({ type: "reden:word", word }).then((r) => {
        if (!r || !r.ok) { wordCache.delete(key); throw new Error("word request failed"); }
        return r.data;
      }));
    }
    return wordCache.get(key);
  }

  // paragraph -> sentences -> items -> sentence rating -> word letters. Throws if the backend fails.
  // Returns {words, breaks}; breaks is only filled in the "layout" style.
  async function analyze(text) {
    const words = [];
    const type = { tree: "reden:depth", layout: "reden:layout" }[appliedStyle] || "reden:sentence";
    const sentences = await Promise.all(core.sentencesOf(text).map(async (s) => {
      const { items, spans, punctuation } = core.wordsOf(text, s.start, s.end);
      if (!items.length) return null;
      const r = await ask({ type, items, punctuation });
      if (!r || !r.ok) throw new Error("sentence request failed");
      await Promise.all(items.map(async (w, i) => {
        const rec = { start: spans[i][0], end: spans[i][1], idx: null };
        if (appliedStyle === "tree") rec.depth = r.data[i];
        else if (appliedStyle === "layout") rec.depth = 0; // drawn like the tree style at full opacity
        else rec.rating = r.data[i];
        words.push(rec);
        if (core.LETTER_RE.test(w) && (appliedStyle !== "layout" || LAYOUT_BOLD)) rec.idx = await wordIndexes(w); // numbers: context for spaCy only
      }));
      return { spans, layout: r.data, items, text: text.slice(s.start, s.end) };
    }));
    const breaks = appliedStyle === "layout" ? core.layoutBreaks(text, sentences) : [];
    const glosses = await vocabGlosses(sentences);
    return { words, breaks, glosses };
  }

  // Words rarer than the user's level get {offset: end of word, gloss: translation}. Never fatal: on any failure, no glosses.
  async function vocabGlosses(sentences) {
    if (!settings.vocabOn || !(settings.vocabZipf > 0)) return [];
    const cands = []; // {word, end, sentence}
    for (const s of sentences) {
      if (!s) continue;
      s.items.forEach((w, i) => {
        // letters only; capitalised words are mostly names, so skip them
        if (core.LETTER_RE.test(w) && /^\p{Ll}/u.test(w) && w.length >= 3) cands.push({ word: w, end: s.spans[i][1], sentence: s.text });
      });
    }
    if (!cands.length) return [];
    const unique = [...new Set(cands.map((c) => c.word.toLowerCase()))];
    const r = await ask({ type: "reden:vocab", words: unique, zipf: settings.vocabZipf });
    if (!r || !r.ok) return [];
    const unknown = new Set(unique.filter((_, i) => r.data[i]));
    const out = [];
    await Promise.all(cands.filter((c) => unknown.has(c.word.toLowerCase())).map(async (c) => {
      const t = await translateWord(c.word, c.sentence);
      if (typeof t === "string" && t.trim()) out.push({ offset: c.end, gloss: t.trim() });
    }));
    return out.sort((a, b) => a.offset - b.offset);
  }

  function translateWord(word, sentence) {
    const key = word.toLowerCase();
    if (!translationCache.has(key)) {
      translationCache.set(key, ask({ type: "reden:translate", word, sentence }).then((r) => (r && r.ok ? r.data : null)));
    }
    return translationCache.get(key);
  }

  // ---------- finding the article ----------
  function hasScope() {
    const now = performance.now();
    if (now - scopeCache.t > 500) scopeCache = { t: now, v: !!document.querySelector(SCOPE) };
    return scopeCache.v;
  }

  function isIconFont(el) {
    if (!fontCache.has(el)) fontCache.set(el, core.isIconFont(getComputedStyle(el).fontFamily));
    return fontCache.get(el);
  }

  // Is this text node part of the article (not a menu, button, icon, code, our own output)?
  function usable(node) {
    const p = node.parentElement;
    if (!p || p.closest(SKIP)) return false;
    const header = p.closest("header");
    if (header && !header.closest(SCOPE)) return false; // page header no, article header (title) yes
    if (hasScope() && !p.closest(SCOPE)) return false;
    return !isIconFont(p);
  }

  const isInline = (el) => { const d = getComputedStyle(el).display; return d === "inline" || d === "contents"; };

  // The block (paragraph, list item, heading, ...) a text node belongs to.
  function blockOf(el) {
    while (el && el !== document.body && el !== document.documentElement) {
      if (!isInline(el)) return el;
      el = el.parentElement;
    }
    return document.body;
  }

  // All usable text nodes of a block, in order, including spaces and punctuation between links, bold, etc.
  function nodesOf(block) {
    const out = [];
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (n.nodeType === Node.ELEMENT_NODE) {
          if (n.matches(SKIP) || !isInline(n)) return NodeFilter.FILTER_REJECT; // other blocks are handled on their own
          return NodeFilter.FILTER_SKIP;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walker.nextNode())) if (usable(n)) out.push(n);
    return out;
  }

  function queueBlock(block) {
    if (queued.has(block)) return;
    queued.add(block);
    queue.push(block);
    pump();
  }

  function enqueueText(node) {
    if (core.LETTER_RE.test(node.nodeValue) && usable(node)) watchBlock(blockOf(node.parentElement));
  }

  // Queue the paragraph now if it has already been near the screen, otherwise wait until it is.
  function watchBlock(block) {
    if (seen.has(block) || !visObserver) return queueBlock(block);
    if (watched.has(block)) return;
    watched.add(block);
    visObserver.observe(block);
  }
  function onVisible(entries) {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      visObserver.unobserve(e.target);
      watched.delete(e.target);
      seen.add(e.target);
      queueBlock(e.target);
    }
  }

  function enqueueTree(root) {
    if (root.nodeType === Node.TEXT_NODE) return enqueueText(root);
    if (root.nodeType !== Node.ELEMENT_NODE || root.closest(SKIP)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (n.nodeType === Node.ELEMENT_NODE) return n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
        return core.LETTER_RE.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    let n;
    while ((n = walker.nextNode())) enqueueText(n);
  }

  // ---------- sending text, rendering the answer ----------
  function pump() {
    while (phase === "on" && workers < BLOCK_WORKERS && queue.length) {
      workers++;
      worker(gen);
    }
  }

  // Takes paragraphs from the queue in page order, analyses each one and draws it as soon as it's done.
  async function worker(myGen) {
    try {
      while (phase === "on" && myGen === gen && queue.length) {
        const block = queue.shift();
        queued.delete(block);
        if (!block.isConnected) continue;
        const nodes = nodesOf(block);
        const pieces = nodes.map((n) => n.nodeValue);
        const text = pieces.join("");
        if (core.collectWords(text).length < MIN_WORDS) continue;

        let words, breaks, glosses;
        try { ({ words, breaks, glosses } = await analyze(text)); }
        catch (_) { if (myGen === gen) goOffline(); return; } // backend gone: REden stops having any effect
        if (myGen !== gen) return; // turned off or restarted while waiting
        const rec = { block, nodes, pieces, text, words, breaks, glosses, style: appliedStyle };
        rendered.push(rec);
        renderRecord(rec);
      }
    } finally {
      if (myGen === gen) workers--;
    }
  }

  function setOrClear(span, prop, value) {
    if (value) span.style.setProperty(prop, value, "important");
    else span.style.removeProperty(prop);
  }

  function styleSpan(span, parent) {
    setOrClear(span, "line-height", settings.bionicSpacing > 0 ? String(settings.bionicSpacing) : "");
    setOrClear(span, "letter-spacing", settings.bionicLetter > 0 ? settings.bionicLetter + "em" : "");
    setOrClear(span, "font-family", core.FONT_STACKS[settings.bionicMode] || "");
    let color = "";
    const p = parent || span.parentElement; // new spans aren't attached yet, so the caller passes the parent
    if (settings.bionicContrast && p) {
      if (!contrastCache.has(p)) {
        const own = span.style.color;
        span.style.removeProperty("color"); // read the page's color, not ours
        contrastCache.set(p, core.contrastColor(getComputedStyle(p).color));
        if (own) span.style.color = own;
      }
      color = contrastCache.get(p) || "";
    }
    setOrClear(span, "color", color);
  }

  function renderRecord(rec) {
    const tree = rec.style === "tree" || rec.style === "layout"; // layout words all have depth 0 = full opacity
    const flags = tree ? core.treeFlags(rec.text, rec.words, settings.bionicStrength)
      : core.buildFlags(rec.text, rec.words, settings.bionicStrength);
    const plan = planHang(rec, rec.breaks || []); // clauses as block lines, so wrapped lines keep the indent
    const breaks = (plan ? plan.textBreaks : rec.breaks || []).concat(rec.glosses || []).sort((a, b) => a.offset - b.offset);
    const hang = !!plan;
    let offset = 0;
    rec.nodes.forEach((node, i) => {
      const piece = rec.pieces[i];
      const start = offset;
      offset += piece.length;
      if (phase !== "on" || !node.isConnected || node.nodeValue !== piece) return; // page changed it meanwhile
      // text pieces split at line breaks ("layout" style), each with its offset in the paragraph
      const parts = core.splitPiece(piece, start, breaks);
      const segs = [];
      let off = start;
      for (const p of parts) {
        if (p.text === undefined) { segs.push(p); continue; }
        segs.push(...core.segmentsFromFlags(p.text, flags, off));
        off += p.text.length;
      }
      if (!segs.some((s) => s.tier || s.text === undefined)) return;

      if (hang) return renderHanging(node, segs, tree);

      const span = document.createElement("span");
      span.className = "reden-w";
      for (const s of segs) {
        if (s.gloss !== undefined) { span.appendChild(glossNode(s.gloss)); continue; }
        if (s.text === undefined) { // "layout" style (fallback): new line + indent spacer before this clause
          if (s.newline) {
            const br = document.createElement("br");
            br.className = "reden-br";
            span.appendChild(br);
          }
          if (s.indent > 0) {
            const pad = document.createElement("span");
            pad.className = "reden-in";
            pad.style.setProperty("display", "inline-block", "important");
            pad.style.setProperty("width", s.indent * INDENT_EM + "em", "important");
            span.appendChild(pad);
          }
        } else {
          span.appendChild(segmentNode(s, tree, node.parentElement));
        }
      }
      styleSpan(span, node.parentElement);
      originals.set(span, node);
      node.replaceWith(span);
    });
    if (hang && phase === "on") {
      for (const b of plan.elBreaks) { // breaks that were inside a link / <b>: a marker just before or after it
        if (!b.el.isConnected) continue;
        const near = b.where === "before" ? b.el.previousSibling : b.el.nextSibling;
        if (near && near.nodeType === Node.ELEMENT_NODE && near.classList.contains("reden-mark")) continue;
        const mark = makeMark(b.indent);
        if (b.where === "before") b.el.before(mark); else b.el.after(mark);
      }
      hangLines(plan.container);
    }
  }

  // One styled piece of text: <b> for bold letters, a faded <span>, or plain text.
  function segmentNode(s, tree, parent) {
    if (tree && s.tier) { // sentence tree / indent: opacity by depth, bold letters at one weight
      const { depth, bold } = core.treeFlag(s.tier);
      const el = document.createElement(bold ? "b" : "span");
      el.className = bold ? "reden-b" : "reden-f";
      if (bold) { el.style.setProperty("font-weight", TREE_WEIGHT, "important"); wordCount++; }
      el.style.setProperty("opacity", String(core.dimFor(depth, settings.dimMin, aaFloor(parent))), "important");
      el.textContent = s.text;
      return el;
    }
    if (s.tier === core.FADED) {
      const f = document.createElement("span");
      f.className = "reden-f";
      f.style.setProperty("opacity", String(Math.max(Number(FADE_OPACITY), aaFloor(parent))), "important");
      f.textContent = s.text;
      return f;
    }
    if (s.tier) {
      const b = document.createElement("b");
      b.className = "reden-b";
      b.style.setProperty("font-weight", WEIGHT[s.tier], "important");
      b.textContent = s.text;
      wordCount++;
      return b;
    }
    return document.createTextNode(s.text);
  }

  // ---------- "layout" style: clauses as block lines, so a wrapped clause keeps its indent ----------
  // Lines are built by moving whole child nodes of a container (the paragraph, or the one element all breaks sit in,
  // e.g. <p><span>…</span></p>) into <span class="reden-line"> blocks, so nothing on the page is cut or cloned.
  // A break inside a link / <b> (a child element of the container) moves to that element's nearer edge.
  // Returns null (inline <br> + spacer fallback) only if the container has block children or a break can't be placed.
  function planHang(rec, breaks) {
    if (rec.style !== "layout" || !breaks.length || !rec.block || !rec.block.isConnected) return null;
    let start = 0;
    const ranges = rec.nodes.map((n, i) => { const r = [start, start + rec.pieces[i].length, n]; start = r[1]; return r; });
    const nodeAt = (off) => { const r = ranges.find(([a, z]) => off >= a && off < z); return r && r[2]; };
    const nodes = breaks.map((b) => nodeAt(b.offset));
    if (nodes.some((n) => !n || !n.parentElement)) return null;
    let container = rec.block;
    const p0 = nodes[0].parentElement;
    if (p0 !== rec.block && rec.block.contains(p0) && nodes.every((n) => n.parentElement === p0)) container = p0;
    for (const c of container.children) {
      if (!c.classList.contains("reden-w") && !c.classList.contains("reden-line") && !isInline(c)) return null;
    }
    const textBreaks = [], elBreaks = [];
    breaks.forEach((b, i) => {
      const n = nodes[i];
      if (n.parentElement === container) return void textBreaks.push(b);
      let top = n;
      while (top.parentNode && top.parentNode !== container) top = top.parentNode;
      if (top.parentNode !== container) return;
      const inside = ranges.filter(([, , m]) => top.contains(m));
      const a = inside[0][0], z = inside[inside.length - 1][1];
      elBreaks.push({ el: top, where: b.offset - a <= z - b.offset ? "before" : "after", indent: b.indent });
    });
    return { container, textBreaks, elBreaks };
  }

  function makeMark(indent) {
    const mark = document.createElement("span");
    mark.className = "reden-w reden-mark";
    mark.dataset.indent = String(indent);
    return mark;
  }

  // Replace one text node with styled pieces, cut at the breaks: [piece][marker][piece]...
  // Every piece maps to the original node (restore puts it back once and drops the rest).
  function renderHanging(node, segs, tree) {
    const out = [];
    let cur = null;
    for (const s of segs) {
      if (s.text === undefined && s.gloss === undefined) {
        const mark = makeMark(s.indent);
        originals.set(mark, node);
        out.push(mark);
        cur = null;
        continue;
      }
      if (!cur) {
        cur = document.createElement("span");
        cur.className = "reden-w";
        styleSpan(cur, node.parentElement);
        originals.set(cur, node);
        out.push(cur);
      }
      cur.appendChild(s.gloss !== undefined ? glossNode(s.gloss) : segmentNode(s, tree, node.parentElement));
    }
    node.replaceWith(...out);
  }

  // " (translation)" after an unknown word: normal weight, a little smaller, never bold or faded.
  function glossNode(text) {
    const g = document.createElement("span");
    g.className = "reden-gloss";
    g.style.setProperty("font-weight", "400", "important");
    g.style.setProperty("font-size", "0.85em", "important");
    g.style.setProperty("opacity", "1", "important");
    g.textContent = " (" + text + ")";
    return g;
  }

  // Group the paragraph's children at the markers into <span class="reden-line"> blocks indented with padding.
  function hangLines(block) {
    const groups = [{ indent: 0, nodes: [] }];
    for (const k of [...block.childNodes]) {
      if (k.nodeType === Node.ELEMENT_NODE && k.classList.contains("reden-mark")) {
        groups.push({ indent: Number(k.dataset.indent) || 0, nodes: [] });
        k.remove();
      } else {
        groups[groups.length - 1].nodes.push(k);
      }
    }
    for (const g of groups) {
      if (!g.nodes.length || g.nodes.every((n) => n.nodeType === Node.TEXT_NODE && !n.nodeValue.trim())) continue;
      const line = document.createElement("span");
      line.className = "reden-line";
      line.style.setProperty("display", "block", "important");
      line.style.setProperty("padding-inline-start", g.indent * INDENT_EM + "em", "important");
      line.style.setProperty("text-indent", "0", "important"); // a paragraph's own first-line indent would hit every line
      line.style.setProperty("margin", "0", "important");
      g.nodes[0].before(line);
      line.append(...g.nodes);
    }
  }

  // ---------- watching for new content ----------
  function onMutations(records) {
    for (const r of records) {
      if (r.type === "characterData") { enqueueText(r.target); continue; }
      for (const n of r.addedNodes) {
        if (n.nodeType === Node.ELEMENT_NODE && (n.classList.contains("reden-w") || n.classList.contains("reden-line"))) continue; // our own output
        enqueueTree(n);
      }
    }
  }

  // ---------- zoom ----------
  function applyZoom() {
    const el = document.documentElement;
    if (settings.bionicSize > 100) {
      if (savedZoom === null) savedZoom = el.style.getPropertyValue("zoom");
      el.style.setProperty("zoom", String(settings.bionicSize / 100), "important");
    } else {
      resetZoom();
    }
  }

  function resetZoom() {
    if (savedZoom === null) return;
    const el = document.documentElement;
    el.style.removeProperty("zoom");
    if (savedZoom) el.style.setProperty("zoom", savedZoom);
    savedZoom = null;
  }

  // ---------- on / off ----------
  async function start() {
    phase = "checking";
    const myGen = ++gen;
    const health = await send({ type: "reden:health" });
    if (myGen !== gen) return; // turned off meanwhile
    if (!health || !health.ok) { phase = "offline"; return; } // backend not there: stay inactive
    phase = "on";
    appliedStrength = settings.bionicStrength;
    appliedStyle = ["tree", "layout"].includes(settings.bionicStyle) ? settings.bionicStyle : "weight";
    appliedDim = settings.dimMin;
    appliedVocab = vocabKey();
    applyZoom();
    visObserver = typeof IntersectionObserver === "function"
      ? new IntersectionObserver(onVisible, { rootMargin: VISIBLE_MARGIN })
      : null; // very old browsers: format everything at once, as before
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    if (document.body) enqueueTree(document.body);
  }

  // Remove everything REden did to the page and forget pending work.
  function teardown(nextPhase) {
    gen++;
    phase = nextPhase;
    if (observer) { observer.disconnect(); observer = null; }
    if (visObserver) { visObserver.disconnect(); visObserver = null; }
    watched = new WeakSet();
    seen = new WeakSet();
    queue = [];
    queued = new WeakSet();
    workers = 0;
    waiting.splice(0).forEach((r) => r()); // waiting requests see the new gen and give up
    rendered = [];
    wordCount = 0;
    resetZoom();
    beginRestore();
  }
  const stop = () => teardown("off");
  const goOffline = () => teardown("offline");

  // Put the original text nodes back in short batches so long pages never freeze.
  function beginRestore() {
    for (const line of document.querySelectorAll(".reden-line")) line.replaceWith(...line.childNodes); // "layout" lines first
    restoreList = [...document.querySelectorAll(".reden-w")];
    ri = 0;
    if (!restoring) { restoring = true; setTimeout(restoreSlice, 0); }
  }

  function restoreSlice() {
    const t0 = performance.now();
    while (ri < restoreList.length && performance.now() - t0 < SLICE_MS) {
      const span = restoreList[ri++];
      if (!span.isConnected) continue;
      const orig = originals.get(span);
      if (orig && orig.isConnected) span.remove(); // a later piece of a text node that is already back
      else span.replaceWith(orig || document.createTextNode(span.textContent));
    }
    if (ri < restoreList.length) return void setTimeout(restoreSlice, 0);
    restoring = false;
    restoreList = [];
    ri = 0;
    const fns = [...afterRestore];
    afterRestore.clear();
    fns.forEach((fn) => fn());
  }

  // The bold amount changed: undo, then draw again from the answers we already have (no new request).
  function reflow() {
    const recs = rendered;
    rendered = [];
    wordCount = 0;
    const myGen = gen;
    afterRestore.add(function redraw() {
      if (phase !== "on" || myGen !== gen) return;
      let i = 0;
      (function step() {
        if (phase !== "on" || myGen !== gen) return;
        const t0 = performance.now();
        while (i < recs.length && performance.now() - t0 < SLICE_MS) {
          const rec = recs[i++];
          rendered.push(rec);
          renderRecord(rec);
        }
        if (i < recs.length) setTimeout(step, 0);
      })();
    });
    beginRestore();
  }

  const vocabKey = () => (settings.vocabOn && settings.vocabZipf > 0 ? "on|" + settings.vocabZipf : "off");

  function reconcile() {
    if (!settings.bionicOn) { if (phase !== "off") stop(); return; }
    if (restoring) { afterRestore.add(reconcile); return; } // wait until old formatting is fully removed
    if (phase === "off" || phase === "offline") return void start(); // (re)check the backend
    if (phase === "checking") return;
    const style = ["tree", "layout"].includes(settings.bionicStyle) ? settings.bionicStyle : "weight";
    if (style !== appliedStyle || vocabKey() !== appliedVocab) { stop(); afterRestore.add(reconcile); return; } // needs new backend data: start over
    if (settings.bionicStrength !== appliedStrength || settings.dimMin !== appliedDim) {
      appliedStrength = settings.bionicStrength;
      appliedDim = settings.dimMin;
      return reflow(); // same answers, drawn again: no new request
    }
    applyZoom();
    for (const span of document.querySelectorAll("span.reden-w")) styleSpan(span);
  }

  function scheduleReconcile() {
    clearTimeout(reconcileTimer);
    reconcileTimer = setTimeout(reconcile, 80); // slider drags fire many changes
  }

  // ---------- wiring ----------
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    let touched = false;
    for (const key of Object.keys(core.DEFAULTS)) {
      if (key in core.FIXED) continue; // built in, not a user setting
      if (key in changes) {
        settings[key] = changes[key].newValue === undefined ? core.DEFAULTS[key] : changes[key].newValue;
        touched = true;
      }
    }
    if (touched) scheduleReconcile();
  });

  api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "reden:recheck") { // the popup was opened: try the backend again if we gave up
      if (settings.bionicOn && phase === "offline" && !restoring) start();
      sendResponse({ phase });
    } else if (msg && msg.type === "reden:status") {
      sendResponse({ phase, active: phase === "on", offline: phase === "offline", words: wordCount, busy: workers > 0 || queue.length > 0 });
    }
  });

  api.storage.local.get(Object.keys(core.DEFAULTS)).then((stored) => {
    settings = core.withFixed({ ...core.DEFAULTS, ...stored });
    reconcile();
  });
})();
