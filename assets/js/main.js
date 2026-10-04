/* ==========================================================================
   BUILDING BETTER — page behaviour
   - Sticky header: tracks the chapter and section you are reading,
     reading-progress line, contents menu on small screens
   - Icons, filters (with "show all"), timeline counts, expandable days
   - "Download / Copy Template" buttons, placeholder highlighter
   - Lightweight SVG charts drawn from assets/js/data.js
   ========================================================================== */
(function () {
  "use strict";

  /* ---------- Icons (24×24 stroke icons) ---------- */
  var ICONS = {
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "arrow-left": '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    "arrow-up": '<path d="M12 19V5M6 11l6-6 6 6"/>',
    "arrow-down": '<path d="M12 5v14M6 13l6 6 6-6"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    map: '<path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4zM9 4v14M15 6v14"/>',
    dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
    pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    leaf: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15zM5 19l8-8"/>',
    droplet: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/>',
    chart: '<path d="M4 4v16h16M8 16v-4M12 16V8M16 16v-6"/>',
    trend: '<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    flame: '<path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1.5 2 2 3 2 0-2.5-.5-4.5 0-7z"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5s1.3 2 3.5 2 3.5-2 3.5-2M9 9.5h.01M15 9.5h.01"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    camera: '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m20.5 16-5-5-9 8.5"/>',
    file: '<path d="M14 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8zM14 3.5V8h4.5M9 13h6M9 16.5h4"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
    users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0M16 5a3.5 3.5 0 0 1 0 7M18 14.5a6 6 0 0 1 3 5.5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>',
    shield: '<path d="M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="m9 12 2 2 4-4"/>',
    alert: '<path d="M12 4 21 20H3zM12 10v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5"/>',
    utensils: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 2-3 5s1 4 3 4v9"/>',
    bed: '<path d="M3 18V7M3 13h18v5M21 18v-3M7 13v-2.5A1.5 1.5 0 0 1 8.5 9H11a1.5 1.5 0 0 1 1.5 1.5V13"/>',
    star: '<path d="m12 3.5 2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9z"/>',
    puzzle: '<path d="M9 4h3v2a1.5 1.5 0 0 0 3 0V4h3a1 1 0 0 1 1 1v3h-2a1.5 1.5 0 0 0 0 3h2v4a1 1 0 0 1-1 1h-4v-2a1.5 1.5 0 0 0-3 0v2H5a1 1 0 0 1-1-1v-4h2a1.5 1.5 0 0 0 0-3H4V5a1 1 0 0 1 1-1z"/>'
  };

  function icon(name, cls) {
    return '<svg class="i' + (cls ? " " + cls : "") + '" aria-hidden="true" focusable="false"><use href="#i-' + name + '"></use></svg>';
  }

  function injectSprite() {
    var symbols = Object.keys(ICONS).map(function (k) {
      return '<symbol id="i-' + k + '" viewBox="0 0 24 24">' + ICONS[k] + "</symbol>";
    }).join("");
    document.body.insertAdjacentHTML("afterbegin",
      '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' + symbols + "</defs></svg>");
    // <i data-i="name" class="i-lg"></i>  →  inline SVG icon
    document.querySelectorAll("i[data-i]").forEach(function (el) {
      el.outerHTML = icon(el.getAttribute("data-i"), el.className);
    });
  }

  /* ---------- Navigation: chapter + section tracking ----------
     <section class="chapter" id="…" data-chapter="Name" data-num="02">
       <div class="block" id="…" data-block="Section name">
     The header highlights the chapter in view, lists that chapter's
     sections in the bar below it, and builds the contents menu.
  */
  function initNav() {
    var header = document.querySelector(".site-header");
    var chapters = Array.prototype.slice.call(document.querySelectorAll(".chapter[data-chapter]"));
    var navLinks = Array.prototype.slice.call(document.querySelectorAll(".primary a[data-for]"));
    var subnavList = document.getElementById("subnav-list");
    var subnavScroll = document.querySelector(".subnav-scroll");
    var menuBtn = document.querySelector(".menu-btn");
    var menuCurrent = document.querySelector(".menu-current");
    var panel = document.getElementById("toc-panel");
    var bar = document.querySelector(".read-progress i");
    var toTop = document.querySelector(".to-top");

    function blocksOf(ch) { return Array.prototype.slice.call(ch.querySelectorAll("[data-block]")); }
    function numOf(ch) { return ch.getAttribute("data-num") || ""; }

    panel.innerHTML = "<ol>" + chapters.map(function (ch) {
      return '<li data-for="' + ch.id + '"><a class="toc-chapter" href="#' + ch.id + '"><span>' + numOf(ch) + "</span>" +
        ch.getAttribute("data-chapter") + "</a><ul>" +
        blocksOf(ch).map(function (b) { return '<li><a href="#' + b.id + '">' + b.getAttribute("data-block") + "</a></li>"; }).join("") +
        "</ul></li>";
    }).join("") + "</ol>";

    function renderSubnav(ch) {
      var n = numOf(ch);
      subnavList.innerHTML = '<li class="here">' + (n ? "<span>" + n + "</span>" : "") + ch.getAttribute("data-chapter") + "</li>" +
        blocksOf(ch).map(function (b) {
          return '<li><a href="#' + b.id + '" data-to="' + b.id + '">' + b.getAttribute("data-block") + "</a></li>";
        }).join("");
      subnavScroll.scrollLeft = 0;
    }

    var curChapter = null, curBlock, ticking = false;
    function update() {
      ticking = false;
      var line = header.getBoundingClientRect().bottom + 40;
      var ch = chapters[0];
      chapters.forEach(function (c) { if (c.getBoundingClientRect().top <= line) ch = c; });
      if (ch !== curChapter) {
        curChapter = ch;
        curBlock = undefined;
        renderSubnav(ch);
        navLinks.forEach(function (a) {
          a.setAttribute("aria-current", String(a.getAttribute("data-for").split(" ").indexOf(ch.id) !== -1));
        });
        menuCurrent.textContent = ch.getAttribute("data-chapter");
        panel.querySelectorAll("li[data-for]").forEach(function (li) {
          li.classList.toggle("is-current", li.getAttribute("data-for") === ch.id);
        });
      }
      var blk = null;
      blocksOf(ch).forEach(function (b) { if (b.getBoundingClientRect().top <= line) blk = b; });
      if (blk !== curBlock) {
        curBlock = blk;
        subnavList.querySelectorAll("a[data-to]").forEach(function (a) {
          var on = !!blk && a.getAttribute("data-to") === blk.id;
          a.setAttribute("aria-current", String(on));
          if (on) {
            var r = a.getBoundingClientRect(), s = subnavScroll.getBoundingClientRect();
            if (r.left < s.left || r.right > s.right) subnavScroll.scrollLeft += r.left - s.left - 32;
          }
        });
      }
      var max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ")";
      toTop.classList.toggle("is-on", window.scrollY > 900);
    }
    function schedule() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    update();

    function setOpen(open) {
      menuBtn.setAttribute("aria-expanded", String(open));
      panel.hidden = !open;
    }
    menuBtn.addEventListener("click", function () { setOpen(menuBtn.getAttribute("aria-expanded") !== "true"); });
    panel.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("click", function (e) { if (!panel.hidden && !e.target.closest(".site-header")) setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) { setOpen(false); menuBtn.focus(); }
    });
    window.addEventListener("resize", function () { if (window.innerWidth > 1080) setOpen(false); });
    toTop.addEventListener("click", function () { window.scrollTo(0, 0); });
  }

  /* ---------- Placeholder highlighter (footer button) ---------- */
  function initPlaceholderToggle() {
    var btn = document.querySelector(".ph-toggle");
    if (!btn) return;
    function set(on) {
      document.documentElement.classList.toggle("show-ph", on);
      btn.setAttribute("aria-pressed", String(on));
      try { localStorage.setItem("bb-show-ph", on ? "1" : "0"); } catch (e) { /* storage unavailable */ }
    }
    var saved = false;
    try { saved = localStorage.getItem("bb-show-ph") === "1"; } catch (e) { /* storage unavailable */ }
    set(saved);
    btn.addEventListener("click", function () { set(btn.getAttribute("aria-pressed") !== "true"); });
  }

  var toastTimer;
  function toast(msg) {
    var t = document.querySelector(".toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("is-on"); }, 3200);
  }

  /* ---------- Filters ----------
     <div data-filter-scope data-limit="8">
       <button class="tab" data-filter="month:1">…</button>     (one key per group)
       <article data-item data-month="1" data-category="photos">…</article>
       [data-filter-container] hides itself when none of its items are visible
       [data-filter-count], [data-filter-empty] and [data-show-all] are optional
     With data-limit, only the first N items show until "Show all" is pressed
     or a filter is chosen.
  */
  function initFilters() {
    document.querySelectorAll("[data-filter-scope]").forEach(function (scope) {
      var items = Array.prototype.slice.call(scope.querySelectorAll("[data-item]"));
      var buttons = Array.prototype.slice.call(scope.querySelectorAll("[data-filter]"));
      var limit = Number(scope.getAttribute("data-limit") || 0);
      var more = scope.querySelector("[data-show-all]");
      var count = scope.querySelector("[data-filter-count]");
      var noun = (count && count.getAttribute("data-noun")) || "items";
      var expanded = false;
      var state = {};
      buttons.forEach(function (btn) {
        var parts = btn.getAttribute("data-filter").split(":");
        var key = parts[0];
        if (!(key in state)) state[key] = "all";
        if (btn.getAttribute("aria-pressed") === "true") state[key] = parts[1];
        btn.addEventListener("click", function () {
          state[key] = parts[1];
          buttons.forEach(function (b) {
            if (b.getAttribute("data-filter").split(":")[0] === key) {
              b.setAttribute("aria-pressed", String(b.getAttribute("data-filter") === key + ":" + state[key]));
            }
          });
          apply();
        });
      });
      if (more) more.addEventListener("click", function () { expanded = true; apply(); });

      function apply() {
        var matches = items.filter(function (it) {
          return Object.keys(state).every(function (k) {
            var v = state[k];
            return v === "all" || (it.getAttribute("data-" + k) || "").split(" ").indexOf(v) !== -1;
          });
        });
        var filtered = Object.keys(state).some(function (k) { return state[k] !== "all"; });
        var cap = limit && !expanded && !filtered ? limit : Infinity;
        items.forEach(function (it) { it.hidden = true; });
        matches.forEach(function (it, i) { it.hidden = i >= cap; });
        var shown = Math.min(matches.length, cap);
        scope.querySelectorAll("[data-filter-container]").forEach(function (c) {
          c.hidden = !c.querySelector("[data-item]:not([hidden])");
        });
        if (count) count.textContent = "Showing " + shown + " of " + items.length + " " + noun;
        var empty = scope.querySelector("[data-filter-empty]");
        if (empty) empty.hidden = matches.length > 0;
        if (more) {
          more.parentNode.hidden = matches.length <= cap;
          more.querySelector("span").textContent = "Show all " + matches.length + " " + noun;
        }
      }
      apply();
    });
  }

  /* ---------- Timeline: milestones completed per month ---------- */
  function initTimeline() {
    document.querySelectorAll("[data-phase-count]").forEach(function (el) {
      var phase = el.getAttribute("data-phase-count");
      var all = document.querySelectorAll('.ms[data-phase="' + phase + '"]').length;
      var done = document.querySelectorAll('.ms[data-phase="' + phase + '"][data-status="done"]').length;
      el.textContent = done + " of " + all + " milestones completed";
    });
  }

  /* ---------- Expandable workout days ---------- */
  function initDetails() {
    document.querySelectorAll("[data-expand-all]").forEach(function (btn) {
      var target = document.querySelector(btn.getAttribute("data-expand-all"));
      btn.addEventListener("click", function () {
        var list = target.querySelectorAll("details");
        var anyClosed = Array.prototype.some.call(list, function (d) { return !d.open; });
        list.forEach(function (d) { d.open = anyClosed; });
        btn.querySelector("span").textContent = anyClosed ? "Collapse all" : "Expand all";
      });
    });
    // Links that point at a <details> open it
    function openFromHash(hash) {
      if (!hash || hash.length < 2) return;
      var el = document.getElementById(hash.slice(1));
      if (el && el.tagName === "DETAILS") el.open = true;
    }
    document.addEventListener("click", function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (a) openFromHash(a.getAttribute("href"));
    });
    openFromHash(location.hash);
  }

  /* ---------- Templates: "Download / Copy Template" ---------- */
  function templateText(form) {
    var blank = "____________________";
    var lines = [form.getAttribute("data-title").toUpperCase(), ""];
    Array.prototype.forEach.call(form.children, function (child) {
      if (child.tagName === "LABEL") {
        var ctl = child.querySelector("input, textarea");
        var name = child.querySelector("span").textContent.trim();
        var val = ctl && ctl.value.trim();
        if (ctl && ctl.tagName === "TEXTAREA") lines.push(name + ":", val || blank + "\n" + blank, "");
        else lines.push(name + ": " + (val || blank));
      } else if (child.tagName === "FIELDSET") {
        lines.push("", child.querySelector("legend").textContent.trim() + ":");
        child.querySelectorAll("label").forEach(function (l) {
          var c = l.querySelector("input");
          lines.push("  " + l.querySelector("span").textContent.trim() + ": " + ((c && c.value.trim()) || "______"));
        });
        lines.push("");
      }
    });
    lines.push("", "Template from the Building Better Personal Project portfolio.");
    return lines.join("\n");
  }

  function copyText(text, okMsg) {
    function fallback() {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      toast(ok ? okMsg : "Your browser blocked copying. Select the template fields and copy them manually.");
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(okMsg); }, fallback);
    } else {
      fallback();
    }
  }

  function initTemplates() {
    document.querySelectorAll("[data-copy-template]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var form = document.getElementById(btn.getAttribute("data-copy-template"));
        copyText(templateText(form), "Template copied. Paste it into a document to start your plan.");
      });
    });
    document.querySelectorAll("form.template-form").forEach(function (f) {
      f.addEventListener("submit", function (e) { e.preventDefault(); });
    });
    document.querySelectorAll("[data-wireframe-action]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        toast(btn.getAttribute("data-wireframe-action"));
      });
    });
  }

  /* ---------- Self-rating dumbbell rows (reflection page) ---------- */
  function initDumbbells() {
    document.querySelectorAll("[data-db]").forEach(function (row) {
      var max = Number(row.getAttribute("data-max") || 10);
      var a = Number(row.getAttribute("data-start"));
      var b = Number(row.getAttribute("data-end"));
      var track = row.querySelector(".db-track");
      var lo = Math.min(a, b) / max * 100, hi = Math.max(a, b) / max * 100;
      track.innerHTML =
        '<span class="seg" style="left:' + lo + "%;width:" + (hi - lo) + '%"></span>' +
        '<span class="dot start" style="left:' + (a / max * 100) + '%" title="Start: ' + a + '/' + max + '"></span>' +
        '<span class="dot end" style="left:' + (b / max * 100) + '%" title="End: ' + b + '/' + max + '"></span>';
      var d = b - a;
      row.querySelector(".delta").textContent = a + " → " + b;
      row.setAttribute("aria-label", row.querySelector(".name").textContent + ": " + a + " out of " + max + " at the start, " + b + " at the end (" + (d >= 0 ? "+" : "") + d + ")");
    });
  }

  /* ======================================================================
     Charts — single-axis SVG line and column charts with hover + data table
     ====================================================================== */
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var SERIES_VARS = ["--s1", "--s2", "--s3"];
  var NS = "http://www.w3.org/2000/svg";

  function startDate() {
    var p = (window.PP && window.PP.projectStart || "2026-06-01").split("-").map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }
  function weekLabel(w) {
    var d = startDate();
    d.setDate(d.getDate() + (w - 1) * 7);
    return d.getDate() + " " + MONTHS[d.getMonth()];
  }
  function fmtValue(cfg, v) {
    if (cfg.format === "pace") {
      var m = Math.floor(v), s = Math.round((v - m) * 60);
      if (s === 60) { m += 1; s = 0; }
      return m + ":" + (s < 10 ? "0" : "") + s;
    }
    return Number(v).toFixed(cfg.decimals == null ? 1 : cfg.decimals);
  }
  function withUnit(cfg, v) {
    var u = cfg.unit || "";
    return fmtValue(cfg, v) + (u ? (u.charAt(0) === "/" ? "" : " ") + u : "");
  }
  function niceStep(raw) {
    var p = Math.pow(10, Math.floor(Math.log10(raw)));
    var n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  function el(tag, attrs, text) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  function resolveConfig(key) {
    var charts = (window.PP && window.PP.charts) || {};
    var cfg = charts[key];
    if (!cfg) return null;
    if (cfg.sameAs) {
      var base = charts[cfg.sameAs];
      var merged = {};
      for (var a in base) merged[a] = base[a];
      for (var b in cfg) if (b !== "sameAs") merged[b] = cfg[b];
      cfg = merged;
    }
    return cfg;
  }

  // Slice to a project month when the container has data-range="1|2|3"
  function prepare(cfg, range) {
    var n = cfg.series[0].values.length;
    var weeks = cfg.weeks || Array.from({ length: n }, function (_, i) { return i + 1; });
    var idx = weeks.map(function (_, i) { return i; });
    if (range && range !== "all" && window.PP.months[range] && !cfg.categories) {
      var r = window.PP.months[range];
      idx = idx.filter(function (i) { return weeks[i] >= r[0] && weeks[i] <= r[1]; });
    }
    return {
      labels: idx.map(function (i) { return cfg.categories ? cfg.categories[i] : weekLabel(weeks[i]); }),
      tips: idx.map(function (i) { return cfg.categories ? cfg.categories[i] : "Week " + weeks[i] + " · " + weekLabel(weeks[i]); }),
      series: cfg.series.map(function (s) { return { name: s.name, values: idx.map(function (i) { return s.values[i]; }) }; })
    };
  }

  function drawChart(host) {
    var cfg = resolveConfig(host.getAttribute("data-chart"));
    if (!cfg) return;
    var d = prepare(cfg, host.getAttribute("data-range"));
    var W = Math.max(280, Math.round(host.clientWidth));
    var H = cfg.height || 250;
    var multi = d.series.length > 1;
    var endW = 0;
    if (cfg.endLabels === "name") {
      endW = Math.max.apply(null, d.series.map(function (s) { return s.name.length; })) * 6.6 + 14;
    } else if (cfg.type === "line") {
      endW = withUnit(cfg, d.series[0].values[d.series[0].values.length - 1]).length * 6.6 + 14;
    }
    var m = { t: 30, r: Math.max(16, endW), b: 46, l: 46 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var n = d.labels.length;

    var all = [];
    d.series.forEach(function (s) { all = all.concat(s.values); });
    if (cfg.target) all.push(cfg.target.value);
    var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all);
    if (cfg.type === "bar") lo = 0;
    var span = (hi - lo) || Math.abs(hi) || 1;
    if (cfg.type !== "bar") { lo -= span * 0.15; hi += span * 0.15; } else { hi += span * 0.12; }
    var step = niceStep((hi - lo) / 4);
    var y0 = cfg.type === "bar" ? 0 : Math.floor(lo / step) * step;
    var y1 = Math.ceil(hi / step) * step;
    var Y = function (v) { return m.t + ih - ((v - y0) / (y1 - y0)) * ih; };
    var band = iw / n;
    var X = cfg.type === "bar"
      ? function (i) { return m.l + band * (i + 0.5); }
      : function (i) { return n === 1 ? m.l + iw / 2 : m.l + (i / (n - 1)) * iw; };

    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, width: W, height: H, role: "img",
      "aria-label": (host.getAttribute("aria-label") || cfg.yTitle) + " — placeholder data" });

    // y grid + ticks
    var tickCfg = cfg.format ? cfg : { decimals: Math.min(2, (String(step).split(".")[1] || "").length) };
    for (var k = 0, v = y0; v <= y1 + step / 1000; k++, v = y0 + k * step) {
      var yy = Y(v);
      svg.appendChild(el("line", { x1: m.l, x2: W - m.r, y1: yy, y2: yy, "class": "grid-line" }));
      svg.appendChild(el("text", { x: m.l - 8, y: yy + 4, "text-anchor": "end" }, fmtValue(tickCfg, v)));
    }
    svg.appendChild(el("line", { x1: m.l, x2: W - m.r, y1: m.t + ih, y2: m.t + ih, "class": "baseline" }));
    svg.appendChild(el("text", { x: 0, y: 12, "class": "axis-title" }, "↑ " + cfg.yTitle));

    // x ticks (thinned to avoid collisions)
    var maxLabels = Math.max(2, Math.floor(iw / (cfg.categories ? 64 : 50)));
    var every = Math.ceil(n / maxLabels);
    d.labels.forEach(function (lab, i) {
      if (i % every !== 0 && i !== n - 1) return;
      if (i === n - 1 && i % every !== 0 && (n - 1) % every < every / 2 && n > 2) return;
      svg.appendChild(el("text", { x: X(i), y: m.t + ih + 18, "text-anchor": "middle" }, lab));
    });
    svg.appendChild(el("text", { x: m.l + iw / 2, y: H - 6, "text-anchor": "middle", "class": "axis-title" },
      (cfg.xTitle || "Week starting (date)") + " →"));

    // target reference line
    if (cfg.target) {
      var ty = Y(cfg.target.value);
      svg.appendChild(el("line", { x1: m.l, x2: W - m.r, y1: ty, y2: ty, "class": "target-line" }));
      svg.appendChild(el("text", { x: m.l + 6, y: ty - 6, "class": "target-label" }, cfg.target.label));
    }

    var colorOf = function (si) { return multi ? "var(" + SERIES_VARS[si % 3] + ")" : "var(--accent)"; };

    if (cfg.type === "bar") {
      var bw = Math.min(24, band * 0.62), r = 4, base = Y(0);
      d.series[0].values.forEach(function (val, i) {
        var x0 = X(i) - bw / 2, x1 = X(i) + bw / 2, top = Y(val), rr = Math.min(r, (base - top) / 2, bw / 2);
        var p = "M" + x0 + "," + base + "V" + (top + rr) + "Q" + x0 + "," + top + " " + (x0 + rr) + "," + top +
          "H" + (x1 - rr) + "Q" + x1 + "," + top + " " + x1 + "," + (top + rr) + "V" + base + "Z";
        svg.appendChild(el("path", { d: p, style: "fill:" + colorOf(0) }));
        if (cfg.labelAll || i === n - 1) {
          svg.appendChild(el("text", { x: X(i), y: top - 6, "text-anchor": "middle", "class": "end-label" }, fmtValue(cfg, val)));
        }
      });
    } else {
      d.series.forEach(function (s, si) {
        var pts = s.values.map(function (val, i) { return [X(i), Y(val)]; });
        var line = pts.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1); }).join("");
        if (!multi) {
          var area = line + "L" + pts[pts.length - 1][0] + "," + (m.t + ih) + "L" + pts[0][0] + "," + (m.t + ih) + "Z";
          svg.appendChild(el("path", { d: area, style: "fill:" + colorOf(si) + ";fill-opacity:.1" }));
        }
        svg.appendChild(el("path", { d: line, style: "fill:none;stroke:" + colorOf(si) + ";stroke-width:2;stroke-linejoin:round;stroke-linecap:round" }));
        var last = pts[pts.length - 1];
        svg.appendChild(el("circle", { cx: last[0], cy: last[1], r: 4.5, style: "fill:" + colorOf(si) + ";stroke:var(--surface);stroke-width:2" }));
        var lbl = cfg.endLabels === "name" ? s.name : withUnit(cfg, s.values[s.values.length - 1]);
        svg.appendChild(el("text", { x: last[0] + 9, y: last[1] + 4, "class": "end-label" }, lbl));
      });
    }

    // hover layer
    var cross = el("line", { y1: m.t, y2: m.t + ih, "class": "crosshair", visibility: "hidden" });
    svg.appendChild(cross);
    var dots = d.series.map(function (s, si) {
      var c = el("circle", { r: 4.5, visibility: "hidden", style: "fill:" + colorOf(si) + ";stroke:var(--surface);stroke-width:2" });
      svg.appendChild(c);
      return c;
    });
    var hit = el("rect", { x: m.l - band / 2, y: m.t, width: iw + band, height: ih, "class": "bar-hit" });
    svg.appendChild(hit);

    host.innerHTML = "";
    host.appendChild(svg);
    var tip = document.createElement("div");
    tip.className = "chart-tip";
    tip.hidden = true;
    host.appendChild(tip);

    function show(evt) {
      var rect = svg.getBoundingClientRect();
      var px = (evt.clientX - rect.left) * (W / rect.width);
      var i = cfg.type === "bar" ? Math.floor((px - m.l) / band) : Math.round(((px - m.l) / iw) * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));
      var x = X(i);
      cross.setAttribute("x1", x); cross.setAttribute("x2", x);
      cross.setAttribute("visibility", cfg.type === "bar" ? "hidden" : "visible");
      var minY = Infinity;
      dots.forEach(function (c, si) {
        var yy = Y(d.series[si].values[i]);
        minY = Math.min(minY, yy);
        c.setAttribute("cx", x); c.setAttribute("cy", yy);
        c.setAttribute("visibility", cfg.type === "bar" ? "hidden" : "visible");
      });
      tip.innerHTML = "<div>" + d.tips[i] + "</div>" + d.series.map(function (s, si) {
        return '<div><span class="sw" style="background:' + colorOf(si) + '"></span>' + s.name + ": <b>" + withUnit(cfg, s.values[i]) + "</b></div>";
      }).join("");
      tip.hidden = false;
      var scale = rect.width / W;
      var left = Math.max(70, Math.min(rect.width - 70, x * scale));
      tip.style.left = left + "px";
      tip.style.top = Math.max(40, minY * scale) + "px";
    }
    hit.addEventListener("pointermove", show);
    hit.addEventListener("pointerdown", show);
    hit.addEventListener("pointerleave", function () {
      tip.hidden = true;
      cross.setAttribute("visibility", "hidden");
      dots.forEach(function (c) { c.setAttribute("visibility", "hidden"); });
    });

    renderLegend(host, d, multi, colorOf);
    renderTable(host, cfg, d);
  }

  function renderLegend(host, d, multi, colorOf) {
    var card = host.closest(".chart-card");
    if (!card || !multi) return;
    var lg = card.querySelector(".chart-legend");
    if (!lg) {
      lg = document.createElement("div");
      lg.className = "chart-legend";
      host.parentNode.insertBefore(lg, host);
    }
    lg.innerHTML = d.series.map(function (s, si) {
      return '<span><i style="background:' + colorOf(si) + '"></i>' + s.name + "</span>";
    }).join("");
  }

  function renderTable(host, cfg, d) {
    var box = host.nextElementSibling;
    if (!box || !box.classList.contains("chart-table")) {
      box = document.createElement("details");
      box.className = "chart-table";
      host.parentNode.insertBefore(box, host.nextSibling);
    }
    var open = box.open;
    var head = "<tr><th>" + (cfg.categories ? "Category" : "Week") + "</th>" +
      d.series.map(function (s) { return "<th>" + s.name + (cfg.unit ? " (" + cfg.unit.replace(/^\//, "per ") + ")" : "") + "</th>"; }).join("") + "</tr>";
    var rows = d.labels.map(function (_, i) {
      return "<tr><td>" + d.tips[i] + "</td>" + d.series.map(function (s) { return "<td>" + fmtValue(cfg, s.values[i]) + "</td>"; }).join("") + "</tr>";
    }).join("");
    box.innerHTML = "<summary>View data table (placeholder values)</summary><div class=\"table-wrap\"><table>" + head + rows + "</table></div>";
    box.open = open;
  }

  function initCharts() {
    var hosts = Array.prototype.slice.call(document.querySelectorAll("[data-chart]"));
    hosts.forEach(drawChart);
    if ("ResizeObserver" in window) {
      var widths = new WeakMap();
      var ro = new ResizeObserver(function (entries) {
        entries.forEach(function (en) {
          var w = Math.round(en.contentRect.width);
          if (widths.get(en.target) !== w) { widths.set(en.target, w); drawChart(en.target); }
        });
      });
      hosts.forEach(function (h) { widths.set(h, Math.round(h.clientWidth)); ro.observe(h); });
    }

    // Sleep month comparison (diet & sleep page)
    var sleepHost = document.querySelector('[data-chart="sleepProgress"]');
    if (sleepHost) {
      var cfg = resolveConfig("sleepProgress");
      var vals = cfg.series[0].values;
      var avgs = {};
      Object.keys(window.PP.months).forEach(function (k) {
        var r = window.PP.months[k], sum = 0, c = 0;
        vals.forEach(function (v, i) { if (i + 1 >= r[0] && i + 1 <= r[1]) { sum += v; c++; } });
        avgs[k] = c ? sum / c : 0;
      });
      document.querySelectorAll("[data-sleep-avg]").forEach(function (tile) {
        var k = tile.getAttribute("data-sleep-avg");
        tile.querySelector(".v").textContent = avgs[k].toFixed(1) + " h";
        var prev = avgs[String(Number(k) - 1)];
        if (prev) {
          var diff = (avgs[k] - prev) * 60;
          tile.querySelector(".d").textContent = (diff >= 0 ? "+" : "−") + Math.abs(Math.round(diff)) + " min per night vs Month " + (Number(k) - 1);
        }
      });
      document.querySelectorAll("[data-sleep-range]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var r = btn.getAttribute("data-sleep-range");
          sleepHost.setAttribute("data-range", r);
          document.querySelectorAll("[data-sleep-range]").forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
          document.querySelectorAll("[data-sleep-avg]").forEach(function (t) { t.classList.toggle("is-current", t.getAttribute("data-sleep-avg") === r); });
          drawChart(sleepHost);
        });
      });
    }
  }

  /* ---------- Boot ---------- */
  injectSprite();
  initNav();
  initPlaceholderToggle();
  initFilters();
  initTimeline();
  initDetails();
  initTemplates();
  initDumbbells();
  initCharts();
})();
