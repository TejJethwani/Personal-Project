/* ==========================================================================
   THE TEJ ERA: CAREER DATA
   --------------------------------------------------------------------------
   Every section of the site is drawn from this one file. To add a season,
   copy the last object in `seasons`, change the numbers, and save. The
   trophy cabinet, honours board, hall of fame totals, records ticker and
   career timeline all update on their own.

   Conventions
   - Dates are "YYYY-MM-DD". If the exact day is unknown, write any text
     instead (for example "Mar 2028") and it is shown as written.
   - venue: "H" home, "A" away, "N" neutral (finals).
   - score: [United goals, opponent goals]. Add aet: true for extra time,
     and pens: [United, opponent] for a shoot-out.
   - goals: side "us" or "them". min is the minute (number).
   - Use the same full player name every season so totals add up.
   - null means "not retained in the archive" and shows as a dash. Never
     guess a number: leave it null.

   This is a fictional career-mode save. Nothing here is real football
   history.
   ========================================================================== */

window.TEJ_ERA = {
  manager: {
    name: "Tej Jethwani",
    club: "Manchester United",
    clubShort: "United",
    since: 2026,
    philosophy:
      "An elite, adaptable, attack-minded side that keeps creative possession without becoming predictable, switching between six tactical approaches as opponents and game states demand.",
    ambitions: [
      "Bring United back to the summit",
      "Win the Premier League",
      "Conquer Europe",
      "Pass Manchester City's 100-point benchmark (target: 101)"
    ],
    // Shown in the footer and hero. Update after every new save.
    archive: { save: "12AA", date: "2028-05-27", note: "Final whistle v Barcelona, Wembley" },
    // Things that are announced but not decided yet.
    pending: [
      "2027 Ballon d'Or still unawarded. Bruno Fernandes projected first."
    ]
  },

  /* Competitions the cabinet knows about. `trophy` picks the drawing:
     "ucl" big-ears cup, "pl" crowned trophy, "lc" three-handled cup,
     "fac" lidded cup, "cup" generic cup for anything new
     (Community Shield, Super Cup, Club World Cup ...). */
  competitions: {
    pl:  { name: "Premier League",        short: "PL",      trophy: "pl",  metal: "silver" },
    ucl: { name: "UEFA Champions League", short: "UCL",     trophy: "ucl", metal: "silver" },
    fac: { name: "FA Cup",                short: "FA Cup",  trophy: "fac", metal: "silver" },
    lc:  { name: "Carabao Cup",           short: "Carabao", trophy: "lc",  metal: "silver" }
  },

  seasons: [
    /* ======================================================================
       SEASON ONE: 2026/27
       ====================================================================== */
    {
      id: "2026-27",
      label: "2026/27",
      title: "The First European Crown",
      summary:
        "Tej's first year set the tone. United returned to the top table of European football with Bruno Fernandes directing the attack, Marcus Rashford becoming an elite goalscorer and Matheus Cunha delivering in the biggest moments. The league finished third, behind Arsenal and Manchester City. Europe delivered the first trophy of the era.",

      // One row per competition entered. won: true puts a trophy in the cabinet.
      competitions: [
        { comp: "pl",  stage: "3rd",           won: false, note: "80 points, behind Arsenal (88) and Man City (86)" },
        { comp: "ucl", stage: "Winners",       won: true,  note: "Beat Bayern Munich 2–1 after extra time in Lisbon", final: "ucl-2027-final" },
        { comp: "fac", stage: "Quarter-final", won: false, note: "Knocked out by Brighton" },
        { comp: "lc",  stage: "Quarter-final", won: false, note: "Knocked out by Newcastle" }
      ],

      league: { position: 3, p: 38, w: 24, d: 8, l: 6, gf: 73, ga: 31, pts: 80 },
      allComps: { p: null, gf: null, ga: null },

      table: {
        caption: "Top three only; the rest of the table was not retained.",
        rows: [
          { pos: 1, club: "Arsenal", pts: 88 },
          { pos: 2, club: "Manchester City", pts: 86 },
          { pos: 3, club: "Manchester United", w: 24, d: 8, l: 6, gd: 42, pts: 80 }
        ]
      },

      // Goals and assists in all competitions. null = not retained.
      stats: [
        { name: "Marcus Rashford", goals: 35, assists: 10 },
        { name: "Bruno Fernandes", goals: 18, assists: 25 },
        { name: "Matheus Cunha", goals: null, assists: null }
      ],

      matches: [
        {
          id: "ucl-2027-final",
          date: "2027-05-29",
          comp: "ucl",
          round: "Final",
          opp: "Bayern Munich",
          venue: "N",
          ground: "Lisbon",
          score: [2, 1],
          aet: true,
          goals: [
            { min: 38, side: "us", player: "Marcus Rashford" },
            { min: 71, side: "them", player: "Harry Kane" },
            { min: 117, side: "us", player: "Matheus Cunha" }
          ],
          highlight: "Champions of Europe",
          story:
            "Rashford gave United a first-half lead, Harry Kane levelled after 71 minutes, and Cunha's 117th-minute winner delivered the first trophy of the Tej Era and made Bruno Fernandes a Champions League-winning captain."
        }
      ],

      notes: [
        "Full fixture-by-fixture logs for 2026/27 were not retained. Only the final and the season totals above are on record."
      ]
    },

    /* ======================================================================
       SEASON TWO: 2027/28
       ====================================================================== */
    {
      id: "2027-28",
      label: "2027/28",
      title: "Operation 101",
      summary:
        "A deep, technically elite squad, six tactical approaches and one target: 101 points. United lost once in the league, won the last 17 league games in a row, beat City 8–2 and 5–2, did the double over Arsenal, lifted the Carabao Cup with a young rotated side and retained the Champions League at Wembley.",

      competitions: [
        { comp: "pl",  stage: "Champions",     won: true,  note: "101 points, 32W 5D 1L. Clinched v Sunderland on 17 May", final: "pl-2028-sunderland" },
        { comp: "ucl", stage: "Winners",       won: true,  note: "Beat Barcelona 3–2 after extra time at Wembley", final: "ucl-2028-final" },
        { comp: "fac", stage: "Quarter-final", won: false, note: "Lost 2–1 at Liverpool" },
        { comp: "lc",  stage: "Winners",       won: true,  note: "Beat Chelsea 2–1 at Wembley", final: "lc-2028-final" }
      ],

      league: { position: 1, p: 38, w: 32, d: 5, l: 1, gf: 101, ga: 33, pts: 101 },
      allComps: { p: 65, gf: 154, ga: 59 },

      table: {
        caption: "Final Premier League table, all 20 clubs synchronised through 38 games.",
        relegation: 3,
        rows: [
          { pos: 1,  club: "Manchester United", w: 32, d: 5,  l: 1,  gd: 68,  pts: 101 },
          { pos: 2,  club: "Arsenal",           w: 30, d: 6,  l: 2,  gd: 53,  pts: 96 },
          { pos: 3,  club: "Liverpool",         w: 28, d: 5,  l: 5,  gd: 48,  pts: 89 },
          { pos: 4,  club: "Manchester City",   w: 27, d: 7,  l: 4,  gd: 44,  pts: 88 },
          { pos: 5,  club: "Chelsea",           w: 26, d: 9,  l: 3,  gd: 48,  pts: 87 },
          { pos: 6,  club: "Tottenham",         w: 21, d: 10, l: 7,  gd: 27,  pts: 73 },
          { pos: 7,  club: "Newcastle",         w: 17, d: 6,  l: 15, gd: 15,  pts: 57 },
          { pos: 8,  club: "Aston Villa",       w: 14, d: 10, l: 14, gd: 7,   pts: 52 },
          { pos: 9,  club: "Brighton",          w: 12, d: 8,  l: 18, gd: -7,  pts: 44 },
          { pos: 10, club: "Bournemouth",       w: 12, d: 6,  l: 20, gd: -12, pts: 42 },
          { pos: 11, club: "Brentford",         w: 10, d: 10, l: 18, gd: -13, pts: 40 },
          { pos: 12, club: "Fulham",            w: 11, d: 6,  l: 21, gd: -15, pts: 39 },
          { pos: 13, club: "Crystal Palace",    w: 9,  d: 10, l: 19, gd: -18, pts: 37 },
          { pos: 14, club: "Nottingham Forest", w: 9,  d: 9,  l: 20, gd: -21, pts: 36 },
          { pos: 15, club: "Everton",           w: 9,  d: 8,  l: 21, gd: -23, pts: 35 },
          { pos: 16, club: "West Ham",          w: 8,  d: 10, l: 20, gd: -25, pts: 34 },
          { pos: 17, club: "Wolves",            w: 8,  d: 9,  l: 21, gd: -29, pts: 33 },
          { pos: 18, club: "Leeds United",      w: 7,  d: 8,  l: 23, gd: -38, pts: 29 },
          { pos: 19, club: "Sunderland",        w: 5,  d: 10, l: 23, gd: -49, pts: 25 },
          { pos: 20, club: "Burnley",           w: 5,  d: 8,  l: 25, gd: -60, pts: 23 }
        ]
      },

      // Points after each matchweek, for the title run-in chart.
      pointsRace: {
        fromMatchweek: 30,
        series: [
          { club: "Manchester United", us: true, values: [77, 80, 83, 86, 89, 92, 95, 98, 101] },
          { club: "Arsenal", values: [75, 75, 78, 81, 84, 87, 90, 93, 96] }
        ],
        notes: { 31: "Beat Arsenal 3–2", 37: "Title clinched", 38: "101 at Anfield" }
      },

      // Canonical all-competition ledger (reconciles to 154 goals, 154 assists).
      stats: [
        { name: "Marcus Rashford",  goals: 45, assists: 1 },
        { name: "Assane Diao",      goals: 27, assists: 13 },
        { name: "Bruno Fernandes",  goals: 25, assists: 24 },
        { name: "Chido Obi",        goals: 18, assists: 2 },
        { name: "Bryan Mbeumo",     goals: 14, assists: 4 },
        { name: "Matheus Cunha",    goals: 13, assists: 3 },
        { name: "Roony Bardghji",   goals: 6,  assists: 17 },
        { name: "João Neves",       goals: 4,  assists: 34 },
        { name: "Carlos Baleba",    goals: 1,  assists: 2 },
        { name: "Luka Vušković",    goals: 1,  assists: 0 },
        { name: "Kobbie Mainoo",    goals: 0,  assists: 28 },
        { name: "Federico Dimarco", goals: 0,  assists: 15 },
        { name: "Jules Koundé",     goals: 0,  assists: 4 },
        { name: "Martim Fernandes", goals: 0,  assists: 4 },
        { name: "Patrick Dorgu",    goals: 0,  assists: 3 }
      ],

      // group: GK, DEF, MID, ATT. from = earlier OVR when it changed this season.
      squad: [
        { name: "Senne Lammens",    group: "GK",  pos: "GK",  ovr: 84, role: "First choice" },
        { name: "Karl Darlow",      group: "GK",  pos: "GK",  ovr: 72, role: "Reserve" },
        { name: "Pau Cubarsí",      group: "DEF", pos: "CB",  ovr: 88, role: "Starting CB" },
        { name: "Jules Koundé",     group: "DEF", pos: "RB",  ovr: 88, role: "Starting RB" },
        { name: "Federico Dimarco", group: "DEF", pos: "LB",  ovr: 86, role: "Starting LB, creator" },
        { name: "Leny Yoro",        group: "DEF", pos: "CB",  ovr: 86, from: 85, role: "Starting CB" },
        { name: "Matthijs de Ligt", group: "DEF", pos: "CB",  ovr: 84, role: "CB rotation" },
        { name: "Luka Vušković",    group: "DEF", pos: "CB",  ovr: 83, from: 82, role: "Young CB rotation" },
        { name: "Vanderson",        group: "DEF", pos: "RB",  ovr: 82, role: "RB rotation" },
        { name: "Patrick Dorgu",    group: "DEF", pos: "LB",  ovr: 80, role: "LB rotation" },
        { name: "Martim Fernandes", group: "DEF", pos: "RB",  ovr: 79, from: 78, role: "Young RB" },
        { name: "Ayden Heaven",     group: "DEF", pos: "CB",  ovr: 75, role: "Young CB" },
        { name: "Harry Amass",      group: "DEF", pos: "LB",  ovr: 73, role: "Young LB" },
        { name: "Bruno Fernandes",  group: "MID", pos: "CAM", ovr: 91, role: "Captain" },
        { name: "João Neves",       group: "MID", pos: "CM",  ovr: 88, from: 87, role: "Starting CM" },
        { name: "Kobbie Mainoo",    group: "MID", pos: "CM",  ovr: 86, from: 84, role: "Starting CM" },
        { name: "Carlos Baleba",    group: "MID", pos: "CDM", ovr: 84, role: "Rotation, defensive cover" },
        { name: "Marcus Rashford",  group: "ATT", pos: "RW",  ovr: 87, role: "ST, then RW" },
        { name: "Matheus Cunha",    group: "ATT", pos: "ST",  ovr: 85, role: "LW, then ST" },
        { name: "Bryan Mbeumo",     group: "ATT", pos: "RW",  ovr: 85, role: "RW, then bench weapon" },
        { name: "Assane Diao",      group: "ATT", pos: "LW",  ovr: 84, from: 81, role: "Became starting LW" },
        { name: "Roony Bardghji",   group: "ATT", pos: "RW",  ovr: 81, from: 79, role: "Young RW, creator" },
        { name: "Chido Obi",        group: "ATT", pos: "ST",  ovr: 77, from: 74, role: "Young ST, cup specialist" }
      ],
      onLoan: [
        { name: "Shea Lacey", pos: "RW", ovr: 74, note: "Season loan to PSV Eindhoven; PSV pay 100% of wages" }
      ],

      // Preferred XI, back line to front line, each row left to right.
      formation: {
        shape: "4-2-3-1",
        rows: [
          [{ name: "Lammens", pos: "GK" }],
          [{ name: "Dimarco", pos: "LB" }, { name: "Cubarsí", pos: "CB" }, { name: "Yoro", pos: "CB" }, { name: "Koundé", pos: "RB" }],
          [{ name: "Mainoo", pos: "CM" }, { name: "Neves", pos: "CM" }],
          [{ name: "Diao", pos: "LW" }, { name: "Bruno", pos: "CAM", captain: true }, { name: "Rashford", pos: "RW" }],
          [{ name: "Cunha", pos: "ST" }]
        ],
        bench: ["Mbeumo", "Chido Obi", "Bardghji"]
      },

      tactics: [
        { name: "Counterattack", text: "Compact shape, rapid transitions, passes into the space behind high lines. Beat Arsenal 3–2 at Old Trafford." },
        { name: "Total Possession", text: "Patient build-up, positional dominance and progressive control of the ball." },
        { name: "Controlled Possession", text: "Safer positioning, fewer risky passes, stronger rest defence. The opening plan at Wembley." },
        { name: "Tiki-Taka V2", text: "Passing triangles through Neves, Mainoo and Bruno; attack after the first goal with cover behind the ball. Debuted in the 2–1 win at Arsenal." },
        { name: "Aggressive Tiki-Taka", text: "Higher press and faster combinations to chase goals. Switched on late in the 2–0 comeback at the Bernabéu and before Cunha's equaliser at Wembley." },
        { name: "All-Out Attack", text: "Full commitment, very high risk, saved for special moments. The 8–2 derby and the 88th-minute winner at Anfield." }
      ],

      signings: [
        { name: "João Neves", fee: "€145M", note: "Midfield pillar, 34 assists" },
        { name: "Assane Diao", fee: "€37M", note: "81 → 84 OVR, displaced Cunha at LW" },
        { name: "Jules Koundé", fee: "Instalments", note: "€40M still owed at season end" },
        { name: "Roony Bardghji", fee: "Instalments", note: "€20M still owed at season end" }
      ],

      finances: {
        caption: "Pre-settlement figures at 27 May 2028. Prize money and season-end costs not yet processed.",
        rows: [
          { label: "Treasury cash", value: "€70.6M" },
          { label: "Protected / earmarked", value: "€63.7M" },
          { label: "Discretionary spendable", value: "€6.9M" },
          { label: "Future instalments (Koundé, Bardghji)", value: "€60M" },
          { label: "Due July 2028", value: "€30M" }
        ],
        status: "Recruitment frozen pending review. Restes talks paused; Martim Fernandes loan on hold."
      },

      matches: [
        /* ---------------- Premier League ---------------- */
        {
          id: "pl-2027-city-home", date: "2027-09-18", comp: "pl", round: "League", opp: "Manchester City", venue: "H",
          score: [8, 2], tactic: "All-Out Attack",
          highlight: "8–2",
          story: "The derby that set the tone for the season. All-Out Attack, eight goals, and the start of a 13–4 aggregate over City across the two league derbies."
        },
        {
          id: "pl-2027-arsenal-away", date: "2027-12-04", comp: "pl", round: "League", opp: "Arsenal", venue: "A",
          score: [2, 1], tactic: "Tiki-Taka V2",
          highlight: "Winning at Arsenal",
          story: "The first meeting with Arsenal ended in an away win and marked the debut of the revised Tiki-Taka."
        },
        {
          id: "pl-2028-bournemouth", date: "2028-01-23", comp: "pl", round: "League", opp: "Bournemouth", venue: "A",
          score: [1, 2],
          story: "The only league defeat of the season. It led to more work on defensive transitions and midfield cover."
        },
        {
          id: "pl-2028-brighton", date: "Mar 2028", comp: "pl", round: "League", opp: "Brighton", venue: "H", score: [4, 1],
          scorers: "Rashford ×2, Bruno, Diao", theirScorers: "Minteh"
        },
        {
          id: "pl-2028-fulham", date: "Mar 2028", comp: "pl", round: "League", opp: "Fulham", venue: "A", score: [3, 0],
          scorers: "Mbeumo, Chido, Neves"
        },
        {
          id: "pl-2028-city-away", date: "Mar 2028", comp: "pl", round: "League", opp: "Manchester City", venue: "A", score: [5, 2],
          scorers: "Rashford ×2, Bruno, Cunha, Diao", theirScorers: "Haaland, Foden"
        },
        {
          id: "pl-2028-villa", date: "2028-03-18", comp: "pl", round: "League", opp: "Aston Villa", venue: "A", score: [3, 1],
          scorers: "Rashford, Mbeumo, Bardghji", theirScorers: "Watkins"
        },
        {
          id: "pl-2028-wolves", date: "2028-03-25", comp: "pl", round: "League", opp: "Wolves", venue: "H", score: [3, 0],
          goals: [
            { min: 18, side: "us", player: "Rashford", assist: "Neves" },
            { min: 42, side: "us", player: "Bruno", assist: "Mainoo" },
            { min: 78, side: "us", player: "Chido", assist: "Bardghji" }
          ]
        },
        {
          id: "pl-2028-palace", date: "2028-04-01", comp: "pl", round: "League", opp: "Crystal Palace", venue: "H", score: [3, 1],
          goals: [
            { min: 13, side: "us", player: "Diao", assist: "Dimarco" },
            { min: 37, side: "them", player: "Eze", assist: "Wharton" },
            { min: 56, side: "us", player: "Rashford", assist: "Bruno" },
            { min: 83, side: "us", player: "Mbeumo", assist: "Koundé" }
          ]
        },
        {
          id: "pl-2028-spurs", date: "2028-04-08", comp: "pl", round: "League", opp: "Tottenham", venue: "A", score: [3, 2],
          goals: [
            { min: 12, side: "them", player: "Solanke", assist: "Brennan Johnson" },
            { min: 26, side: "us", player: "Rashford", assist: "Mainoo" },
            { min: 49, side: "us", player: "Bruno", assist: "Neves" },
            { min: 66, side: "them", player: "Maddison", assist: "Pedro Porro" },
            { min: 82, side: "us", player: "Rashford", assist: "Diao" }
          ]
        },
        {
          id: "pl-2028-arsenal-home", date: "2028-04-15", comp: "pl", round: "MW31", opp: "Arsenal", venue: "H", score: [3, 2],
          tactic: "Counterattack",
          goals: [
            { min: 17, side: "us", player: "Rashford", assist: "Neves" },
            { min: 39, side: "them", player: "Saka", assist: "Ødegaard" },
            { min: 58, side: "us", player: "Bruno", assist: "Mainoo" },
            { min: 73, side: "them", player: "Havertz", assist: "Martinelli" },
            { min: 86, side: "us", player: "Cunha", assist: "Mbeumo" }
          ],
          highlight: "The double over Arsenal",
          story: "Tej picked Counterattack instead of the expected possession plan and refused to settle for a draw. Cunha's 86th-minute winner opened an 80–75 lead at the top."
        },
        {
          id: "pl-2028-brentford", date: "2028-04-22", comp: "pl", round: "MW32", opp: "Brentford", venue: "A", score: [3, 0],
          goals: [
            { min: 14, side: "us", player: "Rashford", assist: "Diao" },
            { min: 38, side: "us", player: "Diao", assist: "Neves" },
            { min: 61, side: "us", player: "Bruno", assist: "Mainoo" }
          ],
          matchStats: { possession: 69, shots: 20, onTarget: 9, xg: 2.8, passAcc: 92 },
          potm: "Diao 9.4"
        },
        {
          id: "pl-2028-everton", date: "2028-04-29", comp: "pl", round: "MW33", opp: "Everton", venue: "H", score: [3, 0],
          goals: [
            { min: 15, side: "us", player: "Diao", assist: "Dimarco" },
            { min: 43, side: "us", player: "Cunha", assist: "Bruno" },
            { min: 64, side: "us", player: "Rashford", assist: "Mainoo" }
          ],
          matchStats: { possession: 73, shots: 19, onTarget: 8, xg: 2.8 }
        },
        {
          id: "pl-2028-leeds", date: "2028-05-06", comp: "pl", round: "MW34", opp: "Leeds United", venue: "A", score: [2, 1],
          goals: [
            { min: 32, side: "us", player: "Cunha", assist: "Neves" },
            { min: 55, side: "them", player: "Gnonto", assist: "Anton Stach" },
            { min: 72, side: "us", player: "Rashford", assist: "Bruno" }
          ]
        },
        {
          id: "pl-2028-forest", date: "2028-05-10", comp: "pl", round: "MW35", opp: "Nottingham Forest", venue: "A", score: [2, 0],
          goals: [
            { min: 29, side: "us", player: "Rashford", assist: "Mainoo" },
            { min: 68, side: "us", player: "Cunha", assist: "Diao" }
          ]
        },
        {
          id: "pl-2028-burnley", date: "2028-05-13", comp: "pl", round: "MW36", opp: "Burnley", venue: "H", score: [3, 0],
          goals: [
            { min: 14, side: "us", player: "Diao", assist: "Dimarco" },
            { min: 44, side: "us", player: "Bruno", assist: "Neves" },
            { min: 80, side: "us", player: "Chido", assist: "Bardghji" }
          ]
        },
        {
          id: "pl-2028-sunderland", date: "2028-05-17", comp: "pl", round: "MW37", opp: "Sunderland", venue: "H", score: [2, 1],
          goals: [
            { min: 21, side: "us", player: "Rashford", assist: "Bruno" },
            { min: 58, side: "them", player: "Isidor", assist: "Trai Hume" },
            { min: 81, side: "us", player: "Mbeumo", assist: "Neves" }
          ],
          highlight: "Champions of England",
          story: "Isidor levelled, so Tej sent on Mbeumo for Cunha and moved Rashford back inside. Mbeumo's 81st-minute winner made the title mathematically certain on 98 points."
        },
        {
          id: "pl-2028-liverpool", date: "2028-05-21", comp: "pl", round: "MW38", opp: "Liverpool", venue: "A", score: [2, 1],
          tactic: "All-Out Attack",
          goals: [
            { min: 25, side: "them", player: "Salah", assist: "Szoboszlai" },
            { min: 62, side: "us", player: "Diao", assist: "Cunha" },
            { min: 88, side: "us", player: "Rashford", assist: "Mainoo" }
          ],
          highlight: "101",
          story: "The title was won, but 101 still needed a win at Anfield. At 1–1 Tej went to All-Out Attack around the 80th minute. Rashford's 88th-minute goal made it 101 points and 101 league goals. A draw would have left United on 99."
        },

        /* ---------------- Champions League ---------------- */
        { id: "ucl-md1", date: "MD1", comp: "ucl", round: "League phase", opp: "Porto", venue: "H", score: [2, 0] },
        { id: "ucl-md2", date: "MD2", comp: "ucl", round: "League phase", opp: "Inter", venue: "A", score: [1, 1] },
        { id: "ucl-md3", date: "MD3", comp: "ucl", round: "League phase", opp: "Benfica", venue: "A", score: [1, 2] },
        { id: "ucl-md4", date: "MD4", comp: "ucl", round: "League phase", opp: "Borussia Dortmund", venue: "H", score: [3, 2] },
        { id: "ucl-md5", date: "MD5", comp: "ucl", round: "League phase", opp: "PSG", venue: "H", score: [2, 2] },
        { id: "ucl-md6", date: "MD6", comp: "ucl", round: "League phase", opp: "RB Leipzig", venue: "A", score: [2, 1] },
        { id: "ucl-md7", date: "MD7", comp: "ucl", round: "League phase", opp: "Sporting CP", venue: "A", score: [1, 1] },
        {
          id: "ucl-md8", date: "2028-01-26", comp: "ucl", round: "League phase", opp: "RB Salzburg", venue: "A", score: [3, 0],
          scorers: "Rashford (Neves), Bruno (Mainoo), Mbeumo (Bruno)"
        },
        { id: "ucl-po1", date: "2028-02-15", comp: "ucl", round: "Play-off, leg 1", opp: "Feyenoord", venue: "A", score: [1, 1] },
        { id: "ucl-po2", date: "2028-02-23", comp: "ucl", round: "Play-off, leg 2", opp: "Feyenoord", venue: "H", score: [3, 0], agg: "4–1" },
        { id: "ucl-r16-1", date: "2028-03-07", comp: "ucl", round: "Round of 16, leg 1", opp: "Atlético Madrid", venue: "A", score: [1, 1] },
        { id: "ucl-r16-2", date: "2028-03-14", comp: "ucl", round: "Round of 16, leg 2", opp: "Atlético Madrid", venue: "H", score: [2, 0], agg: "3–1" },
        { id: "ucl-qf-1", date: "2028-04-04", comp: "ucl", round: "Quarter-final, leg 1", opp: "Bayer Leverkusen", venue: "H", score: [2, 1] },
        {
          id: "ucl-qf-2", date: "2028-04-11", comp: "ucl", round: "Quarter-final, leg 2", opp: "Bayer Leverkusen", venue: "A", score: [1, 1], agg: "3–2",
          goals: [
            { min: 63, side: "them", player: "Schick", assist: "Palacios" },
            { min: 81, side: "us", player: "Bruno", assist: "Diao" }
          ]
        },
        {
          id: "ucl-sf-1", date: "2028-04-26", comp: "ucl", round: "Semi-final, leg 1", opp: "Real Madrid", venue: "A", ground: "Bernabéu", score: [2, 2],
          goals: [
            { min: 21, side: "them", player: "Mbappé", assist: "Bellingham" },
            { min: 47, side: "them", player: "Vinícius Júnior", assist: "Valverde" },
            { min: 60, side: "us", player: "Rashford", assist: "Bruno" },
            { min: 83, side: "us", player: "Diao", assist: "Neves" }
          ],
          highlight: "Back from 2–0 down",
          story: "Two goals down at the Bernabéu, Tej moved from Counterattack to Tiki-Taka V2 and then Aggressive Tiki-Taka. Rashford and Diao brought it back to 2–2."
        },
        {
          id: "ucl-sf-2", date: "2028-05-03", comp: "ucl", round: "Semi-final, leg 2", opp: "Real Madrid", venue: "H", score: [2, 1], agg: "4–3",
          goals: [
            { min: 29, side: "them", player: "Rodrygo", assist: "Valverde" },
            { min: 47, side: "us", player: "Rashford", assist: "Cunha" },
            { min: 76, side: "us", player: "Diao", assist: "Neves" }
          ],
          highlight: "Madrid beaten",
          story: "Behind on aggregate after Rodrygo's goal, United turned it round through the new front three: Cunha set up Rashford, and Diao scored the winner. 4–3 on aggregate and a second straight final."
        },
        {
          id: "ucl-2028-final", date: "2028-05-27", comp: "ucl", round: "Final", opp: "Barcelona", venue: "N", ground: "Wembley",
          score: [3, 2], aet: true,
          lineup: "Lammens; Koundé, Yoro, Cubarsí, Dimarco; Neves, Mainoo; Rashford, Bruno (C), Diao; Cunha",
          goals: [
            { min: 19, side: "them", player: "Lamine Yamal", assist: "Pedri" },
            { min: 39, side: "us", player: "Assane Diao", assist: "Federico Dimarco" },
            { min: 64, side: "them", player: "Raphinha", assist: "Lamine Yamal" },
            { min: 78, side: "us", player: "Matheus Cunha", assist: "Bruno Fernandes" },
            { min: 112, side: "us", player: "Marcus Rashford", assist: "Bryan Mbeumo" }
          ],
          matchStats: { possession: 48, shots: 19, onTarget: 9, xg: 3.0, passAcc: 88 },
          oppStats: { possession: 52, shots: 17, onTarget: 7, xg: 2.4, passAcc: 89 },
          potm: "Rashford 9.6",
          highlight: "Back-to-back",
          story:
            "Barcelona led twice. Diao answered Yamal, Cunha answered Raphinha. Mbeumo came on at 88 minutes and Rashford moved central. In the 112th minute Cubarsí won the ball against his former club, Neves found Bruno, Bruno released Mbeumo, and Mbeumo crossed for Rashford to win it. Lammens had saved from Raphinha at 104; Cubarsí intercepted again at 118."
        },

        /* ---------------- Carabao Cup ---------------- */
        { id: "lc-r3", date: "2027-09-22", comp: "lc", round: "Round 3", opp: "Sheffield Wednesday", venue: "H", score: [2, 0], scorers: "Diao (Bardghji), Chido (Martim)" },
        { id: "lc-r4", date: "2027-10-27", comp: "lc", round: "Round 4", opp: "Everton", venue: "H", score: [3, 1], scorers: "Bardghji (Diao), Chido (Baleba), Diao (Dorgu)" },
        { id: "lc-qf", date: "2027-12-22", comp: "lc", round: "Quarter-final", opp: "Newcastle", venue: "A", score: [2, 1], scorers: "Chido (Bardghji), Diao (Baleba)" },
        { id: "lc-sf-1", date: "2028-01-12", comp: "lc", round: "Semi-final, leg 1", opp: "Tottenham", venue: "H", score: [2, 0], scorers: "Bardghji (Chido), Cunha (Martim)" },
        { id: "lc-sf-2", date: "2028-02-02", comp: "lc", round: "Semi-final, leg 2", opp: "Tottenham", venue: "A", score: [1, 1], agg: "3–1", scorers: "Diao (Bardghji)" },
        {
          id: "lc-2028-final", date: "2028-02-29", comp: "lc", round: "Final", opp: "Chelsea", venue: "N", ground: "Wembley", score: [2, 1],
          goals: [
            { min: 14, side: "them", player: "Cole Palmer", assist: "Enzo Fernández" },
            { min: 44, side: "us", player: "Chido Obi", assist: "Assane Diao" },
            { min: 83, side: "us", player: "Roony Bardghji", assist: "João Neves" }
          ],
          highlight: "The kids win at Wembley",
          story: "A young, rotated side came from behind against Chelsea while the first XI was kept for the league. Bardghji's 83rd-minute winner, and Bruno lifted the cup as club captain."
        },

        /* ---------------- FA Cup ---------------- */
        { id: "fac-r3", date: "2028-01-06", comp: "fac", round: "Round 3", opp: "Plymouth", venue: "H", score: [3, 0], scorers: "Chido (Bardghji), Diao (Martim), Vušković (Dorgu)" },
        { id: "fac-r4", date: "2028-02-09", comp: "fac", round: "Round 4", opp: "Sheffield United", venue: "A", score: [2, 1], scorers: "Chido (Diao), Cunha (Bardghji)" },
        { id: "fac-r5", date: "2028-02-21", comp: "fac", round: "Round 5", opp: "Leicester", venue: "H", score: [3, 1], scorers: "Diao (Dorgu), Chido (Martim), Bardghji (Cunha)" },
        {
          id: "fac-qf", date: "2028-03-22", comp: "fac", round: "Quarter-final", opp: "Liverpool", venue: "A", score: [1, 2],
          goals: [
            { min: 22, side: "them", player: "Salah", assist: "Szoboszlai" },
            { min: 67, side: "us", player: "Chido", assist: "Bardghji" },
            { min: 82, side: "them", player: "Gakpo", assist: "Mac Allister" }
          ]
        }
      ],

      notes: [
        "18 of 38 league results were retained in the archive; the season totals cover all 38.",
        "Champions League league-phase dates for MD1 to MD7 were not retained.",
        "The 2027/28 trophy haul is Premier League, Carabao Cup and Champions League. The FA Cup was lost to Liverpool, so it is not the traditional treble."
      ]
    }
  ],

  /* Hall of Fame. Goals, assists, seasons and trophies are added up from the
     seasons above. tier: "legend" gets a large plaque, "inductee" a small one. */
  hallOfFame: [
    {
      name: "Marcus Rashford", tier: "legend", position: "Forward", epithet: "The Closer", inducted: "2027/28",
      citation: "Scored in both Champions League finals: the opener in Lisbon and the 112th-minute winner at Wembley. His 88th-minute goal at Anfield made it 101 points. Man of the Match in the 2028 final (9.6)."
    },
    {
      name: "Bruno Fernandes", tier: "legend", position: "Captain, attacking midfield", epithet: "The Captain", inducted: "2027/28",
      citation: "Lifted every trophy of the era. 25 goals and 24 assists in 2027/28, 49 direct goal involvements, and the pass that sent Mbeumo away for the Wembley winner. 91 OVR, the highest in the squad."
    },
    {
      name: "Matheus Cunha", tier: "legend", position: "Forward", epithet: "Big-Game Hunter", inducted: "2027/28",
      citation: "Won the 2027 final with a 117th-minute goal, equalised in the 2028 final, and scored the 86th-minute winner against Arsenal that opened the title gap. Moved from left wing to centre-forward without missing a beat."
    },
    {
      name: "Assane Diao", tier: "inductee", position: "Left wing", epithet: "The Breakout", inducted: "2027/28",
      citation: "A €37M signing who grew from 81 to 84, took the left wing and scored in both Real Madrid legs and the Wembley final."
    },
    {
      name: "João Neves", tier: "inductee", position: "Central midfield", epithet: "The Architect", inducted: "2027/28",
      citation: "34 assists, the most in the squad, including the pass for the title-clinching goal against Sunderland."
    },
    {
      name: "Kobbie Mainoo", tier: "inductee", position: "Central midfield", epithet: "The Metronome", inducted: "2027/28",
      citation: "28 assists and the ball for Rashford's 101-point winner at Anfield. Rose from 84 to 86."
    },
    {
      name: "Bryan Mbeumo", tier: "inductee", position: "Right wing", epithet: "Super-Sub", inducted: "2027/28",
      citation: "Won the league off the bench against Sunderland, then came on at Wembley and set up the 112th-minute winner."
    },
    {
      name: "Chido Obi", tier: "inductee", position: "Striker", epithet: "Cup King", inducted: "2027/28",
      citation: "18 goals in his breakout year, eight of them in the domestic cups, including the equaliser in the Carabao Cup final."
    },
    {
      name: "Roony Bardghji", tier: "inductee", position: "Right wing", epithet: "Wembley Winner", inducted: "2027/28",
      citation: "Scored the 83rd-minute winner in the Carabao Cup final and created 17 goals."
    },
    {
      name: "Pau Cubarsí", tier: "inductee", position: "Centre-back", epithet: "The Wall", inducted: "2027/28",
      citation: "Won the ball against his former club to start the winning move in the 2028 final, then made the decisive interception at 118."
    }
  ],

  /* Record book. ticker: true also puts it on the scrolling board. */
  records: [
    { value: "101", unit: "pts", label: "Premier League points", detail: "Past Manchester City's 100-point benchmark, with a win at Anfield on the final day.", season: "2027/28", ticker: true },
    { value: "101", unit: "goals", label: "Premier League goals", detail: "101 scored, 33 conceded, goal difference +68.", season: "2027/28" },
    { value: "17", unit: "wins", label: "Consecutive league wins", detail: "Every league game from matchweek 22 to matchweek 38.", season: "2027/28", ticker: true },
    { value: "2", unit: "in a row", label: "Champions League titles", detail: "Lisbon 2027 and Wembley 2028, both won in extra time.", season: "2026/27 & 2027/28" },
    { value: "8–2", unit: "", label: "Manchester derby", detail: "18 September 2027. United won the two league derbies 13–4 on aggregate.", season: "2027/28", ticker: true },
    { value: "1", unit: "defeat", label: "League defeats all season", detail: "Bournemouth 2–1 United, 23 January 2028.", season: "2027/28" },
    { value: "45", unit: "goals", label: "Rashford in one season", detail: "All competitions, up from 35 the year before.", season: "2027/28", ticker: true },
    { value: "34", unit: "assists", label: "Neves in one season", detail: "The squad's leading creator in all competitions.", season: "2027/28" },
    { value: "154", unit: "goals", label: "Goals in one season", detail: "65 matches in all competitions, 59 conceded.", season: "2027/28" }
  ]
};
