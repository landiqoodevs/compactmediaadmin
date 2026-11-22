(() => {
  const { $ } = CM, show = id => ["boot", "setup", "auth", "app"].forEach(x => $("#" + x).hidden = x != id);
  const forms = n => ["lf", "ff", "nf"].forEach(x => $("#" + x).hidden = x != n);
  const showLogin = msg => { show("auth"); forms("lf"); $("#le").textContent = msg || ""; $("#pw").value = "" };
  let recovering = false, manualOut = false, entered = false;

  const routes = () => ({ overview: CM.views.overview, live: CM.views.live, work: CM.views.work, testimonials: CM.views.testimonials, feedback: CM.views.feedback });
  const route = () => {
    const [name, qs] = location.hash.replace(/^#\/?/, "").split("?"), R = routes(), key = R[name] ? name : "overview";
    CM.$$("#nv a").forEach(a => a.classList.toggle("on", a.getAttribute("href") == "#/" + key));
    const mn = $("#mn"); mn.onclick = null; mn.innerHTML = ""; R[key](mn, Object.fromEntries(new URLSearchParams(qs || "")));
    $("#sb").classList.remove("open"); $("#scrim").classList.remove("on"); CM.refreshBadge(); window.scrollTo(0, 0);
  };
  const enter = async session => {
    const { data, error } = await CM.db.from("admins").select("user_id").eq("user_id", session.user.id).maybeSingle();
    if (error || !data) { manualOut = true; await CM.db.auth.signOut(); return showLogin("This account is not authorized to use this dashboard.") }
    $("#who").textContent = session.user.email; show("app"); entered = true;
    if (!/^#\/(overview|live|work|testimonials|feedback)/.test(location.hash)) location.hash = "#/overview"; route();
  };
  CM.onExpired = () => { if (entered) CM.db.auth.signOut() };

  const bind = () => CM.db.auth.onAuthStateChange((ev, s) => {
    if (ev == "PASSWORD_RECOVERY") { recovering = true; show("auth"); forms("nf") }
    else if (ev == "SIGNED_OUT" && entered) { entered = false; showLogin(manualOut ? "" : "Your session has ended. Please sign in again."); manualOut = false }
  });

  (async () => {
    if (!CM.configured) return show("setup");
    CM.makeClient(localStorage.getItem("cm_remember") !== "0"); bind();
    await new Promise(r => setTimeout(r, 50));
    if (recovering) return;
    const { data: { session } } = await CM.db.auth.getSession();
    session ? enter(session) : showLogin();
  })();

  $("#tg").onclick = () => { const p = $("#pw"), s = p.type == "password"; p.type = s ? "text" : "password"; $("#tg").textContent = s ? "Hide" : "Show"; $("#tg").setAttribute("aria-label", s ? "Hide password" : "Show password") };
  $("#fg").onclick = e => { e.preventDefault(); forms("ff"); $("#fe").value = $("#em").value };
  $("#bk").onclick = e => { e.preventDefault(); forms("lf") };
  $("#lf").onsubmit = async e => {
    e.preventDefault(); const em = $("#em").value.trim(), pw = $("#pw").value, er = $("#le");
    if (!/^\S+@\S+\.\S+$/.test(em)) return er.textContent = "Enter a valid email address.";
    if (!pw) return er.textContent = "Enter your password."; er.textContent = "";
    const rem = $("#rm").checked; if (localStorage.getItem("cm_remember") != (rem ? "1" : "0")) { localStorage.setItem("cm_remember", rem ? "1" : "0"); CM.makeClient(rem); bind() }
    const b = $("#lb"); b.disabled = true; b.textContent = "Signing in…";
    const { data, error } = await CM.db.auth.signInWithPassword({ email: em, password: pw });
    b.disabled = false; b.textContent = "Sign in";
    if (error) return er.textContent = /network|fetch/i.test(error.message) ? "Network problem. Please try again." : "Incorrect email or password.";
    enter(data.session);
  };
  $("#ff").onsubmit = async e => {
    e.preventDefault(); const em = $("#fe").value.trim(), er = $("#fer"); if (!/^\S+@\S+\.\S+$/.test(em)) return er.textContent = "Enter a valid email address.";
    const { error } = await CM.db.auth.resetPasswordForEmail(em, { redirectTo: location.origin + location.pathname });
    er.className = error ? "err" : "err ok"; er.textContent = error ? CM.msg(error) : "If that email belongs to the owner account, a reset link is on its way.";
  };
  $("#nf").onsubmit = async e => {
    e.preventDefault(); const pw = $("#np").value, er = $("#ner"); if (pw.length < 8) return er.textContent = "Use at least 8 characters.";
    const { error } = await CM.db.auth.updateUser({ password: pw }); if (error) return er.textContent = CM.msg(error);
    recovering = false; const { data: { session } } = await CM.db.auth.getSession(); location.hash = "#/overview"; session ? enter(session) : showLogin("Password updated. Please sign in.");
  };
  $("#lo").onclick = () => { manualOut = true; CM.db.auth.signOut() };
  window.addEventListener("hashchange", () => { if (!$("#app").hidden) route() });
  $("#mb").onclick = () => { $("#sb").classList.add("open"); $("#scrim").classList.add("on") }; $("#scrim").onclick = () => { $("#sb").classList.remove("open"); $("#scrim").classList.remove("on") };
})();
