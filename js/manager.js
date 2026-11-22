/* Generic list manager used by "Our Work" and "Our Testimonials". */
(() => {
  const { $, esc } = CM;
  const STATUS = { t: "select", l: "Status", o: [["draft", "Draft (hidden)"], ["published", "Published (live)"]] };
  CM.CATS = ["Social Media", "Ads", "Design", "Web", "Other"];
  CM.FIELDS = {
    projects: [
      { k: "title", l: "Project title", req: 1, max: 160 }, { k: "slug", l: "URL slug (auto if empty)", max: 80 },
      { k: "client_name", l: "Client / business (optional)", max: 120 }, { k: "category", l: "Category", t: "select", o: CM.CATS },
      { k: "short_description", l: "Short description", t: "textarea", rows: 2, max: 400, h: "Shown on the project card (max 400 characters)." },
      { k: "full_description", l: "Full description / case study", t: "textarea", rows: 7 },
      { k: "cover_image_url", l: "Cover image", t: "image", h: "JPG, PNG or WebP, up to 5 MB." }, { k: "gallery_images", l: "Gallery images", t: "gallery", h: "Add several at once. Use ← → to reorder." },
      { k: "video_url", l: "Video URL (optional)", t: "url" }, { k: "project_url", l: "Project URL (optional)", t: "url" },
      { k: "services", l: "Services involved", t: "tags", h: "e.g. Paid Advertising, SEO" }, { k: "project_date", l: "Project date (optional)", t: "date" },
      { k: "display_order", l: "Display order (1 = first)", t: "number", h: "Or use the ↑ ↓ buttons in the list." },
      { k: "featured", l: "Featured project", t: "toggle" }, { ...STATUS, k: "status" }],
    testimonials: [
      { k: "client_name", l: "Client name", req: 1, max: 100 }, { k: "business_name", l: "Business / company (optional)", max: 120 },
      { k: "title", l: "Testimonial title (optional)", max: 120 }, { k: "testimonial_text", l: "Testimonial text", t: "textarea", req: 1, rows: 6, max: 3000 },
      { k: "image_url", l: "Client photo (optional)", t: "image", h: "Without a photo, the client’s initial is shown." },
      { k: "rating", l: "Star rating (optional)", t: "select", o: [["", "No rating"], 5, 4, 3, 2, 1] },
      { k: "service", l: "Service received (optional)", max: 80 }, { k: "testimonial_date", l: "Date (optional)", t: "date" },
      { k: "display_order", l: "Display order (1 = first)", t: "number" }, { k: "featured", l: "Featured testimonial", t: "toggle" }, { ...STATUS, k: "status" }]
  };
  const bg = u => u ? `style="background-image:url('${esc(u)}')"` : "";
  CM.previews = {
    projects: v => `<div class="pvq"><div style="aspect-ratio:16/9;border-radius:10px;background:#155EEF center/cover;${v.cover_image_url ? `background-image:url('${esc(v.cover_image_url)}')` : ""}"></div><small style="color:#62A0FF;font-weight:700">${esc(v.category)}</small><p>${esc(v.title || "Untitled project")}</p><small style="color:#9AA7BD">${esc(v.short_description || "")}</small></div>`,
    testimonials: v => `<div class="pvq">${v.rating ? `<div class="stars">${CM.stars(+v.rating)}</div>` : ""}<p>“${esc(v.testimonial_text || "")}”</p><div style="display:flex;gap:12px;align-items:center">${CM.avatar(v.client_name, v.image_url, "av")}<div><b>${esc(v.client_name || "Client name")}</b><br><small style="color:#9AA7BD">${[v.business_name, v.service].filter(Boolean).map(esc).join(" · ")}</small></div></div></div>`
  };
  const CFG = {
    projects: { table: "projects", label: "Our Work", one: "project", sub: "Your portfolio. Published projects appear on the website’s Selected Work section.", cats: true, dup: true,
      thumb: r => r.cover_image_url, name: r => r.title, meta: r => [r.category, r.client_name].filter(Boolean).join(" · "), find: r => [r.title, r.client_name, r.category, r.short_description].join(" "),
      files: r => [r.cover_image_url, ...(r.gallery_images || [])], defaults: { category: "Social Media", status: "draft", featured: false, display_order: 0 }, slug: "title" },
    testimonials: { table: "testimonials", label: "Our Testimonials", one: "testimonial", sub: "Testimonials you add yourself. Published ones appear in the website’s Testimonials section.",
      thumb: r => r.image_url, name: r => r.client_name, meta: r => [CM.stars(r.rating), r.business_name, (r.testimonial_text || "").slice(0, 70)].filter(Boolean).join(" · "), find: r => [r.client_name, r.business_name, r.testimonial_text, r.service].join(" "),
      files: r => [r.image_url], defaults: { status: "draft", featured: false, display_order: 0 } }
  };
  CM.manager = key => async (mn, params) => {
    const c = CFG[key]; let rows = [], f = { q: "", s: "all", c: "all", f: "all", o: "order" };
    mn.innerHTML = `<div class="top"><div><h1>${c.label}</h1><p class="mu" style="margin:4px 0 0">${c.sub}</p></div><button class="btn" id="add">+ Add ${c.one}</button></div>
    <div class="tools"><input id="q" type="search" placeholder="Search…" aria-label="Search"><select id="fs" aria-label="Status"><option value="all">All statuses</option><option value="published">Published</option><option value="draft">Draft</option></select>
    ${c.cats ? `<select id="fc" aria-label="Category"><option value="all">All categories</option>${CM.CATS.map(x => `<option>${x}</option>`).join("")}</select>` : ""}
    <select id="ff" aria-label="Featured"><option value="all">Featured or not</option><option value="yes">Featured only</option></select>
    <select id="fo" aria-label="Sort"><option value="order">Website order</option><option value="new">Newest first</option><option value="old">Oldest first</option><option value="az">A to Z</option></select></div>
    <div class="box" id="ls">${CM.skeleton(4)}</div>`;
    const open = (row, copy) => CM.editor({ title: row && !copy ? `Edit ${c.one}` : `Add ${c.one}`, table: c.table, fields: CM.FIELDS[key], values: row ? { ...row } : { ...c.defaults }, id: row && !copy ? row.id : null, slug: c.slug, preview: CM.previews[key], onSaved: load });
    const reorderable = () => f.o == "order" && !f.q && f.s == "all" && f.c == "all" && f.f == "all";
    const draw = () => {
      let list = rows.filter(r => (f.s == "all" || r.status == f.s) && (f.c == "all" || r.category == f.c) && (f.f == "all" || r.featured) && (!f.q || c.find(r).toLowerCase().includes(f.q.toLowerCase())));
      if (f.o == "new") list.sort((a, b) => b.created_at.localeCompare(a.created_at)); else if (f.o == "old") list.sort((a, b) => a.created_at.localeCompare(b.created_at)); else if (f.o == "az") list.sort((a, b) => c.name(a).localeCompare(c.name(b)));
      const mv = reorderable();
      $("#ls").innerHTML = (list.map((r, i) => `<div class="row" data-id="${r.id}">${CM.avatar(c.name(r), c.thumb(r))}<div class="t"><b>${esc(c.name(r))}${r.featured ? " ★" : ""}</b><small>${esc(c.meta(r))}</small></div>${CM.badge(r.status)}
        <div class="acts">${mv ? `<button class="btn ghost sm" data-a="up" aria-label="Move up" ${i == 0 ? "disabled" : ""}>↑</button><button class="btn ghost sm" data-a="dn" aria-label="Move down" ${i == list.length - 1 ? "disabled" : ""}>↓</button>` : ""}
        <button class="btn ghost sm" data-a="edit">Edit</button><button class="btn sm" data-a="pub">${r.status == "published" ? "Unpublish" : "Publish"}</button><button class="btn ghost sm" data-a="feat">${r.featured ? "Unfeature" : "Feature"}</button>${c.dup ? '<button class="btn ghost sm" data-a="dup">Duplicate</button>' : ""}<button class="btn ghost sm" data-a="del" style="color:#dc2626">Delete</button></div></div>`).join("")) ||
        `<div class="empty">${rows.length ? "Nothing matches your filters." : `No ${c.one}s yet.<br><br><button class="btn" id="add2">+ Add your first ${c.one}</button>`}</div>`;
      if ($("#add2")) $("#add2").onclick = () => open();
      if (!mv && rows.length > 1) $("#ls").insertAdjacentHTML("afterbegin", '<p class="hint" style="margin:0 0 8px">Reordering is available when sorted by “Website order” with no filters.</p>');
    };
    const load = async () => {
      try { rows = await CM.must(CM.db.from(c.table).select("*").order("display_order").order("created_at", { ascending: false })); draw(); if (params.new) { params.new = 0; open() } if (params.edit) { const r = rows.find(x => x.id == params.edit); params.edit = 0; if (r) open(r) } }
      catch (e) { CM.fail($("#ls"), e, () => { $("#ls").innerHTML = CM.skeleton(4); load() }) }
    };
    const move = async (id, dir) => {
      const order = rows.map(r => r.id), i = order.indexOf(id), j = i + dir; if (j < 0 || j >= order.length) return;[order[i], order[j]] = [order[j], order[i]];
      const changes = order.map((oid, n) => [oid, n + 1]).filter(([oid, n]) => rows.find(r => r.id == oid).display_order != n);
      await Promise.all(changes.map(([oid, n]) => CM.must(CM.db.from(c.table).update({ display_order: n }).eq("id", oid))));
    };
    $("#add").onclick = () => open();
    ["q", "fs", "fc", "ff", "fo"].forEach(id => { const el = $("#" + id); if (el) el.oninput = () => { f[{ q: "q", fs: "s", fc: "c", ff: "f", fo: "o" }[id]] = el.value; draw() } });
    $("#ls").onclick = async e => {
      const b = e.target.closest("[data-a]"); if (!b) return; const id = b.closest(".row").dataset.id, r = rows.find(x => x.id == id), a = b.dataset.a;
      if (a == "edit") return open(r);
      if (a == "dup") return open({ ...r, title: (r.title || "") + " (copy)", slug: "", cover_image_url: "", gallery_images: [], status: "draft", featured: false, display_order: 0 }, true);
      if (a == "del") { if (!(await CM.confirm(`Delete this ${c.one}?`, `“${c.name(r)}” and its uploaded images will be permanently removed.`))) return; const x = await CM.run(b, async () => { await CM.must(CM.db.from(c.table).delete().eq("id", id)); await CM.removeFiles("media", c.files(r)) }, "Deleted"); return x.ok && load() }
      const x = await CM.run(b, () => a == "up" ? move(id, -1) : a == "dn" ? move(id, 1) : a == "pub" ? CM.must(CM.db.from(c.table).update({ status: r.status == "published" ? "draft" : "published" }).eq("id", id)) : CM.must(CM.db.from(c.table).update({ featured: !r.featured }).eq("id", id)),
        a == "pub" ? (r.status == "published" ? "Unpublished: hidden from the website" : "Published: now live on the website") : a == "feat" ? (r.featured ? "Removed from featured" : "Marked as featured") : "");
      if (x.ok) load();
    };
    load();
  };
  CM.views = CM.views || {}; CM.views.work = CM.manager("projects"); CM.views.testimonials = CM.manager("testimonials");
})();
