/* Side-drawer editor used for projects, testimonials and feedback->testimonial conversion. */
(() => {
  const { $, esc } = CM;
  CM.editor = o => {
    const dlg = $("#drw"), id = o.id || crypto.randomUUID(), st = { ...o.values }, added = [], removed = [];
    let dirty = false, uploading = false;
    o.fields.forEach(f => { if (f.t == "gallery" && !Array.isArray(st[f.k])) st[f.k] = []; if (f.t == "tags" && !Array.isArray(st[f.k])) st[f.k] = [] });
    const opt = (v, cur) => { const [val, lab] = Array.isArray(v) ? v : [v, v]; return `<option value="${esc(val)}" ${String(cur ?? "") === String(val) ? "selected" : ""}>${esc(lab)}</option>` };
    const field = f => {
      const v = st[f.k], L = `<label for="e_${f.k}">${f.l}${f.req ? ' <span style="color:#dc2626">*</span>' : ""}</label>`, hint = f.h ? `<div class="hint">${f.h}</div>` : "";
      if (f.t == "textarea") return `${L}<textarea id="e_${f.k}" rows="${f.rows || 4}" maxlength="${f.max || 5000}">${esc(v)}</textarea>${hint}`;
      if (f.t == "select") return `${L}<select id="e_${f.k}">${f.o.map(x => opt(x, v)).join("")}</select>${hint}`;
      if (f.t == "toggle") return `<div class="tp" style="margin-top:16px"><input type="checkbox" id="e_${f.k}" ${v ? "checked" : ""}><label for="e_${f.k}" style="margin:0">${f.l}</label></div>${hint}`;
      if (f.t == "tags") return `${L}<input id="e_${f.k}" value="${esc((v || []).join(", "))}" placeholder="Separate with commas">${hint}`;
      if (f.t == "image") return `${L}<div class="img"><div class="prev" ${v ? `style="background-image:url('${esc(v)}')"` : ""}></div><div><input type="file" accept="image/jpeg,image/png,image/webp" data-file="${f.k}" aria-label="${f.l}"> ${v ? `<button type="button" class="btn ghost sm" data-rm="${f.k}">Remove</button>` : ""}</div></div>${hint}`;
      if (f.t == "gallery") return `${L}<div class="gal">${v.map((u, i) => `<div class="gi"><i style="background-image:url('${esc(u)}')"></i><div><button type="button" data-gup="${f.k}:${i}" aria-label="Move earlier" ${i == 0 ? "disabled" : ""}>←</button><button type="button" data-gdn="${f.k}:${i}" aria-label="Move later" ${i == v.length - 1 ? "disabled" : ""}>→</button><button type="button" data-gdel="${f.k}:${i}" aria-label="Remove image">✕</button></div></div>`).join("")}</div><input type="file" multiple accept="image/jpeg,image/png,image/webp" data-file="${f.k}" aria-label="${f.l}">${hint}`;
      return `${L}<input id="e_${f.k}" type="${f.t || "text"}" value="${esc(v)}" ${f.max ? `maxlength="${f.max}"` : ""} ${f.t == "number" ? 'min="0"' : ""}>${hint}`;
    };
    const sync = () => o.fields.forEach(f => { const el = $("#e_" + f.k, dlg); if (!el) return; if (f.t == "toggle") st[f.k] = el.checked; else if (f.t == "tags") st[f.k] = el.value.split(",").map(s => s.trim()).filter(Boolean); else if (f.t != "image" && f.t != "gallery") st[f.k] = el.value });
    const render = () => {
      dlg.innerHTML = `<div class="dh"><h2>${esc(o.title)}</h2><button class="ib" data-x aria-label="Close editor">✕</button></div><form class="db" id="ef" novalidate>${o.fields.map(field).join("")}<p class="err" id="eer" role="alert"></p></form><div class="df"><button class="btn ghost" data-x>Cancel</button>${o.preview ? '<button class="btn ghost" data-pv>Preview</button>' : ""}<button class="btn" data-save>Save</button></div>`;
    };
    const drop = url => { if (!url) return; const i = added.indexOf(url); if (i >= 0) { added.splice(i, 1); CM.removeFiles("media", [url]) } else removed.push(url) };
    const close = () => { window.onbeforeunload = null; dlg.close() };
    const tryClose = async () => { sync(); if (dirty && !(await CM.confirm("Discard changes?", "Unsaved changes and newly uploaded images will be lost.", "Discard"))) return; CM.removeFiles("media", added); close() };
    const err = m => { $("#eer", dlg).textContent = m || "" };
    const urlOk = u => { try { return /^https?:$/.test(new URL(u).protocol) } catch { return false } };
    const validate = () => {
      for (const f of o.fields) { const v = st[f.k]; if (f.req && !String(v ?? "").trim()) return `${f.l.replace(/ \(.*/, "")} is required.`; if (f.t == "url" && v && !urlOk(v)) return `${f.l} must be a valid web address starting with https://.` }
      return "";
    };
    const payload = () => { const p = {}; o.fields.forEach(f => { let v = st[f.k]; if (f.t == "toggle") v = !!v; else if (f.t == "number") v = v === "" || v == null ? 0 : Math.max(0, parseInt(v, 10) || 0); else if (f.t == "tags" || f.t == "gallery") v = v || []; else if (f.t == "select" && f.k == "rating") v = v ? +v : null; else { v = typeof v == "string" ? v.trim() : v; if (v === "" || v == null) v = f.req || f.k == "status" ? v : null } p[f.k] = v }); if (o.slug && !p.slug) p.slug = CM.slugify(p[o.slug]) + "-" + id.slice(0, 4); return p };
    dlg.oncancel = e => { e.preventDefault(); tryClose() };
    dlg.oninput = () => { dirty = true; window.onbeforeunload = () => "" };
    dlg.onchange = async e => {
      const inp = e.target.closest("[data-file]"); if (!inp) return; sync(); const f = o.fields.find(x => x.k == inp.dataset.file), files = [...inp.files]; if (!files.length) return;
      uploading = true; $("[data-save]", dlg).disabled = true; inp.disabled = true; inp.insertAdjacentHTML("afterend", '<span class="hint" id="upm"> Uploading…</span>');
      try { for (const file of files) { const url = await CM.upload(file, `${o.folder || o.table}/${id}`); added.push(url); if (f.t == "image") { drop(st[f.k]); st[f.k] = url } else st[f.k].push(url) } dirty = true } catch (x) { CM.toast(CM.msg(x), "bad") }
      uploading = false; render();
    };
    dlg.onclick = async e => {
      const b = e.target.closest("button"); if (!b) return; const d = b.dataset;
      if ("x" in d) { e.preventDefault(); return tryClose() }
      if ("pv" in d) { e.preventDefault(); sync(); return CM.preview(o.preview(st)) }
      if (d.rm) { sync(); drop(st[d.rm]); st[d.rm] = ""; dirty = true; return render() }
      const g = d.gdel || d.gup || d.gdn; if (g) { sync(); const [k, i] = [g.split(":")[0], +g.split(":")[1]], a = st[k]; if (d.gdel) drop(a.splice(i, 1)[0]); else { const j = d.gup ? i - 1 : i + 1;[a[i], a[j]] = [a[j], a[i]] } dirty = true; return render() }
      if ("save" in d) {
        e.preventDefault(); if (uploading) return; sync(); const m = validate(); if (m) return err(m); err("");
        const r = await CM.run(b, async () => {
          const p = payload();
          if (o.id) await CM.must(CM.db.from(o.table).update(p).eq("id", id)); else await CM.must(CM.db.from(o.table).insert({ id, ...p, ...(o.extra || {}) }));
          await CM.removeFiles("media", removed);
        }, o.id ? "Changes saved" : "Created");
        if (r.ok) { dirty = false; added.length = 0; close(); o.onSaved && o.onSaved() } else err(CM.msg(r.e));
      }
    };
    render(); dlg.showModal();
  };
})();
