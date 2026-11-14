// REden content script.
//
// Flow for every paragraph of the article:
//   1. split the paragraph into sentences, and each sentence into words
//   2. POST /get_sentence_highlight {items, punctuation}  (once per sentence)  -> rating 0..2 per word
//   3. POST /get_word_highlight {word}                    (once per distinct word) -> letters to bold
//   4. draw: the word's bold letters get a weight by sentence rating (0 light, 1 medium, 2 heavy);
//      the rest of the word's letters are faded a little. Only font-weight and opacity are changed.
// Requests go through the background worker (pages can't call http://127.0.0.1 themselves).
// If the backend can't be reached, REden does nothing and puts the page back.
//
// It never replaces page HTML wholesale: it swaps single text nodes for a <span class="reden-w"> and puts
// the original text node back when turned off.
(function () {
  "use strict";
  if (globalThis.__redenLoaded) return; // injected twice? do nothing the second time
  globalThis.__redenLoaded = true;

  const api = globalThis.browser ?? globalThis.chrome;
  const core = globalThis.REdenCore;
  if (!api || !api.storage || !api.runtime || !core) return;

  const SKIP = core.SKIP_SELECTOR;
  const SCOPE = core.SCOPE_SELECTOR;
  const MIN_WORDS = 3;        // shorter blocks (menus, labels) are not article text
  const BLOCK_WORKERS = 3;    // paragraphs analysed at the same time
  const MAX_INFLIGHT = 6;     // backend requests open at the same time
  // Look: tweak these two.
  const WEIGHT = { 1: "500", 2: "650", 3: "800" }; // bold letters of rating 0 / 1 / 2 words (flag = rating + 1)
  const FADE_OPACITY = "0.75";                       // the letters that aren't bolded (1 = not faded)

  const originals = new WeakMap(); // our span -> the original text node
  const wordCache = new Map();     // lower-case word -> Promise of its bold indexes (each word asked once)
  let phase = "off";               // off | checking | on | offline
  let gen = 0;                     // bumped on every start/stop; late answers from an older gen are ignored
  let observer = null;
  let queue = [];
  let queued = new WeakSet();
  let workers = 0;
  let inflight = 0;
  let waiting = [];
  let boldCount = 0;

  // ---------- talking to the backend (through background.js) ----------
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

  // paragraph -> sentences -> words -> sentence backend -> word backend. Throws if the backend fails.
  async function analyze(text) {
    const words = [];
    await Promise.all(core.sentencesOf(text).map(async (s) => {
      const { items, spans, punctuation } = core.wordsOf(text, s.start, s.end);
      if (!items.length) return;
      const r = await ask({ type: "reden:sentence", items, punctuation });
      if (!r || !r.ok) throw new Error("sentence request failed");
      await Promise.all(items.map(async (w, i) => {
        const rec = { start: spans[i][0], end: spans[i][1], rating: r.data[i], idx: null };
        words.push(rec);
        rec.idx = await wordIndexes(w);
      }));
    }));
    return words;
  }

  // ---------- finding the article's paragraphs ----------
  const isInline = (el) => { const d = getComputedStyle(el).display; return d === "inline" || d === "contents"; };

  function usable(node) {
    const p = node.parentElement;
    if (!p || p.closest(SKIP)) return false;
    const header = p.closest("header");
    if (header && !header.closest(SCOPE)) return false; // page header no, article header (title) yes
    if (document.querySelector(SCOPE) && !p.closest(SCOPE)) return false;
    return !core.ICON_FONT_RE.test(getComputedStyle(p).fontFamily);
  }

  // The block (paragraph, list item, heading) a text node belongs to.
  function blockOf(el) {
    while (el && el !== document.body && el !== document.documentElement) {
      if (!isInline(el)) return el;
      el = el.parentElement;
    }
    return document.body;
  }

  // The text nodes of one block in order; links/bold inside it stay part of it, nested blocks are their own.
  function nodesOf(block) {
    const out = [];
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (n.nodeType === Node.ELEMENT_NODE) {
          return n.matches(SKIP) || !isInline(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    let n;
    while ((n = walker.nextNode())) if (usable(n)) out.push(n);
    return out;
  }

  function enqueueText(node) {
    if (!core.LETTER_RE.test(node.nodeValue) || !usable(node)) return;
    const block = blockOf(node.parentElement);
    if (queued.has(block)) return;
    queued.add(block);
    queue.push(block);
    pump();
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

  // ---------- processing ----------
  function pump() {
    while (phase === "on" && workers < BLOCK_WORKERS && queue.length) {
      workers++;
      worker(gen);
    }
  }

  async function worker(myGen) {
    try {
      while (phase === "on" && myGen === gen && queue.length) {
        const block = queue.shift();
        queued.delete(block);
        if (!block.isConnected) continue;
        const nodes = nodesOf(block);
        const pieces = nodes.map((n) => n.nodeValue);
        const text = pieces.join("");
        if (core.countWords(text) < MIN_WORDS) continue;

        let words;
        try { words = await analyze(text); }
        catch (_) { if (myGen === gen) teardown("offline"); return; }
        if (myGen !== gen) return;
        draw(nodes, pieces, core.buildFlags(text, words));
      }
    } finally {
      if (myGen === gen) workers--;
    }
  }

  function draw(nodes, pieces, flags) {
    let offset = 0;
    nodes.forEach((node, i) => {
      const piece = pieces[i];
      const start = offset;
      offset += piece.length;
      if (!node.isConnected || node.nodeValue !== piece) return; // the page changed it meanwhile
      const segs = core.segmentsFromFlags(piece, flags, start);
      if (!segs.some((s) => s.tier)) return;

      const span = document.createElement("span");
      span.className = "reden-w";
      for (const s of segs) {
        if (!s.tier) { span.appendChild(document.createTextNode(s.text)); continue; }
        const faded = s.tier === core.FADED;
        const el = document.createElement(faded ? "span" : "b");
        el.className = faded ? "reden-f" : "reden-b";
        if (faded) el.style.setProperty("opacity", FADE_OPACITY, "important");
        else { el.style.setProperty("font-weight", WEIGHT[s.tier], "important"); boldCount++; }
        el.textContent = s.text;
        span.appendChild(el);
      }
      originals.set(span, node);
      node.replaceWith(span);
    });
  }

  function onMutations(records) {
    for (const r of records) {
      if (r.type === "characterData") { enqueueText(r.target); continue; }
      for (const n of r.addedNodes) {
        if (n.nodeType === Node.ELEMENT_NODE && n.classList.contains("reden-w")) continue; // our own output
        enqueueTree(n);
      }
    }
  }

  // ---------- on / off ----------
  async function start() {
    const myGen = ++gen;
    phase = "checking";
    const health = await send({ type: "reden:health" });
    if (myGen !== gen) return;
    if (!health || !health.ok) { phase = "offline"; return; }
    phase = "on";
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    if (document.body) enqueueTree(document.body);
  }

  // Undo everything REden did and forget pending work.
  function teardown(nextPhase) {
    gen++;
    phase = nextPhase;
    if (observer) { observer.disconnect(); observer = null; }
    queue = [];
    queued = new WeakSet();
    workers = 0;
    waiting.splice(0).forEach((r) => r()); // waiting requests see the new gen and give up
    boldCount = 0;
    for (const span of document.querySelectorAll("span.reden-w")) {
      span.replaceWith(originals.get(span) || document.createTextNode(span.textContent));
    }
  }

  function apply(on) {
    if (!on) { if (phase !== "off") teardown("off"); return; }
    if (phase === "off" || phase === "offline") start();
  }

  // ---------- wiring ----------
  api.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && "bionicOn" in changes) apply(!!changes.bionicOn.newValue);
  });

  api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === "reden:recheck" && phase === "offline") start(); // popup opened: try the backend again
    if (msg.type === "reden:recheck" || msg.type === "reden:status") {
      sendResponse({ phase, bold: boldCount, busy: workers > 0 || queue.length > 0 });
    }
  });

  api.storage.local.get("bionicOn").then((s) => apply(!!s.bionicOn));
})();
