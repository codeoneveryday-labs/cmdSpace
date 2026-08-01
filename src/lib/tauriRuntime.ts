export function hasTauriRuntime() {
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

export function renderBrowserRuntimeNotice(rootId: string) {
  const root = document.getElementById(rootId);
  if (!root) return;

  root.innerHTML = `
    <main style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0a;color:#f8fafc;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px;">
      <section style="max-width:680px;border:1px solid rgba(148,163,184,.24);border-radius:18px;background:rgba(15,23,42,.7);box-shadow:0 24px 80px rgba(0,0,0,.35);padding:28px;">
        <p style="margin:0 0 10px;color:#38bdf8;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">cmdSpace desktop runtime required</p>
        <h1 style="margin:0 0 12px;font-size:30px;line-height:1.15;">This is the Tauri dev UI, not a project UI.</h1>
        <p style="margin:0;color:#cbd5e1;font-size:16px;line-height:1.65;">
          Open cmdSpace from the desktop app. To use cmdSpace from another device, turn on Network remote access in Settings
          and open the remote URL shown there.
        </p>
      </section>
    </main>
  `;
}
