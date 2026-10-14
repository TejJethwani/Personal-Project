/* The Tej Era: renders every tab from window.TEJ_ERA (data/career.js). */
(function () {
  "use strict";

  var D = window.TEJ_ERA;
  if (!D) return;

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ================================================================== */
  /* Helpers                                                             */
  /* ================================================================== */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtDate(d) {
    if (!d) return "";
    var m = ISO.exec(d);
    if (!m) return d;
    return (+m[3]) + " " + MONTHS[+m[2] - 1] + " " + m[1];
  }

  function ordinal(n) {
    var s = ["th", "st", "nd", "rd"], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  var WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  function word(n) { return WORDS[n] || String(n); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function sign(n) { return n > 0 ? "+" + n : String(n); }
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
  function sum(arr) { return arr.reduce(function (a, b) { return a + b; }, 0); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); }

  function initials(name) {
    return name.split(/\s+/).map(function (p) { return p.charAt(0); }).join("").slice(0, 2).toUpperCase();
  }

  function surname(name) {
    var parts = name.split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(" ") : name;
  }

  function comp(key) {
    return (D.competitions && D.competitions[key]) || { name: key, short: key, type: "cup", trophy: "cup", metal: "silver" };
  }

  function club(key) {
    return (D.clubs && D.clubs[key]) || { name: key || "", short: key || "", tag: key || "" };
  }

  function clubYears(c) {
    return c.from + "–" + (c.to ? String(c.to).slice(-2) : "present");
  }

  function clubBadge(key, small) {
    var c = club(key);
    return '<span class="cbadge cb-' + esc(key) + (small ? " cbadge-sm" : "") + '" title="' + esc(c.name) + '"><i aria-hidden="true"></i>' + esc(small ? (c.tag || c.short) : c.name) + "</span>";
  }

  var COMP_ORDER = Object.keys(D.competitions || {});
  var TYPES = [["league", "League"], ["europe", "Europe"], ["cup", "Domestic cup"], ["leagueCup", "League cup"]];

  /* ================================================================== */
  /* Prepare the data                                                    */
  /* ================================================================== */
  D.seasons.forEach(function (s, i) {
    s._i = i;
    s._club = club(s.club);
    (s.matches || []).forEach(function (m) { m._s = s; });
    (s.friendlies || []).forEach(function (m) { m._s = s; m._friendly = true; });
    s._leagueEntry = (s.competitions || []).filter(function (c) { return comp(c.comp).type === "league"; })[0] || null;
    // Short names in match notes ("Rashford", "Chido") point at full names in stats and squad.
    var names = {};
    (s.stats || []).forEach(function (x) { names[x.name] = 1; });
    (s.squad || []).forEach(function (x) { names[x.name] = 1; });
    var alias = {}, clash = {};
    Object.keys(names).forEach(function (full) {
      var parts = full.split(/\s+/);
      [full, parts[0], parts[parts.length - 1], parts.slice(1).join(" ")].forEach(function (k) {
        if (!k) return;
        if (alias[k] && alias[k] !== full) clash[k] = 1; else alias[k] = full;
      });
    });
    Object.keys(clash).forEach(function (k) { if (!names[k]) delete alias[k]; });
    s._alias = alias;
  });

  function canon(s, n) { return (n && s._alias[n]) || n; }

  function findMatch(id) {
    for (var i = 0; i < D.seasons.length; i++) {
      var list = (D.seasons[i].matches || []).concat(D.seasons[i].friendlies || []);
      for (var j = 0; j < list.length; j++) if (list[j].id === id) return { season: D.seasons[i], match: list[j] };
    }
    return null;
  }

  function hasScore(m) { return Array.isArray(m.score); }

  function outcome(m) {
    if (!hasScore(m)) return m.result || null;
    if (m.pens) return m.pens[0] > m.pens[1] ? "W" : "L";
    return m.score[0] > m.score[1] ? "W" : m.score[0] < m.score[1] ? "L" : "D";
  }

  function outcomeWord(r) { return r === "W" ? "Won" : r === "L" ? "Lost" : r === "D" ? "Drew" : ""; }

  function isShowpiece(m) { return m.round === "Final" && hasScore(m) && !m._friendly; }

  // Home side first; neutral-venue games list Tej's club first.
  function sides(m) {
    var us = m._s._club.short;
    var sc = hasScore(m) ? m.score : [null, null];
    if (m.venue === "A") return { home: m.opp, away: us, hs: sc[1], as: sc[0], usHome: false };
    return { home: us, away: m.opp, hs: sc[0], as: sc[1], usHome: true };
  }

  function scoreHTML(m) {
    var s = sides(m);
    var known = hasScore(m);
    return '<span class="t' + (s.usHome ? " us" : "") + '">' + esc(s.home) + "</span>" +
      '<span class="sc' + (known ? "" : " sc-unknown") + '"' + (known ? "" : ' title="Score not recovered"') + ">" + (known ? s.hs + "–" + s.as : "?–?") + "</span>" +
      '<span class="t' + (s.usHome ? "" : " us") + '">' + esc(s.away) + "</span>";
  }

  function scoreText(m) {
    var s = sides(m);
    if (!hasScore(m)) return s.home + " v " + s.away;
    return s.home + " " + s.hs + "–" + s.as + " " + s.away + (m.aet ? " (AET)" : "") + (m.pens ? " (pens " + m.pens.join("–") + ")" : "");
  }

  function goalName(g) { return g.player || "Unnamed scorer"; }

  function goalLine(g) {
    return goalName(g) + " " + g.min + "'" + (g.assist ? " (" + g.assist + ")" : "");
  }

  function scorersText(m) {
    if (m.goals) return m.goals.filter(function (g) { return g.side === "us"; }).map(goalLine).join(", ");
    return m.scorers || "";
  }

  function theirScorersText(m) {
    if (m.goals) return m.goals.filter(function (g) { return g.side === "them"; }).map(goalLine).join(", ");
    return m.theirScorers || "";
  }

  // Tej's goals with scorer and assist, from goal lists or "Name (Assist), Name ×2" strings.
  function ourGoals(m) {
    if (m.goals) return m.goals.filter(function (g) { return g.side === "us"; }).map(function (g) { return { min: g.min, player: g.player, assist: g.assist || null }; });
    if (!m.scorers) return [];
    var out = [];
    m.scorers.split(/,\s*/).forEach(function (part) {
      var mm = /^(.+?)(?:\s*×(\d+))?(?:\s*\((.+)\))?$/.exec(part.trim());
      if (!mm) return;
      for (var i = 0; i < (+mm[2] || 1); i++) out.push({ min: null, player: mm[1].trim(), assist: mm[3] ? mm[3].trim() : null });
    });
    return out;
  }

  /* ================================================================== */
  /* Derived career data                                                 */
  /* ================================================================== */
  var honours = [], runnersUp = [];
  D.seasons.forEach(function (s) {
    (s.competitions || []).forEach(function (c) {
      var found = c.final ? findMatch(c.final) : null;
      var item = { season: s, entry: c, comp: comp(c.comp), match: found ? found.match : null };
      if (c.won) honours.push(item);
      else if (/runner/i.test(c.stage)) runnersUp.push(item);
    });
  });

  var countsByComp = {};
  honours.forEach(function (h) { countsByComp[h.entry.comp] = (countsByComp[h.entry.comp] || 0) + 1; });

  function sumLeague(seasons) {
    var t = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
    seasons.forEach(function (s) {
      if (!s.league) return;
      ["p", "w", "d", "l", "gf", "ga", "pts"].forEach(function (k) { t[k] += s.league[k] || 0; });
    });
    return t;
  }
  var league = sumLeague(D.seasons);

  var finals = [];
  D.seasons.forEach(function (s) {
    (s.matches || []).forEach(function (m) { if (isShowpiece(m)) finals.push({ season: s, match: m }); });
  });
  var finalsWon = finals.filter(function (f) { return outcome(f.match) === "W"; }).length;

  function seasonTrophies(s) { return (s.competitions || []).filter(function (c) { return c.won; }).length; }

  var clubKeys = [];
  D.seasons.forEach(function (s) { if (clubKeys.indexOf(s.club) < 0) clubKeys.push(s.club); });
  var currentClubKey = D.seasons[D.seasons.length - 1].club;

  function seasonsOf(clubKey) { return D.seasons.filter(function (s) { return !clubKey || s.club === clubKey; }); }

  function awardsFor(name) {
    var out = [];
    D.seasons.forEach(function (s) {
      (s.awards || []).forEach(function (a) { if (a.winner === name) out.push({ award: a.award, season: s.label }); });
    });
    return out;
  }

  function playerCareer(name) {
    var out = { name: name, goals: 0, assists: 0, gUnknown: false, aUnknown: false, seasons: 0, trophies: 0, ovr: null, clubs: [], labels: [] };
    D.seasons.forEach(function (s) {
      var st = (s.stats || []).filter(function (x) { return x.name === name; })[0];
      var sq = (s.squad || []).filter(function (x) { return x.name === name; })[0];
      if (!st && !sq) return;
      out.seasons++;
      out.labels.push(s.label);
      if (out.clubs.indexOf(s.club) < 0) out.clubs.push(s.club);
      out.trophies += seasonTrophies(s);
      if (sq && sq.ovr) out.ovr = sq.ovr;
      if (st) {
        if (st.goals == null) { out.gUnknown = true; out.goals += st.goalsAtLeast || 0; } else out.goals += st.goals;
        if (st.assists == null) { out.aUnknown = true; out.assists += st.assistsAtLeast || 0; } else out.assists += st.assists;
      } else if (!(s.stats && s.stats.length)) {
        out.gUnknown = out.aUnknown = true;
      }
    });
    return out;
  }

  function topScorer(s) {
    var best = null;
    (s.stats || []).forEach(function (x) { if (x.goals != null && (!best || x.goals > best.goals)) best = x; });
    return best;
  }

  // One row per player across the given seasons, ranked by goals + assists.
  function allTimeRows(seasons) {
    var map = {};
    seasons.forEach(function (s) {
      (s.stats || []).forEach(function (x) {
        var r = map[x.name] || (map[x.name] = { name: x.name, goals: 0, assists: 0, gUnknown: false, aUnknown: false, clubs: [], seasons: [] });
        if (x.goals == null) { r.gUnknown = true; r.goals += x.goalsAtLeast || 0; } else r.goals += x.goals;
        if (x.assists == null) { r.aUnknown = true; r.assists += x.assistsAtLeast || 0; } else r.assists += x.assists;
        if (r.clubs.indexOf(s.club) < 0) r.clubs.push(s.club);
        r.seasons.push(s.label);
      });
    });
    return Object.keys(map).map(function (k) { var r = map[k]; r.ga = r.goals + r.assists; return r; })
      .sort(function (a, b) { return b.ga - a.ga || b.goals - a.goals || a.name.localeCompare(b.name); });
  }

  /* ================================================================== */
  /* Trophy drawings (viewBox 0 0 120 170)                               */
  /* ================================================================== */
  function plinth() {
    return '<rect x="24" y="146" width="72" height="20" rx="2" fill="url(#g-plinth)"/>' +
      '<rect x="24" y="146" width="72" height="2.5" fill="url(#g-gold)" opacity=".75"/>' +
      '<rect x="46" y="152" width="28" height="8" rx="1" fill="url(#g-gold)" opacity=".55"/>';
  }

  function shine(d) { return '<path d="' + d + '" stroke="#fff" stroke-width="2.5" fill="none" opacity=".45" stroke-linecap="round"/>'; }

  var TROPHY = {
    ucl: function (f) {
      return '<g fill="none" stroke="' + f + '" stroke-width="6.5" stroke-linecap="round">' +
        '<path d="M40 20 C 4 6, -1 68, 47 72"/><path d="M80 20 C 116 6, 121 68, 73 72"/></g>' +
        '<g fill="' + f + '">' +
        '<path d="M37 13 H83 C83 52 75 75 60 83 C45 75 37 52 37 13 Z"/>' +
        '<path d="M55 82 H65 L63 103 H57 Z"/><ellipse cx="60" cy="104" rx="9" ry="3.6"/>' +
        '<path d="M53 106 H67 L82 136 H38 Z"/><rect x="34" y="135" width="52" height="11" rx="1.5"/></g>' +
        '<ellipse cx="60" cy="13" rx="23" ry="3.2" fill="#fff" opacity=".55"/>' + shine("M48 22 C 48 50 52 66 58 74");
    },
    pl: function (f) {
      return '<g fill="none" stroke="' + f + '" stroke-width="5" stroke-linecap="round">' +
        '<path d="M33 64 C 14 62, 14 90, 38 92"/><path d="M87 64 C 106 62, 106 90, 82 92"/></g>' +
        '<g fill="' + f + '">' +
        '<path d="M31 58 H89 C89 88 79 103 60 107 C41 103 31 88 31 58 Z"/>' +
        '<rect x="28" y="52" width="64" height="8" rx="3"/>' +
        '<path d="M55 106 H65 L64 116 H56 Z"/><path d="M45 116 H75 L84 136 H36 Z"/>' +
        '<rect x="32" y="135" width="56" height="11" rx="1.5"/></g>' +
        '<path fill="url(#g-gold)" d="M38 52 L38 30 L49 40 L60 22 L71 40 L82 30 L82 52 Z"/>' +
        '<circle cx="38" cy="29" r="3" fill="url(#g-gold)"/><circle cx="60" cy="21" r="3.4" fill="url(#g-gold)"/><circle cx="82" cy="29" r="3" fill="url(#g-gold)"/>' +
        shine("M42 64 C 42 82 48 96 56 101");
    },
    lc: function (f) {
      return '<g fill="none" stroke="' + f + '" stroke-width="5" stroke-linecap="round">' +
        '<path d="M41 38 C 20 34, 18 72, 44 80"/><path d="M79 38 C 100 34, 102 72, 76 80"/></g>' +
        '<g fill="' + f + '">' +
        '<circle cx="60" cy="14" r="5"/><path d="M50 20 H70 L75 31 H45 Z"/>' +
        '<path d="M40 31 H80 C80 70 72 93 60 98 C48 93 40 70 40 31 Z"/>' +
        '<path d="M55 97 H65 L64 112 H56 Z"/><path d="M46 112 H74 L83 136 H37 Z"/>' +
        '<rect x="33" y="135" width="54" height="11" rx="1.5"/></g>' +
        '<path d="M60 42 C 49 46, 49 66, 60 71" fill="none" stroke="#7f868f" stroke-width="3.5" stroke-linecap="round" opacity=".9"/>' +
        shine("M47 38 C 47 62 51 82 57 92");
    },
    fac: function (f) {
      return '<g fill="none" stroke="' + f + '" stroke-width="5" stroke-linecap="round">' +
        '<path d="M37 42 C 16 30, 12 66, 40 70"/><path d="M83 42 C 104 30, 108 66, 80 70"/></g>' +
        '<g fill="' + f + '">' +
        '<circle cx="60" cy="13" r="4.5"/><path d="M44 31 C 44 18 76 18 76 31 Z"/>' +
        '<path d="M36 32 H84 C84 66 76 85 60 89 C44 85 36 66 36 32 Z"/>' +
        '<path d="M55 88 H65 L64 110 H56 Z"/><path d="M45 110 H75 L84 136 H36 Z"/>' +
        '<rect x="32" y="135" width="56" height="11" rx="1.5"/></g>';
    },
    uel: function (f) {
      // Tall, handle-less vase with a flared lip
      return '<g fill="' + f + '">' +
        '<path d="M33 10 H87 C81 20 73 29 70 38 C84 48 86 84 71 100 C67 104 65 108 65 112 L79 134 H41 L55 112 C55 108 53 104 49 100 C34 84 36 48 50 38 C47 29 39 20 33 10 Z"/>' +
        '<rect x="34" y="134" width="52" height="12" rx="1.5"/></g>' +
        '<ellipse cx="60" cy="10" rx="27" ry="3" fill="#fff" opacity=".5"/>' +
        '<path d="M50 38 H70" stroke="#8b929b" stroke-width="2" opacity=".8"/>' +
        shine("M48 50 C 44 66 46 84 54 96");
    },
    coppa: function (f) {
      return '<g fill="none" stroke="' + f + '" stroke-width="5" stroke-linecap="round">' +
        '<path d="M38 38 C 18 34, 18 68, 42 72"/><path d="M82 38 C 102 34, 102 68, 78 72"/></g>' +
        '<g fill="' + f + '">' +
        '<path d="M34 26 H86 C86 64 77 86 60 90 C43 86 34 64 34 26 Z"/>' +
        '<path d="M55 89 H65 L64 110 H56 Z"/><path d="M45 110 H75 L84 136 H36 Z"/>' +
        '<rect x="32" y="135" width="56" height="11" rx="1.5"/></g>' +
        '<g class="tricolore"><rect x="41" y="44" width="13" height="7" fill="#2f8f4e"/><rect x="54" y="44" width="12" height="7" fill="#f2f2f2"/><rect x="66" y="44" width="13" height="7" fill="#d63a3a"/></g>';
    },
    scudetto: function (f) {
      return '<g fill="' + f + '">' +
        '<path d="M40 16 H80 L76 30 C88 44 86 82 70 98 L66 112 L80 134 H40 L54 112 L50 98 C34 82 32 44 44 30 Z"/>' +
        '<rect x="34" y="134" width="52" height="12" rx="1.5"/></g>' +
        '<path d="M60 4 L63 11 L70 11 L64.5 15.5 L66.5 22 L60 18 L53.5 22 L55.5 15.5 L50 11 L57 11 Z" fill="url(#g-gold)"/>' +
        shine("M48 46 C 46 64 48 80 56 92");
    },
    cup: function (f) {
      return '<g fill="none" stroke="' + f + '" stroke-width="5" stroke-linecap="round">' +
        '<path d="M38 40 C 18 38, 18 70, 42 74"/><path d="M82 40 C 102 38, 102 70, 78 74"/></g>' +
        '<g fill="' + f + '">' +
        '<path d="M36 30 H84 C84 66 76 86 60 90 C44 86 36 66 36 30 Z"/>' +
        '<path d="M55 89 H65 L64 110 H56 Z"/><path d="M45 110 H75 L84 136 H36 Z"/>' +
        '<rect x="32" y="135" width="56" height="11" rx="1.5"/></g>';
    }
  };

  function trophySVG(c, opts) {
    opts = opts || {};
    var draw = TROPHY[c.trophy] || TROPHY.cup;
    // Ghost (not yet won) outlines are styled in CSS, so they get a plain fill here.
    var fill = opts.ghost ? "currentColor" : (c.metal === "gold" ? "url(#g-gold)" : "url(#g-silver)");
    return '<svg class="trophy-svg' + (opts.ghost ? " is-ghost" : "") + '" viewBox="0 0 120 170" aria-hidden="true" focusable="false">' +
      draw(fill) + (opts.ghost || opts.bare ? "" : plinth()) + "</svg>";
  }

  /* ================================================================== */
  /* Charts                                                              */
  /* ================================================================== */
  function niceStep(max, ticks) {
    var raw = max / ticks, mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), n = raw / mag;
    var step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * mag;
  }

  function observe(box, draw) {
    draw();
    if (!window.ResizeObserver) return;
    var lastW = box.clientWidth;
    new ResizeObserver(function () {
      if (Math.abs(box.clientWidth - lastW) > 4) { lastW = box.clientWidth; draw(); }
    }).observe(box);
  }

  function legendHTML(series) {
    return '<div class="legend">' + series.map(function (s) {
      return '<span class="lg"><i class="lg-' + (s.kind || "rect") + " " + s.cls + '"></i>' + esc(s.name) + "</span>";
    }).join("") + "</div>";
  }

  function tableView(head, rows) {
    return '<details class="tview"><summary>Show as table</summary><div class="table-scroll"><table class="lt"><thead><tr>' +
      head.map(function (h, i) { return '<th scope="col"' + (i ? ' class="num"' : "") + ">" + esc(h) + "</th>"; }).join("") +
      "</tr></thead><tbody>" + rows.map(function (r) {
        return "<tr>" + r.map(function (c, i) { return "<td" + (i ? ' class="num"' : "") + ">" + esc(c) + "</td>"; }).join("") + "</tr>";
      }).join("") + "</tbody></table></div></details>";
  }

  function tipRows(tip, title, rows, note) {
    tip.innerHTML = "";
    var h = document.createElement("p"); h.className = "ctip-h"; h.textContent = title; tip.appendChild(h);
    rows.forEach(function (r) {
      var row = document.createElement("p"); row.className = "ctip-r";
      var key = document.createElement("i"); key.className = "lg-line " + r.cls;
      var val = document.createElement("b"); val.textContent = r.value;
      var lab = document.createElement("span"); lab.textContent = r.name;
      row.appendChild(key); row.appendChild(val); row.appendChild(lab); tip.appendChild(row);
    });
    if (note) { var n = document.createElement("p"); n.className = "ctip-n"; n.textContent = note; tip.appendChild(n); }
    tip.hidden = false;
  }

  function placeTip(tip, box, x, top) {
    var left = x + 14, tw = tip.offsetWidth;
    if (left + tw > box.clientWidth) left = x - tw - 14;
    tip.style.left = Math.max(0, left) + "px";
    tip.style.top = top + "px";
  }

  /* Grouped column chart. cfg: categories, series [{name, cls, values}], fmt, height, capLabels, note, aria */
  function barChart(host, cfg) {
    var series = cfg.series, cats = cfg.categories, n = cats.length;
    var fmt = cfg.fmt || function (v) { return String(v); };
    host.innerHTML = (series.length > 1 ? legendHTML(series) : "") +
      '<div class="chart-box"><svg class="bars" role="img" tabindex="0" aria-label="' + esc(cfg.aria || "") + '"></svg><div class="ctip" hidden></div></div>';
    var svg = $("svg", host), tip = $(".ctip", host), box = $(".chart-box", host);
    var active = 0, geom = null;

    function draw() {
      var W = Math.max(280, box.clientWidth);
      var H = cfg.height || 240;
      var m = { t: cfg.capLabels ? 24 : 14, r: 6, b: 30, l: 46 };
      var iw = W - m.l - m.r, ih = H - m.t - m.b;
      var vals = [];
      series.forEach(function (s) { vals = vals.concat(s.values.filter(function (v) { return v != null; })); });
      var max = Math.max.apply(null, vals.concat([1]));
      var step = niceStep(max, 5), top = Math.ceil(max / step) * step;
      var y = function (v) { return m.t + ih - (v / top) * ih; };
      var band = iw / n, ns = series.length;
      var barW = Math.max(4, Math.min(24, (band * 0.72 - (ns - 1) * 2) / ns));
      var groupW = barW * ns + (ns - 1) * 2;
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.setAttribute("width", W); svg.setAttribute("height", H);
      var out = "";
      for (var v = 0; v <= top + 1e-9; v += step) {
        out += '<line class="grid" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
          '<text class="tick" x="' + (m.l - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + esc(fmt(Math.round(v * 100) / 100, true)) + "</text>";
      }
      var skip = band < 40 ? 2 : 1;
      cats.forEach(function (c, i) {
        var gx = m.l + band * i + (band - groupW) / 2;
        series.forEach(function (s, j) {
          var val = s.values[i];
          if (val == null) return;
          var x = gx + j * (barW + 2), yt = y(val), h = Math.max(0, y(0) - yt), r = Math.min(4, barW / 2, h);
          if (h > 0) {
            out += '<path class="bar ' + s.cls + '" data-i="' + i + '" d="M' + x + " " + y(0) + " V" + (yt + r) + " Q" + x + " " + yt + " " + (x + r) + " " + yt +
              " H" + (x + barW - r) + " Q" + (x + barW) + " " + yt + " " + (x + barW) + " " + (yt + r) + " V" + y(0) + ' Z"/>';
          }
          if (cfg.capLabels) out += '<text class="cap" x="' + (x + barW / 2) + '" y="' + (yt - 6) + '" text-anchor="middle">' + esc(fmt(val)) + "</text>";
        });
        if (i % skip === 0) out += '<text class="tick" x="' + (m.l + band * i + band / 2) + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(c) + "</text>";
        out += '<rect class="hit" data-i="' + i + '" x="' + (m.l + band * i) + '" y="' + m.t + '" width="' + band + '" height="' + ih + '" fill="transparent"/>';
      });
      out += '<line class="axis" x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>';
      svg.innerHTML = out;
      geom = { band: band, m: m };
    }

    function show(i, visible) {
      active = i;
      $all(".bar", svg).forEach(function (b) { b.classList.toggle("on", visible && +b.getAttribute("data-i") === i); });
      if (!visible) { tip.hidden = true; return; }
      tipRows(tip, cfg.tipTitle ? cfg.tipTitle(i) : cats[i], series.map(function (s) {
        return { cls: s.cls, value: s.values[i] == null ? "—" : fmt(s.values[i]), name: s.name };
      }), cfg.note ? cfg.note(i) : "");
      placeTip(tip, box, geom.m.l + geom.band * i + geom.band / 2, geom.m.t);
    }

    svg.addEventListener("pointermove", function (e) {
      var t = e.target.closest("[data-i]");
      if (t) show(+t.getAttribute("data-i"), true);
    });
    svg.addEventListener("pointerleave", function () { show(active, false); });
    svg.addEventListener("focus", function () { show(active, true); });
    svg.addEventListener("blur", function () { show(active, false); });
    svg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); show(Math.min(n - 1, active + 1), true); }
      if (e.key === "ArrowLeft") { e.preventDefault(); show(Math.max(0, active - 1), true); }
    });
    observe(box, draw);
  }

  /* Points race: one line per club over matchweeks. */
  function raceCls(series) {
    var k = 2;
    return series.map(function (s) { return s.us ? "s-1" : "s-" + Math.min(k++, 3); });
  }

  function raceWeeks(r) {
    return r.matchweeks || r.series[0].values.map(function (_, i) { return r.fromMatchweek + i; });
  }

  function raceTable(r) {
    var weeks = raceWeeks(r);
    return tableView(["Matchweek"].concat(r.series.map(function (s) { return s.club; })),
      weeks.map(function (mw, i) {
        return ["MW" + mw + (r.notes && r.notes[mw] ? " · " + r.notes[mw] : "")].concat(r.series.map(function (s) { return s.values[i] == null ? "—" : s.values[i]; }));
      }));
  }

  function drawRace(host, r, s) {
    var series = r.series, cls = raceCls(series), weeks = raceWeeks(r), n = weeks.length;
    var all = [];
    series.forEach(function (x) { all = all.concat(x.values.filter(function (v) { return v != null; })); });
    var stepY = (Math.max.apply(null, all) - Math.min.apply(null, all)) > 36 ? 10 : 5;
    var lo = Math.floor((Math.min.apply(null, all) - 2) / stepY) * stepY;
    var hi = Math.ceil((Math.max.apply(null, all) + 2) / stepY) * stepY;
    var us = series.filter(function (x) { return x.us; })[0] || series[0];

    host.innerHTML = legendHTML(series.map(function (x, i) { return { name: x.club, cls: cls[i], kind: "line" }; })) +
      '<div class="chart-box"><svg class="race" role="img" tabindex="0" aria-label="League points after each checkpoint. Use the arrow keys to step through matchweeks."></svg><div class="ctip" hidden></div></div>';

    var svg = $("svg", host), tip = $(".ctip", host), box = $(".chart-box", host);
    var active = n - 1, geom = null;

    function draw() {
      var W = Math.max(300, box.clientWidth);
      var H = W < 520 ? 260 : 300;
      var m = { t: 20, r: W < 520 ? 84 : 112, b: 34, l: 38 };
      var iw = W - m.l - m.r, ih = H - m.t - m.b;
      var minW = weeks[0], maxW = weeks[n - 1];
      var x = function (i) { return m.l + (maxW === minW ? iw / 2 : ((weeks[i] - minW) / (maxW - minW)) * iw); };
      var y = function (v) { return m.t + ih - ((v - lo) / (hi - lo)) * ih; };
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.setAttribute("width", W); svg.setAttribute("height", H);
      var out = "";
      for (var v = lo; v <= hi; v += stepY) {
        out += '<line class="grid" x1="' + m.l + '" x2="' + (W - m.r + 8) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
          '<text class="tick" x="' + (m.l - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + "</text>";
      }
      weeks.forEach(function (w, i) {
        var crowded = W < 520 && n > 6 && i % 2 && i !== n - 1;
        out += '<text class="tick" x="' + x(i) + '" y="' + (H - 10) + '" text-anchor="middle">' + (crowded ? "" : "MW" + w) + "</text>";
      });
      if (r.notes) {
        Object.keys(r.notes).forEach(function (k) {
          var i = weeks.indexOf(+k);
          if (i < 0 || i >= n - 1) return;
          out += '<line class="note-line" x1="' + x(i) + '" x2="' + x(i) + '" y1="' + m.t + '" y2="' + (m.t + ih) + '"/>' +
            '<text class="note" x="' + (x(i) + 6) + '" y="' + (m.t + 12) + '">' + esc(r.notes[k]) + "</text>";
        });
      }
      out += '<line class="xhair" x1="0" x2="0" y1="' + m.t + '" y2="' + (m.t + ih) + '"/>';
      series.slice().reverse().forEach(function (x2, rev) {
        var i = series.length - 1 - rev, c = cls[i], d = "", pen = "M";
        x2.values.forEach(function (val, j) {
          if (val == null) { pen = "M"; return; }
          d += pen + x(j).toFixed(1) + " " + y(val).toFixed(1) + " "; pen = "L";
        });
        out += '<path class="line ' + c + '" d="' + d + '"/>';
        x2.values.forEach(function (val, j) {
          if (val != null) out += '<circle class="dot ' + c + '" data-j="' + j + '" cx="' + x(j) + '" cy="' + y(val) + '" r="4"/>';
        });
      });
      // End labels, pushed apart so they never overlap
      var ends = series.map(function (x2, i) {
        var last = null;
        for (var j = n - 1; j >= 0; j--) if (x2.values[j] != null) { last = j; break; }
        return { i: i, j: last, v: x2.values[last], y: y(x2.values[last]) };
      }).sort(function (a, b) { return a.y - b.y; });
      for (var e = 1; e < ends.length; e++) if (ends[e].y - ends[e - 1].y < 15) ends[e].y = ends[e - 1].y + 15;
      ends.forEach(function (en) {
        var x2 = series[en.i];
        out += '<text class="endlab" x="' + (x(en.j) + 12) + '" y="' + (en.y + 4) + '">' + esc(x2.us ? s._club.short : (x2.short || x2.club)) + ' <tspan class="endval">' + en.v + "</tspan></text>";
      });
      out += '<rect class="hit" x="' + m.l + '" y="' + m.t + '" width="' + iw + '" height="' + ih + '" fill="transparent"/>';
      svg.innerHTML = out;
      geom = { x: x, m: m };
      show(active, false);
    }

    function show(i, visible) {
      active = i;
      var xh = $(".xhair", svg);
      xh.setAttribute("x1", geom.x(i)); xh.setAttribute("x2", geom.x(i));
      xh.style.opacity = visible ? 1 : 0;
      $all(".dot", svg).forEach(function (d) { d.classList.toggle("on", visible && +d.getAttribute("data-j") === i); });
      if (!visible) { tip.hidden = true; return; }
      var mw = weeks[i];
      var rows = series.map(function (x2, k) { return { cls: cls[k], value: x2.values[i] == null ? "—" : x2.values[i], name: x2.club }; });
      var others = series.filter(function (x2) { return x2 !== us && x2.values[i] != null; }).map(function (x2) { return x2.values[i]; });
      var note = "";
      if (others.length && us.values[i] != null) {
        var best = Math.max.apply(null, others);
        note = us.values[i] >= best ? "Lead: " + sign(us.values[i] - best) : "Behind the leader by " + (best - us.values[i]);
      }
      if (r.notes && r.notes[mw]) note += (note ? " · " : "") + r.notes[mw];
      tipRows(tip, "Matchweek " + mw, rows, note);
      placeTip(tip, box, geom.x(i), geom.m.t);
    }

    function nearest(clientX) {
      var rect = svg.getBoundingClientRect(), px = clientX - rect.left, best = 0, bd = Infinity;
      weeks.forEach(function (_, i) { var dd = Math.abs(geom.x(i) - px); if (dd < bd) { bd = dd; best = i; } });
      return best;
    }

    svg.addEventListener("pointermove", function (e) { show(nearest(e.clientX), true); });
    svg.addEventListener("pointerleave", function () { show(active, false); });
    svg.addEventListener("focus", function () { show(active, true); });
    svg.addEventListener("blur", function () { show(active, false); });
    svg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); show(Math.min(n - 1, active + 1), true); }
      if (e.key === "ArrowLeft") { e.preventDefault(); show(Math.max(0, active - 1), true); }
    });
    observe(box, draw);
  }

  /* ================================================================== */
  /* Shared building blocks                                              */
  /* ================================================================== */
  function block(eyebrow, title, inner, id) {
    return '<section class="sblock"' + (id ? ' id="' + esc(id) + '"' : "") + '><header class="sblock-head"><p class="eyebrow">' + esc(eyebrow) + '</p><h3 class="sblock-title">' + esc(title) + "</h3></header>" + inner + "</section>";
  }

  function pitchHTML(rows, opts) {
    opts = opts || {};
    var label = rows.map(function (r) { return r.map(function (p) { return p.name; }).join(", "); }).join("; ");
    return '<div class="pitch" role="img" aria-label="' + esc((opts.shape ? opts.shape + ": " : "") + label) + '">' +
      '<span class="pitch-lines" aria-hidden="true"><i class="pl-half"></i><i class="pl-circle"></i><i class="pl-box pl-box-top"></i><i class="pl-box pl-box-bot"></i></span>' +
      rows.slice().reverse().map(function (row) {
        return '<div class="prow">' + row.map(function (p) {
          var ck = p.club || opts.club;
          return '<span class="pp' + (ck ? " pp-" + esc(ck) : "") + '"><span class="pp-dot">' + esc(p.pos) +
            (p.captain ? '<b class="pp-c" title="Captain">C</b>' : "") + "</span>" +
            '<span class="pp-name">' + esc(p.name) + "</span>" +
            (p.club && opts.showClub ? '<span class="pp-club">' + esc(club(p.club).tag || club(p.club).short) + "</span>" : "") + "</span>";
        }).join("") + "</div>";
      }).join("") + "</div>";
  }

  function plaqueStats(c) {
    return [
      [c.goals + (c.gUnknown ? "+" : ""), "Goals"],
      [c.assists + (c.aUnknown ? "+" : ""), "Assists"],
      [c.trophies, "Trophies"],
      [c.seasons, c.seasons === 1 ? "Season" : "Seasons"]
    ];
  }

  /* ================================================================== */
  /* OVERVIEW                                                            */
  /* ================================================================== */
  function renderHero() {
    var m = D.manager;
    $("#hero-kicker").textContent = "Manager · " + clubKeys.map(function (k) { return club(k).name + " " + clubYears(club(k)); }).join(" · ");

    var parts = COMP_ORDER.filter(function (k) { return countsByComp[k]; }).map(function (k) {
      var n = countsByComp[k];
      return n > 1 ? word(n) + " " + comp(k).name + " titles" : "the " + comp(k).name;
    });
    var list = parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0];
    $("#hero-lede").textContent = cap(word(honours.length)) + " major trophies in " + word(D.seasons.length) + " seasons at " +
      word(clubKeys.length) + (clubKeys.length === 1 ? " club" : " clubs") + ": " + list + ". " + m.philosophy;

    var euro = honours.filter(function (h) { return h.comp.type === "europe"; }).length;
    var leagues = honours.filter(function (h) { return h.comp.type === "league"; }).length;
    var stats = [
      ["SEA", D.seasons.length, "Seasons managed"],
      ["WIN", pct(league.w, league.p) + "%", "League win rate (" + league.w + " of " + league.p + ")"],
      ["PPG", league.p ? (league.pts / league.p).toFixed(2) : "0", "League points per game"],
      ["EUR", euro, "European trophies"],
      ["LGE", leagues, "League titles"],
      ["FIN", finalsWon + "/" + finals.length, "Cup finals won"]
    ];
    var cur = club(currentClubKey);
    $("#manager-card").innerHTML =
      '<div class="mc-shine" aria-hidden="true"></div>' +
      '<div class="mc-top">' +
        '<div class="mc-big"><span class="mc-num">' + honours.length + '</span><span class="mc-numlab">Trophies</span></div>' +
        '<div class="mc-role"><span>MGR</span><span class="mc-since">' + esc(plural(clubKeys.length, "club")) + "</span></div>" +
      "</div>" +
      '<div class="mc-crest" aria-hidden="true"><span>TJ</span></div>' +
      '<p class="mc-name">' + esc(m.name) + "</p>" +
      '<p class="mc-club">' + esc(cur.name) + " · since " + esc(cur.from) + "</p>" +
      '<dl class="mc-stats">' + stats.map(function (s) {
        return '<div title="' + esc(s[2]) + '"><dt><abbr title="' + esc(s[2]) + '">' + s[0] + "</abbr></dt><dd>" + esc(s[1]) + "</dd></div>";
      }).join("") + "</dl>";

    var card = $("#manager-card");
    if (!reduceMotion && card) {
      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty("--ry", (x * 10).toFixed(2) + "deg");
        card.style.setProperty("--rx", (-y * 10).toFixed(2) + "deg");
        card.style.setProperty("--mx", ((x + 0.5) * 100).toFixed(1) + "%");
        card.style.setProperty("--my", ((y + 0.5) * 100).toFixed(1) + "%");
      });
      card.addEventListener("pointerleave", function () {
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      });
    }
  }

  function renderLED() {
    var items = [];
    honours.forEach(function (h) {
      var line = h.comp.name + " " + (h.entry.stage === "Champions" ? "champions" : "winners") + " " + h.season.label;
      if (h.match && h.match.round === "Final") line += " · " + scoreText(h.match);
      else if (h.comp.type === "league" && h.season.league) line += " · " + h.season.league.pts + " pts";
      items.push(line);
    });
    (D.records || []).forEach(function (r) {
      if (r.ticker) items.push(r.value + (r.unit ? " " + r.unit : "") + " · " + r.label + " " + r.season);
    });
    var html = items.map(function (t) { return '<span class="led-item">' + esc(t) + "</span>"; }).join("");
    $("#led-track").innerHTML = '<div class="led-run">' + html + '</div><div class="led-run" aria-hidden="true">' + html + "</div>";
  }

  function renderJourney() {
    $("#journey").innerHTML = clubKeys.map(function (k, idx) {
      var c = club(k), ss = seasonsOf(k), L = sumLeague(ss);
      var hs = honours.filter(function (h) { return h.season.club === k; });
      var best = ss.filter(function (s) { return s.league; }).sort(function (a, b) { return a.league.position - b.league.position || b.league.pts - a.league.pts; })[0];
      var star = allTimeRows(ss)[0];
      return '<article class="jcard jc-' + esc(k) + (k === currentClubKey ? " jc-current" : "") + '">' +
        '<div class="jc-head"><span class="jc-step">Chapter ' + (idx + 1) + "</span>" + (k === currentClubKey ? '<span class="tag tag-hl">Current club</span>' : "") + "</div>" +
        '<h3 class="jc-club">' + esc(c.name) + "</h3>" +
        '<p class="jc-years">' + esc(clubYears(c)) + " · " + plural(ss.length, "season") + "</p>" +
        '<div class="jc-trophies">' + (hs.length ? hs.map(function (h) {
          return '<span class="jc-cup" title="' + esc(h.comp.name + " " + h.season.label) + '">' + trophySVG(h.comp, { bare: true }) + "</span>";
        }).join("") : '<span class="jc-none">No trophies yet</span>') + "</div>" +
        '<dl class="jc-stats">' +
          "<div><dt>Trophies</dt><dd>" + hs.length + "</dd></div>" +
          "<div><dt>League record</dt><dd>" + L.w + "–" + L.d + "–" + L.l + "</dd></div>" +
          "<div><dt>Best finish</dt><dd>" + (best ? ordinal(best.league.position) + ", " + best.league.pts + " pts" : "—") + "</dd></div>" +
          "<div><dt>Top G+A</dt><dd>" + (star ? esc(star.name) + " " + star.ga + (star.gUnknown || star.aUnknown ? "+" : "") : "—") + "</dd></div>" +
        "</dl>" +
        '<p class="jc-honours">' + (hs.length ? hs.map(function (h) { return esc(h.comp.name + " " + h.season.label); }).join(" · ") : "") + "</p>" +
        '<a class="jc-link" href="#season-' + esc(ss[ss.length - 1].id) + '">Open ' + esc(ss[ss.length - 1].label) + " →</a>" +
        "</article>";
    }).join('<div class="journey-arrow" aria-hidden="true"></div>');
  }

  function renderHonours() {
    var head = '<tr><th scope="col">Season</th><th scope="col">Club</th>' + TYPES.map(function (t) {
      return '<th scope="col">' + esc(t[1]) + "</th>";
    }).join("") + '<th scope="col">Top scorer</th></tr>';

    var rows = D.seasons.slice().reverse().map(function (s) {
      var cells = TYPES.map(function (t) {
        var c = (s.competitions || []).filter(function (x) { return comp(x.comp).type === t[0]; })[0];
        if (!c) return '<td class="hb-none">—</td>';
        var extra = (t[0] === "league" && s.league) ? s.league.pts + " pts" : "";
        var runner = /runner/i.test(c.stage);
        return '<td class="' + (c.won ? "hb-won" : runner ? "hb-runner" : "") + '" title="' + esc(c.note || "") + '">' +
          (c.won ? '<span class="hb-star" aria-hidden="true">★</span>' : runner ? '<span class="hb-star" aria-hidden="true">☆</span>' : "") +
          '<span class="hb-stage">' + esc(c.stage) + "</span>" +
          '<span class="hb-extra">' + esc(comp(c.comp).short) + (extra ? " · " + extra : "") + "</span></td>";
      }).join("");
      var ts = topScorer(s);
      return '<tr><th scope="row"><a href="#season-' + esc(s.id) + '">' + esc(s.label) + "</a></th>" +
        "<td>" + clubBadge(s.club, true) + "</td>" + cells +
        "<td>" + (ts ? esc(surname(ts.name)) + ' <span class="hb-extra">' + ts.goals + " goals</span>" : "—") + "</td></tr>";
    }).join("");

    $("#honours-board").innerHTML = '<div class="board-scroll"><table class="hb"><thead>' + head + "</thead><tbody>" + rows + "</tbody></table></div>";

    var tiles = [
      { v: league.p, k: "League games", s: league.w + "W " + league.d + "D " + league.l + "L" },
      { v: league.pts, k: "League points", s: (league.pts / Math.max(league.p, 1)).toFixed(2) + " per game" },
      { v: league.gf, k: "League goals", s: league.ga + " conceded · " + sign(league.gf - league.ga) },
      { v: finalsWon + "/" + finals.length, k: "Cup finals won", s: finals.map(function (f) { return comp(f.match.comp).short + " " + f.season.label.slice(-2); }).join(" · ") },
      { v: honours.length, k: "Major trophies", s: (honours.length / D.seasons.length).toFixed(1) + " per season · " + plural(clubKeys.length, "club") }
    ];
    $("#career-stats").innerHTML = tiles.map(function (t) {
      return '<div class="cs"><span class="cs-v">' + esc(t.v) + '</span><span class="cs-k">' + esc(t.k) + '</span><span class="cs-s">' + esc(t.s) + "</span></div>";
    }).join("");
  }

  function renderExplore() {
    var matchesOnRecord = sum(D.seasons.map(function (s) { return (s.matches || []).filter(hasScore).length; }));
    var leader = allTimeRows(D.seasons)[0];
    var lineups = sum(D.seasons.map(function (s) { return (s.lineups || []).length; })) + (D.allTimeXI ? 1 : 0);
    var nights = sum(D.seasons.map(function (s) { return (s.matches || []).filter(function (m) { return m.highlight; }).length; }));
    var cards = [
      ["cabinet", "Trophy cabinet", plural(honours.length, "trophy", "trophies") + " on the shelves"],
      ["seasons", "Season archive", matchesOnRecord + " matches on record"],
      ["lineups", "Lineups", plural(lineups, "eleven") + " to look back on"],
      ["stats", "Statistics", leader ? "All-time G+A leader: " + leader.name + " (" + leader.ga + (leader.gUnknown || leader.aUnknown ? "+" : "") + ")" : "Career numbers"],
      ["hall-of-fame", "Hall of Fame", (D.hallOfFame || []).length + " inductees and an all-time XI"],
      ["records", "Record book", plural((D.records || []).length, "record")],
      ["timeline", "Timeline", plural(nights, "night") + " that made the era"],
      ["season-" + D.seasons[D.seasons.length - 1].id, "Latest season", D.seasons[D.seasons.length - 1].label + " · " + D.seasons[D.seasons.length - 1].title]
    ];
    $("#explore").innerHTML = cards.map(function (c) {
      return '<a class="xcard" href="#' + c[0] + '"><span class="xc-title">' + esc(c[1]) + '</span><span class="xc-sub">' + esc(c[2]) + '</span><span class="xc-go" aria-hidden="true">→</span></a>';
    }).join("");
  }

  /* ================================================================== */
  /* CABINET                                                             */
  /* ================================================================== */
  function bayHTML(h, i) {
    var c = h.comp, detail, sub;
    if (h.match && h.match.round === "Final") {
      detail = scoreText(h.match);
      sub = fmtDate(h.match.date) + (h.match.ground ? " · " + h.match.ground : "");
    } else if (c.type === "league" && h.season.league) {
      var L = h.season.league;
      detail = L.pts + " points · " + L.w + "W " + L.d + "D " + L.l + "L";
      sub = h.match ? "Clinched " + fmtDate(h.match.date) + " v " + h.match.opp : "";
    } else {
      detail = h.entry.note || "";
      sub = "";
    }
    var target = h.match ? "m-" + h.match.id : "season-" + h.season.id;
    return '<a class="bay" href="#' + esc(target) + '" style="--i:' + i + '">' +
      '<span class="bay-light" aria-hidden="true"></span>' +
      '<span class="bay-trophy">' + trophySVG(c) + "</span>" +
      '<span class="bay-plaque">' +
        '<span class="bay-season">' + esc(h.season.label) + "</span>" +
        '<span class="bay-comp">' + esc(c.name) + "</span>" +
        '<span class="bay-detail">' + esc(detail) + "</span>" +
        (sub ? '<span class="bay-sub">' + esc(sub) + "</span>" : "") +
      "</span></a>";
  }

  function renderCabinet() {
    $("#cabinet-lede").textContent = cap(word(honours.length)) + " major trophies in " + word(D.seasons.length) + " completed seasons with " +
      word(clubKeys.length) + (clubKeys.length === 1 ? " club" : " clubs") + ". Select a trophy to relive the night it was won.";

    $("#cabinet-counts").innerHTML = COMP_ORDER.filter(function (k) { return countsByComp[k]; }).map(function (k) {
      return '<span class="count-chip"><b>' + countsByComp[k] + "×</b> " + esc(comp(k).name) + "</span>";
    }).join("");

    $("#cabinet-clubs").innerHTML = clubKeys.map(function (k) {
      var hs = honours.filter(function (h) { return h.season.club === k; });
      var n = Math.max(1, hs.length);
      return '<div class="shelf-group" style="flex:' + n + " 1 " + (n * 190 + 56) + 'px">' +
        '<div class="shelf-head">' + clubBadge(k) + '<span class="shelf-meta">' + esc(clubYears(club(k))) + " · " + plural(hs.length, "trophy", "trophies") + "</span></div>" +
        (hs.length ? '<div class="cabinet">' + hs.map(bayHTML).join("") + "</div>" : '<p class="shelf-empty">The shelf is waiting.</p>') +
        "</div>";
    }).join("");

    var vacant = COMP_ORDER.filter(function (k) { return !countsByComp[k]; }).map(function (k) {
      var runs = [];
      D.seasons.forEach(function (s) {
        (s.competitions || []).forEach(function (c) { if (c.comp === k) runs.push(c.stage + " " + s.label); });
      });
      return { key: k, runs: runs };
    }).filter(function (v) { return v.runs.length; });

    var html = "";
    if (runnersUp.length) {
      html += '<p class="vacant-head">Runners-up medals</p><div class="vacant-row">' + runnersUp.map(function (h) {
        return '<a class="vacant-item medal" href="#' + esc(h.match ? "m-" + h.match.id : "season-" + h.season.id) + '">' +
          '<span class="medal-disc" aria-hidden="true">2</span>' +
          '<span class="vacant-copy"><span class="vacant-comp">' + esc(h.comp.name) + "</span>" +
          '<span class="vacant-runs">' + esc(h.season.label + " · " + (h.match ? scoreText(h.match) : h.entry.note || "")) + "</span></span></a>";
      }).join("") + "</div>";
    }
    if (vacant.length) {
      html += '<p class="vacant-head">Space reserved</p><div class="vacant-row">' + vacant.map(function (v) {
        return '<div class="vacant-item"><span class="vacant-trophy">' + trophySVG(comp(v.key), { ghost: true }) + "</span>" +
          '<span class="vacant-copy"><span class="vacant-comp">' + esc(comp(v.key).name) + "</span>" +
          '<span class="vacant-runs">Still to win. ' + esc(v.runs.join(" · ")) + "</span></span></div>";
      }).join("") + "</div>";
    }
    $("#cabinet-vacant").innerHTML = html;
  }

  /* ================================================================== */
  /* SEASONS                                                             */
  /* ================================================================== */
  var currentSeason = null;

  function renderSeasonTabs() {
    var wrap = $("#season-tabs");
    wrap.innerHTML = D.seasons.map(function (s, i) {
      var t = seasonTrophies(s);
      return '<button type="button" role="tab" class="stab st-' + esc(s.club) + '" id="tab-' + esc(s.id) + '" aria-controls="season-panel" data-season="' + esc(s.id) + '">' +
        '<span class="stab-n">Season ' + (i + 1) + " · " + esc(s._club.short) + "</span>" +
        '<span class="stab-l">' + esc(s.label) + "</span>" +
        '<span class="stab-t">' + esc(s.title) + "</span>" +
        '<span class="stab-cups" aria-label="' + plural(t, "trophy", "trophies") + '">' + new Array(t + 1).join("★") + "</span>" +
        "</button>";
    }).join("");

    wrap.addEventListener("click", function (e) {
      var b = e.target.closest("[data-season]");
      if (b) { selectSeason(b.getAttribute("data-season")); setHash("season-" + b.getAttribute("data-season")); }
    });
    wrap.addEventListener("keydown", function (e) {
      var tabs = $all(".stab", wrap), i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var n = null;
      if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
      if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
      if (e.key === "Home") n = 0;
      if (e.key === "End") n = tabs.length - 1;
      if (n != null) {
        e.preventDefault();
        selectSeason(tabs[n].getAttribute("data-season"), true);
        setHash("season-" + tabs[n].getAttribute("data-season"));
      }
    });
  }

  function selectSeason(id, focusTab) {
    var s = D.seasons.filter(function (x) { return x.id === id; })[0] || D.seasons[D.seasons.length - 1];
    $all(".stab").forEach(function (b) {
      var on = b.getAttribute("data-season") === s.id;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
      if (on && focusTab) b.focus();
    });
    $("#season-panel").setAttribute("aria-labelledby", "tab-" + s.id);
    if (currentSeason !== s.id) { currentSeason = s.id; renderSeason(s); }
    return s;
  }

  function renderSeason(s) {
    var html = "", lc = s._leagueEntry ? comp(s._leagueEntry.comp) : null;

    html += '<div class="sp-head" id="season-' + esc(s.id) + '">' +
      '<span class="sp-label" aria-hidden="true">' + esc(s.label) + "</span>" +
      '<div class="sp-head-copy"><p class="eyebrow">Season ' + (s._i + 1) + " · " + esc(s.label) + " · " + esc(s._club.name) + "</p>" +
      '<h3 class="sp-title">' + esc(s.title) + "</h3>" +
      '<p class="sp-summary">' + esc(s.summary) + "</p></div></div>";

    html += '<div class="outcomes">' + (s.competitions || []).map(function (c) {
      var runner = /runner/i.test(c.stage);
      return '<div class="oc' + (c.won ? " oc-won" : runner ? " oc-runner" : "") + '">' +
        '<span class="oc-comp">' + esc(comp(c.comp).name) + "</span>" +
        '<span class="oc-stage">' + (c.won ? '<span aria-hidden="true">★ </span>' : "") + esc(c.stage) + "</span>" +
        '<span class="oc-note">' + esc(c.note || "") + "</span></div>";
    }).join("") + "</div>";

    var L = s.league, A = s.allComps || {}, keys = [];
    if (L) {
      keys.push({ v: L.pts, u: "pts", k: (lc ? lc.name : "League") + ", " + ordinal(L.position) });
      keys.push({ v: L.w + "–" + L.d + "–" + L.l, u: "", k: "League W–D–L" });
      keys.push({ v: L.gf, u: "scored", k: L.ga + " conceded · GD " + sign(L.gf - L.ga) });
    }
    if (A.p) keys.push({ v: A.gf, u: "goals", k: "All competitions · " + A.p + " games · " + A.ga + " conceded" });
    var ts = topScorer(s);
    if (ts) keys.push({ v: ts.goals, u: "goals", k: "Top scorer: " + ts.name });
    var tga = allTimeRows([s])[0];
    if (tga && tga.name !== (ts && ts.name)) keys.push({ v: tga.ga, u: "G+A", k: "Most goal involvements: " + tga.name });
    html += '<div class="keys">' + keys.map(function (k) {
      return '<div class="key"><span class="key-v">' + esc(k.v) + (k.u ? "<small>" + esc(k.u) + "</small>" : "") + '</span><span class="key-k">' + esc(k.k) + "</span></div>";
    }).join("") + "</div>";

    var fin = (s.matches || []).filter(isShowpiece);
    if (fin.length) html += block("Finals", fin.length > 1 ? "The showpieces" : "The showpiece", fin.map(matchCentre).join(""));

    if (s.pointsRace) {
      html += block("League race", s.pointsRace.title || "The run-in", '<div class="chart" id="race-chart"></div>' +
        (s.pointsRace.caption ? '<p class="caption">' + esc(s.pointsRace.caption) + "</p>" : "") + raceTable(s.pointsRace));
    }

    if (s.table) html += block(lc ? lc.name : "League", "Final table", leagueTable(s));

    var listable = (s.matches || []).filter(function (m) { return !isShowpiece(m); });
    var comps = COMP_ORDER.filter(function (k) { return listable.some(function (m) { return m.comp === k; }); });
    if (s.friendlies && s.friendlies.length) comps.push("pre");
    if (comps.length) {
      html += block("Results", "Every result on record",
        '<div class="filters" role="tablist" aria-label="Competition">' + comps.map(function (k, i) {
          var n = k === "pre" ? s.friendlies.length : listable.filter(function (m) { return m.comp === k; }).length;
          return '<button type="button" role="tab" class="filter" data-comp="' + esc(k) + '" aria-selected="' + (i === 0 ? "true" : "false") + '">' +
            esc(k === "pre" ? "Pre-season" : comp(k).name) + ' <span class="filter-n">' + n + "</span></button>";
        }).join("") + '</div><div id="results-list"></div>');
    }

    if (s.stats && s.stats.length) html += block("Goals & assists", "Leaderboard", leaderboardShell("Ranked by goals + assists, all competitions. Select a column to sort. A dash means the total was not retained; + means at least that many."));

    if (s.awards && s.awards.length) {
      html += block("Awards night", "Season awards", '<div class="awards">' + s.awards.map(function (a) {
        return '<div class="award"><p class="aw-name">' + esc(a.award) + '</p><p class="aw-winner">' + esc(a.winner) + "</p>" + (a.detail ? '<p class="aw-detail">' + esc(a.detail) + "</p>" : "") + "</div>";
      }).join("") + "</div>");
    }

    if (s.squad) {
      html += block("The squad", "Squad and ratings", squadHTML(s) +
        ((s.lineups && s.lineups.length) ? '<p class="caption"><a href="#lineup-' + esc(s.id) + '">See this season\'s lineups →</a></p>' : ""));
    }

    if (s.tactics) {
      html += block("Tactics", s.tacticsTitle || "Ways to play", '<div class="tactics">' + s.tactics.map(function (t) {
        var rec = tacticRecord(s, t.name);
        return '<div class="tac"><p class="tac-name">' + esc(t.name) + "</p>" +
          (rec ? '<p class="tac-rec">' + esc(rec) + "</p>" : "") +
          '<p class="tac-text">' + esc(t.text) + "</p></div>";
      }).join("") + "</div>");
    }

    if (s.signings || s.departures || s.finances || s.staff) {
      var inner = '<div class="board-grid">';
      if (s.signings) inner += ledgerPanel("Arrivals", s.signings.map(function (x) { return [x.name, x.note, x.fee]; }));
      if (s.departures) inner += ledgerPanel("Departures", s.departures.map(function (x) { return [x.name, x.note, x.fee]; }));
      if (s.staff) inner += ledgerPanel("Backroom staff", s.staff.map(function (x) { return [x.name, x.detail, x.role]; }));
      if (s.finances) {
        inner += '<div class="panel"><p class="panel-title">Boardroom</p><ul class="ledger">' + s.finances.rows.map(function (x) {
          return '<li><span class="lg-name">' + esc(x.label) + '</span><span class="lg-val">' + esc(x.value) + "</span></li>";
        }).join("") + "</ul>" +
          (s.finances.status ? '<p class="panel-note">' + esc(s.finances.status) + "</p>" : "") +
          (s.finances.caption ? '<p class="panel-note">' + esc(s.finances.caption) + "</p>" : "") + "</div>";
      }
      inner += "</div>";
      if (s.finances && s.finances.monthly) {
        inner += '<p class="mini-title mini-gap">Revenue and operating expenses by month</p><div class="chart" id="finance-chart"></div>' + financeTable(s.finances.monthly);
      }
      html += block("Transfers & finance", "The business", inner);
    }

    if (s.notes && s.notes.length) {
      html += '<div class="notes"><p class="notes-title">Archive notes</p><ul>' + s.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul></div>";
    }

    var panel = $("#season-panel");
    panel.innerHTML = html;

    if (s.pointsRace) drawRace($("#race-chart"), s.pointsRace, s);
    if (s.finances && s.finances.monthly) drawFinance($("#finance-chart"), s.finances.monthly);
    if (comps.length) {
      var filters = $(".filters", panel);
      renderResults(s, comps[0]);
      filters.addEventListener("click", function (e) {
        var b = e.target.closest(".filter");
        if (!b) return;
        $all(".filter", filters).forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
        renderResults(s, b.getAttribute("data-comp"));
      });
    }
    var lb = $(".lb", panel);
    if (lb) wireLeaderboard(lb, s.stats.map(function (x) {
      return { name: x.name, goals: x.goals, assists: x.assists, gMin: x.goalsAtLeast, aMin: x.assistsAtLeast };
    }));
  }

  function ledgerPanel(title, rows) {
    return '<div class="panel"><p class="panel-title">' + esc(title) + '</p><ul class="ledger">' + rows.map(function (r) {
      return '<li><span class="lg-name">' + esc(r[0]) + (r[1] ? "<small>" + esc(r[1]) + "</small>" : "") + '</span><span class="lg-val">' + esc(r[2]) + "</span></li>";
    }).join("") + "</ul></div>";
  }

  function financeTable(rows) {
    return tableView(["Month", "Revenue (€M)", "Expenses (€M)", "Surplus (€M)"], rows.map(function (r) {
      return [r.month, r.revenue.toFixed(1), r.expenses.toFixed(1), (r.revenue - r.expenses).toFixed(1)];
    }));
  }

  function drawFinance(host, rows) {
    barChart(host, {
      categories: rows.map(function (r) { return r.month.split(" ")[0]; }),
      series: [
        { name: "Revenue", cls: "s-2", values: rows.map(function (r) { return r.revenue; }) },
        { name: "Operating expenses", cls: "s-3", values: rows.map(function (r) { return r.expenses; }) }
      ],
      fmt: function (v, axis) { return axis ? "€" + v + "M" : "€" + v.toFixed(1) + "M"; },
      tipTitle: function (i) { return rows[i].month; },
      note: function (i) { return "Surplus €" + (rows[i].revenue - rows[i].expenses).toFixed(1) + "M"; },
      height: 250,
      aria: "Monthly revenue and operating expenses in euro millions."
    });
  }

  /* ---------- Match centre ---------- */
  function statsBars(m) {
    if (!(m.matchStats && m.oppStats)) return "";
    var rows = [["possession", "Possession", "%"], ["shots", "Shots", ""], ["onTarget", "On target", ""], ["xg", "xG", ""], ["passAcc", "Pass accuracy", "%"]];
    var shown = rows.filter(function (x) { return m.matchStats[x[0]] != null && m.oppStats[x[0]] != null; });
    if (!shown.length) return "";
    return '<div class="mstats"><div class="mstats-key"><span class="k-us">' + esc(m._s._club.short) + '</span><span class="k-them">' + esc(m.opp) + "</span></div>" +
      shown.map(function (x) {
        var a = m.matchStats[x[0]], b = m.oppStats[x[0]], t = a + b || 1;
        var fa = x[0] === "xg" ? a.toFixed(2) : a, fb = x[0] === "xg" ? b.toFixed(2) : b;
        return '<div class="ms-row"><span class="ms-a">' + fa + x[2] + '</span><span class="ms-l">' + x[1] + '</span><span class="ms-b">' + fb + x[2] + "</span>" +
          '<span class="ms-bar"><i class="ms-us" style="width:' + (a / t * 100).toFixed(1) + '%"></i><i class="ms-them" style="width:' + (b / t * 100).toFixed(1) + '%"></i></span></div>';
      }).join("") + "</div>";
  }

  function matchCentre(m) {
    var s = sides(m), r = outcome(m);
    var maxMin = m.aet ? 120 : 90;
    var goals = (m.goals || []).slice().sort(function (a, b) { return a.min - b.min; });

    // Goal labels sit above (Tej's side) and below (opponent) the minute track.
    // A label that would crowd the previous one on its side steps out a row.
    var ROW = 40, LH = 34;
    var lastPct = { us: -100, them: -100 }, lastLvl = { us: 1, them: 1 }, maxLvl = { us: -1, them: -1 };
    var laid = goals.map(function (g) {
      var side = g.side === "us" ? "us" : "them";
      var p = Math.min(100, (g.min / maxMin) * 100);
      var lvl = p - lastPct[side] < 30 ? (lastLvl[side] === 0 ? 1 : 0) : 0;
      lastPct[side] = p; lastLvl[side] = lvl; maxLvl[side] = Math.max(maxLvl[side], lvl);
      return { g: g, side: side, pct: p, lvl: lvl };
    });
    var trackY = 6 + (maxLvl.us + 1) * ROW + 10;
    var gtlH = trackY + 10 + (maxLvl.them + 1) * ROW + 26;

    var running = [0, 0];
    var marks = laid.map(function (o) {
      var g = o.g;
      if (o.side === "us") running[0]++; else running[1]++;
      var align = o.pct > 78 ? "end" : o.pct < 16 ? "start" : "mid";
      var tally = s.usHome ? running[0] + "–" + running[1] : running[1] + "–" + running[0];
      var labelTop = o.side === "us" ? trackY - 10 - LH - o.lvl * ROW : trackY + 10 + o.lvl * ROW;
      var stemTop = o.side === "us" ? labelTop + LH : trackY + 6;
      var stemH = o.side === "us" ? trackY - 6 - stemTop : labelTop - stemTop;
      return '<div class="gm gm-' + o.side + " gm-" + align + '" style="left:' + o.pct.toFixed(2) + '%" aria-hidden="true">' +
        '<span class="gm-stem" style="top:' + stemTop + "px;height:" + Math.max(0, stemH) + 'px"></span>' +
        '<span class="gm-dot" style="top:' + (trackY - 7) + 'px"></span>' +
        '<span class="gm-label" style="top:' + labelTop + 'px"><span class="gm-who"><b>' + g.min + "'</b> " + esc(goalName(g)) + "</span>" + (g.assist ? "<small>" + esc(g.assist) + "</small>" : "") + "</span></div>" +
        '<span class="sr">' + g.min + " minutes, " + esc(goalName(g)) + (g.assist ? ", assisted by " + esc(g.assist) : "") + ", " + tally + ".</span>";
    }).join("");

    return '<article class="mc' + (r === "L" ? " mc-lost" : "") + '" id="m-' + esc(m.id) + '">' +
      '<div class="mc-head">' +
        '<span class="mc-comp">' + esc(comp(m.comp).name) + " · " + esc(m.round) + "</span>" +
        '<span class="mc-when">' + esc(fmtDate(m.date)) + (m.ground ? " · " + esc(m.ground) : "") + "</span>" +
      "</div>" +
      '<div class="mc-board">' +
        '<span class="mc-team' + (s.usHome ? " us" : "") + '">' + esc(s.home) + "</span>" +
        '<span class="mc-score"><span>' + s.hs + '</span><i aria-hidden="true">–</i><span>' + s.as + "</span></span>" +
        '<span class="mc-team' + (s.usHome ? "" : " us") + '">' + esc(s.away) + "</span>" +
      "</div>" +
      '<p class="mc-tags"><span class="res-r res-' + r + '">' + outcomeWord(r) + "</span>" +
        (m.aet ? '<span class="tag">After extra time</span>' : "") +
        (m.potm ? '<span class="tag">Man of the Match: ' + esc(m.potm) + "</span>" : m.best ? '<span class="tag">Best player: ' + esc(m.best) + "</span>" : "") +
        (m.tactic ? '<span class="tag">' + esc(m.tactic) + "</span>" : "") + "</p>" +
      (goals.length ? '<div class="gtl" style="height:' + gtlH + 'px"><div class="gtl-track" aria-hidden="true">' +
        '<span class="gtl-line" style="top:' + (trackY - 2) + 'px"></span>' +
        (m.aet ? '<span class="gtl-et" style="top:' + (trackY - 9) + "px;left:" + (90 / maxMin * 100) + '%"></span><span class="gtl-tick gtl-tick-et" style="left:' + (105 / maxMin * 100) + '%">Extra time</span>' : "") +
        '<span class="gtl-half" style="top:' + (trackY - 9) + "px;left:" + (45 / maxMin * 100) + '%"></span>' +
        [0, 45, 90].concat(m.aet ? [120] : []).map(function (t) {
          return '<span class="gtl-tick' + (t === maxMin ? " gtl-tick-end" : t === 0 ? " gtl-tick-start" : "") + '" style="left:' + (t / maxMin * 100) + '%">' + t + "'</span>";
        }).join("") +
        "</div>" + marks + "</div>" +
        '<ol class="glist" aria-hidden="true">' + goals.map(function (g) {
          return '<li class="gl-' + (g.side === "us" ? "us" : "them") + '"><b>' + g.min + "'</b><span>" + esc(goalName(g)) +
            (g.assist ? " <small>" + esc(g.assist) + "</small>" : "") + "</span></li>";
        }).join("") + "</ol>" : "") +
      (m.story ? '<p class="mc-story">' + esc(m.story) + "</p>" : "") +
      (m.lineup ? '<p class="mc-lineup"><b>Starting XI</b> ' + esc(m.lineup) + "</p>" : "") +
      statsBars(m) +
      (m.report ? '<details class="res-report mc-report"><summary>Full match report</summary>' + reportHTML(m, true) + "</details>" : "") +
      "</article>";
  }

  function reportHTML(m, skipStats) {
    var facts = [];
    if (m.attendance) facts.push(["Attendance", m.attendance.toLocaleString("en-GB")]);
    if (m.potm) facts.push(["Man of the Match", m.potm]);
    else if (m.best) facts.push(["Best player", m.best]);
    if (m.tactic) facts.push(["Tactic", m.tactic]);
    if (m.cards && m.cards.length) facts.push(["Booked", m.cards.join(", ")]);
    if (m.note) facts.push(["Note", m.note]);
    return '<p class="rep-text">' + esc(m.report) + "</p>" +
      (m.selection ? '<p class="rep-sel"><b>Selection</b> ' + esc(m.selection) + "</p>" : "") +
      (m.perf ? '<p class="rep-sel"><b>Ratings and fitness</b> ' + esc(m.perf) + "</p>" : "") +
      (facts.length ? '<dl class="rep-facts">' + facts.map(function (f) { return "<div><dt>" + esc(f[0]) + "</dt><dd>" + esc(f[1]) + "</dd></div>"; }).join("") + "</dl>" : "") +
      (skipStats ? "" : statsBars(m));
  }

  /* ---------- Results list ---------- */
  function renderResults(s, k) {
    var list = k === "pre" ? (s.friendlies || []) : (s.matches || []).filter(function (m) { return m.comp === k && !isShowpiece(m); });
    var scored = list.filter(hasScore);
    var w = 0, d = 0, l = 0, gf = 0, ga = 0;
    scored.forEach(function (m) {
      var r = outcome(m);
      if (r === "W") w++; else if (r === "D") d++; else l++;
      gf += m.score[0]; ga += m.score[1];
    });
    var finalsHere = (s.matches || []).filter(function (m) { return m.comp === k && isShowpiece(m); });
    var html = '<p class="res-sum">' + plural(list.length, "game") + " shown" + (scored.length ? " · " + w + "W " + d + "D " + l + "L · " + gf + "–" + ga : "") +
      (k === "pre" ? " · friendlies are left out of every total" : "") +
      (finalsHere.length ? ' · <a href="#m-' + esc(finalsHere[0].id) + '">Final shown above</a>' : "") + "</p>";
    html += '<ol class="results">' + list.map(function (m) {
      var r = outcome(m);
      var ours = scorersText(m), theirs = theirScorersText(m);
      return '<li class="res' + (m.highlight ? " res-hl" : "") + '" id="m-' + esc(m.id) + '">' +
        '<span class="res-date">' + esc(fmtDate(m.date)) + "<small>" + esc(m.round || "Friendly") + "</small></span>" +
        '<span class="res-score">' + scoreHTML(m) + "</span>" +
        (r ? '<span class="res-r res-' + r + '" title="' + (r === "W" ? "Win" : r === "L" ? "Defeat" : "Draw") + '">' + r + "</span>" : '<span class="res-r res-na" title="No result recorded">–</span>') +
        '<span class="res-meta">' +
          (m.outcomeText ? '<span class="res-out">' + esc(m.outcomeText) + "</span>" : "") +
          (ours ? '<span class="res-goals">' + esc(ours) + "</span>" : "") +
          (theirs ? '<span class="res-opp">' + esc(m.opp) + ": " + esc(theirs) + "</span>" : "") +
          ((m.agg || m.tactic || m.highlight || m.potm || m.best) ? '<span class="res-tags">' +
            (m.highlight ? '<span class="tag tag-hl">' + esc(m.highlight) + "</span>" : "") +
            (m.agg ? '<span class="tag">Agg ' + esc(m.agg) + "</span>" : "") +
            (m.tactic ? '<span class="tag">' + esc(m.tactic) + "</span>" : "") +
            (m.potm ? '<span class="tag">MOTM ' + esc(m.potm) + "</span>" : m.best ? '<span class="tag">Best ' + esc(m.best) + "</span>" : "") +
          "</span>" : "") +
          (m.story ? '<span class="res-story">' + esc(m.story) + "</span>" : "") +
          (m.report ? '<details class="res-report"><summary>Match report</summary>' + reportHTML(m) + "</details>" : "") +
        "</span></li>";
    }).join("") + "</ol>";
    $("#results-list").innerHTML = html;
  }

  /* ---------- League table ---------- */
  function leagueTable(s) {
    var t = s.table, rel = t.relegation || 0, n = t.rows.length;
    return '<div class="table-scroll"><table class="lt"><thead><tr>' +
      '<th scope="col" class="num">Pos</th><th scope="col">Club</th><th scope="col" class="num">W</th><th scope="col" class="num">D</th><th scope="col" class="num">L</th><th scope="col" class="num">GD</th><th scope="col" class="num">Pts</th>' +
      "</tr></thead><tbody>" + t.rows.map(function (r) {
        var us = r.club === s._club.name;
        var cls = (us ? "lt-us" : "") + (rel && r.pos > n - rel ? " lt-rel" : "");
        return '<tr class="' + cls + '"><td class="num">' + r.pos + "</td><td>" + esc(r.club) + (r.note ? ' <span class="lt-note">' + esc(r.note) + "</span>" : "") + "</td>" +
          ["w", "d", "l"].map(function (k) { return '<td class="num">' + (r[k] == null ? "—" : r[k]) + "</td>"; }).join("") +
          '<td class="num">' + (r.gd == null ? "—" : sign(r.gd)) + '</td><td class="num lt-pts">' + r.pts + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<p class="caption">' + esc(t.caption || "") + (rel ? " Bottom " + rel + " relegated." : "") + "</p>";
  }

  /* ---------- Leaderboard ---------- */
  function leaderboardShell(caption, withClub) {
    return '<div class="table-scroll"><table class="lb' + (withClub ? " lb-club" : "") + '"><thead><tr>' +
      '<th scope="col" class="num">#</th><th scope="col">Player</th>' + (withClub ? '<th scope="col">Club</th>' : "") +
      '<th scope="col" class="lb-col"><button type="button" data-sort="goals">Goals</button></th>' +
      '<th scope="col" class="lb-col"><button type="button" data-sort="assists">Assists</button></th>' +
      '<th scope="col" class="num"><button type="button" data-sort="ga">G+A</button></th>' +
      "</tr></thead><tbody></tbody></table></div>" +
      '<p class="caption">' + esc(caption) + "</p>";
  }

  // rows: {name, goals, assists, gMin?, aMin?, gUnknown?, aUnknown?, clubs?}
  function wireLeaderboard(table, rows, opts) {
    opts = opts || {};
    function g(x) { return x.goals == null ? (x.gMin || 0) : x.goals; }
    function a(x) { return x.assists == null ? (x.aMin || 0) : x.assists; }
    function gUnk(x) { return x.goals == null || !!x.gUnknown; }
    function aUnk(x) { return x.assists == null || !!x.aUnknown; }
    var maxBoth = Math.max.apply(null, rows.map(function (x) { return Math.max(g(x), a(x)); }).concat([1]));

    function val(x, key) {
      if (key === "ga") return g(x) + a(x);
      return key === "goals" ? g(x) : a(x);
    }

    function bar(v, unknown, cls) {
      if (unknown && !v) return '<span class="lb-in"><span class="lb-v">—</span><span class="lb-bar"></span></span>';
      return '<span class="lb-in"><span class="lb-v">' + v + (unknown ? "+" : "") + '</span><span class="lb-bar">' +
        (v > 0 ? '<i class="' + cls + '" style="width:' + (v / maxBoth * 100).toFixed(1) + '%"></i>' : "") + "</span></span>";
    }

    function draw(key) {
      var sorted = rows.slice().sort(function (p, q) { return val(q, key) - val(p, key) || val(q, "ga") - val(p, "ga") || val(q, "goals") - val(p, "goals") || p.name.localeCompare(q.name); });
      $("tbody", table).innerHTML = sorted.map(function (x, i) {
        var unk = gUnk(x) || aUnk(x);
        var ga = (gUnk(x) && aUnk(x) && !g(x) && !a(x)) ? "—" : (g(x) + a(x)) + (unk ? "+" : "");
        return '<tr><td class="num lb-rank">' + (i + 1) + '</td><td class="lb-name">' + esc(x.name) + "</td>" +
          (opts.withClub ? '<td class="lb-clubs">' + (x.clubs || []).map(function (c) { return clubBadge(c, true); }).join(" ") + "</td>" : "") +
          '<td class="lb-cell">' + bar(g(x), gUnk(x), "b-goals") + "</td>" +
          '<td class="lb-cell">' + bar(a(x), aUnk(x), "b-assists") + "</td>" +
          '<td class="num lb-ga">' + ga + "</td></tr>";
      }).join("");
      $all("th", table).forEach(function (th) {
        var b = $("button", th);
        if (!b) return;
        if (b.getAttribute("data-sort") === key) th.setAttribute("aria-sort", "descending"); else th.removeAttribute("aria-sort");
      });
    }

    $("thead", table).addEventListener("click", function (e) {
      var b = e.target.closest("button[data-sort]");
      if (b) draw(b.getAttribute("data-sort"));
    });
    draw(opts.sort || "ga");
  }

  /* ---------- Squad ---------- */
  function squadHTML(s) {
    var groups = [["GK", "Goalkeepers"], ["DEF", "Defenders"], ["MID", "Midfielders"], ["ATT", "Attackers"]];
    return '<div class="roster">' + groups.map(function (g) {
      var ps = s.squad.filter(function (p) { return p.group === g[0]; });
      if (!ps.length) return "";
      return '<div class="rg"><p class="rg-title">' + g[1] + " <span>" + ps.length + "</span></p><ul>" + ps.map(function (p) {
        var delta = p.from != null && p.ovr !== p.from ? '<span class="up" title="From ' + p.from + " to " + p.ovr + '">' + sign(p.ovr - p.from) + "</span>" : "<span></span>";
        return '<li><span class="ovr">' + p.ovr + '</span><span class="rp-name">' + esc(p.name) + "<small>" + esc(p.pos) + (p.age ? " · age " + p.age : "") + (p.role ? " · " + esc(p.role) : "") + "</small></span>" + delta + "</li>";
      }).join("") + "</ul></div>";
    }).join("") +
    (s.onLoan && s.onLoan.length ? '<div class="rg"><p class="rg-title">Out on loan</p><ul>' + s.onLoan.map(function (p) {
      return '<li class="loan"><span class="ovr">' + p.ovr + '</span><span class="rp-name">' + esc(p.name) + "<small>" + esc(p.pos) + " · " + esc(p.note) + "</small></span><span></span></li>";
    }).join("") + "</ul></div>" : "") + "</div>";
  }

  function tacticRecord(s, name) {
    var ms = (s.matches || []).filter(function (m) { return m.tactic === name && hasScore(m); });
    if (!ms.length) return "";
    var w = 0, d = 0, l = 0;
    ms.forEach(function (m) { var r = outcome(m); if (r === "W") w++; else if (r === "D") d++; else l++; });
    return "Record in " + plural(ms.length, "recorded match", "recorded matches") + ": " + w + "W " + d + "D " + l + "L";
  }

  /* ================================================================== */
  /* LINEUPS                                                             */
  /* ================================================================== */
  function lineupCard(lu, s) {
    var found = lu.match ? findMatch(lu.match) : null;
    var m = found && found.match, r = m ? outcome(m) : null;
    return '<article class="lucard">' +
      '<header class="lu-head"><p class="eyebrow">' + esc(lu.shape) + (lu.when ? " · " + esc(lu.when) : "") + "</p>" +
      '<h4 class="lu-title">' + esc(lu.title) + "</h4>" +
      (m ? '<a class="lu-match" href="#m-' + esc(m.id) + '">' + (r ? '<span class="res-r res-' + r + '">' + r + "</span> " : "") + esc(scoreText(m)) + "</a>" : "") +
      "</header>" +
      pitchHTML(lu.rows, { shape: lu.shape, club: s.club }) +
      (lu.bench ? '<p class="bench"><b>' + esc(lu.benchLabel || "Bench") + "</b> " + esc(lu.bench.join(" · ")) + "</p>" : "") +
      (lu.note ? '<p class="lu-note">' + esc(lu.note) + "</p>" : "") +
      "</article>";
  }

  function renderLineups() {
    $("#lineups-list").innerHTML = D.seasons.slice().reverse().map(function (s) {
      var body;
      if (s.lineups && s.lineups.length) {
        body = '<div class="lu-grid">' + s.lineups.map(function (lu) { return lineupCard(lu, s); }).join("") + "</div>";
      } else {
        body = '<div class="lu-missing"><p class="lu-miss-title">The full XI was not recovered for this season</p>' +
          '<p class="lu-miss-text">' + esc(s.lineupsNote || "No starting eleven survives in the archive.") + "</p>" +
          (s.core ? '<ul class="core">' + s.core.map(function (p) {
            return '<li><span class="pp-dot">' + esc(p.pos) + (p.captain ? '<b class="pp-c" title="Captain">C</b>' : "") + "</span><span><b>" + esc(p.name) + "</b><small>" + esc(p.note) + "</small></span></li>";
          }).join("") + "</ul>" : "") + "</div>";
      }
      return '<section class="lu-season" id="lineup-' + esc(s.id) + '">' +
        '<header class="lu-season-head">' + clubBadge(s.club) + '<h3 class="lu-season-title">' + esc(s.label) + " <span>" + esc(s.title) + "</span></h3></header>" +
        body + "</section>";
    }).join("");
  }

  /* ================================================================== */
  /* STATS                                                               */
  /* ================================================================== */
  var statsScope = "all";

  function scopeSeasons() {
    return statsScope === "all" ? D.seasons : D.seasons.filter(function (s) { return s.id === statsScope; });
  }

  function recorded(seasons) {
    var out = [];
    seasons.forEach(function (s) { (s.matches || []).forEach(function (m) { if (hasScore(m)) out.push(m); }); });
    return out;
  }

  function wdl(ms) {
    var t = { p: ms.length, w: 0, d: 0, l: 0, gf: 0, ga: 0, cs: 0 };
    ms.forEach(function (m) {
      var r = outcome(m);
      if (r === "W") t.w++; else if (r === "D") t.d++; else t.l++;
      t.gf += m.score[0]; t.ga += m.score[1];
      if (m.score[1] === 0) t.cs++;
    });
    return t;
  }

  function splitTable(title, rows) {
    return '<div class="table-scroll"><table class="lt st-table"><thead><tr><th scope="col">' + esc(title) + '</th><th scope="col" class="num">P</th><th scope="col" class="num">W</th><th scope="col" class="num">D</th><th scope="col" class="num">L</th><th scope="col" class="num">GF</th><th scope="col" class="num">GA</th><th scope="col" class="num">Win %</th><th scope="col" class="st-bar-h"><span class="sr">Record</span></th></tr></thead><tbody>' +
      rows.map(function (r) {
        var t = r.t;
        return "<tr><td>" + r.label + '</td><td class="num">' + t.p + '</td><td class="num">' + t.w + '</td><td class="num">' + t.d + '</td><td class="num">' + t.l + '</td><td class="num">' + t.gf + '</td><td class="num">' + t.ga + '</td><td class="num">' + pct(t.w, t.p) + "%</td>" +
          '<td class="st-bar"><span class="wdl" aria-hidden="true"><i class="wdl-w" style="flex:' + t.w + '"></i><i class="wdl-d" style="flex:' + t.d + '"></i><i class="wdl-l" style="flex:' + t.l + '"></i></span></td></tr>';
      }).join("") + "</tbody></table></div>";
  }

  function tiles(list) {
    return '<div class="stat-tiles">' + list.map(function (t) {
      return '<div class="stile"><span class="st-k">' + esc(t.k) + '</span><span class="st-v">' + esc(t.v) + "</span>" + (t.s ? '<span class="st-s">' + esc(t.s) + "</span>" : "") + "</div>";
    }).join("") + "</div>";
  }

  function rankList(rows, unit) {
    var max = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
    return '<ol class="rank">' + rows.map(function (r) {
      return '<li><span class="rk-name">' + r.label + '</span><span class="rk-bar"><i style="width:' + (r.v / max * 100).toFixed(1) + '%"></i></span><span class="rk-v">' + r.v + (unit ? " <small>" + esc(unit) + "</small>" : "") + "</span></li>";
    }).join("") + "</ol>";
  }

  var GA_CAPTION = "Ranked by goals + assists, all competitions. Select a column to sort. + means at least that many: some season totals were not retained.";

  function renderStats() {
    var body = $("#stats-body");
    var chips = [["all", "All seasons"]].concat(D.seasons.map(function (s) { return [s.id, s.label + " · " + s._club.short]; }));
    var html = '<div class="filters scope" role="tablist" aria-label="Season">' + chips.map(function (c) {
      return '<button type="button" role="tab" class="filter" data-scope="' + esc(c[0]) + '" aria-selected="' + (statsScope === c[0] ? "true" : "false") + '">' + esc(c[1]) + "</button>";
    }).join("") + "</div>";

    var seasons = scopeSeasons();
    var timing = null;

    // 1. Season comparison
    var cmpRows = seasons.map(function (s) {
      var L = s.league || {}, t = seasonTrophies(s);
      return '<tr><td><a href="#season-' + esc(s.id) + '">' + esc(s.label) + "</a></td><td>" + clubBadge(s.club, true) + '</td><td class="num">' + (L.position ? ordinal(L.position) : "—") + '</td><td class="num">' + L.p + '</td><td class="num">' + L.w + '</td><td class="num">' + L.d + '</td><td class="num">' + L.l + '</td><td class="num">' + L.gf + '</td><td class="num">' + L.ga + '</td><td class="num">' + L.pts + '</td><td class="num">' + (L.pts / L.p).toFixed(2) + '</td><td class="num">' + pct(L.w, L.p) + '%</td><td class="num">' + (s.allComps && s.allComps.p ? s.allComps.p : "—") + '</td><td class="num">' + t + "</td></tr>";
    }).join("");
    var T = sumLeague(seasons);
    var totalRow = seasons.length > 1 ? '<tr class="lt-total"><td>Total</td><td></td><td></td><td class="num">' + T.p + '</td><td class="num">' + T.w + '</td><td class="num">' + T.d + '</td><td class="num">' + T.l + '</td><td class="num">' + T.gf + '</td><td class="num">' + T.ga + '</td><td class="num">' + T.pts + '</td><td class="num">' + (T.pts / T.p).toFixed(2) + '</td><td class="num">' + pct(T.w, T.p) + '%</td><td></td><td class="num">' + sum(seasons.map(seasonTrophies)) + "</td></tr>" : "";
    html += block("League", "Season by season",
      '<div class="table-scroll"><table class="lt cmp"><thead><tr><th scope="col">Season</th><th scope="col">Club</th><th scope="col" class="num">Pos</th><th scope="col" class="num">P</th><th scope="col" class="num">W</th><th scope="col" class="num">D</th><th scope="col" class="num">L</th><th scope="col" class="num">GF</th><th scope="col" class="num">GA</th><th scope="col" class="num">Pts</th><th scope="col" class="num">PPG</th><th scope="col" class="num">Win %</th><th scope="col" class="num">All games</th><th scope="col" class="num">Trophies</th></tr></thead><tbody>' + cmpRows + totalRow + "</tbody></table></div>" +
      (statsScope === "all" ? '<p class="mini-title mini-gap">League points by season</p><div class="chart" id="pts-chart"></div>' : ""));

    // 2. Goals + assists leaders
    html += block("Goals + assists", statsScope === "all" ? "All-time leaders" : "Season leaders",
      (statsScope === "all" && clubKeys.length > 1 ? '<div class="filters" id="ga-club" role="group" aria-label="Club">' +
        [["", "All clubs"]].concat(clubKeys.map(function (k) { return [k, club(k).name]; })).map(function (c, i) {
          return '<button type="button" class="filter" data-club="' + esc(c[0]) + '" aria-pressed="' + (i === 0 ? "true" : "false") + '">' + esc(c[1]) + "</button>";
        }).join("") + "</div>" : "") +
      '<div id="ga-board"></div>');

    // 3. What the match records say
    var ms = recorded(seasons);
    var dated = ms.length && ms.every(function (m) { return ISO.test(m.date); });
    if (ms.length) {
      var t = wdl(ms);
      var big = ms.filter(function (m) { return outcome(m) === "W"; }).sort(function (a, b) { return (b.score[0] - b.score[1]) - (a.score[0] - a.score[1]) || b.score[0] - a.score[0]; })[0];
      var heavy = ms.filter(function (m) { return outcome(m) === "L"; }).sort(function (a, b) { return (b.score[1] - b.score[0]) - (a.score[1] - a.score[0]); })[0];
      var xgMs = ms.filter(function (m) { return m.matchStats && m.oppStats && m.matchStats.xg != null && m.oppStats.xg != null; });
      var possMs = ms.filter(function (m) { return m.matchStats && m.matchStats.possession != null; });
      var tileList = [
        { k: "Matches on record", v: t.p, s: t.w + "W " + t.d + "D " + t.l + "L · " + pct(t.w, t.p) + "% won" },
        { k: "Goals", v: t.gf + "–" + t.ga, s: (t.gf / t.p).toFixed(2) + " scored per game" },
        { k: "Clean sheets", v: t.cs, s: pct(t.cs, t.p) + "% of matches" }
      ];
      if (dated) {
        var run = 0, best = 0;
        ms.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).forEach(function (m) {
          if (outcome(m) !== "L") { run++; best = Math.max(best, run); } else run = 0;
        });
        tileList.push({ k: "Longest unbeaten run", v: best, s: "matches, all competitions" });
      }
      if (big) tileList.push({ k: "Biggest win", v: big.score[0] + "–" + big.score[1], s: "v " + big.opp + " · " + big._s.label });
      if (heavy) tileList.push({ k: "Heaviest defeat", v: heavy.score[0] + "–" + heavy.score[1], s: "v " + heavy.opp + " · " + heavy._s.label });
      if (xgMs.length) {
        var xf = sum(xgMs.map(function (m) { return m.matchStats.xg; })), xa = sum(xgMs.map(function (m) { return m.oppStats.xg; }));
        tileList.push({ k: "Expected goals", v: xf.toFixed(1) + "–" + xa.toFixed(1), s: "xG for and against, " + xgMs.length + " matches" });
      }
      if (possMs.length) tileList.push({ k: "Average possession", v: Math.round(sum(possMs.map(function (m) { return m.matchStats.possession; })) / possMs.length) + "%", s: "across " + possMs.length + " matches" });

      var byComp = COMP_ORDER.map(function (k) {
        var list = ms.filter(function (m) { return m.comp === k; });
        return list.length ? { label: esc(comp(k).name), t: wdl(list) } : null;
      }).filter(Boolean);
      var byVenue = [["H", "Home"], ["A", "Away"], ["N", "Neutral"]].map(function (v) {
        var list = ms.filter(function (m) { return m.venue === v[0]; });
        return list.length ? { label: v[1], t: wdl(list) } : null;
      }).filter(Boolean);

      html += block("Match records", "What the results say", tiles(tileList) +
        '<div class="split-2"><div><p class="mini-title">By competition</p>' + splitTable("Competition", byComp) + "</div>" +
        '<div><p class="mini-title">Home and away</p>' + splitTable("Venue", byVenue) + "</div></div>" +
        '<p class="caption">Built from the ' + t.p + " matches with a recorded score" + (seasons.some(function (s) { return s.id === "2026-27"; }) ? "; 2026/27 kept only its final" : "") + ". The league table above comes from the season records and covers every game.</p>");

      // Goal timing
      var timed = [];
      ms.forEach(function (m) { (m.goals || []).forEach(function (g) { if (g.min != null) timed.push(g); }); });
      if (timed.length) {
        var bands = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75], [76, 90], [91, 120]];
        var labels = ["1–15", "16–30", "31–45", "46–60", "61–75", "76–90", "ET"];
        var forB = bands.map(function (b) { return timed.filter(function (g) { return g.side === "us" && g.min >= b[0] && g.min <= b[1]; }).length; });
        var agB = bands.map(function (b) { return timed.filter(function (g) { return g.side === "them" && g.min >= b[0] && g.min <= b[1]; }).length; });
        if (!forB[6] && !agB[6]) { labels.pop(); forB.pop(); agB.pop(); }
        var ours = timed.filter(function (g) { return g.side === "us"; });
        var late = ours.filter(function (g) { return g.min >= 76; }).length;
        timing = { labels: labels, forB: forB, agB: agB };
        html += block("Timing", "When the goals come",
          '<div class="chart" id="timing-chart"></div>' +
          '<p class="caption">' + timed.length + " goals with a recorded minute. " + late + " of " + ours.length + " of ours came from the 76th minute on.</p>" +
          tableView(["Minutes", "Scored", "Conceded"], labels.map(function (l, i) { return [l, forB[i], agB[i]]; })));
      }

      // Partnerships, MOTM, bookings
      var duos = {}, motm = {}, cards = {};
      ms.forEach(function (m) {
        var s = m._s;
        ourGoals(m).forEach(function (g) {
          if (!g.assist || !g.player) return;
          var k = canon(s, g.assist) + " → " + canon(s, g.player);
          duos[k] = (duos[k] || 0) + 1;
        });
        if (m.potm) { var n = canon(s, m.potm.replace(/\s+\d+(\.\d+)?$/, "")); motm[n] = (motm[n] || 0) + 1; }
        (m.cards || []).forEach(function (c) { var n2 = canon(s, c); cards[n2] = (cards[n2] || 0) + 1; });
      });
      var top = function (obj, n) {
        return Object.keys(obj).map(function (k) { return { label: esc(k), v: obj[k] }; })
          .sort(function (a, b) { return b.v - a.v || a.label.localeCompare(b.label); }).slice(0, n);
      };
      var cols = "";
      var dz = top(duos, 8);
      if (dz.length) cols += '<div><p class="mini-title">Deadliest partnerships</p>' + rankList(dz, "goals") + '<p class="caption">Assist → scorer, from goals where both were recorded.</p></div>';
      var mz = top(motm, 8);
      if (mz.length) cols += '<div><p class="mini-title">Man of the Match awards</p>' + rankList(mz) + "</div>";
      var cz = top(cards, 8);
      if (cz.length) cols += '<div><p class="mini-title">Most booked</p>' + rankList(cz, "yellows") + "</div>";
      if (cols) html += block("Players", "Partnerships and honours", '<div class="split-3">' + cols + "</div>");

      // Tactics record
      var tacs = {};
      ms.forEach(function (m) { if (m.tactic) (tacs[m.tactic] = tacs[m.tactic] || []).push(m); });
      var tacRows = Object.keys(tacs).map(function (k) { return { label: esc(k), t: wdl(tacs[k]) }; }).sort(function (a, b) { return b.t.p - a.t.p || pct(b.t.w, b.t.p) - pct(a.t.w, a.t.p); });
      if (tacRows.length) html += block("Tactics", "Record by tactic", splitTable("Tactic", tacRows) + '<p class="caption">Only matches where the archive names the tactic.</p>');

      // Month by month (only when every match in scope has an exact date)
      if (dated) {
        var months = {};
        ms.forEach(function (m) { var mm = ISO.exec(m.date); (months[mm[1] + "-" + mm[2]] = months[mm[1] + "-" + mm[2]] || []).push(m); });
        var mk = Object.keys(months).sort();
        if (mk.length >= 3) {
          html += block("Form", "Month by month", '<div class="table-scroll"><table class="lt st-table"><thead><tr><th scope="col">Month</th><th scope="col" class="num">P</th><th scope="col" class="num">W</th><th scope="col" class="num">D</th><th scope="col" class="num">L</th><th scope="col" class="num">GF</th><th scope="col" class="num">GA</th><th scope="col">Results in order</th></tr></thead><tbody>' +
            mk.map(function (k) {
              var list = months[k].slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }), tt = wdl(list);
              return "<tr><td>" + MONTHS[+k.slice(5) - 1] + " " + k.slice(0, 4) + '</td><td class="num">' + tt.p + '</td><td class="num">' + tt.w + '</td><td class="num">' + tt.d + '</td><td class="num">' + tt.l + '</td><td class="num">' + tt.gf + '</td><td class="num">' + tt.ga + '</td><td class="form">' +
                list.map(function (m) { var r = outcome(m); return '<a class="res-r res-' + r + '" href="#m-' + esc(m.id) + '" title="' + esc(scoreText(m) + " · " + fmtDate(m.date)) + '">' + r + "</a>"; }).join("") + "</td></tr>";
            }).join("") + "</tbody></table></div>");
        }
      }
    }

    // 4. Development
    var risers = [];
    seasons.forEach(function (s) {
      (s.squad || []).forEach(function (p) { if (p.from != null && p.ovr > p.from) risers.push({ label: esc(p.name) + " <small>" + esc(s.label) + "</small>", v: p.ovr - p.from, from: p.from, to: p.ovr }); });
    });
    risers.sort(function (a, b) { return b.v - a.v || b.to - a.to; });
    if (risers.length) {
      html += block("Development", "Biggest rating rises", '<ol class="rank rank-dev">' + risers.slice(0, 10).map(function (r) {
        return '<li><span class="rk-name">' + r.label + '</span><span class="rk-bar"><i style="width:' + (r.v / risers[0].v * 100).toFixed(1) + '%"></i></span><span class="rk-v">+' + r.v + " <small>" + r.from + "→" + r.to + "</small></span></li>";
      }).join("") + "</ol>");
    }

    body.innerHTML = html;

    $all(".scope .filter", body).forEach(function (b) {
      b.addEventListener("click", function () { statsScope = b.getAttribute("data-scope"); renderStats(); });
    });

    function drawBoard(clubKey) {
      var rows = allTimeRows(seasons.filter(function (s) { return !clubKey || s.club === clubKey; }));
      $("#ga-board").innerHTML = leaderboardShell(GA_CAPTION, statsScope === "all");
      wireLeaderboard($(".lb", $("#ga-board")), rows.map(function (r) {
        return { name: r.name, goals: r.goals, assists: r.assists, gUnknown: r.gUnknown, aUnknown: r.aUnknown, clubs: r.clubs };
      }), { withClub: statsScope === "all" });
    }
    drawBoard("");
    var gc = $("#ga-club");
    if (gc) gc.addEventListener("click", function (e) {
      var b = e.target.closest(".filter");
      if (!b) return;
      $all(".filter", gc).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      drawBoard(b.getAttribute("data-club"));
    });

    var pc = $("#pts-chart");
    if (pc) {
      barChart(pc, {
        categories: D.seasons.map(function (s) { return s.label; }),
        series: [{ name: "League points", cls: "s-1", values: D.seasons.map(function (s) { return s.league ? s.league.pts : null; }) }],
        capLabels: true, height: 230,
        tipTitle: function (i) { return D.seasons[i].label + " · " + D.seasons[i]._club.name; },
        note: function (i) { var s = D.seasons[i]; return s.league ? ordinal(s.league.position) + " in the " + comp(s._leagueEntry.comp).name : ""; },
        aria: "League points by season: " + D.seasons.map(function (s) { return s.label + " " + (s.league ? s.league.pts : "unknown"); }).join(", ")
      });
    }
    var tc = $("#timing-chart");
    if (tc && timing) {
      barChart(tc, {
        categories: timing.labels,
        series: [
          { name: "Scored", cls: "s-1", values: timing.forB },
          { name: "Conceded", cls: "s-2", values: timing.agB }
        ],
        tipTitle: function (i) { return timing.labels[i] === "ET" ? "Extra time" : "Minutes " + timing.labels[i]; },
        height: 240,
        aria: "Goals scored and conceded by 15-minute period."
      });
    }
  }

  /* ================================================================== */
  /* HALL OF FAME                                                        */
  /* ================================================================== */
  var hofClub = "";

  function renderAllTimeXI() {
    var x = D.allTimeXI;
    if (!x) { $("#all-time-xi").innerHTML = ""; return; }
    var listed = [];
    x.rows.forEach(function (r) { r.forEach(function (p) { listed.push(p); }); });
    $("#all-time-xi").innerHTML = '<div class="atxi">' +
      '<div class="atxi-pitch">' + pitchHTML(x.rows, { shape: x.shape, showClub: true }) + "</div>" +
      '<div class="atxi-copy"><p class="eyebrow">All-time XI · ' + esc(x.shape) + "</p>" +
      '<h3 class="sblock-title">' + esc(x.title) + "</h3>" +
      '<p class="sec-lede">' + esc(x.note) + "</p>" +
      '<ol class="atxi-list">' + listed.map(function (p) {
        return '<li><span class="atxi-pos">' + esc(p.pos) + '</span><span class="atxi-main"><span class="atxi-name">' + esc(p.full || p.name) + (p.captain ? " (C)" : "") + "</span>" +
          (p.why ? '<span class="atxi-why">' + esc(p.why) + "</span>" : "") + "</span>" + clubBadge(p.club, true) + "</li>";
      }).join("") + "</ol>" +
      (x.bench ? '<p class="bench"><b>Bench</b> ' + x.bench.map(function (b) { return esc(b.name) + ' <span class="bench-club">' + esc(club(b.club).tag || club(b.club).short) + "</span>"; }).join(" · ") + "</p>" : "") +
      "</div></div>";
  }

  function renderHOFFilters() {
    var f = $("#hof-filters");
    var opts = [["", "All clubs"]].concat(clubKeys.map(function (k) { return [k, club(k).name]; }));
    f.innerHTML = opts.map(function (o) {
      return '<button type="button" class="filter" data-club="' + esc(o[0]) + '" aria-pressed="' + (hofClub === o[0] ? "true" : "false") + '">' + esc(o[1]) + "</button>";
    }).join("");
    f.addEventListener("click", function (e) {
      var b = e.target.closest(".filter");
      if (!b) return;
      hofClub = b.getAttribute("data-club");
      $all(".filter", f).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      renderHOF();
    });
  }

  function renderHOF() {
    var list = (D.hallOfFame || []).map(function (p) { return { p: p, c: playerCareer(p.name) }; })
      .filter(function (o) { return !hofClub || o.c.clubs.indexOf(hofClub) >= 0; });
    function card(o, big) {
      var p = o.p, c = o.c, aw = awardsFor(p.name);
      return '<article class="plaque' + (big ? " plaque-legend" : "") + '">' +
        '<span class="pl-water" aria-hidden="true">' + esc(surname(p.name)) + "</span>" +
        '<div class="pl-top"><span class="pl-mono" aria-hidden="true">' + esc(initials(p.name)) + "</span>" +
          '<span class="pl-clubs">' + c.clubs.map(function (k) { return clubBadge(k, true); }).join("") + "</span>" +
          (c.ovr ? '<span class="pl-ovr" title="Latest overall rating">' + c.ovr + "<small>OVR</small></span>" : "") + "</div>" +
        '<p class="pl-epithet">' + esc(p.epithet) + "</p>" +
        '<h3 class="pl-name">' + esc(p.name) + "</h3>" +
        '<p class="pl-pos">' + esc(p.position) + " · Inducted " + esc(p.inducted) + "</p>" +
        (aw.length ? '<p class="pl-awards">' + aw.map(function (a) { return '<span class="tag tag-hl">' + esc(a.award + " " + a.season) + "</span>"; }).join("") + "</p>" : "") +
        '<p class="pl-cite">' + esc(p.citation) + "</p>" +
        '<dl class="pl-stats">' + plaqueStats(c).map(function (s) { return "<div><dt>" + s[1] + "</dt><dd>" + s[0] + "</dd></div>"; }).join("") + "</dl>" +
        ((c.gUnknown || c.aUnknown) ? '<p class="pl-foot">+ includes a season whose totals were not retained</p>' : "") +
        "</article>";
    }
    var legends = list.filter(function (o) { return o.p.tier === "legend"; });
    var others = list.filter(function (o) { return o.p.tier !== "legend"; });
    $("#hof-legends").innerHTML = legends.map(function (o) { return card(o, true); }).join("");
    $("#hof-grid").innerHTML = others.map(function (o) { return card(o, false); }).join("") ||
      (legends.length ? "" : '<p class="shelf-empty">No inductees from this club yet.</p>');
  }

  /* ================================================================== */
  /* RECORDS, TIMELINE, FOOTER                                           */
  /* ================================================================== */
  function renderRecords() {
    $("#records-grid").innerHTML = (D.records || []).map(function (r, i) {
      return '<article class="rec' + (i === 0 ? " rec-hero" : "") + '">' +
        '<p class="rec-v">' + esc(r.value) + (r.unit ? "<small>" + esc(r.unit) + "</small>" : "") + "</p>" +
        '<p class="rec-l">' + esc(r.label) + "</p>" +
        '<p class="rec-d">' + esc(r.detail) + "</p>" +
        '<p class="rec-s">' + esc(r.season) + (r.club ? " · " + esc(club(r.club).name) : "") + "</p></article>";
    }).join("");
  }

  function renderTimeline() {
    var html = "";
    D.seasons.forEach(function (s) {
      var hs = (s.matches || []).filter(function (m) { return m.highlight; })
        .map(function (m, i) { return { m: m, i: i, k: ISO.test(m.date) ? m.date : "9999" }; })
        .sort(function (a, b) { return a.k < b.k ? -1 : a.k > b.k ? 1 : a.i - b.i; })
        .map(function (o) { return o.m; });
      if (!hs.length) return;
      html += '<li class="tl-season"><span class="tl-label">' + esc(s.label) + "</span> " + esc(s.title) + " " + clubBadge(s.club, true) + "</li>";
      hs.forEach(function (m) {
        var r = outcome(m);
        html += '<li class="tl-item' + (isShowpiece(m) ? (r === "W" ? " tl-final" : " tl-final-lost") : "") + '">' +
          '<span class="tl-dot" aria-hidden="true"></span>' +
          '<div class="tl-headcol">' +
            '<p class="tl-when">' + esc(fmtDate(m.date)) + " · " + esc(comp(m.comp).name) + (m.round && m.round !== "League" ? ", " + esc(m.round) : "") + "</p>" +
            '<h3 class="tl-title">' + esc(m.highlight) + "</h3>" +
            '<p class="tl-score">' + (r ? '<span class="res-r res-' + r + '">' + r + "</span> " : "") + esc(scoreText(m)) + "</p>" +
          "</div>" +
          '<div class="tl-body">' +
            (m.story ? '<p class="tl-story">' + esc(m.story) + "</p>" : "") +
            '<a class="tl-link" href="#m-' + esc(m.id) + '">Match details</a>' +
          "</div></li>";
      });
    });
    $("#timeline-list").innerHTML = html;
  }

  function renderFooter() {
    var a = D.manager.archive || {};
    $("#footer-meta").innerHTML =
      '<p><span class="fm-k">Archive</span> Save ' + esc(a.save || "") + " · " + esc(fmtDate(a.date)) + (a.note ? " · " + esc(a.note) : "") + "</p>" +
      ((D.manager.pending || []).length ? '<p><span class="fm-k">Pending</span> ' + D.manager.pending.map(esc).join(" ") + "</p>" : "") +
      '<p><span class="fm-k">Next chapter</span> Season ' + (D.seasons.length + 1) + " to be written.</p>";
  }

  /* ================================================================== */
  /* Tabs and deep links                                                 */
  /* ================================================================== */
  var PAGES = ["overview", "cabinet", "seasons", "lineups", "stats", "hall-of-fame", "records", "timeline"];
  var rendered = {};
  var RENDER = {
    overview: function () { renderHero(); renderLED(); renderJourney(); renderHonours(); renderExplore(); },
    cabinet: renderCabinet,
    seasons: function () { renderSeasonTabs(); selectSeason(D.seasons[D.seasons.length - 1].id); },
    lineups: renderLineups,
    stats: renderStats,
    "hall-of-fame": function () { renderAllTimeXI(); renderHOFFilters(); renderHOF(); },
    records: renderRecords,
    timeline: renderTimeline
  };

  function openPage(page) {
    if (PAGES.indexOf(page) < 0) page = "overview";
    $all(".page").forEach(function (p) { p.hidden = p.getAttribute("data-page") !== page; });
    $all(".nav a").forEach(function (a) {
      if (a.getAttribute("data-page") === page) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    if (!rendered[page]) { rendered[page] = true; RENDER[page](); }
    var nav = $("#nav"), link = $('.nav a[data-page="' + page + '"]');
    if (nav && link && nav.scrollWidth > nav.clientWidth) {
      var l = link.offsetLeft - nav.offsetLeft, w = link.offsetWidth;
      if (l < nav.scrollLeft || l + w > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = Math.max(0, l - 16);
    }
  }

  function setHash(id) {
    try { history.replaceState(null, "", "#" + id); } catch (e) { /* sandboxed frames may refuse */ }
  }

  function pushHash(id) {
    try { history.pushState(null, "", "#" + id); } catch (e) { setHash(id); }
  }

  function scrollToEl(el, smooth) {
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.pageYOffset - 76;
    window.scrollTo({ top: Math.max(0, top), behavior: smooth && !reduceMotion ? "smooth" : "auto" });
  }

  function flash(el) {
    if (!el) return;
    el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
  }

  function route(hash, smooth) {
    var id = (hash || "").replace(/^#/, "");
    if (!id || id === "top" || id === "main" || id === "overview") { openPage("overview"); window.scrollTo(0, 0); return; }
    if (id === "honours") { openPage("overview"); scrollToEl($("#honours"), smooth); return; }
    if (id.indexOf("season-") === 0) {
      openPage("seasons"); selectSeason(id.slice(7));
      scrollToEl($("#season-tabs"), smooth); return;
    }
    if (id.indexOf("m-") === 0) {
      var f = findMatch(id.slice(2));
      openPage("seasons");
      if (!f) return;
      selectSeason(f.season.id);
      if (!isShowpiece(f.match)) {
        var key = f.match._friendly ? "pre" : f.match.comp;
        var btn = $('.filter[data-comp="' + key + '"]', $("#season-panel"));
        if (btn && btn.getAttribute("aria-selected") !== "true") btn.click();
      }
      var el = document.getElementById(id);
      scrollToEl(el, smooth); flash(el);
      return;
    }
    if (id.indexOf("lineup-") === 0) {
      openPage("lineups");
      var lu = document.getElementById(id);
      scrollToEl(lu, smooth); flash(lu);
      return;
    }
    openPage(PAGES.indexOf(id) >= 0 ? id : "overview");
    window.scrollTo(0, 0);
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[href^='#']");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    var h = a.getAttribute("href");
    if (h === "#main" || h === "#") return;
    e.preventDefault();
    pushHash(h.slice(1));
    route(h, true);
  });
  window.addEventListener("popstate", function () { route(location.hash, false); });

  renderFooter();
  route(location.hash, false);
})();
