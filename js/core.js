(() => {
  const cfg = window.CM_ADMIN_CONFIG || {};
  const CM = window.CM = { cfg };
  CM.configured = /^https:\/\/.+/.test(cfg.SUPABASE_URL || "") && !!cfg.SUPABASE_ANON_KEY && !!window.supabase;
  CM.$ = (s, r = document) => r.querySelector(s);
  CM.$$ = (s, r = document) => [...r.querySelectorAll(s)];
  CM.esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  CM.makeClient = remember => (CM.db = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { storage: remember ? localStorage : sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }));
  CM.fmt = d => d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";
  CM.stars = n => n ? "★".repeat(n) + "☆".repeat(5 - n) : "";
  CM.initial = n => (n || "?").trim().charAt(0).toUpperCase();
  CM.slugify = s => String(s || "").toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60);
  CM.toast = (m, kind) => { const t = document.createElement("div"); t.className = "toast " + (kind || ""); t.textContent = m; CM.$("#toasts").append(t); setTimeout(() => t.remove(), kind == "bad" ? 6000 : 3000) };
  CM.msg = e => { const m = (e && e.message) || String(e); if (/slug|projects_slug_key/.test(m) && /duplicate|unique/i.test(m)) return "That URL slug is already used by another project."; if (/Failed to fetch|NetworkError/i.test(m)) return "Network problem. Check your connection and try again."; if (/row-level security|permission denied/i.test(m)) return "Not allowed. Please sign in again as the owner."; return m };
  // Every backend call goes through here so failures are never hidden.
  CM.must = async p => { const r = await p; if (r.error) { if (/JWT|expired|not authenticated/i.test(r.error.message || "") && CM.onExpired) CM.onExpired(); throw r.error } return r.data };
  CM.run = async (btn, fn, okMsg) => {
    const label = btn && btn.textContent; if (btn) { btn.disabled = true; btn.textContent = "Working…" }
    try { const r = await fn(); if (okMsg) CM.toast(okMsg, "good"); return { ok: true, r } }
    catch (e) { CM.toast(CM.msg(e), "bad"); return { ok: false, e } }
    finally { if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = label } }
  };
  CM.confirm = (title, msg, yes = "Delete", danger = true) => new Promise(res => {
    const d = CM.$("#cfm"); CM.$("#cft").textContent = title; CM.$("#cfp").textContent = msg;
    const y = CM.$("#cfy"); y.textContent = yes; y.className = "btn" + (danger ? " red" : "");
    let out = false; d.onclose = () => res(out); CM.$("#cfn").onclick = () => d.close(); y.onclick = () => { out = true; d.close() }; d.showModal();
  });
  CM.preview = html => { CM.$("#pvb").innerHTML = html; CM.$("#pvc").onclick = () => CM.$("#pv").close(); CM.$("#pv").showModal() };
  CM.ALLOWED = ["image/jpeg", "image/png", "image/webp"];
  CM.upload = async (file, folder, bucket = "media", max = 5e6) => {
    if (!CM.ALLOWED.includes(file.type)) throw new Error("Only JPG, PNG or WebP images are allowed.");
    if (file.size > max) throw new Error(`Image must be under ${max / 1e6} MB.`);
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type], path = `${folder}/${crypto.randomUUID()}.${ext}`;
    const { error } = await CM.db.storage.from(bucket).upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (error) throw error; return CM.db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  };
  CM.pathIn = (bucket, url) => { const m = `/storage/v1/object/public/${bucket}/`, i = (url || "").indexOf(m); return i < 0 ? null : decodeURIComponent(url.slice(i + m.length).split("?")[0]) };
  CM.removeFiles = async (bucket, urls) => { const p = urls.filter(Boolean).map(u => CM.pathIn(bucket, u)).filter(Boolean); if (p.length) { const { error } = await CM.db.storage.from(bucket).remove(p); if (error) console.warn("File cleanup failed", error) } };
  CM.fail = (el, e, retry) => { el.innerHTML = `<div class="box empty"><p><b>Couldn’t load this page.</b><br>${CM.esc(CM.msg(e))}</p><button class="btn" id="rt">Try again</button></div>`; CM.$("#rt", el).onclick = retry };
  CM.skeleton = n => Array.from({ length: n }, () => '<div class="sk"></div>').join("");
  CM.avatar = (name, url, cls = "th") => `<div class="${cls}" ${url ? `style="background-image:url('${CM.esc(url)}')"` : ""} aria-hidden="true">${url ? "" : CM.esc(CM.initial(name))}</div>`;
  CM.badge = s => `<span class="bd ${s}">${{ published: "Live", draft: "Draft", pending: "Pending", rejected: "Rejected" }[s] || s}</span>`;
  CM.refreshBadge = async () => { try { const { count } = await CM.db.from("customer_feedback").select("id", { count: "exact", head: true }).eq("status", "pending"); const b = CM.$("#bd"); b.textContent = count || 0; b.hidden = !count } catch (e) { } };
})();
