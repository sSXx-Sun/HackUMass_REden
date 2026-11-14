// Bionic reading content script.
// Injected on demand (activeTab) or registered for every page when Automatic mode is on.
// It never touches page HTML wholesale: it only swaps individual text nodes for a small <span>
// holding the bolded pieces, and swaps the original text node back when turned off.
(function () {
  "use strict";
  if (globalThis.__readenBionicLoaded) return; // injected twice? do nothing the second time
  globalThis.__readenBionicLoaded = true;

  const api = globalThis.browser ?? globalThis.chrome;
  const core = globalThis.ReaDeNCore;
  if (!api || !api.storage || !core) return;

  const SKIP = core.SKIP_SELECTOR;
  const SLICE_MS = 12; // max time spent per batch, so long pages never freeze

  const originals = new WeakMap(); // wrapper span -> the original text node
  let settings = { ...core.DEFAULTS };
  let active = false;
  let appliedStrength = null;
  let observer = null;
  let queue = [];
  let qi = 0;
  let queued = new WeakSet();
  let timer = null;
  let wordCount = 0;
  let savedZoom = null; // original inline zoom of <html>, restored when turned off
  let reconcileTimer = null;
  let restoring = false;          // restoring original text in batches
  let restoreList = [];
  let ri = 0;
  let startAfterRestore = false;

  // ---------- finding text ----------
  function push(node) {
    if (queued.has(node)) return;
    queued.add(node);
    queue.push(node);
    if (!timer) timer = setTimeout(run, 0);
  }

  function enqueueText(node) {
    if (!core.LETTER_RE.test(node.nodeValue)) return;
    const p = node.parentElement;
    if (!p || p.closest(SKIP)) return;
    push(node);
  }

  function enqueueTree(root) {
    if (root.nodeType === Node.TEXT_NODE) return enqueueText(root);
    if (root.nodeType !== Node.ELEMENT_NODE || root.closest(SKIP)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (n.nodeType === Node.ELEMENT_NODE) {
          return n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP; // reject = skip whole subtree
        }
        return core.LETTER_RE.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    });
    let n;
    while ((n = walker.nextNode())) push(n);
  }

  // ---------- formatting ----------
  const contrastCache = new WeakMap(); // parent element -> color chosen before we changed it

  function setOrClear(span, prop, value) {
    if (value) span.style.setProperty(prop, value, "important");
    else span.style.removeProperty(prop);
  }

  function styleSpan(span, parent) {
    setOrClear(span, "line-height", settings.bionicSpacing > 0 ? String(settings.bionicSpacing) : "");
    setOrClear(span, "letter-spacing", settings.bionicLetter > 0 ? settings.bionicLetter + "em" : "");
    setOrClear(span, "font-family", core.FONT_STACKS[settings.bionicMode] || "");
    let color = "";
    const p = parent || span.parentElement; // new spans aren't attached yet, so format() passes the parent
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

  function format(node) {
    if (!active || !node.isConnected) return;
    const text = node.nodeValue;
    const p = node.parentElement;
    if (!text || !p || p.closest(SKIP)) return;

    const segs = core.segments(text, settings.bionicStrength);
    if (!segs.some((s) => s.bold)) return;

    const span = document.createElement("span");
    span.className = "readen-w";
    for (const s of segs) {
      if (s.bold) {
        const b = document.createElement("b");
        b.className = "readen-b";
        b.style.setProperty("font-weight", "700", "important");
        b.textContent = s.text;
        span.appendChild(b);
        wordCount++;
      } else {
        span.appendChild(document.createTextNode(s.text));
      }
    }
    styleSpan(span, p);
    originals.set(span, node);
    node.replaceWith(span);
  }

  function run() {
    timer = null;
    const t0 = performance.now();
    while (qi < queue.length && performance.now() - t0 < SLICE_MS) format(queue[qi++]);
    if (qi < queue.length) timer = setTimeout(run, 0);
    else { queue = []; qi = 0; }
  }

  // ---------- watching for new content ----------
  function onMutations(records) {
    for (const r of records) {
      if (r.type === "characterData") { enqueueText(r.target); continue; }
      for (const n of r.addedNodes) {
        if (n.nodeType === Node.ELEMENT_NODE && n.classList.contains("readen-w")) continue; // our own output
        enqueueTree(n);
      }
    }
  }

  // ---------- on / off ----------
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

  function start() {
    active = true;
    appliedStrength = settings.bionicStrength;
    applyZoom();
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    if (document.body) enqueueTree(document.body);
  }

  function stop() {
    if (!active) return;
    active = false;
    if (observer) { observer.disconnect(); observer = null; }
    clearTimeout(timer);
    timer = null;
    queue = [];
    qi = 0;
    queued = new WeakSet();
    wordCount = 0;
    resetZoom();
    // Put the original text nodes back in short batches so long pages never freeze.
    restoreList = [...document.querySelectorAll("span.readen-w")];
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
    if (startAfterRestore) { startAfterRestore = false; reconcile(); } // settings may have changed meanwhile
  }

  function reconcile() {
    if (!settings.bionicOn) return stop();
    if (restoring) { startAfterRestore = true; return; } // wait until the old formatting is fully removed
    if (!active) return start();
    if (settings.bionicStrength !== appliedStrength) { startAfterRestore = true; return stop(); }
    applyZoom();
    for (const span of document.querySelectorAll("span.readen-w")) styleSpan(span);
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
    if (msg && msg.type === "readen:status") sendResponse({ active, words: wordCount });
  });

  api.storage.local.get(Object.keys(core.DEFAULTS)).then((stored) => {
    settings = { ...core.DEFAULTS, ...stored };
    reconcile();
  });
})();
