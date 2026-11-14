// REden content script.
// It extracts the article text of the page, sends it (through the background worker) to the backend,
// and bolds exactly the words the backend answers with. If the backend can't be reached, REden does
// nothing: no formatting, no zoom, no spacing.
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
  const BATCH_BLOCKS = 40;    // paragraphs per backend request
  const BATCH_CHARS = 30000;  // characters per backend request
  const MIN_WORDS = 3;        // shorter blocks (menus, labels, buttons) are not article text

  const originals = new WeakMap(); // wrapper span -> the original text node
  let settings = { ...core.DEFAULTS };
  // off: not formatting | checking: asking the backend if it is there | on: formatting | offline: backend unreachable
  let phase = "off";
  let gen = 0;                 // bumped on every stop/start; answers from older generations are ignored
  let appliedStrength = null;
  let observer = null;
  let queue = [];              // block elements waiting to be sent
  let queued = new WeakSet();
  let sending = false;
  let rendered = [];           // {nodes, pieces, text, marks}: kept so a bold-amount change needs no new request
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

  // ---------- talking to the background worker ----------
  function send(msg) {
    return new Promise((resolve) => {
      try { Promise.resolve(api.runtime.sendMessage(msg)).then(resolve, () => resolve(null)); }
      catch (_) { resolve(null); }
    });
  }

  // ---------- finding the article ----------
  function hasScope() {
    const now = performance.now();
    if (now - scopeCache.t > 500) scopeCache = { t: now, v: !!document.querySelector(SCOPE) };
    return scopeCache.v;
  }

  function isIconFont(el) {
    if (!fontCache.has(el)) fontCache.set(el, core.ICON_FONT_RE.test(getComputedStyle(el).fontFamily));
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
    if (core.LETTER_RE.test(node.nodeValue) && usable(node)) queueBlock(blockOf(node.parentElement));
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
  async function pump() {
    if (sending || phase !== "on") return;
    sending = true;
    const myGen = gen;
    try {
      while (phase === "on" && myGen === gen && queue.length) {
        const batch = [];
        let chars = 0;
        while (queue.length && batch.length < BATCH_BLOCKS && chars < BATCH_CHARS) {
          const block = queue.shift();
          queued.delete(block);
          if (!block.isConnected) continue;
          const nodes = nodesOf(block);
          const pieces = nodes.map((n) => n.nodeValue);
          const text = pieces.join("");
          if (core.collectWords(text).length < MIN_WORDS) continue;
          batch.push({ nodes, pieces, text });
          chars += text.length;
        }
        if (!batch.length) continue;

        const res = await send({ type: "reden:bionic", paragraphs: batch.map((b) => b.text) });
        if (myGen !== gen) return; // turned off or restarted while waiting
        if (!res || !res.ok) return goOffline(); // backend gone: REden stops having any effect
        batch.forEach((b, i) => {
          const rec = { ...b, marks: res.data[i] };
          rendered.push(rec);
          renderRecord(rec);
        });
        await new Promise((r) => setTimeout(r, 0)); // let the page breathe between batches
      }
    } finally {
      if (myGen === gen) sending = false;
      if (phase === "on" && myGen === gen && queue.length) pump();
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
    const flags = core.applyTiers(rec.text, rec.marks, settings.bionicStrength);
    let offset = 0;
    rec.nodes.forEach((node, i) => {
      const piece = rec.pieces[i];
      const start = offset;
      offset += piece.length;
      if (phase !== "on" || !node.isConnected || node.nodeValue !== piece) return; // page changed it meanwhile
      const segs = core.segmentsFromFlags(piece, flags, start);
      if (!segs.some((s) => s.tier)) return;

      const span = document.createElement("span");
      span.className = "reden-w";
      for (const s of segs) {
        if (s.tier) {
          const b = document.createElement("b");
          b.className = "reden-b";
          b.style.setProperty("font-weight", s.tier === 2 ? "800" : "600", "important");
          b.textContent = s.text;
          span.appendChild(b);
          wordCount++;
        } else {
          span.appendChild(document.createTextNode(s.text));
        }
      }
      styleSpan(span, node.parentElement);
      originals.set(span, node);
      node.replaceWith(span);
    });
  }

  // ---------- watching for new content ----------
  function onMutations(records) {
    for (const r of records) {
      if (r.type === "characterData") { enqueueText(r.target); continue; }
      for (const n of r.addedNodes) {
        if (n.nodeType === Node.ELEMENT_NODE && n.classList.contains("reden-w")) continue; // our own output
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
    applyZoom();
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    if (document.body) enqueueTree(document.body);
  }

  // Remove everything REden did to the page and forget pending work.
  function teardown(nextPhase) {
    gen++;
    phase = nextPhase;
    if (observer) { observer.disconnect(); observer = null; }
    queue = [];
    queued = new WeakSet();
    sending = false;
    rendered = [];
    wordCount = 0;
    resetZoom();
    beginRestore();
  }
  const stop = () => teardown("off");
  const goOffline = () => teardown("offline");

  // Put the original text nodes back in short batches so long pages never freeze.
  function beginRestore() {
    restoreList = [...document.querySelectorAll("span.reden-w")];
    ri = 0;
    if (!restoring) { restoring = true; setTimeout(restoreSlice, 0); }
  }

  function restoreSlice() {
    const t0 = performance.now();
    while (ri < restoreList.length && performance.now() - t0 < SLICE_MS) {
      const span = restoreList[ri++];
      if (!span.isConnected) continue;
      span.replaceWith(originals.get(span) || document.createTextNode(span.textContent));
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

  function reconcile() {
    if (!settings.bionicOn) { if (phase !== "off") stop(); return; }
    if (restoring) { afterRestore.add(reconcile); return; } // wait until old formatting is fully removed
    if (phase === "off" || phase === "offline") return void start(); // (re)check the backend
    if (phase === "checking") return;
    if (settings.bionicStrength !== appliedStrength) { appliedStrength = settings.bionicStrength; return reflow(); }
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
      sendResponse({ phase, active: phase === "on", offline: phase === "offline", words: wordCount, busy: sending || queue.length > 0 });
    }
  });

  api.storage.local.get(Object.keys(core.DEFAULTS)).then((stored) => {
    settings = { ...core.DEFAULTS, ...stored };
    reconcile();
  });
})();
