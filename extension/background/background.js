// REden background worker. Web pages can't call the local backend directly (mixed content, CORS),
// so the content script sends its requests here and this worker talks to the backend.
// It only ever contacts the backend address saved in Settings (http://127.0.0.1:5050 by default).
const api = globalThis.browser ?? globalThis.chrome;
const DEFAULT_URL = "http://127.0.0.1:5050";

async function backendUrl() {
  try {
    const s = await api.storage.local.get("backendUrl");
    return String(s.backendUrl || DEFAULT_URL).replace(/\/$/, "");
  } catch (_) {
    return DEFAULT_URL;
  }
}

async function request(path, body, timeoutMs) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch((await backendUrl()) + path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || sender.id !== api.runtime.id) return; // only our own extension scripts
  if (msg.type === "reden:health") {
    request("/health", null, 2500).then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
    return true; // answer asynchronously
  }
  if (msg.type === "reden:bionic") {
    const paragraphs = Array.isArray(msg.paragraphs) ? msg.paragraphs.filter((p) => typeof p === "string") : [];
    request("/bionic", { paragraphs }, 120000).then(
      (d) => sendResponse(Array.isArray(d.paragraphs) && d.paragraphs.length === paragraphs.length
        ? { ok: true, data: d.paragraphs } : { ok: false, error: "bad response" }),
      (e) => sendResponse({ ok: false, error: String(e) })
    );
    return true;
  }
});
