// Cross-browser shim: Firefox exposes `browser`, Chromium exposes `chrome`.
const api = globalThis.browser ?? globalThis.chrome;
const core = globalThis.ReaDeNCore; // from ../shared/core.js

const DEFAULTS = {
  activeTab: "home",
  dark: false, large: false, popupSize: 14, trLang: "es", words: [], notes: "",
  backendUrl: "http://127.0.0.1:5050",
  pageDark: false,
  ...core.DEFAULTS,
};

const AUTO_ORIGINS = ["http://*/*", "https://*/*"];
const AUTO_SCRIPT_ID = "readen-bionic";
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

function applyTheme({ dark, popupSize }) {
  document.body.classList.toggle("dark", !!dark);
  const px = Math.min(22, Math.max(12, Number(popupSize) || 14));
  document.body.style.setProperty("--font-size", px + "px");
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
  try { if (await sendToTab({ type: "readen:status" })) return true; } catch (_) { /* not injected yet */ }
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
      chk.reason + (saved.bionicOn ? " It will still apply on supported pages." : ""),
      "warn"
    );
  }
  if (!saved.bionicOn) {
    return setStatus(saved.bionicAuto ? "Bionic reading is off, so new pages stay as they are." : "Bionic reading is off.", null);
  }
  const ok = await ensureInjected();
  if (!ok) return setStatus("This site blocks extensions, so REden can't format it. Try another page.", "warn");
  await new Promise((r) => setTimeout(r, 150)); // let the first batch finish
  try {
    const s = await sendToTab({ type: "readen:status" });
    setStatus(
      s && s.active ? `Bionic reading is on. ${s.words} word${s.words === 1 ? "" : "s"} formatted on this page.` : "Formatting this page…",
      "ok"
    );
  } catch (_) {
    setStatus("This page isn't responding. Reload it and turn Bionic reading on again.", "warn");
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
      return note("auto-msg", "Permission wasn't granted, so Automatic mode stays off.");
    }
    try { await registerAuto(); }
    catch (_) {
      box.checked = false;
      return note("auto-msg", "Couldn't turn on Automatic mode in this browser.");
    }
    saved.bionicAuto = true;
    await storageSet({ bionicAuto: true });
    note("auto-msg", "Automatic mode is on. New pages are formatted when Bionic reading is on.");
  } else {
    await unregisterAuto();
    try { await call(() => api.permissions.remove({ origins: AUTO_ORIGINS })); } catch (_) {}
    saved.bionicAuto = false;
    await storageSet({ bionicAuto: false });
    note("auto-msg", "Automatic mode is off and the website permission was removed.");
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

function initRead() {
  $("analyze").addEventListener("click", async () => {
    const list = $("r-sentences");
    list.textContent = "";
    note("r-status", "Reading page…");
    let text;
    try { text = await getPageText(); }
    catch (_) { return note("r-status", "Can't read this page (browser pages and extension stores are blocked)."); }
    if (!text) return note("r-status", "No text found. Select some text on the page first.");

    note("r-status", "Analyzing…");
    try {
      const { sentences, count } = await apiPost("/sentences", { text }, saved.backendUrl);
      sentences.forEach((s) => {
        const li = document.createElement("li");
        li.textContent = s;
        list.append(li);
      });
      note("r-status", count + " sentence" + (count === 1 ? "" : "s") + ".");
    } catch (_) {
      note("r-status", "The backend isn't running. Start it with `python app.py` in the backend folder. Bionic reading works without it.");
    }
  });
}

// ---------- WORDS ----------
function initWords() {
  const info = $("word-info");

  async function lookup(w) {
    info.hidden = false;
    info.textContent = "Looking up “" + w + "”…";
    try {
      const r = await apiPost("/word", { word: w }, saved.backendUrl);
      info.textContent = "";
      [["Word", r.word], ["Base form", r.lemma], ["Part of speech", r.pos],
       ["Common word", r.is_stop ? "yes" : "no"]].forEach(([k, v]) => {
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
      info.textContent = "The word is saved, but the backend isn't running. Start it with `python app.py` in the backend folder to see details.";
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
      label.setAttribute("aria-label", "Look up " + w);
      label.addEventListener("click", () => lookup(w));
      const del = document.createElement("button");
      del.type = "button";
      del.className = "remove-btn";
      del.setAttribute("aria-label", "Remove " + w);
      del.textContent = "Remove";
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
  const t = await Translator.create({
    ...pair,
    monitor(m) {
      m.addEventListener("downloadprogress", (e) =>
        note("tr-status", "Downloading the language pack, " + Math.round(e.loaded * 100) + "%. This happens once."));
    },
  });
  return t.translate(text);
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
      note("tr-status", "Reading your selection…");
      try { text = await getSelectedText(); }
      catch (_) { return note("tr-status", "Can't read this page. Type or paste the text instead."); }
    }
    if (!text) return note("tr-status", "No text to translate. Type some, or select text on the page first.");
    note("tr-status", "Translating…");
    try {
      const result = await translateText(text, sel.value);
      renderSample(out, result, false);
      note("tr-status", "");
    } catch (e) {
      note("tr-status", e.message === "pair"
        ? "This browser can't translate English into that language yet. Try another language."
        : "On-device translation isn't available here. It needs Chrome or Edge 138 or newer on a computer. The sample above still shows what it looks like.");
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
      note("pg-msg", "Can't change this page (browser pages and extension stores are blocked).");
    }
  });

  $("be-url").value = saved.backendUrl;
  $("be-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const url = $("be-url").value.trim().replace(/\/$/, "");
    saved.backendUrl = url;
    storageSet({ backendUrl: url });
    note("be-msg", "Testing…");
    try {
      const r = await fetch(url + "/health");
      note("be-msg", r.ok ? "Connected." : "Server answered with HTTP " + r.status + ".");
    } catch (_) {
      note("be-msg", "Not reachable. Run `python app.py` in the backend folder.");
    }
  });

  $("clear-data").addEventListener("click", () => {
    words.length = 0;
    $("note-text").value = "";
    storageSet({ words: [], notes: "" });
    $("word-list").textContent = "";
    $("word-empty").hidden = false;
    $("word-info").hidden = true;
    note("clear-msg", "Cleared.");
  });
}

// ---------- start ----------
(async function init() {
  saved = { ...DEFAULTS, ...(await storageGet(Object.keys(DEFAULTS))) };
  words = Array.isArray(saved.words) ? [...saved.words] : [];
  if (saved.large && saved.popupSize === 14) saved.popupSize = 18; // old "Large text" checkbox
  applyTheme(saved);

  [activeTabInfo] = await queryActiveTab();
  const title = (activeTabInfo && activeTabInfo.title) || "Unavailable";
  $("page-title").textContent = title;
  $("r-title").textContent = title;
  let host = "Unavailable";
  try { host = new URL(activeTabInfo.url).hostname || host; } catch (_) {}
  $("r-host").textContent = host;

  initBionic();
  initRead();
  initWords();
  initTranslate();
  initNotes();
  initSettings();
  showSection($("t-" + saved.activeTab) ? saved.activeTab : "home");

  await syncAutoWithPermission();
  refreshStatus();
})();
