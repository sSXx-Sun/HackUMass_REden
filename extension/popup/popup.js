// Cross-browser shim: Firefox exposes `browser`, Chromium exposes `chrome`.
const api = globalThis.browser ?? globalThis.chrome;
const core = globalThis.REdenCore; // from ../shared/core.js
const I18N = globalThis.REdenI18n; // from i18n.js
let lang = "en";
const tx = (key, vars) => I18N.t(lang, key, vars);

const DEFAULTS = {
  activeTab: "home",
  dark: false, large: false, popupSize: 14, tintSite: true, lang: null, trLang: "es", words: [], notes: "",
  backendUrl: "http://127.0.0.1:5050",
  pageDark: false,
  ...core.DEFAULTS,
};

const AUTO_ORIGINS = ["http://*/*", "https://*/*"];
const AUTO_SCRIPT_ID = "reden-bionic";
const CONTENT_FILES = ["shared/core.js", "content/bionic.js"];
const PREVIEW_TEXT = "Bionic reading helps your eyes glide through text by bolding the start of every word.";
const SPECIMEN_TEXT = "Your eyes find each word faster when its start stands out.";

// CSS for the one-off "Dark page" toggle (inserted into the current tab only).
const DARK_PAGE_CSS =
  "html { filter: invert(1) hue-rotate(180deg) !important; background: #fff !important; }" +
  "img, video, picture, canvas, svg image { filter: invert(1) hue-rotate(180deg) !important; }";

// ---------- helpers ----------
// Extension APIs return promises when called without a callback (Chrome MV3 and Firefox).
const call = (fn) => new Promise((resolve, reject) => {
  try { Promise.resolve(fn()).then(resolve, reject); } catch (e) { reject(e); }
});
const storageGet = (keys) => call(() => api.storage.local.get(keys)).catch(() => ({}));
const storageSet = (obj) => call(() => api.storage.local.set(obj)).catch(() => {});
const queryActiveTab = () => call(() => api.tabs.query({ active: true, currentWindow: true })).catch(() => []);
async function apiPost(path, body, baseUrl) {
  const r = await fetch(baseUrl.replace(/\/$/, "") + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
const $ = (id) => document.getElementById(id);
function note(id, msg) { $(id).hidden = !msg; $(id).textContent = msg || ""; }
function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ---------- state ----------
let saved = { ...DEFAULTS };
let activeTabInfo = null;
let words = [];

// ---------- navigation ----------
// Switching sides is done by CSS (radio buttons #t-<id>); JS remembers the last side
// and wires the Home tiles. Radios give arrow-key navigation for free.
const radios = [...document.querySelectorAll(".tab-radio")];

function showSection(id) {
  const r = $("t-" + id);
  if (r) r.checked = true;
  storageSet({ activeTab: id });
  if (id === "stats") renderStats();
}
radios.forEach((r) => r.addEventListener("change", () => showSection(r.id.slice(2))));
document.querySelectorAll("[data-goto]").forEach((el) =>
  el.addEventListener("click", () => {
    showSection(el.dataset.goto);
    $("t-" + el.dataset.goto).focus();
  })
);

// ---------- site color ----------
// The popup takes a faint tint of the current website's own color (green site -> greenish popup).
// Tint amounts match the original purple design: paper 2%, selected 8%, rules 13% of the site color.
let siteColor = null; // [r,g,b] or null
const mix = (a, b, t) => a.map((v, i) => Math.round(v * (1 - t) + b[i] * t));
const lum = (c) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const css = (c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const sat = (c) => { const mx = Math.max(...c), mn = Math.min(...c); return mx === 0 ? 0 : (mx - mn) / mx; };
// Move `c` toward `target` in small steps until it has enough contrast against `bg`.
function ensureContrast(c, bg, target, min) {
  let out = c;
  for (let i = 0; i < 12 && contrast(out, bg) < min; i++) out = mix(out, target, 0.12);
  return out;
}
function siteTokens(site, dark) {
  const W = [255, 255, 255], K = [0, 0, 0];
  if (!dark) {
    const paper = mix(W, site, 0.02);
    const ink = ensureContrast(mix(K, site, 0.45), paper, K, 9);
    const blue = ensureContrast(site, paper, K, 5);
    return {
      "--paper": css(paper), "--field": "#FFFFFF", "--rule": css(mix(W, site, 0.13)), "--lav": css(mix(W, site, 0.08)),
      "--ink": css(ink), "--brand": css(ensureContrast(mix(K, site, 0.6), paper, K, 7)), "--muted": css(ensureContrast(mix(ink, paper, 0.3), paper, K, 4.6)),
      "--blue": css(blue), "--on-blue": contrast(W, blue) >= contrast(K, blue) ? "#FFFFFF" : "#000000",
    };
  }
  const base = [20, 20, 24];
  const paper = mix(base, site, 0.1);
  const ink = mix(W, site, 0.1);
  const blue = ensureContrast(site, paper, W, 5);
  return {
    "--paper": css(paper), "--field": css(mix([12, 12, 16], site, 0.07)), "--rule": css(mix(base, site, 0.22)),
    "--lav": css(mix(base, site, 0.25)), "--ink": css(ink), "--brand": css(ensureContrast(mix(W, site, 0.45), paper, W, 7)),
    "--muted": css(ensureContrast(mix(ink, paper, 0.3), paper, W, 4.6)),
    "--blue": css(blue), "--on-blue": contrast(W, blue) >= contrast(K, blue) ? "#FFFFFF" : "#000000",
  };
}
function applyTint() {
  const names = ["--paper", "--field", "--rule", "--lav", "--ink", "--brand", "--muted", "--blue", "--on-blue"];
  const tokens = saved.tintSite && siteColor ? siteTokens(siteColor, !!saved.dark) : null;
  for (const n of names) {
    if (tokens) document.body.style.setProperty(n, tokens[n]);
    else document.body.style.removeProperty(n);
  }
}
function parseColor(str) {
  const probe = document.createElement("span");
  probe.style.color = "";
  probe.style.color = str;
  if (!probe.style.color) return null;
  document.body.append(probe);
  const m = /rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(getComputedStyle(probe).color);
  probe.remove();
  if (!m || (m[4] !== undefined && Number(m[4]) < 0.5)) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}
// Runs inside the page: returns candidate colors, best first.
function pageColorCandidates() {
  const out = [];
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && meta.content) out.push(meta.content);
  const bgOf = (el) => (el ? getComputedStyle(el).backgroundColor : "");
  for (const sel of ["header", "nav", '[role="banner"]', "body", "html"]) out.push(bgOf(document.querySelector(sel)));
  const a = document.querySelector("a[href]");
  if (a) out.push(getComputedStyle(a).color);
  return out;
}
async function detectSiteColor() {
  siteColor = null;
  if (!activeTabInfo || !core.checkUrl(activeTabInfo.url).ok) return;
  try {
    const res = await call(() => api.scripting.executeScript({ target: { tabId: activeTabInfo.id }, func: pageColorCandidates }));
    const list = (res && res[0] && res[0].result) || [];
    for (const raw of Array.isArray(list) ? list : []) {
      const c = parseColor(raw);
      if (c && sat(c) >= 0.2) { siteColor = c; break; } // grey, white and black sites keep the REden purple
    }
  } catch (_) { /* page can't be read: keep the default colors */ }
}

function applyTheme({ dark, popupSize }) {
  document.body.classList.toggle("dark", !!dark);
  const px = Math.min(22, Math.max(12, Number(popupSize) || 14));
  document.body.style.setProperty("--font-size", px + "px");
  applyTint();
}

// ---------- LANGUAGE ----------
// The first time the popup opens it asks for a language. It can be changed later in Settings.
function guessLang() {
  const code = String((navigator.language || "en")).slice(0, 2).toLowerCase();
  return I18N.LANGS.some(([c]) => c === code) ? code : "en";
}
function setLanguage(code) {
  lang = I18N.LANGS.some(([c]) => c === code) ? code : "en";
  saved.lang = lang;
  I18N.apply(document, lang);
  const sel = $("opt-lang");
  if (sel) sel.value = lang;
  // Translation target follows the chosen language when it is one we can translate into.
  const trSel = $("tr-lang");
  if (trSel && lang !== "en" && [...trSel.options].some((o) => o.value === lang)) {
    trSel.value = lang;
    trSel.dispatchEvent(new Event("change"));
  }
  if (activeTabInfo) {
    refreshStatus();
    rerenderWords();
  }
}
function showWelcome() {
  const guess = guessLang();
  $("welcome-title").textContent = I18N.t(guess, "welcome_title");
  $("welcome-sub").textContent = I18N.t(guess, "welcome_sub");
  const list = $("welcome-list");
  list.textContent = "";
  const ordered = [...I18N.LANGS].sort((a, b) => (b[0] === guess) - (a[0] === guess));
  for (const [code, name] of ordered) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "lang-btn" + (code === guess ? " guess" : "");
    b.lang = code;
    b.dir = I18N.RTL.has(code) ? "rtl" : "ltr";
    b.textContent = name;
    b.addEventListener("click", () => {
      setLanguage(code);
      storageSet({ lang: code, trLang: $("tr-lang").value });
      $("welcome").hidden = true;
    });
    list.append(b);
  }
  $("welcome").hidden = false;
  list.querySelector("button").focus();
}

// ---------- BIONIC READING ----------
const bioSwitches = [...document.querySelectorAll("[data-bio-switch]")];
const bioStatus = [...document.querySelectorAll("[data-bio-status]")];

function setStatus(text, kind) {
  bioStatus.forEach((el) => {
    el.textContent = text;
    el.classList.toggle("warn", kind === "warn");
    el.classList.toggle("ok", kind === "ok");
  });
}

function sendToTab(msg) {
  return call(() => api.tabs.sendMessage(activeTabInfo.id, msg));
}

// Make sure the content script is running in the current tab (uses the activeTab permission).
async function ensureInjected() {
  if (!activeTabInfo) return false;
  try { if (await sendToTab({ type: "reden:status" })) return true; } catch (_) { /* not injected yet */ }
  try {
    await call(() => api.scripting.executeScript({ target: { tabId: activeTabInfo.id }, files: CONTENT_FILES }));
    return true;
  } catch (_) {
    return false;
  }
}

async function refreshStatus() {
  const chk = core.checkUrl(activeTabInfo && activeTabInfo.url);
  if (!chk.ok) {
    return setStatus(
      chk.reason + (saved.bionicOn ? " " + tx("s_still") : ""),
      "warn"
    );
  }
  if (!saved.bionicOn) {
    return setStatus(saved.bionicAuto ? tx("s_off_auto") : tx("s_off"), null);
  }
  const ok = await ensureInjected();
  if (!ok) return setStatus(tx("s_blocked"), "warn");
  try {
    let s = await sendToTab({ type: "reden:recheck" }).then(() => sendToTab({ type: "reden:status" }));
    // The page script is still reading its settings or asking the backend: wait a moment for the answer.
    for (let i = 0; i < 10 && s && (s.phase === "checking" || s.phase === "off"); i++) {
      await new Promise((r) => setTimeout(r, 400));
      s = await sendToTab({ type: "reden:status" });
    }
    if (s && s.offline) return setStatus(tx("s_offline"), "warn");
    setStatus(s && s.active && !(s.busy && s.words === 0) ? tx("s_on", { n: s.words }) : tx("s_formatting"), "ok");
  } catch (_) {
    setStatus(tx("s_noresp"), "warn");
  }
}

async function setBionic(on) {
  saved.bionicOn = on;
  bioSwitches.forEach((s) => { s.checked = on; });
  await storageSet({ bionicOn: on }); // wait: the content script reads this when it starts
  await refreshStatus();
}

// Draws a sample sentence with the current bold amount, size and spacing.
function renderSample(el, text, scaled) {
  el.textContent = "";
  for (const s of core.segments(text, saved.bionicStrength)) {
    if (s.bold) {
      const b = document.createElement("b");
      b.textContent = s.text;
      el.append(b);
    } else {
      el.append(document.createTextNode(s.text));
    }
  }
  const stack = core.FONT_STACKS[saved.bionicMode];
  el.style.fontFamily = stack || "";
  if (scaled) {
    el.style.fontSize = saved.bionicSize / 100 + "em";
    el.style.lineHeight = saved.bionicSpacing > 0 ? String(saved.bionicSpacing) : "1.4";
    el.style.letterSpacing = saved.bionicLetter > 0 ? saved.bionicLetter + "em" : "";
  }
}
function syncPresetRadios() {
  document.querySelectorAll('input[name="preset"]').forEach((r) => { r.checked = Number(r.value) === saved.bionicStrength; });
}
function renderPreview() {
  renderSample($("preview"), PREVIEW_TEXT, true);
  renderSample($("specimen"), SPECIMEN_TEXT, false);
}

async function registerAuto() {
  const def = {
    id: AUTO_SCRIPT_ID, matches: AUTO_ORIGINS, js: CONTENT_FILES,
    runAt: "document_idle", persistAcrossSessions: true,
  };
  const existing = await call(() => api.scripting.getRegisteredContentScripts({ ids: [AUTO_SCRIPT_ID] }));
  if (existing && existing.length) await call(() => api.scripting.updateContentScripts([def]));
  else await call(() => api.scripting.registerContentScripts([def]));
}
async function unregisterAuto() {
  try { await call(() => api.scripting.unregisterContentScripts({ ids: [AUTO_SCRIPT_ID] })); } catch (_) {}
}

async function setAuto(want, box) {
  note("auto-msg", "");
  if (want) {
    // Must be requested straight from the click, so no `await` before this line.
    let granted = false;
    try { granted = await call(() => api.permissions.request({ origins: AUTO_ORIGINS })); } catch (_) {}
    if (!granted) {
      box.checked = false;
      return note("auto-msg", tx("a_denied"));
    }
    try { await registerAuto(); }
    catch (_) {
      box.checked = false;
      return note("auto-msg", tx("a_fail"));
    }
    saved.bionicAuto = true;
    await storageSet({ bionicAuto: true });
    note("auto-msg", tx("a_on"));
  } else {
    await unregisterAuto();
    try { await call(() => api.permissions.remove({ origins: AUTO_ORIGINS })); } catch (_) {}
    saved.bionicAuto = false;
    await storageSet({ bionicAuto: false });
    note("auto-msg", tx("a_off"));
  }
  refreshStatus();
}

// If the user revoked the permission in browser settings, reflect that.
async function syncAutoWithPermission() {
  let granted = false;
  try { granted = await call(() => api.permissions.contains({ origins: AUTO_ORIGINS })); } catch (_) {}
  if (saved.bionicAuto && !granted) {
    saved.bionicAuto = false;
    await storageSet({ bionicAuto: false });
    await unregisterAuto();
  } else if (saved.bionicAuto && granted) {
    try { await registerAuto(); } catch (_) {}
  }
  $("bio-auto").checked = saved.bionicAuto;
}

function initBionic() {
  bioSwitches.forEach((s) => {
    s.checked = saved.bionicOn;
    s.addEventListener("change", () => setBionic(s.checked));
  });

  const strength = $("bio-strength");
  const size = $("bio-size");
  const spacing = $("bio-spacing");
  strength.value = saved.bionicStrength;
  size.value = saved.bionicSize;
  spacing.value = String(saved.bionicSpacing);
  $("bio-strength-out").textContent = saved.bionicStrength + "%";
  $("bio-size-out").textContent = saved.bionicSize + "%";

  // Merge pending changes so two quick edits (e.g. size then spacing) are both saved.
  let pending = {};
  const flush = debounce(() => { const p = pending; pending = {}; storageSet(p); }, 100);
  const persist = (patch) => { Object.assign(pending, patch); flush(); };
  strength.addEventListener("input", () => {
    saved.bionicStrength = core.clampPct(strength.value);
    $("bio-strength-out").textContent = saved.bionicStrength + "%";
    renderPreview();
    syncPresetRadios();
    persist({ bionicStrength: saved.bionicStrength });
  });
  size.addEventListener("input", () => {
    saved.bionicSize = Number(size.value);
    $("bio-size-out").textContent = saved.bionicSize + "%";
    renderPreview();
    persist({ bionicSize: saved.bionicSize });
  });
  spacing.addEventListener("change", () => {
    saved.bionicSpacing = Number(spacing.value);
    renderPreview();
    persist({ bionicSpacing: saved.bionicSpacing });
  });

  // Home: intensity presets and page text style
  document.querySelectorAll('input[name="preset"]').forEach((r) =>
    r.addEventListener("change", () => {
      saved.bionicStrength = core.clampPct(r.value);
      strength.value = saved.bionicStrength;
      $("bio-strength-out").textContent = saved.bionicStrength + "%";
      renderPreview();
      persist({ bionicStrength: saved.bionicStrength });
    })
  );
  syncPresetRadios();
  const modeRadios = [...document.querySelectorAll('input[name="mode"]')];
  if (!core.FONT_STACKS.hasOwnProperty(saved.bionicMode)) saved.bionicMode = "original";
  modeRadios.forEach((r) => {
    r.checked = r.value === saved.bionicMode;
    r.addEventListener("change", () => {
      saved.bionicMode = r.value;
      renderPreview();
      persist({ bionicMode: r.value });
    });
  });

  // Read: letter spacing and contrast
  const letter = $("bio-letter");
  letter.value = String(saved.bionicLetter);
  letter.addEventListener("change", () => {
    saved.bionicLetter = Number(letter.value);
    renderPreview();
    persist({ bionicLetter: saved.bionicLetter });
  });
  const contrast = $("bio-contrast");
  contrast.checked = !!saved.bionicContrast;
  contrast.addEventListener("change", () => {
    saved.bionicContrast = contrast.checked;
    persist({ bionicContrast: contrast.checked });
  });

  $("bio-auto").checked = saved.bionicAuto;
  $("bio-auto").addEventListener("change", (e) => setAuto(e.target.checked, e.target));

  renderPreview();
}

// ---------- SENTENCE ANALYSIS (needs backend) ----------
async function getPageText() {
  const res = await call(() => api.scripting.executeScript({
    target: { tabId: activeTabInfo.id },
    func: () => String(getSelection()).trim() || document.body.innerText.slice(0, 3000),
  }));
  return (res && res[0] && res[0].result) || "";
}

// ---------- PAGE WORDS ----------
// Runs inside the page: returns the page's visible text. Text pieces in the same block are joined
// directly (so bold pieces like <b>Yo</b>ur stay one word), and different blocks are separated by a newline.
function pageTextForWords() {
  const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|IFRAME|SVG|MATH|TEXTAREA|INPUT|SELECT|OPTION)$/i;
  const root = document.body || document.documentElement;
  const blocks = new WeakMap();
  const blockOf = (el) => {
    if (!el || el === root) return root;
    if (!blocks.has(el)) {
      const d = getComputedStyle(el).display;
      blocks.set(el, d === "inline" || d === "contents" ? blockOf(el.parentElement) : el);
    }
    return blocks.get(el);
  };
  const out = [];
  let size = 0;
  let prev = null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (n.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
      if (SKIP.test(n.tagName) || (n.checkVisibility && !n.checkVisibility())) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_SKIP;
    },
  });
  let n;
  while ((n = walker.nextNode()) && size < 4000000) {
    const b = blockOf(n.parentElement);
    if (prev && b !== prev) out.push("\n");
    out.push(n.nodeValue);
    size += n.nodeValue.length;
    prev = b;
  }
  return { url: location.href, title: document.title, text: out.join("") };
}
// Runs inside the page: prints the words to the page's own console (F12 > Console).
function printWordsInPage(words, url) {
  console.log("[REden] " + words.length + " words from " + url, words);
}

function initPageWords() {
  $("pw-go").addEventListener("click", async () => {
    $("pw-preview").textContent = "";
    note("pw-status", tx("pw_working"));
    let page;
    try {
      const res = await call(() => api.scripting.executeScript({ target: { tabId: activeTabInfo.id }, func: pageTextForWords }));
      page = res && res[0] && res[0].result;
    } catch (_) { return note("pw-status", tx("r_cant")); }
    const words = page ? core.collectWords(page.text) : [];
    if (!words.length) return note("pw-status", tx("pw_none"));

    console.log("[REden] " + words.length + " words from " + page.url, words); // popup console
    try {
      await call(() => api.scripting.executeScript({ target: { tabId: activeTabInfo.id }, func: printWordsInPage, args: [words, page.url] }));
    } catch (_) { /* console print is best effort */ }
    $("pw-preview").textContent = words.slice(0, 40).join(" ") + (words.length > 40 ? " …" : "");

    const unique = new Set(words.map((w) => w.toLowerCase())).size;
    let sent = false;
    try {
      await apiPost("/page", { url: page.url, title: page.title, words }, saved.backendUrl);
      sent = true;
    } catch (_) { /* backend offline */ }
    note("pw-status", tx("pw_done", { n: words.length, u: unique }) + " " + tx(sent ? "pw_sent" : "pw_nobackend"));
  });
}

function initRead() {
  $("analyze").addEventListener("click", async () => {
    const list = $("r-sentences");
    list.textContent = "";
    note("r-status", tx("r_reading"));
    let text;
    try { text = await getPageText(); }
    catch (_) { return note("r-status", tx("r_cant")); }
    if (!text) return note("r-status", tx("r_none"));

    note("r-status", tx("r_analyzing"));
    try {
      const { sentences, count } = await apiPost("/sentences", { text }, saved.backendUrl);
      sentences.forEach((s) => {
        const li = document.createElement("li");
        li.textContent = s;
        list.append(li);
      });
      note("r-status", tx("r_count", { n: count }));
    } catch (_) {
      note("r-status", tx("r_backend"));
    }
  });
}

// ---------- WORDS ----------
let rerenderWords = () => {};
function initWords() {
  const info = $("word-info");

  async function lookup(w) {
    info.hidden = false;
    info.textContent = tx("w_looking", { w });
    try {
      const r = await apiPost("/word", { word: w }, saved.backendUrl);
      info.textContent = "";
      [[tx("w_word"), r.word], [tx("w_base"), r.lemma], [tx("w_pos"), r.pos],
       [tx("w_common"), r.is_stop ? tx("yes") : tx("no")]].forEach(([k, v]) => {
        const row = document.createElement("div");
        row.className = "kv";
        const a = document.createElement("span");
        a.textContent = k;
        const b = document.createElement("b");
        b.textContent = v;
        row.append(a, b);
        info.append(row);
      });
    } catch (_) {
      info.textContent = tx("w_down");
    }
  }

  function render() {
    const list = $("word-list");
    list.textContent = "";
    words.forEach((w, i) => {
      const li = document.createElement("li");
      const label = document.createElement("button");
      label.type = "button";
      label.className = "word-btn";
      label.textContent = w;
      label.setAttribute("aria-label", tx("w_lookup", { w }));
      label.addEventListener("click", () => lookup(w));
      const del = document.createElement("button");
      del.type = "button";
      del.className = "remove-btn";
      del.setAttribute("aria-label", tx("w_remove_aria", { w }));
      del.textContent = tx("w_remove");
      del.addEventListener("click", () => {
        words.splice(i, 1);
        storageSet({ words });
        info.hidden = true;
        render();
      });
      li.append(label, del);
      list.append(li);
    });
    $("word-empty").hidden = words.length > 0;
  }

  $("word-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("word-input").value.trim();
    if (v && !words.includes(v)) {
      words.push(v);
      storageSet({ words });
      render();
      lookup(v);
    }
    $("word-input").value = "";
  });

  rerenderWords = render;
  render();
}

// ---------- TRANSLATE (English -> your language, on-device) ----------
// Sample sentence and hand-written translations shown before the user translates anything.
const TR_SAMPLE = "Reading is easier when the start of each word is bold.";
const TR_LANGS = [
  ["es", "Spanish (Español)", "Leer es más fácil cuando el comienzo de cada palabra está en negrita."],
  ["fr", "French (Français)", "La lecture est plus facile quand le début de chaque mot est en gras."],
  ["de", "German (Deutsch)", "Lesen fällt leichter, wenn der Anfang jedes Wortes fett gedruckt ist."],
  ["pt", "Portuguese (Português)", "Ler é mais fácil quando o início de cada palavra está em negrito."],
  ["ru", "Russian (Русский)", "Читать легче, когда начало каждого слова выделено жирным."],
  ["zh", "Chinese (中文)", "当每个单词的开头加粗时，阅读会更容易。"],
  ["ja", "Japanese (日本語)", "各単語の最初が太字だと、読みやすくなります。"],
  ["ko", "Korean (한국어)", "각 단어의 시작 부분이 굵게 표시되면 읽기가 더 쉬워집니다."],
  ["ar", "Arabic (العربية)", "تصبح القراءة أسهل عندما تكون بداية كل كلمة بخط عريض."],
  ["hi", "Hindi (हिन्दी)", "जब हर शब्द की शुरुआत मोटे अक्षरों में हो, तो पढ़ना आसान हो जाता है।"],
];

async function getSelectedText() {
  const res = await call(() => api.scripting.executeScript({
    target: { tabId: activeTabInfo.id },
    func: () => String(getSelection()).trim().slice(0, 3000),
  }));
  return (res && res[0] && res[0].result) || "";
}

async function translateText(text, target) {
  if (!("Translator" in globalThis)) throw new Error("unsupported");
  const pair = { sourceLanguage: "en", targetLanguage: target };
  if ((await Translator.availability(pair)) === "unavailable") throw new Error("pair");
  const translator = await Translator.create({
    ...pair,
    monitor(m) {
      m.addEventListener("downloadprogress", (e) =>
        note("tr-status", tx("t_download", { n: Math.round(e.loaded * 100) })));
    },
  });
  return translator.translate(text);
}

function initTranslate() {
  const sel = $("tr-lang");
  TR_LANGS.forEach(([code, label]) => {
    const o = document.createElement("option");
    o.value = code;
    o.textContent = label;
    sel.append(o);
  });
  if (!TR_LANGS.some(([c]) => c === saved.trLang)) saved.trLang = "es";
  sel.value = saved.trLang;

  function showExample() {
    renderSample($("tr-ex-en"), TR_SAMPLE, false);
    const row = TR_LANGS.find(([c]) => c === sel.value);
    renderSample($("tr-ex-to"), row ? row[2] : "", false);
  }
  sel.addEventListener("change", () => {
    saved.trLang = sel.value;
    storageSet({ trLang: sel.value });
    $("tr-out").textContent = "";
    note("tr-status", "");
    showExample();
  });
  showExample();

  $("tr-go").addEventListener("click", async () => {
    const out = $("tr-out");
    out.textContent = "";
    let text = $("tr-input").value.trim();
    if (!text) {
      note("tr-status", tx("t_reading"));
      try { text = await getSelectedText(); }
      catch (_) { return note("tr-status", tx("t_cant")); }
    }
    if (!text) return note("tr-status", tx("t_none"));
    note("tr-status", tx("t_working"));
    try {
      const result = await translateText(text, sel.value);
      renderSample(out, result, false);
      note("tr-status", "");
    } catch (e) {
      note("tr-status", e.message === "pair"
        ? tx("t_pair")
        : tx("t_unavail"));
    }
  });
}

// ---------- NOTES ----------
function initNotes() {
  const box = $("note-text");
  box.value = saved.notes || "";
  box.addEventListener("input", () => storageSet({ notes: box.value }));
}

// ---------- STATS ----------
function renderStats() {
  const notes = $("note-text").value;
  $("stat-words").textContent = words.length;
  $("stat-chars").textContent = notes.length;
  $("stat-lines").textContent = notes ? notes.split("\n").length : 0;
  $("stat-longest").textContent = words.reduce((a, w) => (w.length > a.length ? w : a), "") || "–";
}

// ---------- SETTINGS ----------
function initSettings() {
  const dark = $("opt-dark");
  const size = $("opt-size");
  const langSel = $("opt-lang");
  I18N.LANGS.forEach(([code, name]) => {
    const o = document.createElement("option");
    o.value = code;
    o.textContent = name;
    langSel.append(o);
  });
  langSel.value = lang;
  langSel.addEventListener("change", () => {
    setLanguage(langSel.value);
    storageSet({ lang: lang, trLang: $("tr-lang").value });
  });
  const tint = $("opt-tint");
  tint.checked = saved.tintSite;
  tint.addEventListener("change", () => {
    saved.tintSite = tint.checked;
    storageSet({ tintSite: tint.checked });
    applyTint();
  });
  dark.checked = saved.dark;
  size.value = saved.popupSize;
  $("opt-size-out").textContent = saved.popupSize + " px";
  dark.addEventListener("change", () => {
    saved.dark = dark.checked;
    storageSet({ dark: dark.checked });
    applyTheme(saved);
  });
  size.addEventListener("input", () => {
    saved.popupSize = Number(size.value);
    $("opt-size-out").textContent = saved.popupSize + " px";
    applyTheme(saved);
    storageSet({ popupSize: saved.popupSize });
  });

  const pgDark = $("pg-dark");
  pgDark.checked = saved.pageDark;
  pgDark.addEventListener("change", async () => {
    const target = { tabId: activeTabInfo.id };
    try {
      if (pgDark.checked) await call(() => api.scripting.insertCSS({ target, css: DARK_PAGE_CSS }));
      else await call(() => api.scripting.removeCSS({ target, css: DARK_PAGE_CSS }));
      storageSet({ pageDark: pgDark.checked });
      note("pg-msg", "");
    } catch (_) {
      pgDark.checked = !pgDark.checked;
      note("pg-msg", tx("pg_cant"));
    }
  });

  $("be-url").value = saved.backendUrl;
  $("be-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = $("be-url").value.trim().replace(/\/$/, "");
    saved.backendUrl = url;
    storageSet({ backendUrl: url });
    note("be-msg", tx("be_testing"));
    try {
      const r = await fetch(url + "/health");
      note("be-msg", r.ok ? tx("be_ok") : tx("be_http", { n: r.status }));
    } catch (_) {
      note("be-msg", tx("be_no"));
    }
  });

  $("clear-data").addEventListener("click", () => {
    words.length = 0;
    $("note-text").value = "";
    storageSet({ words: [], notes: "" });
    $("word-list").textContent = "";
    $("word-empty").hidden = false;
    $("word-info").hidden = true;
    note("clear-msg", tx("cleared"));
  });
}

// ---------- start ----------
(async function init() {
  saved = { ...DEFAULTS, ...(await storageGet(Object.keys(DEFAULTS))) };
  words = Array.isArray(saved.words) ? [...saved.words] : [];
  if (saved.large && saved.popupSize === 14) saved.popupSize = 18; // old "Large text" checkbox
  applyTheme(saved);
  lang = I18N.LANGS.some(([c]) => c === saved.lang) ? saved.lang : "en";
  I18N.apply(document, lang);

  [activeTabInfo] = await queryActiveTab();
  const title = (activeTabInfo && activeTabInfo.title) || tx("unavailable");
  $("page-title").textContent = title;
  $("r-title").textContent = title;
  let host = tx("unavailable");
  try { host = new URL(activeTabInfo.url).hostname || host; } catch (_) {}
  $("r-host").textContent = host;
  await detectSiteColor();
  applyTheme(saved);

  initBionic();
  initRead();
  initPageWords();
  initWords();
  initTranslate();
  initNotes();
  initSettings();
  showSection($("t-" + saved.activeTab) ? saved.activeTab : "home");
  if (!saved.lang) showWelcome();

  await syncAutoWithPermission();
  refreshStatus();
})();
