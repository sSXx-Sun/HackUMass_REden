// REden popup: one switch and a status line.
const api = globalThis.browser ?? globalThis.chrome;
const core = globalThis.REdenCore;
const CONTENT_FILES = ["shared/core.js", "content/bionic.js"];

// Extension APIs return promises when called without a callback (Chrome MV3 and Firefox).
const call = (fn) => new Promise((resolve, reject) => {
  try { Promise.resolve(fn()).then(resolve, reject); } catch (e) { reject(e); }
});
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let tab = null;
let pollToken = 0;

function setStatus(text, kind) {
  const el = $("status");
  el.textContent = text;
  el.className = "status" + (kind ? " " + kind : "");
}

const sendToTab = (msg) => call(() => api.tabs.sendMessage(tab.id, msg));

// Make sure the content script runs in this tab (activeTab permission).
async function ensureInjected() {
  try { if (await sendToTab({ type: "reden:status" })) return true; } catch (_) { /* not injected yet */ }
  try {
    await call(() => api.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_FILES }));
    return true;
  } catch (_) {
    return false;
  }
}

// Ask the page how it's going, every 0.5 s while the popup is open.
async function poll(on) {
  const token = ++pollToken;
  if (!on) return setStatus("Off. Turn it on to format this page.");
  setStatus("Starting…");
  if (!(await ensureInjected())) return setStatus("This page doesn't allow extensions to change it.", "warn");
  let first = true;
  while (token === pollToken) {
    let s = null;
    try { s = await sendToTab({ type: first ? "reden:recheck" : "reden:status" }); } catch (_) {}
    first = false;
    if (token !== pollToken) return;
    if (!s) setStatus("The page isn't answering. Reload it and try again.", "warn");
    else if (s.phase === "offline") setStatus("Can't reach the backend. Start it with: cd backend, then python server.py", "warn");
    else if (s.phase === "on") setStatus(s.busy ? `Formatting… ${s.bold} words bolded so far.` : `On. ${s.bold} words bolded.`, "ok");
    else setStatus("Connecting to the backend…");
    await sleep(500);
  }
}

(async function init() {
  [tab] = await call(() => api.tabs.query({ active: true, currentWindow: true })).catch(() => []);
  const sw = $("bionic");
  $("page").textContent = (tab && tab.title) || "";

  const chk = core.checkUrl(tab && tab.url);
  if (!chk.ok) {
    sw.disabled = true;
    return setStatus(chk.reason, "warn");
  }

  const { bionicOn } = await call(() => api.storage.local.get("bionicOn")).catch(() => ({}));
  sw.checked = !!bionicOn;
  sw.addEventListener("change", async () => {
    await call(() => api.storage.local.set({ bionicOn: sw.checked })); // the content script reads this on start
    poll(sw.checked);
  });
  poll(sw.checked);
})();
