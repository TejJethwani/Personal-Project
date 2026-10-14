/* The Tej Era: renders every section from window.TEJ_ERA (data/career.js). */
(function () {
  "use strict";

  var D = window.TEJ_ERA;
  if (!D) return;

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtDate(d) {
    if (!d) return "";
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
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

  function comp(key) {
    return (D.competitions && D.competitions[key]) || { name: key, short: key, trophy: "cup", metal: "silver" };
  }

  function initials(name) {
    return name.split(/\s+/).map(function (p) { return p.charAt(0); }).join("").slice(0, 2).toUpperCase();
  }

  function surname(name) {
    var parts = name.split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(" ") : name;
  }

  function sign(n) { return n > 0 ? "+" + n : String(n); }

  function findMatch(id) {
    for (var i = 0; i < D.seasons.length; i++) {
      var ms = D.seasons[i].matches || [];
      for (var j = 0; j < ms.length; j++) if (ms[j].id === id) return { season: D.seasons[i], match: ms[j] };
    }
    return null;
  }

  function outcome(m) {
    var s = m.score;
    if (m.pens) return m.pens[0] > m.pens[1] ? "W" : "L";
    return s[0] > s[1] ? "W" : s[0] < s[1] ? "L" : "D";
  }

  // Home side first; neutral-venue games list United first.
  function sides(m) {
    var club = D.manager.clubShort || "United";
    if (m.venue === "A") return { home: m.opp, away: club, hs: m.score[1], as: m.score[0], usHome: false };
    return { home: club, away: m.opp, hs: m.score[0], as: m.score[1], usHome: true };
  }

  function scoreHTML(m) {
    var s = sides(m);
    return '<span class="t' + (s.usHome ? " us" : "") + '">' + esc(s.home) + "</span>" +
      '<span class="sc">' + s.hs + "–" + s.as + "</span>" +
      '<span class="t' + (s.usHome ? "" : " us") + '">' + esc(s.away) + "</span>";
  }

  function scoreText(m) {
    var s = sides(m);
    return s.home + " " + s.hs + "–" + s.as + " " + s.away + (m.aet ? " (AET)" : "");
  }

  function goalLine(g) {
    return g.player + " " + g.min + "'" + (g.assist ? " (" + g.assist + ")" : "");
  }

  function scorersText(m) {
    if (m.goals) {
      return m.goals.filter(function (g) { return g.side === "us"; }).map(goalLine).join(", ");
    }
    return m.scorers || "";
  }

  function theirScorersText(m) {
    if (m.goals) {
      return m.goals.filter(function (g) { return g.side === "them"; }).map(goalLine).join(", ");
    }
    return m.theirScorers || "";
  }

  /* ------------------------------------------------------------------ */
  /* Derived career data                                                 */
  /* ------------------------------------------------------------------ */
  var honours = [];
  D.seasons.forEach(function (s) {
    (s.competitions || []).forEach(function (c) {
      if (!c.won) return;
      var found = c.final ? findMatch(c.final) : null;
      honours.push({ season: s, entry: c, comp: comp(c.comp), match: found ? found.match : null });
    });
  });

  var compOrder = Object.keys(D.competitions || {});

  var countsByComp = {};
  honours.forEach(function (h) { countsByComp[h.entry.comp] = (countsByComp[h.entry.comp] || 0) + 1; });

  var league = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
  D.seasons.forEach(function (s) {
    if (!s.league) return;
    ["p", "w", "d", "l", "gf", "ga", "pts"].forEach(function (k) { league[k] += s.league[k] || 0; });
  });

  var finals = [];
  D.seasons.forEach(function (s) {
    (s.matches || []).forEach(function (m) { if (m.round === "Final") finals.push({ season: s, match: m }); });
  });
  var finalsWon = finals.filter(function (f) { return outcome(f.match) === "W"; }).length;

  function seasonTrophies(s) {
    return (s.competitions || []).filter(function (c) { return c.won; }).length;
  }

  function playerCareer(name) {
    var out = { goals: 0, assists: 0, gUnknown: false, aUnknown: false, seasons: 0, trophies: 0, ovr: null, labels: [] };
    D.seasons.forEach(function (s) {
      var st = (s.stats || []).filter(function (x) { return x.name === name; })[0];
      var sq = (s.squad || []).filter(function (x) { return x.name === name; })[0];
      if (!st && !sq) return;
      out.seasons++;
      out.labels.push(s.label);
      out.trophies += seasonTrophies(s);
      if (sq && sq.ovr) out.ovr = sq.ovr;
      if (st) {
        if (st.goals == null) out.gUnknown = true; else out.goals += st.goals;
        if (st.assists == null) out.aUnknown = true; else out.assists += st.assists;
      } else if (!(s.stats && s.stats.length)) {
        out.gUnknown = out.aUnknown = true;
      }
    });
    return out;
  }

  function topScorer(s) {
    var best = null;
    (s.stats || []).forEach(function (x) {
      if (x.goals != null && (!best || x.goals > best.goals)) best = x;
    });
    return best;
  }

  /* ------------------------------------------------------------------ */
  /* Trophy drawings (viewBox 0 0 120 170)                               */
  /* ------------------------------------------------------------------ */
  function plinth() {
    return '<rect x="24" y="146" width="72" height="20" rx="2" fill="url(#g-plinth)"/>' +
      '<rect x="24" y="146" width="72" height="2.5" fill="url(#g-gold)" opacity=".75"/>' +
      '<rect x="46" y="152" width="28" height="8" rx="1" fill="url(#g-gold)" opacity=".55"/>';
  }

  var TROPHY = {
    ucl: function (f) {
      return '<g fill="none" stroke="' + f + '" stroke-width="6.5" stroke-linecap="round">' +
        '<path d="M40 20 C 4 6, -1 68, 47 72"/><path d="M80 20 C 116 6, 121 68, 73 72"/></g>' +
        '<g fill="' + f + '">' +
        '<path d="M37 13 H83 C83 52 75 75 60 83 C45 75 37 52 37 13 Z"/>' +
        '<path d="M55 82 H65 L63 103 H57 Z"/><ellipse cx="60" cy="104" rx="9" ry="3.6"/>' +
        '<path d="M53 106 H67 L82 136 H38 Z"/><rect x="34" y="135" width="52" height="11" rx="1.5"/></g>' +
        '<ellipse cx="60" cy="13" rx="23" ry="3.2" fill="#fff" opacity=".55"/>' +
        '<path d="M48 22 C 48 50 52 66 58 74" stroke="#fff" stroke-width="2.5" fill="none" opacity=".45" stroke-linecap="round"/>';
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
        '<path d="M42 64 C 42 82 48 96 56 101" stroke="#fff" stroke-width="2.5" fill="none" opacity=".45" stroke-linecap="round"/>';
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
        '<path d="M47 38 C 47 62 51 82 57 92" stroke="#fff" stroke-width="2.5" fill="none" opacity=".45" stroke-linecap="round"/>';
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
      draw(fill) + (opts.ghost ? "" : plinth()) + "</svg>";
  }

  /* ------------------------------------------------------------------ */
  /* Hero                                                                */
  /* ------------------------------------------------------------------ */
  function renderHero() {
    var m = D.manager;
    $("#hero-kicker").textContent = "Manager · " + m.club + " · " + m.since + "–present";

    var parts = compOrder.filter(function (k) { return countsByComp[k]; }).map(function (k) {
      var n = countsByComp[k];
      return (n > 1 ? word(n) + " " + comp(k).name + " titles" : "the " + comp(k).name);
    });
    var list = parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0];
    $("#hero-lede").textContent =
      cap(word(honours.length)) + " major trophies in " + word(D.seasons.length) + " seasons: " + list + ". " + m.philosophy;

    var winPct = league.p ? Math.round((league.w / league.p) * 100) : 0;
    var ppg = league.p ? (league.pts / league.p).toFixed(2) : "0";
    var stats = [
      ["SEA", D.seasons.length, "Seasons managed"],
      ["WIN", winPct + "%", "League win rate (" + league.w + " of " + league.p + ")"],
      ["PPG", ppg, "League points per game"],
      ["UCL", countsByComp.ucl || 0, "Champions League titles"],
      ["PL", countsByComp.pl || 0, "Premier League titles"],
      ["FIN", finalsWon + "/" + finals.length, "Cup finals won"]
    ];

    $("#manager-card").innerHTML =
      '<div class="mc-shine" aria-hidden="true"></div>' +
      '<div class="mc-top">' +
        '<div class="mc-big"><span class="mc-num">' + honours.length + '</span><span class="mc-numlab">Trophies</span></div>' +
        '<div class="mc-role"><span>MGR</span><span class="mc-since">Est. ' + esc(m.since) + "</span></div>" +
      "</div>" +
      '<div class="mc-crest" aria-hidden="true"><span>TJ</span></div>' +
      '<p class="mc-name">' + esc(m.name) + "</p>" +
      '<p class="mc-club">' + esc(m.club) + "</p>" +
      '<dl class="mc-stats">' + stats.map(function (s) {
        return '<div title="' + esc(s[2]) + '"><dt><abbr title="' + esc(s[2]) + '">' + s[0] + '</abbr></dt><dd>' + esc(s[1]) + "</dd></div>";
      }).join("") + "</dl>";

    // Pointer tilt on the card
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

  /* ------------------------------------------------------------------ */
  /* LED board                                                           */
  /* ------------------------------------------------------------------ */
  function renderLED() {
    var items = [];
    honours.forEach(function (h) {
      var line = h.comp.name + " " + (h.entry.stage === "Champions" ? "champions" : "winners") + " " + h.season.label;
      if (h.match && h.match.round === "Final") line += " · " + scoreText(h.match);
      else if (h.entry.comp === "pl" && h.season.league) line += " · " + h.season.league.pts + " pts";
      items.push(line);
    });
    (D.records || []).forEach(function (r) {
      if (r.ticker) items.push(r.value + (r.unit ? " " + r.unit : "") + " · " + r.label + " " + r.season);
    });
    var html = items.map(function (t) { return '<span class="led-item">' + esc(t) + "</span>"; }).join("");
    $("#led-track").innerHTML =
      '<div class="led-run">' + html + "</div>" +
      '<div class="led-run" aria-hidden="true">' + html + "</div>";
  }

  /* ------------------------------------------------------------------ */
  /* Trophy cabinet                                                      */
  /* ------------------------------------------------------------------ */
  function renderCabinet() {
    $("#cabinet-lede").textContent =
      cap(word(honours.length)) + " major trophies in " + word(D.seasons.length) + " completed seasons. Select a trophy to relive the night it was won.";

    $("#cabinet-counts").innerHTML = compOrder.filter(function (k) { return countsByComp[k]; }).map(function (k) {
      return '<span class="count-chip"><b>' + countsByComp[k] + "×</b> " + esc(comp(k).name) + "</span>";
    }).join("");

    $("#cabinet-shelf").innerHTML = honours.map(function (h, i) {
      var c = h.comp, detail, sub;
      if (h.match && h.match.round === "Final") {
        detail = scoreText(h.match);
        sub = fmtDate(h.match.date) + (h.match.ground ? " · " + h.match.ground : "");
      } else if (h.entry.comp === "pl" && h.season.league) {
        var L = h.season.league;
        detail = L.pts + " points · " + L.w + "W " + L.d + "D " + L.l + "L";
        sub = h.match ? "Clinched " + fmtDate(h.match.date) + " v " + h.match.opp : "";
      } else {
        detail = h.entry.note || "";
        sub = "";
      }
      var target = h.match ? "m-" + h.match.id : "season-" + h.season.id;
      return '<a class="bay" href="#' + esc(target) + '" data-season="' + esc(h.season.id) + '" style="--i:' + i + '">' +
        '<span class="bay-light" aria-hidden="true"></span>' +
        '<span class="bay-trophy">' + trophySVG(c) + "</span>" +
        '<span class="bay-plaque">' +
          '<span class="bay-season">' + esc(h.season.label) + "</span>" +
          '<span class="bay-comp">' + esc(c.name) + "</span>" +
          '<span class="bay-detail">' + esc(detail) + "</span>" +
          (sub ? '<span class="bay-sub">' + esc(sub) + "</span>" : "") +
        "</span></a>";
    }).join("");

    // Competitions entered but not yet won
    var vacant = compOrder.filter(function (k) { return !countsByComp[k]; }).map(function (k) {
      var runs = [];
      D.seasons.forEach(function (s) {
        (s.competitions || []).forEach(function (c) { if (c.comp === k) runs.push(c.stage + " " + s.label); });
      });
      return { key: k, runs: runs };
    }).filter(function (v) { return v.runs.length; });

    $("#cabinet-vacant").innerHTML = vacant.length ? (
      '<p class="vacant-head">Space reserved</p><div class="vacant-row">' +
      vacant.map(function (v) {
        return '<div class="vacant-item"><span class="vacant-trophy">' + trophySVG(comp(v.key), { ghost: true }) + "</span>" +
          '<span class="vacant-copy"><span class="vacant-comp">' + esc(comp(v.key).name) + "</span>" +
          '<span class="vacant-runs">Still to win. ' + esc(v.runs.join(" · ")) + "</span></span></div>";
      }).join("") + "</div>") : "";
  }

  /* ------------------------------------------------------------------ */
  /* Honours board + career totals                                       */
  /* ------------------------------------------------------------------ */
  function renderHonours() {
    var head = '<tr><th scope="col">Season</th>' + compOrder.map(function (k) {
      return '<th scope="col">' + esc(comp(k).name) + "</th>";
    }).join("") + '<th scope="col">Top scorer</th></tr>';

    var rows = D.seasons.slice().reverse().map(function (s) {
      var cells = compOrder.map(function (k) {
        var c = (s.competitions || []).filter(function (x) { return x.comp === k; })[0];
        if (!c) return '<td class="hb-none">—</td>';
        var extra = (k === "pl" && s.league) ? '<span class="hb-extra">' + s.league.pts + " pts</span>" : "";
        return '<td class="' + (c.won ? "hb-won" : "") + '" title="' + esc(c.note || "") + '">' +
          (c.won ? '<span class="hb-star" aria-hidden="true">★</span>' : "") +
          '<span class="hb-stage">' + esc(c.stage) + "</span>" + extra + "</td>";
      }).join("");
      var ts = topScorer(s);
      return '<tr><th scope="row"><a href="#season-' + esc(s.id) + '" data-season="' + esc(s.id) + '">' + esc(s.label) + "</a></th>" + cells +
        "<td>" + (ts ? esc(surname(ts.name)) + ' <span class="hb-extra">' + ts.goals + "</span>" : "—") + "</td></tr>";
    }).join("");

    $("#honours-board").innerHTML =
      '<div class="board-scroll"><table class="hb"><thead>' + head + "</thead><tbody>" + rows + "</tbody></table></div>";

    var tiles = [
      { v: league.p, k: "Premier League games", s: league.w + "W " + league.d + "D " + league.l + "L" },
      { v: league.pts, k: "League points", s: (league.pts / Math.max(league.p, 1)).toFixed(2) + " per game" },
      { v: league.gf, k: "League goals", s: league.ga + " conceded · " + sign(league.gf - league.ga) },
      { v: finalsWon + "/" + finals.length, k: "Cup finals won", s: finals.map(function (f) { return comp(f.match.comp).short + " " + f.season.label.slice(-2); }).join(" · ") },
      { v: honours.length, k: "Major trophies", s: (honours.length / D.seasons.length).toFixed(1) + " per season" }
    ];
    $("#career-stats").innerHTML = tiles.map(function (t) {
      return '<div class="cs"><span class="cs-v">' + esc(t.v) + '</span><span class="cs-k">' + esc(t.k) + '</span><span class="cs-s">' + esc(t.s) + "</span></div>";
    }).join("");
  }

  /* ------------------------------------------------------------------ */
  /* Season archive                                                      */
  /* ------------------------------------------------------------------ */
  var currentSeason = null;

  function renderSeasonTabs() {
    var wrap = $("#season-tabs");
    wrap.innerHTML = D.seasons.map(function (s, i) {
      return '<button type="button" role="tab" class="stab" id="tab-' + esc(s.id) + '" aria-controls="season-panel" data-season="' + esc(s.id) + '">' +
        '<span class="stab-n">Season ' + (i + 1) + "</span>" +
        '<span class="stab-l">' + esc(s.label) + "</span>" +
        '<span class="stab-t">' + esc(s.title) + "</span>" +
        '<span class="stab-cups" aria-label="' + seasonTrophies(s) + ' trophies">' + new Array(seasonTrophies(s) + 1).join("★") + "</span>" +
        "</button>";
    }).join("");

    wrap.addEventListener("click", function (e) {
      var b = e.target.closest("[data-season]");
      if (b) selectSeason(b.getAttribute("data-season"), { focusTab: false, updateHash: true });
    });
    wrap.addEventListener("keydown", function (e) {
      var tabs = $all(".stab", wrap);
      var i = tabs.indexOf(document.activeElement);
      if (i < 0) return;
      var n = null;
      if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
      if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
      if (e.key === "Home") n = 0;
      if (e.key === "End") n = tabs.length - 1;
      if (n != null) {
        e.preventDefault();
        selectSeason(tabs[n].getAttribute("data-season"), { focusTab: true, updateHash: true });
      }
    });
  }

  function selectSeason(id, opts) {
    opts = opts || {};
    var s = D.seasons.filter(function (x) { return x.id === id; })[0] || D.seasons[D.seasons.length - 1];
    $all(".stab").forEach(function (b) {
      var on = b.getAttribute("data-season") === s.id;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
      if (on && opts.focusTab) b.focus();
    });
    $("#season-panel").setAttribute("aria-labelledby", "tab-" + s.id);
    if (currentSeason !== s.id) {
      currentSeason = s.id;
      renderSeason(s);
    }
    if (opts.updateHash && history.replaceState) {
      try { history.replaceState(null, "", "#season-" + s.id); } catch (e) { /* sandboxed frames may refuse */ }
    }
  }

  function renderSeason(s) {
    var idx = D.seasons.indexOf(s);
    var html = "";

    // Header
    html += '<div class="sp-head" id="season-' + esc(s.id) + '">' +
      '<span class="sp-label" aria-hidden="true">' + esc(s.label) + "</span>" +
      '<div class="sp-head-copy"><p class="eyebrow">Season ' + (idx + 1) + " · " + esc(s.label) + "</p>" +
      '<h3 class="sp-title">' + esc(s.title) + "</h3>" +
      '<p class="sp-summary">' + esc(s.summary) + "</p></div></div>";

    // Competition outcomes
    html += '<div class="outcomes">' + (s.competitions || []).map(function (c) {
      return '<div class="oc' + (c.won ? " oc-won" : "") + '">' +
        '<span class="oc-comp">' + esc(comp(c.comp).name) + "</span>" +
        '<span class="oc-stage">' + (c.won ? '<span aria-hidden="true">★ </span>' : "") + esc(c.stage) + "</span>" +
        '<span class="oc-note">' + esc(c.note || "") + "</span></div>";
    }).join("") + "</div>";

    // Key numbers
    var L = s.league, A = s.allComps || {};
    var keys = [];
    if (L) {
      keys.push({ v: L.pts, u: "pts", k: "Premier League, " + ordinal(L.position) });
      keys.push({ v: L.w + "–" + L.d + "–" + L.l, u: "", k: "League W–D–L" });
      keys.push({ v: L.gf, u: "scored", k: L.ga + " conceded · GD " + sign(L.gf - L.ga) });
    }
    if (A.p) keys.push({ v: A.gf, u: "goals", k: "All competitions · " + A.p + " games · " + A.ga + " conceded" });
    var ts = topScorer(s);
    if (ts) keys.push({ v: ts.goals, u: "goals", k: "Top scorer: " + ts.name });
    html += '<div class="keys">' + keys.map(function (k) {
      return '<div class="key"><span class="key-v">' + esc(k.v) + (k.u ? "<small>" + esc(k.u) + "</small>" : "") + '</span><span class="key-k">' + esc(k.k) + "</span></div>";
    }).join("") + "</div>";

    // Finals
    var fin = (s.matches || []).filter(function (m) { return m.round === "Final"; });
    if (fin.length) {
      html += block("Finals", fin.length > 1 ? "The showpieces" : "The showpiece", fin.map(matchCentre).join(""));
    }

    // Title run-in chart
    if (s.pointsRace) {
      html += block("Title race", "The run-in", '<div class="chart" id="race-chart"></div>' + raceTable(s.pointsRace));
    }

    // League table
    if (s.table) html += block("Premier League", "Final table", leagueTable(s));

    // Results by competition
    var nonFinals = (s.matches || []).filter(function (m) { return m.round !== "Final"; });
    if (nonFinals.length) {
      var comps = compOrder.filter(function (k) { return (s.matches || []).some(function (m) { return m.comp === k; }); });
      html += block("Results", "Every result on record",
        '<div class="filters" role="tablist" aria-label="Competition">' + comps.map(function (k, i) {
          var n = (s.matches || []).filter(function (m) { return m.comp === k; }).length;
          return '<button type="button" role="tab" class="filter" data-comp="' + esc(k) + '" aria-selected="' + (i === 0 ? "true" : "false") + '">' +
            esc(comp(k).name) + ' <span class="filter-n">' + n + "</span></button>";
        }).join("") + "</div>" +
        '<div id="results-list"></div>');
    }

    // Scorers
    if (s.stats && s.stats.length) html += block("Goals & assists", "Leaderboard", leaderboard(s));

    // Squad and formation
    if (s.formation || s.squad) html += block("The squad", s.formation ? "Preferred XI · " + s.formation.shape : "Squad", squadHTML(s));

    // Tactics
    if (s.tactics) {
      html += block("Tactics", "Six ways to play", '<div class="tactics">' + s.tactics.map(function (t) {
        return '<div class="tac"><p class="tac-name">' + esc(t.name) + '</p><p class="tac-text">' + esc(t.text) + "</p></div>";
      }).join("") + "</div>");
    }

    // Transfers and boardroom
    if (s.signings || s.finances) {
      var inner = '<div class="board-grid">';
      if (s.signings) {
        inner += '<div class="panel"><p class="panel-title">Key arrivals</p><ul class="ledger">' + s.signings.map(function (x) {
          return '<li><span class="lg-name">' + esc(x.name) + '<small>' + esc(x.note || "") + '</small></span><span class="lg-val">' + esc(x.fee) + "</span></li>";
        }).join("") + "</ul></div>";
      }
      if (s.finances) {
        inner += '<div class="panel"><p class="panel-title">Boardroom</p><ul class="ledger">' + s.finances.rows.map(function (x) {
          return '<li><span class="lg-name">' + esc(x.label) + '</span><span class="lg-val">' + esc(x.value) + "</span></li>";
        }).join("") + "</ul>" +
          (s.finances.status ? '<p class="panel-note">' + esc(s.finances.status) + "</p>" : "") +
          (s.finances.caption ? '<p class="panel-note">' + esc(s.finances.caption) + "</p>" : "") + "</div>";
      }
      inner += "</div>";
      html += block("Transfers & finance", "The business", inner);
    }

    if (s.notes && s.notes.length) {
      html += '<div class="notes"><p class="notes-title">Archive notes</p><ul>' + s.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul></div>";
    }

    var panel = $("#season-panel");
    panel.innerHTML = html;

    if (s.pointsRace) drawRace(s.pointsRace);
    if (nonFinals.length) {
      var filters = $(".filters", panel);
      var first = $(".filter", filters);
      renderResults(s, first.getAttribute("data-comp"));
      filters.addEventListener("click", function (e) {
        var b = e.target.closest(".filter");
        if (!b) return;
        $all(".filter", filters).forEach(function (x) { x.setAttribute("aria-selected", x === b ? "true" : "false"); });
        renderResults(s, b.getAttribute("data-comp"));
      });
    }
    var lb = $(".lb", panel);
    if (lb) wireLeaderboard(lb, s);
  }

  function block(eyebrow, title, inner) {
    return '<section class="sblock"><header class="sblock-head"><p class="eyebrow">' + esc(eyebrow) + '</p><h4 class="sblock-title">' + esc(title) + "</h4></header>" + inner + "</section>";
  }

  /* ---------- Match centre ---------- */
  function matchCentre(m) {
    var s = sides(m), r = outcome(m);
    var maxMin = m.aet ? 120 : 90;
    var goals = (m.goals || []).slice().sort(function (a, b) { return a.min - b.min; });

    // Lay goal labels out above (United) and below (opponent) the minute track.
    // A label that would crowd the previous one on its side steps out a row.
    var ROW = 40, LH = 34;
    var lastPct = { us: -100, them: -100 }, lastLvl = { us: 1, them: 1 }, maxLvl = { us: -1, them: -1 };
    var laid = goals.map(function (g) {
      var side = g.side === "us" ? "us" : "them";
      var pct = Math.min(100, (g.min / maxMin) * 100);
      var lvl = pct - lastPct[side] < 30 ? (lastLvl[side] === 0 ? 1 : 0) : 0;
      lastPct[side] = pct; lastLvl[side] = lvl; maxLvl[side] = Math.max(maxLvl[side], lvl);
      return { g: g, side: side, pct: pct, lvl: lvl };
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
        '<span class="gm-label" style="top:' + labelTop + 'px"><span class="gm-who"><b>' + g.min + "'</b> " + esc(g.player) + "</span>" + (g.assist ? "<small>" + esc(g.assist) + "</small>" : "") + "</span></div>" +
        '<span class="sr">' + g.min + " minutes, " + esc(g.player) + (g.assist ? ", assisted by " + esc(g.assist) : "") + ", " + tally + ".</span>";
    }).join("");

    var stats = "";
    if (m.matchStats && m.oppStats) {
      var rows = [["possession", "Possession", "%"], ["shots", "Shots", ""], ["onTarget", "On target", ""], ["xg", "xG", ""], ["passAcc", "Pass accuracy", "%"]];
      stats = '<div class="mstats"><div class="mstats-key"><span class="k-us">United</span><span class="k-them">' + esc(m.opp) + "</span></div>" +
        rows.filter(function (x) { return m.matchStats[x[0]] != null && m.oppStats[x[0]] != null; }).map(function (x) {
          var a = m.matchStats[x[0]], b = m.oppStats[x[0]], t = a + b || 1;
          var fa = x[0] === "xg" ? a.toFixed(1) : a, fb = x[0] === "xg" ? b.toFixed(1) : b;
          return '<div class="ms-row"><span class="ms-a">' + fa + x[2] + '</span><span class="ms-l">' + x[1] + '</span><span class="ms-b">' + fb + x[2] + "</span>" +
            '<span class="ms-bar"><i class="ms-us" style="width:' + (a / t * 100).toFixed(1) + '%"></i><i class="ms-them" style="width:' + (b / t * 100).toFixed(1) + '%"></i></span></div>';
        }).join("") + "</div>";
    }

    return '<article class="mc" id="m-' + esc(m.id) + '">' +
      '<div class="mc-head">' +
        '<span class="mc-comp">' + esc(comp(m.comp).name) + " · " + esc(m.round) + "</span>" +
        '<span class="mc-when">' + esc(fmtDate(m.date)) + (m.ground ? " · " + esc(m.ground) : "") + "</span>" +
      "</div>" +
      '<div class="mc-board">' +
        '<span class="mc-team' + (s.usHome ? " us" : "") + '">' + esc(s.home) + "</span>" +
        '<span class="mc-score"><span>' + s.hs + '</span><i aria-hidden="true">–</i><span>' + s.as + "</span></span>" +
        '<span class="mc-team' + (s.usHome ? "" : " us") + '">' + esc(s.away) + "</span>" +
      "</div>" +
      '<p class="mc-tags"><span class="res-r res-' + r + '">' + (r === "W" ? "Won" : r === "L" ? "Lost" : "Drew") + "</span>" +
        (m.aet ? '<span class="tag">After extra time</span>' : "") +
        (m.potm ? '<span class="tag">Man of the Match: ' + esc(m.potm) + "</span>" : "") + "</p>" +
      (goals.length ? '<div class="gtl" style="height:' + gtlH + 'px"><div class="gtl-track" aria-hidden="true">' +
        '<span class="gtl-line" style="top:' + (trackY - 2) + 'px"></span>' +
        (m.aet ? '<span class="gtl-et" style="top:' + (trackY - 9) + "px;left:" + (90 / maxMin * 100) + '%"><em>Extra time</em></span>' : "") +
        '<span class="gtl-half" style="top:' + (trackY - 9) + "px;left:" + (45 / maxMin * 100) + '%"></span>' +
        [0, 45, 90].concat(m.aet ? [120] : []).map(function (t) {
          return '<span class="gtl-tick' + (t === maxMin ? " gtl-tick-end" : t === 0 ? " gtl-tick-start" : "") + '" style="left:' + (t / maxMin * 100) + "%\">" + t + "'</span>";
        }).join("") +
        "</div>" + marks + "</div>" +
        // Compact list that replaces the floating labels on narrow screens
        '<ol class="glist" aria-hidden="true">' + goals.map(function (g) {
          return '<li class="gl-' + (g.side === "us" ? "us" : "them") + '"><b>' + g.min + "'</b><span>" + esc(g.player) +
            (g.assist ? " <small>" + esc(g.assist) + "</small>" : "") + "</span></li>";
        }).join("") + "</ol>" : "") +
      (m.story ? '<p class="mc-story">' + esc(m.story) + "</p>" : "") +
      (m.lineup ? '<p class="mc-lineup"><b>Starting XI</b> ' + esc(m.lineup) + "</p>" : "") +
      stats +
      "</article>";
  }

  /* ---------- Results list ---------- */
  function renderResults(s, k) {
    var list = (s.matches || []).filter(function (m) { return m.comp === k && m.round !== "Final"; });
    var w = 0, d = 0, l = 0, gf = 0, ga = 0;
    list.forEach(function (m) {
      var r = outcome(m);
      if (r === "W") w++; else if (r === "D") d++; else l++;
      gf += m.score[0]; ga += m.score[1];
    });
    var finalsHere = (s.matches || []).filter(function (m) { return m.comp === k && m.round === "Final"; });
    var html = '<p class="res-sum">' + list.length + " games shown · " + w + "W " + d + "D " + l + "L · " + gf + "–" + ga +
      (finalsHere.length ? ' · <a href="#m-' + esc(finalsHere[0].id) + '">Final shown above</a>' : "") + "</p>";
    html += '<ol class="results">' + list.map(function (m) {
      var r = outcome(m);
      var ours = scorersText(m), theirs = theirScorersText(m);
      return '<li class="res' + (m.highlight ? " res-hl" : "") + '" id="m-' + esc(m.id) + '">' +
        '<span class="res-date">' + esc(fmtDate(m.date)) + "<small>" + esc(m.round) + "</small></span>" +
        '<span class="res-score">' + scoreHTML(m) + "</span>" +
        '<span class="res-r res-' + r + '" title="' + (r === "W" ? "Win" : r === "L" ? "Defeat" : "Draw") + '">' + r + "</span>" +
        '<span class="res-meta">' +
          (ours ? '<span class="res-goals">' + esc(ours) + "</span>" : "") +
          (theirs ? '<span class="res-opp">' + esc(m.opp) + ": " + esc(theirs) + "</span>" : "") +
          ((m.agg || m.tactic || m.highlight) ? '<span class="res-tags">' +
            (m.highlight ? '<span class="tag tag-hl">' + esc(m.highlight) + "</span>" : "") +
            (m.agg ? '<span class="tag">Agg ' + esc(m.agg) + "</span>" : "") +
            (m.tactic ? '<span class="tag">' + esc(m.tactic) + "</span>" : "") +
          "</span>" : "") +
          (m.story ? '<span class="res-story">' + esc(m.story) + "</span>" : "") +
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
        var us = r.club === D.manager.club;
        var cls = (us ? "lt-us" : "") + (rel && r.pos > n - rel ? " lt-rel" : "");
        return '<tr class="' + cls + '"><td class="num">' + r.pos + "</td><td>" + esc(r.club) + "</td>" +
          ["w", "d", "l"].map(function (k) { return '<td class="num">' + (r[k] == null ? "—" : r[k]) + "</td>"; }).join("") +
          '<td class="num">' + (r.gd == null ? "—" : sign(r.gd)) + '</td><td class="num lt-pts">' + r.pts + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      '<p class="caption">' + esc(t.caption || "") + (rel ? " Bottom " + rel + " relegated." : "") + "</p>";
  }

  /* ---------- Leaderboard ---------- */
  function leaderboard(s) {
    return '<div class="table-scroll"><table class="lb"><thead><tr>' +
      '<th scope="col" class="num">#</th><th scope="col">Player</th>' +
      '<th scope="col" class="lb-col" aria-sort="descending"><button type="button" data-sort="goals">Goals</button></th>' +
      '<th scope="col" class="lb-col"><button type="button" data-sort="assists">Assists</button></th>' +
      '<th scope="col" class="num"><button type="button" data-sort="ga">G+A</button></th>' +
      "</tr></thead><tbody></tbody></table></div>" +
      '<p class="caption">All competitions. Select a column to sort. A dash means the total was not retained.</p>';
  }

  function wireLeaderboard(table, s) {
    var maxG = Math.max.apply(null, s.stats.map(function (x) { return x.goals || 0; }).concat([1]));
    var maxA = Math.max.apply(null, s.stats.map(function (x) { return x.assists || 0; }).concat([1]));
    var maxBoth = Math.max(maxG, maxA);

    function val(x, key) {
      if (key === "ga") return (x.goals == null && x.assists == null) ? -1 : (x.goals || 0) + (x.assists || 0);
      return x[key] == null ? -1 : x[key];
    }

    function bar(v, cls) {
      if (v == null) return '<span class="lb-in"><span class="lb-v">—</span></span>';
      return '<span class="lb-in"><span class="lb-v">' + v + '</span><span class="lb-bar">' +
        (v > 0 ? '<i class="' + cls + '" style="width:' + (v / maxBoth * 100).toFixed(1) + '%"></i>' : "") + "</span></span>";
    }

    function draw(key) {
      var rows = s.stats.slice().sort(function (a, b) { return val(b, key) - val(a, key) || val(b, "ga") - val(a, "ga"); });
      $("tbody", table).innerHTML = rows.map(function (x, i) {
        var ga = (x.goals == null && x.assists == null) ? "—" : (x.goals || 0) + (x.assists || 0);
        return "<tr><td class=\"num lb-rank\">" + (i + 1) + "</td><td class=\"lb-name\">" + esc(x.name) + "</td>" +
          '<td class="lb-cell">' + bar(x.goals, "b-goals") + "</td>" +
          '<td class="lb-cell">' + bar(x.assists, "b-assists") + "</td>" +
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
    draw("goals");
  }

  /* ---------- Squad ---------- */
  function squadHTML(s) {
    var html = '<div class="squad-grid">';
    if (s.formation) {
      var rows = s.formation.rows.slice().reverse();
      html += '<div class="pitch-wrap"><div class="pitch" role="img" aria-label="' + esc(s.formation.shape + ": " + s.formation.rows.map(function (r) { return r.map(function (p) { return p.name; }).join(", "); }).join("; ")) + '">' +
        '<span class="pitch-lines" aria-hidden="true"><i class="pl-half"></i><i class="pl-circle"></i><i class="pl-box pl-box-top"></i><i class="pl-box pl-box-bot"></i></span>' +
        rows.map(function (row) {
          return '<div class="prow">' + row.map(function (p) {
            return '<span class="pp"><span class="pp-dot">' + esc(p.pos) + (p.captain ? '<b class="pp-c" title="Captain">C</b>' : "") + '</span><span class="pp-name">' + esc(p.name) + "</span></span>";
          }).join("") + "</div>";
        }).join("") +
        "</div>" +
        (s.formation.bench ? '<p class="bench"><b>Bench threats</b> ' + esc(s.formation.bench.join(" · ")) + "</p>" : "") +
        "</div>";
    }
    if (s.squad) {
      var groups = [["GK", "Goalkeepers"], ["DEF", "Defenders"], ["MID", "Midfielders"], ["ATT", "Attackers"]];
      html += '<div class="roster">' + groups.map(function (g) {
        var ps = s.squad.filter(function (p) { return p.group === g[0]; });
        if (!ps.length) return "";
        return '<div class="rg"><p class="rg-title">' + g[1] + " <span>" + ps.length + "</span></p><ul>" + ps.map(function (p) {
          var delta = p.from != null ? '<span class="up" title="Up from ' + p.from + '">+' + (p.ovr - p.from) + "</span>" : "";
          return '<li><span class="ovr">' + p.ovr + '</span><span class="rp-name">' + esc(p.name) + "<small>" + esc(p.pos) + (p.role ? " · " + esc(p.role) : "") + "</small></span>" + delta + "</li>";
        }).join("") + "</ul></div>";
      }).join("") +
      (s.onLoan && s.onLoan.length ? '<div class="rg"><p class="rg-title">Out on loan</p><ul>' + s.onLoan.map(function (p) {
        return '<li class="loan"><span class="ovr">' + p.ovr + '</span><span class="rp-name">' + esc(p.name) + "<small>" + esc(p.pos) + " · " + esc(p.note) + "</small></span></li>";
      }).join("") + "</ul></div>" : "") +
      "</div>";
    }
    html += "</div>";
    return html;
  }

  /* ---------- Title race chart ---------- */
  function raceTable(r) {
    var mws = r.series[0].values.map(function (_, i) { return r.fromMatchweek + i; });
    return '<details class="tview"><summary>Show as table</summary><div class="table-scroll"><table class="lt"><thead><tr><th scope="col">Matchweek</th>' +
      r.series.map(function (s) { return '<th scope="col" class="num">' + esc(s.club) + "</th>"; }).join("") + '<th scope="col" class="num">Gap</th></tr></thead><tbody>' +
      mws.map(function (mw, i) {
        return "<tr><td>MW" + mw + (r.notes && r.notes[mw] ? " · " + esc(r.notes[mw]) : "") + "</td>" +
          r.series.map(function (s) { return '<td class="num">' + s.values[i] + "</td>"; }).join("") +
          '<td class="num">' + sign(r.series[0].values[i] - r.series[1].values[i]) + "</td></tr>";
      }).join("") + "</tbody></table></div></details>";
  }

  function drawRace(r) {
    var host = $("#race-chart");
    if (!host) return;
    var NS = "http://www.w3.org/2000/svg";
    var series = r.series;
    var n = series[0].values.length;
    var all = [];
    series.forEach(function (s) { all = all.concat(s.values); });
    var lo = Math.floor((Math.min.apply(null, all) - 2) / 5) * 5;
    var hi = Math.ceil((Math.max.apply(null, all) + 2) / 5) * 5;

    host.innerHTML =
      '<div class="legend">' + series.map(function (s) {
        return '<span class="lg"><i class="lg-line ' + (s.us ? "c-us" : "c-them") + '"></i>' + esc(s.club) + "</span>";
      }).join("") + "</div>" +
      '<div class="chart-box"><svg class="race" role="img" tabindex="0" aria-label="Points after each matchweek from MW' + r.fromMatchweek +
      ". Use the arrow keys to step through matchweeks." + '"></svg><div class="ctip" hidden></div></div>';

    var svg = $("svg", host), tip = $(".ctip", host), box = $(".chart-box", host);
    var active = n - 1;

    function draw() {
      var W = Math.max(300, box.clientWidth);
      var H = W < 520 ? 250 : 290;
      var m = { t: 18, r: W < 520 ? 74 : 104, b: 34, l: 38 };
      var iw = W - m.l - m.r, ih = H - m.t - m.b;
      var x = function (i) { return m.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw); };
      var y = function (v) { return m.t + ih - ((v - lo) / (hi - lo)) * ih; };
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      svg.setAttribute("width", W);
      svg.setAttribute("height", H);

      var out = "";
      for (var v = lo; v <= hi; v += 5) {
        out += '<line class="grid" x1="' + m.l + '" x2="' + (W - m.r + 8) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>' +
          '<text class="tick" x="' + (m.l - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + v + "</text>";
      }
      for (var i = 0; i < n; i++) {
        out += '<text class="tick" x="' + x(i) + '" y="' + (H - 10) + '" text-anchor="middle">' + (W < 520 && i % 2 ? "" : "MW" + (r.fromMatchweek + i)) + "</text>";
      }
      // Notes: hairline + label, skipping the last matchweek (the end label covers it)
      if (r.notes) {
        Object.keys(r.notes).forEach(function (k) {
          var i = +k - r.fromMatchweek;
          if (i < 0 || i >= n - 1) return;
          out += '<line class="note-line" x1="' + x(i) + '" x2="' + x(i) + '" y1="' + m.t + '" y2="' + (m.t + ih) + '"/>' +
            '<text class="note" x="' + (x(i) + 6) + '" y="' + (m.t + 12) + '">' + esc(r.notes[k]) + "</text>";
        });
      }
      out += '<line class="xhair" x1="0" x2="0" y1="' + m.t + '" y2="' + (m.t + ih) + '"/>';
      series.slice().reverse().forEach(function (s) {
        var d = s.values.map(function (v, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1); }).join(" ");
        var cls = s.us ? "c-us" : "c-them";
        out += '<path class="line ' + cls + '" d="' + d + '"/>';
        s.values.forEach(function (v, i) {
          out += '<circle class="dot ' + cls + '" data-i="' + i + '" cx="' + x(i) + '" cy="' + y(v) + '" r="4"/>';
        });
        var last = s.values[n - 1];
        out += '<text class="endlab" x="' + (x(n - 1) + 12) + '" y="' + (y(last) + 4) + '">' + esc(s.us ? (D.manager.clubShort || s.club) : s.club) + ' <tspan class="endval">' + last + "</tspan></text>";
      });
      out += '<rect class="hit" x="' + m.l + '" y="' + m.t + '" width="' + iw + '" height="' + ih + '" fill="transparent"/>';
      svg.innerHTML = out;
      svg._geom = { x: x, y: y, m: m, iw: iw, W: W };
      show(active, false);
    }

    function show(i, visible) {
      active = i;
      var g = svg._geom;
      var xh = $(".xhair", svg);
      xh.setAttribute("x1", g.x(i)); xh.setAttribute("x2", g.x(i));
      xh.style.opacity = visible ? 1 : 0;
      $all(".dot", svg).forEach(function (d) { d.classList.toggle("on", visible && +d.getAttribute("data-i") === i); });
      if (!visible) { tip.hidden = true; return; }
      var mw = r.fromMatchweek + i;
      var gap = series[0].values[i] - series[1].values[i];
      tip.innerHTML = "";
      var h = document.createElement("p"); h.className = "ctip-h"; h.textContent = "Matchweek " + mw; tip.appendChild(h);
      series.forEach(function (s) {
        var row = document.createElement("p"); row.className = "ctip-r";
        var key = document.createElement("i"); key.className = "lg-line " + (s.us ? "c-us" : "c-them");
        var val = document.createElement("b"); val.textContent = s.values[i];
        var lab = document.createElement("span"); lab.textContent = s.club;
        row.appendChild(key); row.appendChild(val); row.appendChild(lab); tip.appendChild(row);
      });
      var gp = document.createElement("p"); gp.className = "ctip-n"; gp.textContent = "Gap " + sign(gap) + (r.notes && r.notes[mw] ? " · " + r.notes[mw] : "");
      tip.appendChild(gp);
      tip.hidden = false;
      var left = g.x(i) + 14;
      var tw = tip.offsetWidth;
      if (left + tw > box.clientWidth) left = g.x(i) - tw - 14;
      tip.style.left = Math.max(0, left) + "px";
      tip.style.top = g.m.t + "px";
    }

    function nearest(clientX) {
      var g = svg._geom, rect = svg.getBoundingClientRect();
      var px = clientX - rect.left;
      var i = Math.round(((px - g.m.l) / g.iw) * (n - 1));
      return Math.max(0, Math.min(n - 1, i));
    }

    svg.addEventListener("pointermove", function (e) { show(nearest(e.clientX), true); });
    svg.addEventListener("pointerleave", function () { show(active, false); });
    svg.addEventListener("focus", function () { show(active, true); });
    svg.addEventListener("blur", function () { show(active, false); });
    svg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); show(Math.min(n - 1, active + 1), true); }
      if (e.key === "ArrowLeft") { e.preventDefault(); show(Math.max(0, active - 1), true); }
    });

    draw();
    if (window.ResizeObserver) {
      var lastW = box.clientWidth;
      new ResizeObserver(function () {
        if (Math.abs(box.clientWidth - lastW) > 4) { lastW = box.clientWidth; draw(); }
      }).observe(box);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Hall of Fame                                                        */
  /* ------------------------------------------------------------------ */
  function renderHOF() {
    var list = D.hallOfFame || [];
    function card(p, big) {
      var c = playerCareer(p.name);
      var stats = [
        [c.goals + (c.gUnknown ? "+" : ""), "Goals"],
        [c.assists + (c.aUnknown ? "+" : ""), "Assists"],
        [c.trophies, "Trophies"],
        [c.seasons, c.seasons === 1 ? "Season" : "Seasons"]
      ];
      return '<article class="plaque' + (big ? " plaque-legend" : "") + '">' +
        '<span class="pl-water" aria-hidden="true">' + esc(surname(p.name)) + "</span>" +
        '<div class="pl-top"><span class="pl-mono" aria-hidden="true">' + esc(initials(p.name)) + "</span>" +
          (c.ovr ? '<span class="pl-ovr" title="Latest overall rating">' + c.ovr + "<small>OVR</small></span>" : "") + "</div>" +
        '<p class="pl-epithet">' + esc(p.epithet) + "</p>" +
        '<h3 class="pl-name">' + esc(p.name) + "</h3>" +
        '<p class="pl-pos">' + esc(p.position) + " · Inducted " + esc(p.inducted) + "</p>" +
        '<p class="pl-cite">' + esc(p.citation) + "</p>" +
        '<dl class="pl-stats">' + stats.map(function (s) { return "<div><dt>" + s[1] + "</dt><dd>" + s[0] + "</dd></div>"; }).join("") + "</dl>" +
        ((c.gUnknown || c.aUnknown) ? '<p class="pl-foot">+ includes a season whose totals were not retained</p>' : "") +
        "</article>";
    }
    $("#hof-legends").innerHTML = list.filter(function (p) { return p.tier === "legend"; }).map(function (p) { return card(p, true); }).join("");
    $("#hof-grid").innerHTML = list.filter(function (p) { return p.tier !== "legend"; }).map(function (p) { return card(p, false); }).join("");
  }

  /* ------------------------------------------------------------------ */
  /* Records                                                             */
  /* ------------------------------------------------------------------ */
  function renderRecords() {
    $("#records-grid").innerHTML = (D.records || []).map(function (r, i) {
      return '<article class="rec' + (i === 0 ? " rec-hero" : "") + '">' +
        '<p class="rec-v">' + esc(r.value) + (r.unit ? "<small>" + esc(r.unit) + "</small>" : "") + "</p>" +
        '<p class="rec-l">' + esc(r.label) + "</p>" +
        '<p class="rec-d">' + esc(r.detail) + "</p>" +
        '<p class="rec-s">' + esc(r.season) + "</p></article>";
    }).join("");
  }

  /* ------------------------------------------------------------------ */
  /* Timeline                                                            */
  /* ------------------------------------------------------------------ */
  function renderTimeline() {
    var html = "";
    D.seasons.forEach(function (s) {
      var iso = /^\d{4}-\d{2}-\d{2}$/;
      var hs = (s.matches || []).filter(function (m) { return m.highlight; })
        .map(function (m, i) { return { m: m, i: i, k: iso.test(m.date) ? m.date : "9999" }; })
        .sort(function (a, b) { return a.k < b.k ? -1 : a.k > b.k ? 1 : a.i - b.i; })
        .map(function (o) { return o.m; });
      if (!hs.length) return;
      html += '<li class="tl-season"><span>' + esc(s.label) + "</span> " + esc(s.title) + "</li>";
      hs.forEach(function (m) {
        var r = outcome(m);
        html += '<li class="tl-item' + (m.round === "Final" ? " tl-final" : "") + '">' +
          '<span class="tl-dot" aria-hidden="true"></span>' +
          '<div class="tl-headcol">' +
            '<p class="tl-when">' + esc(fmtDate(m.date)) + " · " + esc(comp(m.comp).name) + (m.round && m.round !== "League" ? ", " + esc(m.round) : "") + "</p>" +
            '<h3 class="tl-title">' + esc(m.highlight) + "</h3>" +
            '<p class="tl-score"><span class="res-r res-' + r + '">' + r + "</span> " + esc(scoreText(m)) + "</p>" +
          "</div>" +
          '<div class="tl-body">' +
            (m.story ? '<p class="tl-story">' + esc(m.story) + "</p>" : "") +
            '<a class="tl-link" href="#m-' + esc(m.id) + '">Match details</a>' +
          "</div></li>";
      });
    });
    $("#timeline-list").innerHTML = html;
  }

  /* ------------------------------------------------------------------ */
  /* Footer                                                              */
  /* ------------------------------------------------------------------ */
  function renderFooter() {
    var a = D.manager.archive || {};
    $("#footer-meta").innerHTML =
      '<p><span class="fm-k">Archive</span> Save ' + esc(a.save || "") + " · " + esc(fmtDate(a.date)) + (a.note ? " · " + esc(a.note) : "") + "</p>" +
      ((D.manager.pending || []).length ? '<p><span class="fm-k">Pending</span> ' + D.manager.pending.map(esc).join(" ") + "</p>" : "") +
      '<p><span class="fm-k">Next chapter</span> Season ' + (D.seasons.length + 1) + " to be written.</p>";
  }

  /* ------------------------------------------------------------------ */
  /* Deep links: #season-ID and #m-MATCHID                               */
  /* ------------------------------------------------------------------ */
  function goTo(hash, smooth) {
    if (!hash) return false;
    var id = hash.replace(/^#/, "");
    if (id.indexOf("season-") === 0) {
      selectSeason(id.slice(7), {});
      scrollToEl($("#seasons"), smooth);
      return true;
    }
    if (id.indexOf("m-") === 0) {
      var f = findMatch(id.slice(2));
      if (!f) return false;
      selectSeason(f.season.id, {});
      var res = $(".filter[data-comp=\"" + f.match.comp + "\"]");
      if (res && f.match.round !== "Final") res.click();
      var el = document.getElementById(id);
      if (el) {
        scrollToEl(el, smooth);
        el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
      }
      return true;
    }
    return false;
  }

  function scrollToEl(el, smooth) {
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.pageYOffset - 84;
    window.scrollTo({ top: top, behavior: smooth && !reduceMotion ? "smooth" : "auto" });
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[href^='#']");
    if (!a) return;
    var h = a.getAttribute("href");
    if (/^#(season-|m-)/.test(h)) {
      e.preventDefault();
      goTo(h, true);
    }
  });

  /* Active nav link */
  function watchNav() {
    if (!window.IntersectionObserver) return;
    var links = $all(".nav a");
    var map = {};
    links.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) {
          links.forEach(function (a) { a.classList.remove("on"); });
          map[en.target.id].classList.add("on");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  /* ------------------------------------------------------------------ */
  /* Boot                                                                */
  /* ------------------------------------------------------------------ */
  renderHero();
  renderLED();
  renderCabinet();
  renderHonours();
  renderSeasonTabs();
  selectSeason(D.seasons[D.seasons.length - 1].id, {});
  renderHOF();
  renderRecords();
  renderTimeline();
  renderFooter();
  watchNav();
  if (location.hash) goTo(location.hash, false);
})();
