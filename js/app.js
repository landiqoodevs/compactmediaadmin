
(() => {
  const { $ } = CM;

  // --------------------------------
  // SCREEN AND FORM MANAGEMENT
  // --------------------------------

  const hideSections = (id) => {
    ["boot", "setup", "auth", "app"].forEach((x) => {
      $("#" + x).hidden = x !== id;
    });
  };

  const forms = (name) => {
    ["lf", "ff", "nf"].forEach((x) => {
      $("#" + x).hidden = x !== name;
    });
  };

  const showLogin = (msg = "") => {
    hideSections("auth");
    forms("lf");
    $("#le").textContent = msg;
    $("#pw").value = "";
  };

  // --------------------------------
  // AUTHENTICATION STATE
  // --------------------------------

  let recovering = false;
  let manualOut = false;
  let entered = false;

  // --------------------------------
  // DASHBOARD NAVIGATION
  // --------------------------------

  const routes = () => ({
    overview: CM.views.overview,
    live: CM.views.live,
    work: CM.views.work,
    testimonials: CM.views.testimonials,
    feedback: CM.views.feedback
  });

  const route = () => {
    const [name, qs] = location.hash
      .replace(/^#\//, "")
      .split("?");

    const R = routes();
    const key = R[name] ? name : "overview";

    CM.$$("#nv a").forEach((a) => {
      a.classList.toggle(
        "on",
        a.getAttribute("href") === "#/" + key
      );
    });

    const mn = $("#mn");

    mn.onclick = null;
    mn.innerHTML = "";

    R[key](
      mn,
      Object.fromEntries(
        new URLSearchParams(qs || "")
      )
    );

    $("#sb").classList.remove("open");
    $("#scrim").classList.remove("on");

    CM.refreshBadge();
    window.scrollTo(0, 0);
  };

  // --------------------------------
  // OWNER AUTHORIZATION
  // --------------------------------

  const enter = async (session) => {
    if (!session || !session.user) {
      return showLogin("Please sign in again.");
    }

    try {
      const { data, error } = await CM.db
        .from("admins")
        .select("user_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Admin authorization error:", error);

        manualOut = true;
        await CM.db.auth.signOut();

        return showLogin(
          "Admin check error: " + error.message
        );
      }

      if (!data) {
        console.error(
          "No matching admin record for user:",
          session.user.id
        );

        manualOut = true;
        await CM.db.auth.signOut();

        return showLogin(
          "Admin record not found for this account."
        );
      }

      // Owner verified successfully.

      $("#who").textContent = session.user.email;

      entered = true;
      hideSections("app");

      if (
        !/^#\/(overview|live|work|testimonials|feedback)(\?|$)/.test(
          location.hash
        )
      ) {
        location.hash = "#/overview";
      }

      route();

    } catch (error) {
      console.error("Dashboard entry error:", error);

      showLogin(
        "Dashboard error: " +
        (error.message || "Unknown error")
      );
    }
  };

  // --------------------------------
  // SESSION EXPIRY
  // --------------------------------

  CM.onExpired = () => {
    if (entered) {
      entered = false;
      CM.db.auth.signOut();
    }
  };

  // --------------------------------
  // AUTHENTICATION LISTENER
  // --------------------------------

  const bind = () => {
    CM.db.auth.onAuthStateChange((ev, session) => {

      if (ev === "PASSWORD_RECOVERY") {
        recovering = true;
        hideSections("auth");
        forms("nf");
      }

      else if (ev === "SIGNED_OUT" && entered) {
        entered = false;

        showLogin(
          manualOut
            ? ""
            : "Your session has ended. Please sign in again."
        );

        manualOut = false;
      }

    });
  };

  // --------------------------------
  // INITIALIZATION
  // --------------------------------

  const initialize = async () => {
    if (!CM.configured) {
      hideSections("setup");
      return;
    }

    try {
      CM.makeClient(
        localStorage.getItem("cm_remember") !== "0"
      );

      bind();

      await new Promise((resolve) =>
        setTimeout(resolve, 50)
      );

      if (recovering) return;

      const {
        data: { session },
        error
      } = await CM.db.auth.getSession();

      if (error) {
        console.error("Session error:", error);
        return showLogin(CM.msg(error));
      }

      if (session) {
        await enter(session);
      } else {
        showLogin();
      }

    } catch (error) {
      console.error("Initialization error:", error);

      showLogin(
        "Unable to initialize dashboard: " +
        error.message
      );
    }
  };

  initialize();

  // --------------------------------
  // SHOW / HIDE PASSWORD
  // --------------------------------

  $("#tg").onclick = () => {
    const p = $("#pw");
    const visible = p.type === "password";

    p.type = visible ? "text" : "password";

    $("#tg").textContent = visible ? "Hide" : "Show";

    $("#tg").setAttribute(
      "aria-label",
      visible ? "Hide password" : "Show password"
    );
  };

  // --------------------------------
  // FORGOT PASSWORD SCREEN
  // --------------------------------

  $("#fg").onclick = (e) => {
    e.preventDefault();

    forms("ff");

    $("#fe").value = $("#em").value;
  };

  $("#bk").onclick = (e) => {
    e.preventDefault();

    forms("lf");
  };

  // --------------------------------
  // LOGIN FORM
  // --------------------------------

  $("#lf").onsubmit = async (e) => {
    e.preventDefault();

    const em = $("#em").value.trim();
    const pw = $("#pw").value;
    const er = $("#le");

    if (!/^\S+@\S+\.\S+$/.test(em)) {
      return er.textContent =
        "Enter a valid email address.";
    }

    if (!pw) {
      return er.textContent =
        "Enter your password.";
    }

    er.textContent = "";

    const remember = $("#rm").checked;

    if (
      localStorage.getItem("cm_remember") !==
      (remember ? "1" : "0")
    ) {
      localStorage.setItem(
        "cm_remember",
        remember ? "1" : "0"
      );

      CM.makeClient(remember);
      bind();
    }

    const button = $("#lb");

    button.disabled = true;
    button.textContent = "Signing in…";

    try {
      const { data, error } =
        await CM.db.auth.signInWithPassword({
          email: em,
          password: pw
        });

      if (error) {
        throw error;
      }

      if (!data.session) {
        throw new Error(
          "Login succeeded but no session was returned."
        );
      }

      await enter(data.session);

    } catch (error) {
      console.error("Login error:", error);

      er.textContent =
        /network|fetch/i.test(error.message)
          ? "Network problem. Please try again."
          : CM.msg(error);

    } finally {
      button.disabled = false;
      button.textContent = "Sign in";
    }
  };

  // --------------------------------
  // PASSWORD RESET EMAIL
  // --------------------------------

  $("#ff").onsubmit = async (e) => {
    e.preventDefault();

    const em = $("#fe").value.trim();
    const er = $("#fer");

    if (!/^\S+@\S+\.\S+$/.test(em)) {
      return er.textContent =
        "Enter a valid email address.";
    }

    try {
      const { error } =
        await CM.db.auth.resetPasswordForEmail(em, {
          redirectTo:
            location.origin + location.pathname
        });

      if (error) throw error;

      er.className = "err ok";

      er.textContent =
        "If that email belongs to the owner account, a reset link is on its way.";

    } catch (error) {
      er.className = "err";
      er.textContent = CM.msg(error);
    }
  };

  // --------------------------------
  // NEW PASSWORD FORM
  // --------------------------------

  $("#nf").onsubmit = async (e) => {
    e.preventDefault();

    const pw = $("#np").value;
    const er = $("#ner");

    if (pw.length < 8) {
      return er.textContent =
        "Use at least 8 characters.";
    }

    try {
      const { error } =
        await CM.db.auth.updateUser({
          password: pw
        });

      if (error) throw error;

      recovering = false;

      const {
        data: { session }
      } = await CM.db.auth.getSession();

      location.hash = "#/overview";

      if (session) {
        await enter(session);
      } else {
        showLogin(
          "Password updated. Please sign in."
        );
      }

    } catch (error) {
      er.textContent = CM.msg(error);
    }
  };

  // --------------------------------
  // LOGOUT
  // --------------------------------

  $("#lo").onclick = async () => {
    manualOut = true;

    const { error } = await CM.db.auth.signOut();

    if (error) {
      console.error("Logout error:", error);
    }

    entered = false;
    showLogin();
  };

  // --------------------------------
  // NAVIGATION LISTENER
  // --------------------------------

  window.addEventListener("hashchange", () => {
    if (!$("#app").hidden && entered) {
      route();
    }
  });

  // --------------------------------
  // MOBILE SIDEBAR
  // --------------------------------

  $("#mb").onclick = () => {
    $("#sb").classList.add("open");
    $("#scrim").classList.add("on");
  };

  $("#scrim").onclick = () => {
    $("#sb").classList.remove("open");
    $("#scrim").classList.remove("on");
  };

})();
