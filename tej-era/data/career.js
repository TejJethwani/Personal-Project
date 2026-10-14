/* ==========================================================================
   THE TEJ ERA: CAREER DATA
   --------------------------------------------------------------------------
   Every tab of the site is drawn from this one file. To add a season, copy
   the last object in `seasons`, change the numbers, and save. The trophy
   cabinet, honours board, manager card, stats, hall of fame totals, LED
   board and timeline all update on their own.

   Conventions
   - club: a key from `clubs` below. A new club needs one line there.
   - Dates are "YYYY-MM-DD". If the exact day is unknown, write any text
     instead (for example "Mar 2028") and it is shown as written.
   - venue: "H" home, "A" away, "N" neutral (finals), null if not recovered.
   - score: [Tej's team goals, opponent goals] whatever the venue. Add
     aet: true for extra time and pens: [ours, theirs] for a shoot-out.
     If the score was not recorded, write score: null and result: "W",
     "D", "L" or null.
   - goals: side "us" or "them"; min is the minute; player null when the
     scorer was not named.
   - Use the same full player name every season so totals add up.
   - null means "not retained in the archive" and shows as a dash. Never
     guess a number: leave it null. goalsAtLeast: n records a known
     minimum (shown as "n+").

   This is a fictional career-mode save. Nothing here is real football
   history.
   ========================================================================== */

window.TEJ_ERA = {
  manager: {
    name: "Tej Jethwani",
    philosophy:
      "An elite, adaptable, attack-minded side that keeps creative possession without becoming predictable, switching systems as opponents and game states demand.",
    // Shown in the footer. Update after every new save.
    archive: { save: "12BG", date: "2029-06-01", note: "Awards night after the Europa League final" },
    // Things that are announced but not decided yet.
    pending: [
      "2027 Ballon d'Or: still unawarded when the United archive closed on 27 May 2028, with Bruno Fernandes projected first. No result has been recorded since.",
      "Milan's 2029/30 budget waits on the June board meeting."
    ]
  },

  /* Clubs Tej has managed, in order. tag is the short badge text. */
  clubs: {
    mu:  { name: "Manchester United", short: "United", tag: "MUN", from: 2026, to: 2028 },
    acm: { name: "AC Milan",          short: "Milan",  tag: "MIL", from: 2028, to: null }
  },

  /* Competitions the cabinet knows about.
     type: "league", "europe", "cup" or "leagueCup" (the honours board columns).
     trophy picks the drawing: "ucl" big-ears cup, "pl" crowned trophy,
     "lc" three-handled cup, "fac" lidded cup, "uel" tall vase, "coppa"
     cup with a tricolour band, "scudetto" starred trophy, "cup" generic
     cup for anything new (Super Cup, Club World Cup ...). */
  competitions: {
    pl:  { name: "Premier League",        short: "PL",      type: "league",    trophy: "pl",       metal: "silver" },
    ucl: { name: "UEFA Champions League", short: "UCL",     type: "europe",    trophy: "ucl",      metal: "silver" },
    fac: { name: "FA Cup",                short: "FA Cup",  type: "cup",       trophy: "fac",      metal: "silver" },
    lc:  { name: "Carabao Cup",           short: "Carabao", type: "leagueCup", trophy: "lc",       metal: "silver" },
    sa:  { name: "Serie A",               short: "Serie A", type: "league",    trophy: "scudetto", metal: "silver" },
    uel: { name: "UEFA Europa League",    short: "UEL",     type: "europe",    trophy: "uel",      metal: "silver" },
    cit: { name: "Coppa Italia",          short: "Coppa",   type: "cup",       trophy: "coppa",    metal: "silver" }
  },

  seasons: [
    /* ======================================================================
       SEASON ONE: 2026/27
       ====================================================================== */
    {
      id: "2026-27",
      label: "2026/27",
      club: "mu",
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
        // Cunha's season total was not kept; his Lisbon winner is the one goal on record.
        { name: "Matheus Cunha", goals: null, goalsAtLeast: 1, assists: null }
      ],

      // No starting XI survives for 2026/27, so the lineups tab shows these players.
      lineupsNote: "No 2026/27 starting eleven was preserved, not even for the Lisbon final. These are the players the archive names.",
      core: [
        { name: "Marcus Rashford", pos: "FW", note: "35 goals, 10 assists. Opened the scoring in Lisbon." },
        { name: "Bruno Fernandes", pos: "AM", captain: true, note: "18 goals, 25 assists. Lifted the Champions League as captain." },
        { name: "Matheus Cunha", pos: "FW", note: "Scored the 117th-minute winner against Bayern Munich." }
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
        },
        {
          id: "ucl-2027-sf", date: "Date not recovered", comp: "ucl", round: "Semi-final, two legs", opp: "Opponent not recovered", venue: null,
          score: null, result: null,
          outcomeText: "Through to the final. Opponent, dates, venues, scores and scorers were not recovered."
        },
        {
          id: "fac-2027-qf", date: "Date not recovered", comp: "fac", round: "Quarter-final", opp: "Brighton", venue: null,
          score: null, result: "L",
          outcomeText: "Knocked out. Venue, score and scorers were not recovered."
        },
        {
          id: "lc-2027-qf", date: "Date not recovered", comp: "lc", round: "Quarter-final", opp: "Newcastle", venue: null,
          score: null, result: "L",
          outcomeText: "Knocked out. Venue, score and scorers were not recovered."
        }
      ],

      notes: [
        "The original 2026/27 match-by-match log was not preserved. The 38 league results are known only as totals: 24 wins, 8 draws, 6 defeats, 73 scored, 31 conceded.",
        "Only the Lisbon final has a recorded score. The cup exits to Brighton and Newcastle and the Champions League semi-final are listed without scores; their home or away status is not known either.",
        "United 4–1 Brighton (Rashford ×2, Bruno, Diao) and Newcastle 1–2 United (Chido, Diao) belong to 2027/28, not to these quarter-finals."
      ]
    },

    /* ======================================================================
       SEASON TWO: 2027/28
       ====================================================================== */
    {
      id: "2027-28",
      label: "2027/28",
      club: "mu",
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

      // Lineups: back line to front line, each row left to right.
      lineups: [
        {
          title: "The earlier first-choice XI",
          when: "2027/28, until mid-April 2028",
          shape: "4-2-3-1",
          match: "pl-2028-arsenal-home",
          rows: [
            [{ name: "Lammens", pos: "GK" }],
            [{ name: "Dimarco", pos: "LB" }, { name: "Cubarsí", pos: "CB" }, { name: "Yoro", pos: "CB" }, { name: "Koundé", pos: "RB" }],
            [{ name: "Mainoo", pos: "CM" }, { name: "Neves", pos: "CM" }],
            [{ name: "Cunha", pos: "LW" }, { name: "Bruno", pos: "CAM", captain: true }, { name: "Mbeumo", pos: "RW" }],
            [{ name: "Rashford", pos: "ST" }]
          ],
          note: "Tej's earlier preferred XI and his first-choice side for most of the title run. The archive confirms this front three (Cunha LW, Rashford ST, Mbeumo RW) for the 3–2 win over Arsenal on 15 April; the rest of that day's XI was not recorded."
        },
        {
          title: "Champions League final",
          when: "Wembley, 27 May 2028",
          shape: "4-2-3-1",
          match: "ucl-2028-final",
          rows: [
            [{ name: "Lammens", pos: "GK" }],
            [{ name: "Dimarco", pos: "LB" }, { name: "Cubarsí", pos: "CB" }, { name: "Yoro", pos: "CB" }, { name: "Koundé", pos: "RB" }],
            [{ name: "Mainoo", pos: "CM" }, { name: "Neves", pos: "CM" }],
            [{ name: "Diao", pos: "LW" }, { name: "Bruno", pos: "CAM", captain: true }, { name: "Rashford", pos: "RW" }],
            [{ name: "Cunha", pos: "ST" }]
          ],
          benchLabel: "Came on",
          bench: ["Mbeumo (88')", "Baleba (96')"],
          note: "The final front three: Diao on the left, Cunha through the middle and Rashford cutting in from the right. Mbeumo came off the bench to set up the winner."
        }
      ],

      tacticsTitle: "Six ways to play",
      tactics: [
        { name: "Counterattack", text: "Compact shape, rapid transitions, passes into the space behind high lines. Beat Arsenal 3–2 at Old Trafford." },
        { name: "Total Possession", text: "Patient build-up, positional dominance and progressive control of the ball." },
        { name: "Controlled Possession", text: "Safer positioning, fewer risky passes, stronger rest defence. The opening plan at Wembley." },
        { name: "Tiki-Taka V2", text: "Passing triangles through Neves, Mainoo and Bruno; attack after the first goal with cover behind the ball. Debuted in the 2–1 win at Arsenal." },
        { name: "Aggressive Tiki-Taka", text: "Higher press and faster combinations to chase goals. Switched on late in the comeback from 2–0 down at the Bernabéu (2–2) and before Cunha's equaliser at Wembley." },
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
    },

    /* ======================================================================
       SEASON THREE: 2028/29 · AC MILAN
       Every competitive match is on record. Generated from the season
       archive and checked match by match against it.
       ====================================================================== */
    {
      id: "2028-29",
      label: "2028/29",
      club: "acm",
      title: "The Rossoneri Rebuild",
      summary:
        "Tej left a Manchester United dynasty to rebuild sixth-placed AC Milan. He sold Nkunku, Rabiot and Estupiñán, signed Moretti, Valera and Nascimento, and gave a debut to a 16-year-old left-back from his own hometown. Milan played 60 matches, beat Inter 4–2 away, reached both cup finals and finished fifth in Serie A, then won the Europa League in extra time to qualify for the Champions League.",

      competitions: [
        { comp: "sa",  stage: "5th",        won: false, note: "75 points, 21W 12D 5L. Twelve draws kept Milan out of the top four" },
        { comp: "uel", stage: "Winners",    won: true,  note: "Beat Athletic Club 2–1 after extra time. Through Porto, Ajax, Frankfurt and Tottenham", final: "uel-2029-final" },
        { comp: "cit", stage: "Runners-up", won: false, note: "Lost 2–1 to Juventus in the final in Rome", final: "cit-2029-final" }
      ],

      league: { position: 5, p: 38, w: 21, d: 12, l: 5, gf: 68, ga: 33, pts: 75 },
      allComps: { p: 60, gf: 110, ga: 58 },

      table: {
        caption: "Top eight as published; the rest of the table was not published. Milan's goal difference is +35 from the recorded scores (the save's summary said +34).",
        rows: [
          { pos: 1, club: "Inter",     w: 28, d: 6,  l: 4,  gd: 46, pts: 90, note: "Champions" },
          { pos: 2, club: "Napoli",    w: 26, d: 10, l: 2,  gd: 43, pts: 88 },
          { pos: 3, club: "Juventus",  w: 25, d: 9,  l: 4,  gd: 38, pts: 84 },
          { pos: 4, club: "Roma",      w: 24, d: 8,  l: 6,  gd: 32, pts: 80 },
          { pos: 5, club: "AC Milan",  w: 21, d: 12, l: 5,  gd: 35, pts: 75 },
          { pos: 6, club: "Atalanta",  w: 20, d: 10, l: 8,  gd: 25, pts: 70 },
          { pos: 7, club: "Lazio",     w: 18, d: 10, l: 10, gd: 18, pts: 64 },
          { pos: 8, club: "Bologna",   w: 15, d: 12, l: 11, gd: 12, pts: 57 }
        ]
      },

      // Points at each month-end the archive records.
      pointsRace: {
        title: "Race for the top four",
        matchweeks: [14, 18, 22, 26, 30, 34, 38],
        series: [
          { club: "AC Milan", us: true, values: [29, 38, 48, 55, 60, 67, 75] },
          { club: "Inter", values: [34, 44, 51, 62, 71, 81, 90] },
          { club: "Roma", values: [27, 37, 47, 54, 64, 70, 80] }
        ],
        notes: { 30: "Fell to 5th" },
        caption: "Points at each month-end checkpoint. Inter won the title; Roma took the last Champions League place in the league, and Milan went through the Europa League instead."
      },

      // Every Milan goal and assist from the 60 match reports (110 of each).
      stats: [
        { name: "Christian Pulisic", goals: 19, assists: 15 },
        { name: "Rafael Leão", goals: 21, assists: 10 },
        { name: "Mateo Valera", goals: 11, assists: 18 },
        { name: "Samuele Ricci", goals: 0, assists: 22 },
        { name: "Gabriel Nascimento", goals: 17, assists: 1 },
        { name: "Santiago Giménez", goals: 17, assists: 0 },
        { name: "Giovanni Ferri", goals: 7, assists: 7 },
        { name: "Ardon Jashari", goals: 6, assists: 7 },
        { name: "Rana Metodija", goals: 1, assists: 10 },
        { name: "Alessio Moretti", goals: 0, assists: 10 },
        { name: "Luca Bellini", goals: 8, assists: 0 },
        { name: "Alexis Saelemaekers", goals: 0, assists: 8 },
        { name: "Youssouf Fofana", goals: 1, assists: 1 },
        { name: "David Odogu", goals: 1, assists: 0 },
        { name: "Fikayo Tomori", goals: 1, assists: 0 },
        { name: "Davide Bartesaghi", goals: 0, assists: 1 }
      ],

      squad: [
        { name: "Mike Maignan", group: "GK", pos: "GK", age: 32, ovr: 85, role: "Captain" },
        { name: "Lorenzo Torriani", group: "GK", pos: "GK", age: 23, ovr: 75, role: "Back-up goalkeeper" },
        { name: "Matteo Greco", group: "GK", pos: "GK", age: 21, ovr: 69, role: "Third-choice goalkeeper" },
        { name: "Alessio Moretti", group: "DEF", pos: "RB", age: 24, ovr: 84, from: 83, role: "Signed from Torino" },
        { name: "Zachary Athekame", group: "DEF", pos: "RB", age: 23, ovr: 77, role: "RB rotation" },
        { name: "Fikayo Tomori", group: "DEF", pos: "CB", age: 30, ovr: 82, role: "Started both cup finals" },
        { name: "Strahinja Pavlović", group: "DEF", pos: "CB", age: 27, ovr: 82, role: "First-choice CB" },
        { name: "Koni De Winter", group: "DEF", pos: "CB", age: 25, ovr: 82, from: 81, role: "CB" },
        { name: "Matteo Gabbia", group: "DEF", pos: "CB", age: 28, ovr: 79, role: "CB" },
        { name: "David Odogu", group: "DEF", pos: "CB", age: 22, ovr: 76, from: 75, role: "Young CB" },
        { name: "Davide Bartesaghi", group: "DEF", pos: "LB/CB", age: 22, ovr: 80, from: 79, role: "LB / CB" },
        { name: "Rana Metodija", group: "DEF", pos: "LB", age: 16, ovr: 83, from: 82, role: "#36 · natural RB overall 82 → 83 · LB positional fit 79 → 85" },
        { name: "Alexis Saelemaekers", group: "DEF", pos: "RM/RWB", age: 28, ovr: 81, from: 80, role: "Wide option" },
        { name: "Samuele Ricci", group: "MID", pos: "CDM/CM", age: 26, ovr: 85, from: 83, role: "Vice-captain" },
        { name: "Mateo Valera", group: "MID", pos: "CM", age: 23, ovr: 87, from: 84, role: "Signed from Real Sociedad" },
        { name: "Ardon Jashari", group: "MID", pos: "CM", age: 25, ovr: 84, from: 82, role: "Ball-carrier" },
        { name: "Youssouf Fofana", group: "MID", pos: "CDM", age: 29, ovr: 82, role: "Midfield shield" },
        { name: "Ruben Loftus-Cheek", group: "MID", pos: "CM", age: 32, ovr: 78, role: "Squad midfielder" },
        { name: "Giovanni Ferri", group: "MID", pos: "CM", age: 19, ovr: 75, from: 70, role: "Academy" },
        { name: "Rafael Leão", group: "ATT", pos: "LW/ST", age: 28, ovr: 88, from: 87, role: "Attacking leader" },
        { name: "Christian Pulisic", group: "ATT", pos: "RW/CAM", age: 29, ovr: 85, role: "Right wing" },
        { name: "Gabriel Nascimento", group: "ATT", pos: "ST", age: 24, ovr: 84, from: 82, role: "Signed from Braga" },
        { name: "Santiago Giménez", group: "ATT", pos: "ST", age: 27, ovr: 83, from: 81, role: "Striker" },
        { name: "Luca Bellini", group: "ATT", pos: "ST", age: 18, ovr: 72, from: 68, role: "Academy" }
      ],

      // Lineups: back line to front line, each row left to right.
      lineups: [
        {
          title: "Opening day",
          when: "20 Aug 2028",
          shape: "4-3-3",
          match: "sa-md1",
          rows: [
            [{ name: "Maignan", pos: "GK", captain: true }],
            [{ name: "Metodija", pos: "LB" }, { name: "Pavlović", pos: "CB" }, { name: "De Winter", pos: "CB" }, { name: "Moretti", pos: "RB" }],
            [{ name: "Valera", pos: "CM" }, { name: "Ricci", pos: "DM" }, { name: "Jashari", pos: "CM" }],
            [{ name: "Leão", pos: "LW" }, { name: "Nascimento", pos: "ST" }, { name: "Pulisic", pos: "RW" }]
          ],
          benchLabel: "Came on",
          bench: ["Bartesaghi (71')", "Fofana (73')", "Giménez (76')", "Tomori (81')"],
          note: "Tej's first-choice 4-3-3, named before the opener. Metodija made his Serie A debut at 16."
        },
        {
          title: "The Tej Special",
          when: "19 Nov 2028",
          shape: "4-3-3",
          match: "sa-md13",
          rows: [
            [{ name: "Maignan", pos: "GK", captain: true }],
            [{ name: "Bartesaghi", pos: "LB" }, { name: "Pavlović", pos: "CB" }, { name: "Tomori", pos: "CB" }, { name: "Moretti", pos: "RB" }],
            [{ name: "Valera", pos: "CM" }, { name: "Ricci", pos: "DM" }, { name: "Jashari", pos: "CM" }],
            [{ name: "Leão", pos: "LW" }, { name: "Nascimento", pos: "ST" }, { name: "Pulisic", pos: "RW" }]
          ],
          benchLabel: "Came on",
          bench: ["Fofana (65')", "Saelemaekers (68')", "Giménez (70')"],
          note: "All-out pressing for 90 minutes away at Inter. Leão scored twice and was rated 9.7."
        },
        {
          title: "Europa League final",
          when: "30 May 2029",
          shape: "4-3-3",
          match: "uel-2029-final",
          rows: [
            [{ name: "Maignan", pos: "GK", captain: true }],
            [{ name: "Metodija", pos: "LB" }, { name: "Pavlović", pos: "CB" }, { name: "Tomori", pos: "CB" }, { name: "Moretti", pos: "RB" }],
            [{ name: "Valera", pos: "CM" }, { name: "Ricci", pos: "DM" }, { name: "Jashari", pos: "CM" }],
            [{ name: "Leão", pos: "LW" }, { name: "Nascimento", pos: "ST" }, { name: "Pulisic", pos: "RW" }]
          ],
          benchLabel: "Came on",
          bench: ["Bartesaghi (92')", "Fofana", "Giménez"],
          note: "The same XI started the Coppa Italia final two weeks earlier. Metodija set up the equaliser; Ricci set up Leão's winner."
        }
      ],

      awards: [
        { award: "Player of the Season", winner: "Rafael Leão", detail: "21 goals, the most in the squad, and the 111th-minute Europa League final winner." },
        { award: "Goal of the Season", winner: "Rafael Leão", detail: "The extra-time winner against Athletic Club. Nominees: Metodija 88' at Fiorentina, Pulisic 72' v Juventus." },
        { award: "Midfielder of the Season", winner: "Samuele Ricci", detail: "Ran the build-up and made 22 assists, including the European final winner." },
        { award: "Goalkeeper of the Season", winner: "Mike Maignan", detail: "Decisive saves against Ajax, Porto, Frankfurt, Juventus and Athletic; lifted the trophy as captain." },
        { award: "Young Player of the Season", winner: "Rana Metodija", detail: "Aged 16. Won the Coppa semi-final at Fiorentina and set up the Europa League final equaliser." },
        { award: "Signing of the Season", winner: "Mateo Valera", detail: "Rose from 84 to 87 and reshaped the midfield." },
        { award: "Academy Breakthrough", winner: "Giovanni Ferri", detail: "Began at 70 and finished at 75, with 7 goals and 7 assists." },
        { award: "Impact Player", winner: "Santiago Giménez", detail: "Refused to be frozen out by Nascimento: 17 goals, including against Porto, Ajax and Lazio." }
      ],

      tacticsTitle: "Nine ways to play",
      tactics: [
        { name: "Controlled Counter", text: "Tej's base system: a flexible 4-3-3 that switched between slow control and fast transitions, with Ricci running the build-up and Leão and Pulisic attacking space, instead of defending deep for 90 minutes." },
        { name: "Aggressive Controlled Counter", text: "A more aggressive version of the base counter, brought in for September and first used in the 2-1 win at Bologna." },
        { name: "Total Possession", text: "Short, patient passing with Ricci setting the tempo; it gave 66% possession in the 2-1 win over Juventus, but Lyon exposed it in transition in a 2-0 defeat." },
        { name: "All-Out Attack", text: "Used to win early against weaker sides and then rotate, and in the big European nights: the 4-1 win over Rangers, the 3-2 win in Amsterdam and the three-goal first half against Tottenham." },
        { name: "Tej Special", text: "All-out high pressing for the whole match; it beat Inter 4-2 in November, but Inter adapted and won the April rematch 3-2." },
        { name: "Disciplined Counter", text: "Disciplined transitions used away from home: a 2-0 win at Fenerbahçe and a 2-1 win at Frankfurt, picked to avoid a repeat of the Lyon problem." },
        { name: "Natural Counterattack", text: "A throwback to Tej's first Manchester United season, with direct counterattacks; used in the 2-2 draw at Parma." },
        { name: "Hybrid Control", text: "Used against dangerous clubs (Napoli away) and in tight knockout ties (Porto, Frankfurt, Fiorentina, Tottenham); in the Europa League final against Athletic Club it ran as a Hybrid Controlled Counter." },
        { name: "Compact 4-1-4-1", text: "A press-aware, compact 4-1-4-1 that earned a 0-0 away draw at Juventus three days after the Ajax away leg." }
      ],

      signings: [
        { name: "Alessio Moretti", fee: "€36M + €3M", note: "Right-back from Torino. 83 → 84, 10 assists" },
        { name: "Mateo Valera", fee: "€44M + €4M", note: "Midfielder from Real Sociedad. Signing of the Season, 84 → 87" },
        { name: "Gabriel Nascimento", fee: "€31M + €2M", note: "Striker from Braga. 17 goals, 82 → 84" },
        { name: "Rana Metodija", fee: "Scouted", note: "16, from Tej's hometown in India. Young Player of the Season" }
      ],
      departures: [
        { name: "Christopher Nkunku", fee: "€36M + €3M", note: "To Atlético de Madrid, 12 Jun 2028" },
        { name: "Pervis Estupiñán", fee: "€16M + €2M", note: "To West Ham, 15 Jun 2028" },
        { name: "Adrien Rabiot", fee: "€7M + €1M", note: "To Fenerbahçe, 18 Jun 2028. Met Milan again in Istanbul" }
      ],
      staff: [
        { name: "Marco Bellandi", role: "Assistant", detail: "Italian, 44. 4-3-3 and controlled pressing" },
        { name: "Sergio Álvarez", role: "Tactics", detail: "Spanish, 39. Possession and attacking transitions" },
        { name: "Elena Conti", role: "Performance", detail: "Italian, 41. Fitness, recovery and Metodija's workload" },
        { name: "Daniel Weber", role: "Recruitment", detail: "German, 35. Analytics and talent identification" }
      ],

      finances: {
        caption: "Monthly figures are provisional operating statements from the save, not a reconciled profit. Year-end cash was not recorded.",
        rows: [
          { label: "Transfer budget after sales", value: "€128.11M" },
          { label: "Sales (Nkunku, Estupiñán, Rabiot)", value: "€59M + €6M" },
          { label: "Signings (Moretti, Valera, Nascimento)", value: "€111M + €9M" },
          { label: "Transfer budget left", value: "€5.61M" },
          { label: "Wage bill (ceiling €2.15M)", value: "€1.788M / wk" },
          { label: "Revenue, Aug–May", value: "€206.6M" },
          { label: "Operating surplus, Aug–May", value: "€49.2M" },
          { label: "Board / fan confidence", value: "98 / 100" }
        ],
        status: "Manager's release fee to United €6M; manager's salary €7.5M a season to June 2031. The 2029/30 budget waits on the June board meeting.",
        monthly: [
          { month: "Aug 2028", revenue: 13.1, expenses: 11.852 },
          { month: "Sep 2028", revenue: 15.9, expenses: 13.352 },
          { month: "Oct 2028", revenue: 18.9, expenses: 14.752 },
          { month: "Nov 2028", revenue: 21.5, expenses: 15.452 },
          { month: "Dec 2028", revenue: 17, expenses: 14.052 },
          { month: "Jan 2029", revenue: 16.3, expenses: 14.818 },
          { month: "Feb 2029", revenue: 23.1, expenses: 16.652 },
          { month: "Mar 2029", revenue: 20, expenses: 16.118 },
          { month: "Apr 2029", revenue: 26.6, expenses: 18.163 },
          { month: "May 2029", revenue: 34.2, expenses: 22.218 }
        ]
      },

      friendlies: [
        {
          id: "pre-1",
          date: "2028-07-15",
          comp: "fr",
          round: "Friendly",
          opp: "Como",
          venue: "H",
          ground: "Milanello",
          score: [3, 1],
          goals: [
            { min: 18, side: "us", player: "Leão", assist: "Valera" },
            { min: 43, side: "us", player: "Giménez", assist: "Pulisic" },
            { min: 61, side: "them", player: "Gabriel Strefezza" },
            { min: 79, side: "us", player: "Bellini", assist: "Ferri" }
          ],
          potm: "Leão 8.4"
        },
        {
          id: "pre-2",
          date: "2028-07-20",
          comp: "fr",
          round: "Friendly",
          opp: "PSV Eindhoven",
          venue: "H",
          ground: "San Siro",
          score: [2, 2],
          goals: [
            { min: 26, side: "us", player: "Pulisic", assist: "Jashari" },
            { min: 39, side: "them", player: "Malik Tillman" },
            { min: 67, side: "us", player: "Nascimento", assist: "Moretti" },
            { min: 81, side: "them", player: "Ismael Saibari" }
          ],
          best: "Pulisic 8.0"
        },
        {
          id: "pre-3",
          date: "2028-07-25",
          comp: "fr",
          round: "Friendly",
          opp: "Valencia",
          venue: "A",
          ground: "Mestalla",
          score: [1, 2],
          goals: [
            { min: 14, side: "them", player: "Hugo Duro" },
            { min: 56, side: "us", player: "Jashari", assist: "Ricci" },
            { min: 72, side: "them", player: "Diego López" }
          ]
        },
        {
          id: "pre-4",
          date: "2028-07-31",
          comp: "fr",
          round: "Friendly",
          opp: "Borussia Dortmund",
          venue: "H",
          ground: "San Siro",
          score: [2, 1],
          goals: [
            { min: 33, side: "us", player: "Leão", assist: "Pulisic" },
            { min: 61, side: "them", player: "Karim Adeyemi" },
            { min: 76, side: "us", player: "Valera", assist: "Metodija" }
          ],
          potm: "Valera 8.6"
        }
      ],

      matches: [
        {
          id: "sa-md1",
          date: "2028-08-20",
          comp: "sa",
          round: "MD1",
          opp: "Udinese",
          venue: "H",
          score: [2, 0],
          tactic: "Controlled Counter",
          goals: [
            { min: 24, side: "us", player: "Leão", assist: "Pulisic" },
            { min: 68, side: "us", player: "Nascimento", assist: "Valera" }
          ],
          attendance: 72480,
          matchStats: { possession: 58, shots: 16, onTarget: 7, xg: 2.13 },
          oppStats: { possession: 42, shots: 7, onTarget: 3, xg: 0.78 },
          potm: "Leão 8.6",
          cards: ["Moretti"],
          highlight: "A new chapter",
          story: "Tej's first competitive match in charge of Milan. Ricci won the ball and Pulisic released Leão for the opener, then Valera threaded Nascimento through for the second. Metodija made his Serie A debut at 16.",
          selection: "First-choice 4-3-3; Metodija makes his competitive Serie A debut at LB.",
          report: "24 Leão finishes the first competitive Milan goal of the Tej era after Ricci wins the ball and Pulisic releases him. 39 Maignan makes a key close-range save. At halftime Ricci is instructed to stay deeper. 68 Valera threads through for Nascimento to double the lead. 71 Bartesaghi for Metodija; 73 Fofana for Jashari; 76 Giménez for Nascimento; 81 Tomori for De Winter.",
          perf: "MOTM Leão 8.6. Metodija 7.0. Moretti yellow. No injuries. Clean sheet."
        },
        {
          id: "sa-md2",
          date: "2028-08-27",
          comp: "sa",
          round: "MD2",
          opp: "Fiorentina",
          venue: "A",
          score: [1, 1],
          tactic: "Controlled Counter",
          goals: [
            { min: 37, side: "them", player: "Moise Kean" },
            { min: 74, side: "us", player: "Pulisic", assist: "Valera" }
          ],
          matchStats: { possession: 49, shots: 11, onTarget: 4, xg: 1.31 },
          oppStats: { possession: 51, shots: 12, onTarget: 5, xg: 1.56 },
          potm: "Valera 8.1",
          cards: ["Fofana"],
          selection: "Full starting XI not separately preserved for this fixture; no lineup invented.",
          report: "19 Fiorentina hit the post on a transition. 37 Kean attacks the channel between Pavlović and Metodija and scores. 55 Fofana replaces Jashari to support Ricci. 62 Bartesaghi replaces Metodija after a difficult afternoon. 74 Valera releases Pulisic, who cuts inside and equalizes. 83 Nascimento forces a save; in stoppage time Leão shoots narrowly wide.",
          perf: "Milan MOTM Valera 8.1; Metodija 6.3. Fofana yellow. No injuries."
        },
        {
          id: "sa-md3",
          date: "2028-08-30",
          comp: "sa",
          round: "MD3",
          opp: "Genoa",
          venue: "H",
          score: [3, 1],
          tactic: "Controlled Counter",
          goals: [
            { min: 12, side: "us", player: "Valera", assist: "Ricci" },
            { min: 53, side: "us", player: "Leão", assist: "Moretti" },
            { min: 64, side: "them", player: "Vitinha" },
            { min: 87, side: "us", player: "Giménez", assist: "Saelemaekers" }
          ],
          attendance: 69820,
          matchStats: { possession: 56, shots: 17, onTarget: 8, xg: 2.48 },
          oppStats: { possession: 44, shots: 9, onTarget: 4, xg: 1.01 },
          potm: "Leão 8.5",
          cards: ["Tomori"],
          selection: "Bartesaghi and Tomori start for workload reasons.",
          report: "12 Ricci breaks pressure with a forward pass for Valera. 53 Moretti drives forward and supplies Leão. 64 Vitinha punishes an attack down Milan’s right. 67 Fofana on for Jashari; 70 Giménez for Nascimento; 75 Metodija for Bartesaghi; 81 Saelemaekers for Pulisic. 87 Saelemaekers crosses; Giménez scores the clincher.",
          perf: "MOTM Leão 8.5; Giménez 7.8; Metodija 6.9; Tomori yellow; no injuries."
        },
        {
          id: "sa-md4",
          date: "2028-09-10",
          comp: "sa",
          round: "MD4",
          opp: "Bologna",
          venue: "A",
          score: [2, 1],
          tactic: "Aggressive Controlled Counter",
          goals: [
            { min: 19, side: "us", player: "Nascimento", assist: "Valera" },
            { min: 62, side: "them", player: "Riccardo Orsolini" },
            { min: 71, side: "us", player: "Pulisic", assist: "Leão" }
          ],
          matchStats: { possession: 52, shots: 14, xg: 1.74 },
          oppStats: { possession: 48, shots: 12, xg: 1.23 },
          potm: "Pulisic 8.4",
          cards: ["Jashari"],
          selection: "Bartesaghi starts at LB; Metodija unused.",
          report: "Aggressive Controlled Counter introduced. 19 Valera threads in Nascimento. 62 Orsolini equalizes after Bologna exploit right-back space. 71 Leão switches to Pulisic for winning goal. Fofana and Tomori enter to protect lead.",
          perf: "MOTM Pulisic 8.4. Jashari yellow. No injuries."
        },
        {
          id: "sa-md5",
          date: "2028-09-17",
          comp: "sa",
          round: "MD5",
          opp: "Napoli",
          venue: "H",
          score: [2, 2],
          tactic: "Aggressive Controlled Counter",
          goals: [
            { min: 14, side: "them", player: "Matteo Politano" },
            { min: 31, side: "us", player: "Leão", assist: "Pulisic" },
            { min: 59, side: "them", player: null },
            { min: 83, side: "us", player: "Fofana", assist: "Ricci" }
          ],
          attendance: 74126,
          matchStats: { possession: 48, shots: 14, xg: 1.89 },
          oppStats: { possession: 52, shots: 16, xg: 2.05 },
          potm: "Leão 8.3",
          cards: ["Moretti", "Fofana"],
          selection: "Bartesaghi starts; Metodija unused due elite matchup.",
          report: "14 Politano curls in opener. 31 Pulisic releases Leão to equalize. 59 Napoli retake lead through central combination; scorer not recorded. 65 Fofana replaces Jashari and shields midfield. 83 Ricci delivers into the right side; ball breaks for Fofana to finish.",
          perf: "MOTM Leão 8.3; Bartesaghi 7.4. Moretti, Fofana yellows; no injuries."
        },
        {
          id: "uel-lp1",
          date: "2028-09-21",
          comp: "uel",
          round: "League phase MD1",
          opp: "Real Betis",
          venue: "H",
          score: [3, 1],
          tactic: "Aggressive Controlled Counter",
          goals: [
            { min: 22, side: "us", player: "Giménez", assist: "Moretti" },
            { min: 48, side: "us", player: "Valera", assist: "Jashari" },
            { min: 66, side: "us", player: "Leão", assist: "Pulisic" },
            { min: 73, side: "them", player: "Aitor Ruibal" }
          ],
          attendance: 61842,
          matchStats: { possession: 55, shots: 17, xg: 2.61 },
          oppStats: { possession: 45, shots: 10, xg: 1.12 },
          potm: "Valera 8.8",
          cards: ["De Winter"],
          selection: "Giménez starts; Fofana also starts; Metodija late substitute.",
          report: "22 Moretti crosses to Giménez. Jashari is introduced at halftime and feeds Valera for the 48th-minute goal. 66 Pulisic releases Leão on counter. 73 Ruibal pulls one back. 78 Metodija for Bartesaghi as Milan protect lead.",
          perf: "MOTM Valera 8.8; Metodija 6.8; De Winter yellow; no injury."
        },
        {
          id: "sa-md6",
          date: "2028-09-24",
          comp: "sa",
          round: "MD6",
          opp: "Torino",
          venue: "A",
          score: [0, 1],
          tactic: "Aggressive Controlled Counter",
          goals: [
            { min: 64, side: "them", player: "Matteo Riva" }
          ],
          matchStats: { possession: 61, shots: 13, onTarget: 3, xg: 0.94 },
          oppStats: { possession: 39, shots: 9, onTarget: 4, xg: 1.18 },
          best: "Maignan 7.6",
          cards: ["Pavlović"],
          selection: "Full starting XI not separately preserved for this fixture; no lineup invented.",
          report: "Torino mark Valera tightly. At 54 Valera is challenged heavily, continues but has ankle discomfort. 64 a Milan midfield turnover leaves right flank exposed; Riva scores. Giménez and Jashari enter as Milan chase; Leão shoots on target 78; late penalty appeal waved off.",
          perf: "Milan best Maignan 7.6; Pavlović yellow; Valera diagnosed minor ankle sprain, estimated 7-10 days. First league loss."
        },
        {
          id: "sa-md7",
          date: "2028-10-01",
          comp: "sa",
          round: "MD7",
          opp: "Lazio",
          venue: "H",
          score: [1, 1],
          goals: [
            { min: 34, side: "them", player: "Mattia Zaccagni" },
            { min: 77, side: "us", player: "Giménez", assist: "Saelemaekers" }
          ],
          matchStats: { possession: 57, shots: 14, xg: 1.48 },
          oppStats: { possession: 43, shots: 10, xg: 1.16 },
          potm: "Giménez 7.8",
          cards: ["Pavlović"],
          selection: "Fofana, Ricci, Jashari midfield, Giménez striker.",
          report: "Valera rested because of ankle. Zaccagni scores when Lazio exploit Moretti’s side. Saelemaekers enters 64 and delivers low cross for Giménez equalizer at 77. Late pressure but no winner.",
          perf: "MOTM Giménez 7.8; Pavlović yellow, no new injury."
        },
        {
          id: "uel-lp2",
          date: "2028-10-05",
          comp: "uel",
          round: "League phase MD2",
          opp: "Fenerbahçe",
          venue: "A",
          score: [2, 0],
          tactic: "Disciplined Counter",
          goals: [
            { min: 29, side: "us", player: "Nascimento", assist: "Leão" },
            { min: 62, side: "us", player: "Pulisic", assist: "Ricci" }
          ],
          matchStats: { possession: 46, shots: 11, onTarget: 6, xg: 1.89 },
          oppStats: { possession: 54, shots: 13, onTarget: 4, xg: 1.12 },
          potm: "Maignan 8.5",
          cards: ["Moretti"],
          selection: "Disciplined transitions.",
          report: "Former Milan player Rabiot is with Fenerbahçe. 29 Leão releases Nascimento on counter. Maignan makes key save after halftime. 62 Ricci intercepts and supplies Pulisic. At 2-0: 66 Metodija for Bartesaghi; 69 Saelemaekers for Leão; 72 Giménez for Nascimento; 76 Valera for Ricci, marking Valera recovery.",
          perf: "MOTM Maignan 8.5. Moretti yellow. Metodija 24 min, no defensive error. No injuries."
        },
        {
          id: "sa-md8",
          date: "2028-10-15",
          comp: "sa",
          round: "MD8",
          opp: "Atalanta",
          venue: "A",
          score: [2, 1],
          tactic: "Controlled Counter",
          goals: [
            { min: 21, side: "us", player: "Leão", assist: "Valera" },
            { min: 55, side: "them", player: "Ademola Lookman" },
            { min: 81, side: "us", player: "Nascimento", assist: "Pulisic" }
          ],
          matchStats: { possession: 48, shots: 13, onTarget: 5, xg: 1.71 },
          oppStats: { possession: 52, shots: 14, onTarget: 5, xg: 1.58 },
          potm: "Nascimento 8.4",
          cards: ["Fofana"],
          selection: "Adaptive Controlled Counter, Bartesaghi LB.",
          report: "After ten-day gap, fit XI restored. 21 Valera finds Leão in inside-left channel. 55 Lookman equalizes during transition behind Moretti. 67 Fofana adds defensive balance. 81 Pulisic feeds diagonal Nascimento run to win. Maignan handles late pressure.",
          perf: "MOTM Nascimento 8.4; Fofana booked, no injuries."
        },
        {
          id: "sa-md9",
          date: "2028-10-22",
          comp: "sa",
          round: "MD9",
          opp: "Juventus",
          venue: "H",
          score: [2, 1],
          tactic: "Total Possession",
          goals: [
            { min: 38, side: "us", player: "Valera", assist: "Ricci" },
            { min: 60, side: "them", player: "Kenan Yıldız" },
            { min: 72, side: "us", player: "Pulisic", assist: "Jashari" }
          ],
          matchStats: { possession: 66, passAcc: 91, shots: 16, onTarget: 7, xg: 2.07 },
          oppStats: { possession: 34, shots: 10, onTarget: 4, xg: 1.13 },
          potm: "Ricci 9.0",
          cards: ["Tomori"],
          highlight: "Ricci's masterclass",
          story: "The surprise plan against Juventus: 66% of the ball and 91% pass completion. Ricci set up Valera, Yıldız levelled from a turnover, and Jashari released Pulisic for the winner. Ricci was rated 9.0.",
          selection: "Bartesaghi LB against major opponent.",
          report: "TOTAL POSSESSION surprise: short patient passing, Ricci directing tempo. 38 Ricci plays to Valera on box edge. 60 Juventus equalize from transition after midfield turnover. 65 Fofana replaces Nascimento, formation becomes possession-heavy 4-1-4-1 with Pulisic highest. 72 Jashari releases Pulisic to score. Milan pass out final minutes.",
          perf: "MOTM Ricci 9.0; Tomori yellow; no injuries."
        },
        {
          id: "uel-lp3",
          date: "2028-10-26",
          comp: "uel",
          round: "League phase MD3",
          opp: "Rangers",
          venue: "H",
          score: [4, 1],
          tactic: "All-Out Attack",
          goals: [
            { min: 9, side: "us", player: "Giménez", assist: "Leão" },
            { min: 26, side: "us", player: "Pulisic", assist: "Moretti" },
            { min: 41, side: "them", player: "Cyriel Dessers" },
            { min: 49, side: "us", player: "Leão", assist: "Valera" },
            { min: 84, side: "us", player: "Bellini", assist: "Ferri" }
          ],
          matchStats: { possession: 60, shots: 23, onTarget: 11, xg: 3.42 },
          oppStats: { possession: 40, shots: 9, onTarget: 4, xg: 0.96 },
          potm: "Leão 8.8",
          selection: "Youth minutes prioritized with lead.",
          report: "ALL-OUT ATTACK. 9 Leão squares to Giménez. 26 Moretti low assist for Pulisic. Rangers Dessers score 41 as Milan overcommit. 49 Valera releases Leão for 3-1. 56 Metodija for Bartesaghi; 58 Ferri for Ricci; 61 Bellini for Giménez; 65 Saelemaekers for Pulisic; 67 Odogu for Pavlović. 84 Ferri finds Bellini after winning the ball.",
          perf: "MOTM Leão 8.8; Metodija 7.1 in 34 minutes; no cards or injuries."
        },
        {
          id: "sa-md10",
          date: "2028-10-29",
          comp: "sa",
          round: "MD10",
          opp: "Parma",
          venue: "A",
          score: [2, 2],
          tactic: "Natural Counterattack",
          goals: [
            { min: 12, side: "them", player: "Ange-Yoan Bonny" },
            { min: 35, side: "us", player: "Nascimento", assist: "Leão" },
            { min: 62, side: "them", player: "Luca Benedetti" },
            { min: 89, side: "us", player: "Tomori", assist: "Ricci" }
          ],
          matchStats: { possession: 44, shots: 12, onTarget: 5, xg: 1.46 },
          oppStats: { possession: 56, shots: 14, onTarget: 6, xg: 1.92 },
          potm: "Tomori 8.0",
          cards: ["Moretti"],
          selection: "Tired side after Juve/Rangers.",
          report: "Throwback natural counterattack. Parma take lead 12 from defensive error; 35 Leão assists Nascimento. 62 Benedetti finishes cross with Moretti advanced. 72 Ricci and Bellini introduced; 81 Valera nearly equalizes; 89 Ricci corner finds Tomori header.",
          perf: "MOTM Milan Tomori 8.0; Moretti yellow. Moretti hamstring tightness, five days modified training, no tear."
        },
        {
          id: "sa-md11",
          date: "2028-11-05",
          comp: "sa",
          round: "MD11",
          opp: "Roma",
          venue: "A",
          score: [1, 1],
          goals: [
            { min: 36, side: "them", player: null },
            { min: 72, side: "us", player: "Pulisic", assist: "Valera" }
          ],
          matchStats: { possession: 47, shots: 11, onTarget: 4, xg: 1.25 },
          oppStats: { possession: 53, shots: 14, onTarget: 5, xg: 1.52 },
          potm: "Maignan 8.1",
          cards: ["Fofana"],
          selection: "Athekame starts as Moretti recovers; Bartesaghi LB; Fofana with Ricci and Valera.",
          report: "Roma score after central move 36. Bellandi adjusts Valera role at halftime. 72 Valera through-ball to Pulisic for equalizer. Late Maignan save prevents defeat.",
          perf: "Milan MOTM Maignan 8.1; Fofana yellow; no injuries."
        },
        {
          id: "uel-lp4",
          date: "2028-11-09",
          comp: "uel",
          round: "League phase MD4",
          opp: "Real Sociedad",
          venue: "A",
          score: [1, 2],
          goals: [
            { min: 17, side: "them", player: null },
            { min: 53, side: "us", player: "Giménez", assist: "Saelemaekers" },
            { min: 79, side: "them", player: null }
          ],
          matchStats: { possession: 45, shots: 10, onTarget: 4, xg: 1.21 },
          oppStats: { possession: 55, shots: 15, onTarget: 6, xg: 1.87 },
          best: "Giménez 7.6",
          cards: ["De Winter"],
          selection: "Giménez, Saelemaekers, Athekame start; Metodija unused.",
          report: "Valera returns to former club to mixed reception; heavily rotated lineup. 17 hosts exploit a buildup turnover. At halftime Milan play more directly. 53 Saelemaekers crosses for Giménez. 79 Sociedad counter between full-back and CB for winner.",
          perf: "Milan best Giménez 7.6. De Winter yellow. First UEL defeat, no injuries."
        },
        {
          id: "sa-md12",
          date: "2028-11-12",
          comp: "sa",
          round: "MD12",
          opp: "Sassuolo",
          venue: "H",
          score: [3, 0],
          goals: [
            { min: 16, side: "us", player: "Nascimento", assist: "Leão" },
            { min: 43, side: "us", player: "Jashari", assist: "Ricci" },
            { min: 81, side: "us", player: "Bellini", assist: "Ferri" }
          ],
          matchStats: { possession: 62, shots: 18, xg: 2.66 },
          oppStats: { possession: 38, shots: 6, xg: 0.53 },
          potm: "Jashari 8.5",
          selection: "Metodija LB full 90, youth-led rotation.",
          report: "16 Leão releases Nascimento. 43 Ricci wins ball and finds Jashari. Two-goal halftime rule: Leão off for Saelemaekers HT; Ricci off Ferri 55; Nascimento off Bellini 60; Moretti off Athekame 67; Pavlović off Odogu 72. 81 Ferri finds Bellini to seal.",
          perf: "MOTM Jashari 8.5; Metodija 7.3; no cards or injuries."
        },
        {
          id: "sa-md13",
          date: "2028-11-19",
          comp: "sa",
          round: "MD13",
          opp: "Inter",
          venue: "A",
          score: [4, 2],
          tactic: "Tej Special",
          goals: [
            { min: 18, side: "us", player: "Leão", assist: "Valera" },
            { min: 31, side: "them", player: "Lautaro Martínez" },
            { min: 44, side: "us", player: "Pulisic", assist: "Ricci" },
            { min: 58, side: "us", player: "Leão", assist: "Pulisic" },
            { min: 73, side: "them", player: "Marcus Thuram" },
            { min: 86, side: "us", player: "Giménez", assist: "Leão" }
          ],
          attendance: 75817,
          matchStats: { possession: 53, shots: 21, onTarget: 10, xg: 3.12 },
          oppStats: { possession: 47, shots: 17, onTarget: 8, xg: 2.31 },
          potm: "Leão 9.7",
          cards: ["Moretti"],
          lineup: "Maignan (C), Moretti, Tomori, Pavlović, Bartesaghi, Ricci, Jashari, Valera, Pulisic, Nascimento, Leão",
          highlight: "Four at Inter",
          story: "All-out high pressing for the full 90 minutes, away at Inter. Leão scored twice, Pulisic once, and Giménez finished the fourth after Leão's run down the left. Leão was rated 9.7.",
          selection: "Maignan (C), Moretti, Tomori, Pavlović, Bartesaghi, Ricci, Jashari, Valera, Pulisic, Nascimento, Leão.",
          report: "THE TEJ SPECIAL, all-out high pressing all match. 9 Lautaro hits post. 18 Valera sets up Leão. 31 Lautaro equalizes. 44 Ricci assists Pulisic. 58 Pulisic assists Leão for 1-3. 65 Fofana for Jashari; 68 Saelemaekers for Pulisic; 70 Giménez for Nascimento. 73 Thuram makes it 2-3. 79 Maignan save. 86 Leão attacks left, links Saelemaekers and releases rebound opportunity finished by Giménez. The original live narration momentarily described the already-substituted Nascimento as recipient, then explicitly corrected it to Giménez. The definitive scorer is Giménez; save ledger credits Leão with direct assist.",
          perf: "MOTM Leão 9.7. Moretti booked; no injuries. Milan win away/designated Inter home derby 4-2."
        },
        {
          id: "sa-md14",
          date: "2028-11-26",
          comp: "sa",
          round: "MD14",
          opp: "Lecce",
          venue: "H",
          score: [2, 0],
          goals: [
            { min: 34, side: "us", player: "Giménez", assist: "Moretti" },
            { min: 69, side: "us", player: "Valera", assist: "Jashari" }
          ],
          matchStats: { possession: 64, shots: 17, onTarget: 7, xg: 2.21 },
          oppStats: { possession: 36, shots: 5, onTarget: 1, xg: 0.34 },
          potm: "Valera 8.3",
          selection: "Giménez starts; Metodija at LB.",
          report: "34 Moretti crosses for Giménez header. 69 Jashari supplies Valera for low finish. With two-goal lead, Ricci, Leão, Moretti are withdrawn across next 10 minutes. Metodija completes 90.",
          perf: "MOTM Valera 8.3; Metodija 7.6; no cards or injuries."
        },
        {
          id: "uel-lp5",
          date: "2028-11-30",
          comp: "uel",
          round: "League phase MD5",
          opp: "PAOK",
          venue: "H",
          score: [2, 1],
          goals: [
            { min: 25, side: "us", player: "Pulisic", assist: "Moretti" },
            { min: 56, side: "them", player: null },
            { min: 82, side: "us", player: "Odogu", assist: "Ferri" }
          ],
          matchStats: { possession: 57, shots: 13, onTarget: 5, xg: 1.73 },
          oppStats: { possession: 43, shots: 10, onTarget: 4, xg: 1.08 },
          potm: "Odogu 8.2",
          cards: ["Athekame"],
          selection: "Odogu, Ferri and Athekame meaningful minutes.",
          report: "25 Moretti delivers low cross for Pulisic. 56 PAOK equalize after set-piece scramble. Ferri enters and speeds midfield circulation. 82 Ferri swings corner, Odogu heads winner, his first competitive season goal.",
          perf: "MOTM Odogu 8.2; Athekame yellow, no injuries."
        },
        {
          id: "sa-md15",
          date: "2028-12-03",
          comp: "sa",
          round: "MD15",
          opp: "Como",
          venue: "A",
          score: [2, 1],
          goals: [
            { min: 23, side: "us", player: "Leão", assist: "Ricci" },
            { min: 51, side: "them", player: null },
            { min: 78, side: "us", player: "Valera", assist: "Nascimento" }
          ],
          matchStats: { possession: 53, shots: 14, onTarget: 6, xg: 1.73 },
          oppStats: { possession: 47, shots: 10, onTarget: 4, xg: 1.17 },
          potm: "Valera 8.5",
          cards: ["Jashari"],
          selection: "Full starting XI not separately preserved for this fixture; no lineup invented.",
          report: "23 Ricci releases Leão; Como equalize 51 from cross not cleared. 65 staff keep Valera high. 78 Nascimento drops deep to send Valera through for winner. Fofana enters late to stabilize.",
          perf: "MOTM Valera 8.5; Jashari yellow, no injury."
        },
        {
          id: "cit-r16",
          date: "2028-12-06",
          comp: "cit",
          round: "Round of 16",
          opp: "Palermo",
          venue: "H",
          score: [3, 1],
          goals: [
            { min: 17, side: "us", player: "Giménez", assist: "Metodija" },
            { min: 39, side: "them", player: null },
            { min: 57, side: "us", player: "Pulisic", assist: "Ferri" },
            { min: 83, side: "us", player: "Bellini", assist: "Saelemaekers" }
          ],
          matchStats: { possession: 60, shots: 18, xg: 2.58 },
          oppStats: { possession: 40, shots: 8, xg: 0.91 },
          potm: "Pulisic 8.5",
          cards: ["Fofana"],
          lineup: "Maignan, Moretti, Tomori, Pavlović, Metodija, Fofana, Ferri, Valera, Pulisic, Giménez, Leão",
          selection: "Maignan, Moretti, Tomori, Pavlović, Metodija, Fofana, Ferri, Valera, Pulisic, Giménez, Leão.",
          report: "Fictional bracket draws Palermo, previously advanced through early rounds. 17 Metodija overlaps and assists Giménez, first competitive Milan assist in a domestic cup context (note earlier league assists already recorded, so this old description is not factually first overall). 39 Palermo head in corner equalizer. 57 Ferri feeds Pulisic. 83 Saelemaekers crosses for substitute Bellini header.",
          perf: "MOTM Pulisic 8.5; Metodija 7.8. Fofana yellow. Advances to QF."
        },
        {
          id: "sa-md16",
          date: "2028-12-10",
          comp: "sa",
          round: "MD16",
          opp: "Cagliari",
          venue: "H",
          score: [2, 0],
          goals: [
            { min: 28, side: "us", player: "Nascimento", assist: "Leão" },
            { min: 59, side: "us", player: "Jashari", assist: "Valera" }
          ],
          matchStats: { possession: 63, shots: 16, xg: 2.17 },
          oppStats: { possession: 37, shots: 6, xg: 0.56 },
          potm: "Jashari 8.4",
          selection: "Bartesaghi returns at LB; Ricci and Nascimento restored.",
          report: "28 Leão cuts back to Nascimento. 59 Valera draws defenders and lays off to Jashari. Two-goal rotation: 63 Saelemaekers for Leão; 69 Ferri for Ricci; Giménez replaces Nascimento shortly thereafter.",
          perf: "MOTM Jashari 8.4; no cards or injuries, Maignan clean sheet."
        },
        {
          id: "uel-lp6",
          date: "2028-12-14",
          comp: "uel",
          round: "League phase MD6",
          opp: "Braga",
          venue: "A",
          score: [1, 1],
          goals: [
            { min: 31, side: "them", player: null },
            { min: 73, side: "us", player: "Nascimento", assist: "Pulisic" }
          ],
          matchStats: { possession: 49, shots: 12, xg: 1.37 },
          oppStats: { possession: 51, shots: 13, xg: 1.43 },
          best: "Nascimento 8.0",
          cards: ["Moretti"],
          selection: "Full starting XI not separately preserved for this fixture; no lineup invented.",
          report: "Nascimento returns to former club. Braga score 31 attacking Milan right. At halftime reduce pressing workload. 73 Pulisic releases Nascimento for respectful equalizer.",
          perf: "Milan standout Nascimento 8.0; Moretti yellow; no injury."
        },
        {
          id: "sa-md17",
          date: "2028-12-17",
          comp: "sa",
          round: "MD17",
          opp: "Verona",
          venue: "A",
          score: [1, 2],
          goals: [
            { min: 19, side: "them", player: null },
            { min: 54, side: "us", player: "Leão", assist: "Ricci" },
            { min: 68, side: "them", player: null }
          ],
          matchStats: { possession: 58, shots: 15, xg: 1.42 },
          oppStats: { possession: 42, shots: 11, xg: 1.66 },
          best: "Leão 7.8",
          cards: ["Athekame"],
          selection: "Athekame RB, Metodija LB, Giménez ST.",
          report: "Heavily rotated defense Athekame/Metodija; 19 transition exploits full-backs. 54 Ricci feeds Leão for equalizer. 68 high ball to back post causes confusion between Metodija and Pavlović; Verona score. Nascimento, Valera late subs cannot level.",
          perf: "Metodija 6.1; Leão best 7.8; Athekame yellow; no injuries. Staff caution against mass defensive rotation."
        },
        {
          id: "sa-md18",
          date: "2028-12-23",
          comp: "sa",
          round: "MD18",
          opp: "Pisa",
          venue: "H",
          score: [3, 0],
          goals: [
            { min: 15, side: "us", player: "Pulisic", assist: "Metodija" },
            { min: 42, side: "us", player: "Giménez", assist: "Valera" },
            { min: 76, side: "us", player: "Ferri", assist: "Bartesaghi" }
          ],
          matchStats: { possession: 61, shots: 19, onTarget: 9, xg: 2.79 },
          oppStats: { possession: 39, shots: 5, onTarget: 2, xg: 0.47 },
          potm: "Pulisic 8.7",
          selection: "Maignan, Moretti, Tomori, Pavlović, Metodija and stable defensive structure.",
          report: "15 Metodija carries and switches to Pulisic. 42 Valera threads pass for Giménez. 2-0 halftime leads to rotation: Leão rests, Ricci off early, Bellini replaces Giménez. 76 substitute Bartesaghi passes to Ferri for his first senior competitive goal.",
          perf: "MOTM Pulisic 8.7; no cards/injuries. Year ends on clean sheet."
        },
        {
          id: "sa-md19",
          date: "2029-01-07",
          comp: "sa",
          round: "MD19",
          opp: "Cremonese",
          venue: "A",
          score: [2, 0],
          tactic: "Total Possession",
          goals: [
            { min: 29, side: "us", player: "Valera", assist: "Ricci" },
            { min: 63, side: "us", player: "Nascimento", assist: "Metodija" }
          ],
          matchStats: { possession: 68, shots: 16, xg: 2.04 },
          oppStats: { possession: 32, shots: 6, xg: 0.48 },
          potm: "Valera 8.6",
          selection: "Metodija LB starter.",
          report: "TOTAL POSSESSION. 29 Ricci through-pass to Valera. 63 Metodija combines with Leão and crosses low to Nascimento. At 2-0 withdraw Leão, Ricci, Nascimento 67-78 to preserve energy.",
          perf: "MOTM Valera 8.6; Metodija 8.0, assist; no cards or injuries."
        },
        {
          id: "sa-md20",
          date: "2029-01-14",
          comp: "sa",
          round: "MD20",
          opp: "Udinese",
          venue: "A",
          score: [1, 1],
          goals: [
            { min: 41, side: "them", player: null },
            { min: 76, side: "us", player: "Pulisic", assist: "Valera" }
          ],
          matchStats: { possession: 67, shots: 14, xg: 1.48 },
          oppStats: { possession: 33, shots: 9, xg: 1.03 },
          best: "Pulisic 8.0",
          cards: ["De Winter"],
          selection: "Metodija first-choice LB.",
          report: "Udinese defend in compact block despite 71% Milan early possession. 41 De Winter misplaced pass leads to Udinese goal. Giménez replaces Nascimento after 60. 76 Valera disguises pass for Pulisic to equalize.",
          perf: "Milan best Pulisic 8.0; Metodija 7.1; De Winter yellow. No injuries."
        },
        {
          id: "uel-lp7",
          date: "2029-01-18",
          comp: "uel",
          round: "League phase MD7",
          opp: "AZ Alkmaar",
          venue: "H",
          score: [3, 1],
          tactic: "Total Possession",
          goals: [
            { min: 11, side: "us", player: "Leão", assist: "Valera" },
            { min: 38, side: "us", player: "Giménez", assist: "Pulisic" },
            { min: 52, side: "them", player: null },
            { min: 83, side: "us", player: "Ferri", assist: "Metodija" }
          ],
          matchStats: { possession: 63, shots: 19, xg: 2.73 },
          oppStats: { possession: 37, shots: 10, xg: 1.04 },
          potm: "Leão 8.7",
          cards: ["Fofana"],
          selection: "Youth minutes and hybrid Total Possession.",
          report: "11 Valera releases Leão. 38 Pulisic low cross for Giménez. Ricci protected at halftime, Fofana on. 52 AZ pull one back in transition. 69 Ferri for Jashari. 83 Metodija carries and finds Ferri edge of area.",
          perf: "MOTM Leão 8.7; Metodija 7.9; Fofana yellow; no injuries."
        },
        {
          id: "sa-md21",
          date: "2029-01-21",
          comp: "sa",
          round: "MD21",
          opp: "Fiorentina",
          venue: "H",
          score: [2, 1],
          goals: [
            { min: 17, side: "us", player: "Nascimento", assist: "Leão" },
            { min: 49, side: "them", player: "Moise Kean" },
            { min: 79, side: "us", player: "Jashari", assist: "Ricci" }
          ],
          matchStats: { possession: 62, shots: 15, xg: 1.91 },
          oppStats: { possession: 38, shots: 12, xg: 1.43 },
          potm: "Jashari 8.4",
          cards: ["Moretti"],
          selection: "Full starting XI not separately preserved for this fixture; no lineup invented.",
          report: "Bartesaghi starts for recovering Metodija. 17 Leão slides Nascimento through. 49 Kean equalizes after a turnover with Moretti upfield. Fofana stabilizes midfield. 79 Ricci releases Jashari for winner.",
          perf: "MOTM Jashari 8.4; Moretti yellow, no injuries."
        },
        {
          id: "uel-lp8",
          date: "2029-01-25",
          comp: "uel",
          round: "League phase MD8",
          opp: "Lyon",
          venue: "A",
          score: [0, 2],
          tactic: "Total Possession",
          goals: [
            { min: 32, side: "them", player: null },
            { min: 71, side: "them", player: null }
          ],
          matchStats: { possession: 65, shots: 13, onTarget: 3, xg: 1.07 },
          oppStats: { possession: 35, shots: 14, onTarget: 6, xg: 2.15 },
          best: "Maignan 7.4",
          cards: ["Pavlović"],
          selection: "Total Possession exposed in transition.",
          report: "Lyon deliberately allow Milan possession then counter. 32 move behind Metodija leads opening goal. Milan struggle with overly committed rest-defense. 71 break isolates Pavlović 2-v-1, Lyon score again. Pulisic side-netting; Nascimento forces save; Leão saved 83.",
          perf: "Milan best Maignan 7.4, Metodija 5.9; Pavlović yellow. Milan finish UEL league phase 9th on 16 pts, must play Porto."
        },
        {
          id: "sa-md22",
          date: "2029-01-28",
          comp: "sa",
          round: "MD22",
          opp: "Genoa",
          venue: "A",
          score: [2, 1],
          goals: [
            { min: 24, side: "us", player: "Giménez", assist: "Moretti" },
            { min: 58, side: "them", player: null },
            { min: 86, side: "us", player: "Pulisic", assist: "Ricci" }
          ],
          matchStats: { possession: 54, shots: 13, xg: 1.64 },
          oppStats: { possession: 46, shots: 11, xg: 1.31 },
          potm: "Pulisic 8.5",
          cards: ["Tomori"],
          selection: "Full starting XI not separately preserved for this fixture; no lineup invented.",
          report: "Post-Lyon heavily rotated XI: Giménez striker, Bartesaghi LB, Tomori replaces Pavlović, Ferri CM. 24 Moretti crosses for Giménez header. 58 Genoa equalize from interception. 73 Pulisic introduced, 79 Ricci introduced. 86 Ricci quick pass to Pulisic winner.",
          perf: "MOTM Pulisic 8.5; Tomori yellow; no injuries."
        },
        {
          id: "sa-md23",
          date: "2029-02-03",
          comp: "sa",
          round: "MD23",
          opp: "Bologna",
          venue: "H",
          score: [3, 1],
          tactic: "All-Out Attack",
          goals: [
            { min: 9, side: "us", player: "Leão", assist: "Pulisic" },
            { min: 31, side: "us", player: "Valera", assist: "Ricci" },
            { min: 58, side: "us", player: "Nascimento", assist: "Metodija" },
            { min: 73, side: "them", player: null }
          ],
          matchStats: { possession: 59, shots: 19, xg: 2.71 },
          oppStats: { possession: 41, shots: 9, xg: 0.98 },
          potm: "Valera 8.8",
          selection: "Full starting XI not separately preserved for this fixture; no lineup invented.",
          report: "All-out attack against weaker opponent. 9 Pulisic finds Leão. 31 Ricci finds Valera. 2-0 at halftime triggers sensible protection of Ricci/Pulisic. 58 Metodija overlap and low cross to Nascimento. 73 Bologna reduce lead, Milan hold.",
          perf: "MOTM Valera 8.8; Metodija 7.9; no cards/injury."
        },
        {
          id: "cit-qf",
          date: "2029-02-07",
          comp: "cit",
          round: "Quarter-final",
          opp: "Lazio",
          venue: "H",
          score: [2, 1],
          goals: [
            { min: 24, side: "us", player: "Pulisic", assist: "Valera" },
            { min: 51, side: "them", player: null },
            { min: 77, side: "us", player: "Giménez", assist: "Saelemaekers" }
          ],
          matchStats: { possession: 54, shots: 15, onTarget: 6, xg: 1.92 },
          oppStats: { possession: 46, shots: 12, onTarget: 4, xg: 1.31 },
          potm: "Giménez 8.5",
          cards: ["Pavlović"],
          selection: "Bartesaghi LB, Giménez ST, Fofana midfield.",
          report: "Milan prioritize cups while managing recovery. 24 Valera finds Pulisic. Lazio equalize at 51 after second ball. 65 Nascimento enters for extra pace while Giménez remains involved. 77 Saelemaekers crosses to Giménez header for winner.",
          perf: "MOTM Giménez 8.5; Pavlović yellow. Advance Coppa SF vs Fiorentina."
        },
        {
          id: "sa-md24",
          date: "2029-02-11",
          comp: "sa",
          round: "MD24",
          opp: "Napoli",
          venue: "A",
          score: [1, 2],
          tactic: "Hybrid Control",
          goals: [
            { min: 22, side: "them", player: null },
            { min: 57, side: "them", player: null },
            { min: 68, side: "us", player: "Leão", assist: "Ricci" }
          ],
          matchStats: { possession: 52, shots: 12, onTarget: 4, xg: 1.29 },
          oppStats: { possession: 48, shots: 15, onTarget: 7, xg: 2.14 },
          best: "Leão 8.0",
          cards: ["Fofana"],
          selection: "Metodija LB; Fofana shields Ricci/Valera.",
          report: "Hybrid Control against elite opponent. 22 Napoli transition exploits Moretti side; 57 midfield turnover leads 2-0. Jashari enters, press raised. 68 Ricci through pass releases Leão. Pulisic saved 84; Valera wide in stoppage time.",
          perf: "Leão best 8.0; Metodija 6.5; Fofana yellow; no injuries."
        },
        {
          id: "uel-po-1",
          date: "2029-02-15",
          comp: "uel",
          round: "Play-off, leg 1",
          opp: "Porto",
          venue: "A",
          score: [1, 1],
          goals: [
            { min: 39, side: "them", player: null },
            { min: 61, side: "us", player: "Giménez", assist: "Moretti" }
          ],
          matchStats: { possession: 51, shots: 11, xg: 1.19 },
          oppStats: { possession: 49, shots: 13, xg: 1.56 },
          potm: "Maignan 8.2",
          cards: ["De Winter"],
          selection: "Bartesaghi LB for Metodija rest; Giménez ST.",
          report: "Porto press hard and profit 39 from buildup turnover. Milan bypass press more directly in second half. 61 Moretti early ball to Giménez, who finishes. Maignan key save 80.",
          perf: "MOTM Maignan 8.2; De Winter booked, no injuries. Aggregate 1-1."
        },
        {
          id: "sa-md25",
          date: "2029-02-18",
          comp: "sa",
          round: "MD25",
          opp: "Torino",
          venue: "H",
          score: [2, 0],
          tactic: "All-Out Attack",
          goals: [
            { min: 18, side: "us", player: "Ferri", assist: "Metodija" },
            { min: 40, side: "us", player: "Pulisic", assist: "Valera" }
          ],
          matchStats: { possession: 61, shots: 17, onTarget: 7, xg: 2.22 },
          oppStats: { possession: 39, shots: 7, onTarget: 2, xg: 0.64 },
          potm: "Ferri 8.5",
          selection: "Full starting XI not separately preserved for this fixture; no lineup invented.",
          report: "All-out early pressure with stable back line, Ferri starts. 18 Metodija arrives on left and passes to Ferri for score. 40 Valera supplies Pulisic. At 2-0 halftime, Leão/Ricci rested, Bellini, Jashari and Athekame used. Maignan important late save.",
          perf: "MOTM Ferri 8.5; no cards or injuries."
        },
        {
          id: "uel-po-2",
          date: "2029-02-22",
          comp: "uel",
          round: "Play-off, leg 2",
          opp: "Porto",
          venue: "H",
          score: [2, 0],
          agg: "3–1",
          tactic: "Hybrid Control",
          goals: [
            { min: 33, side: "us", player: "Nascimento", assist: "Pulisic" },
            { min: 74, side: "us", player: "Leão", assist: "Ricci" }
          ],
          matchStats: { possession: 54, shots: 15, onTarget: 6, xg: 1.94 },
          oppStats: { possession: 46, shots: 11, onTarget: 4, xg: 1.02 },
          potm: "Leão 8.7",
          cards: ["Moretti"],
          selection: "Metodija LB first choice.",
          report: "Aggregate enters 1-1. Hybrid Control. 33 Pulisic supplies Nascimento. Porto pressure forces Maignan save. 74 Ricci intercepts and releases Leão. With two-goal aggregate cushion, Fofana for Jashari, Bartesaghi for Metodija 79, Giménez for Nascimento.",
          perf: "MOTM Leão 8.7; Metodija 7.4; Moretti yellow; no injury. Milan win tie 3-1 aggregate."
        },
        {
          id: "sa-md26",
          date: "2029-02-25",
          comp: "sa",
          round: "MD26",
          opp: "Lazio",
          venue: "A",
          score: [1, 1],
          goals: [
            { min: 29, side: "them", player: null },
            { min: 50, side: "us", player: "Jashari", assist: "Fofana" }
          ],
          matchStats: { possession: 51, shots: 12, onTarget: 4, xg: 1.28 },
          oppStats: { possession: 49, shots: 13, onTarget: 5, xg: 1.49 },
          best: "Jashari 8.0",
          cards: ["Tomori"],
          selection: "Full starting XI not separately preserved for this fixture; no lineup invented.",
          report: "Following Porto tight turnaround, Bartesaghi for Metodija; Fofana supports midfield. Lazio score early quick counter. At HT Milan slow possession. 50 Fofana challenges and feeds Jashari equalizer. Pulisic saved 83.",
          perf: "Milan standout Jashari 8.0; Tomori booked. Pulisic mild calf tightness, six days reduced training, doubtful Atalanta Mar 4."
        },
        {
          id: "sa-md27",
          date: "2029-03-04",
          comp: "sa",
          round: "MD27",
          opp: "Atalanta",
          venue: "H",
          score: [1, 1],
          tactic: "Hybrid Control",
          goals: [
            { min: 27, side: "them", player: "Ademola Lookman" },
            { min: 74, side: "us", player: "Jashari", assist: "Ferri" }
          ],
          matchStats: { possession: 56, shots: 12, xg: 1.35 },
          oppStats: { possession: 44, shots: 12, xg: 1.43 },
          best: "Jashari 8.0",
          cards: ["Fofana"],
          selection: "Metodija LB; Fofana protects midfield.",
          report: "Pulisic omitted while finishing calf recovery; fatigued Ricci/Leão managed. 27 Lookman scores after recycled attack. Ferri enters 63. 74 Ferri intercepts and feeds Jashari. Late Giménez header over.",
          perf: "Milan standout Jashari 8.0; Metodija 7.0; Fofana yellow, no injuries."
        },
        {
          id: "uel-r16-1",
          date: "2029-03-08",
          comp: "uel",
          round: "Round of 16, leg 1",
          opp: "Ajax",
          venue: "A",
          score: [3, 2],
          tactic: "All-Out Attack",
          goals: [
            { min: 14, side: "us", player: "Leão", assist: "Pulisic" },
            { min: 36, side: "them", player: null },
            { min: 50, side: "us", player: "Nascimento", assist: "Ricci" },
            { min: 67, side: "us", player: "Valera", assist: "Leão" },
            { min: 88, side: "them", player: null }
          ],
          matchStats: { possession: 52, shots: 18, onTarget: 9, xg: 2.67 },
          oppStats: { possession: 48, shots: 16, onTarget: 7, xg: 2.06 },
          potm: "Leão 9.1",
          cards: ["Moretti"],
          highlight: "The Amsterdam gamble",
          story: "All-Out Attack away from home. Leão, Nascimento and Valera put Milan 3–1 up before Ajax scored late; a 1–1 draw at home took Milan through 4–3 on aggregate.",
          selection: "Strong fit attacking XI, Metodija LB until substituted.",
          report: "All-out attack in Amsterdam. 14 medically cleared Pulisic assists Leão. 36 Ajax equalize. 50 Ricci feeds Nascimento. 67 Leão finds Valera for 1-3. Two-goal lead: Pulisic removed to manage calf, Fofana for Jashari, Bartesaghi for Metodija. 88 Ajax late set-piece goal makes 2-3.",
          perf: "MOTM Leão 9.1; Metodija 7.0; Moretti yellow, no injuries."
        },
        {
          id: "sa-md28",
          date: "2029-03-11",
          comp: "sa",
          round: "MD28",
          opp: "Juventus",
          venue: "A",
          score: [0, 0],
          tactic: "Compact 4-1-4-1",
          goals: [],
          matchStats: { possession: 41, shots: 7, onTarget: 2, xg: 0.68 },
          oppStats: { possession: 59, shots: 15, onTarget: 5, xg: 1.63 },
          potm: "Maignan 8.8",
          cards: ["Tomori"],
          selection: "Maignan, Bartesaghi LB, Fofana and Ferri CM, Giménez ST, Saelemaekers wide, Pulisic begins on bench.",
          report: "Protect players three days after Ajax. Compact 4-1-4-1, Juventus 60% first-half possession. Maignan sharp save 39; Giménez counter effort wide. Ricci introduced only final 25 minutes. Juventus strike crossbar at 86; Milan earn away draw.",
          perf: "MOTM Maignan 8.8; Tomori booked, no injuries."
        },
        {
          id: "uel-r16-2",
          date: "2029-03-15",
          comp: "uel",
          round: "Round of 16, leg 2",
          opp: "Ajax",
          venue: "H",
          score: [1, 1],
          agg: "4–3",
          goals: [
            { min: 29, side: "them", player: null },
            { min: 72, side: "us", player: "Giménez", assist: "Moretti" }
          ],
          matchStats: { possession: 47, shots: 11, xg: 1.29 },
          oppStats: { possession: 53, shots: 15, xg: 1.72 },
          potm: "Maignan 8.4",
          cards: ["Pavlović"],
          selection: "Four changes from first leg, including rested Metodija.",
          report: "Aggregate 3-2 entering. Bartesaghi LB, Giménez ST, Fofana protects Ricci. Ajax score 29, tie 3-3. Leão introduced second half, pins Ajax line. 72 Moretti early cross to Giménez header. Final aggregate Milan 4-3 Ajax.",
          perf: "MOTM Maignan 8.4; Pavlović booked, no injury; advance QF vs Frankfurt."
        },
        {
          id: "sa-md29",
          date: "2029-03-18",
          comp: "sa",
          round: "MD29",
          opp: "Parma",
          venue: "H",
          score: [3, 0],
          tactic: "Hybrid Control",
          goals: [
            { min: 12, side: "us", player: "Pulisic", assist: "Valera" },
            { min: 34, side: "us", player: "Bellini", assist: "Metodija" },
            { min: 70, side: "us", player: "Ferri", assist: "Jashari" }
          ],
          matchStats: { possession: 61, shots: 18, xg: 2.74 },
          oppStats: { possession: 39, shots: 6, xg: 0.52 },
          potm: "Metodija 8.7",
          selection: "Full starting XI not separately preserved for this fixture; no lineup invented.",
          report: "Young, fresh attack with Pulisic medically cleared for controlled appearance, Bellini ST, Ferri CM, Metodija LB. 12 Valera feeds Pulisic. 34 Metodija low cross for Bellini. 2-0 halftime: Pulisic and Valera withdrawn, Fofana controls midfield. 70 Jashari finds Ferri.",
          perf: "MOTM Metodija 8.7; no cards or injuries."
        },
        {
          id: "sa-md30",
          date: "2029-03-31",
          comp: "sa",
          round: "MD30",
          opp: "Roma",
          venue: "A",
          score: [1, 2],
          tactic: "Hybrid Control",
          goals: [
            { min: 18, side: "them", player: null },
            { min: 54, side: "us", player: "Leão", assist: "Ricci" },
            { min: 82, side: "them", player: null }
          ],
          matchStats: { possession: 46, shots: 12, onTarget: 4, xg: 1.36 },
          oppStats: { possession: 54, shots: 16, onTarget: 6, xg: 1.94 },
          best: "Leão 7.9",
          cards: ["Moretti"],
          selection: "Mixed XI; Metodija LB, Fofana with Ricci, Valera available.",
          report: "International-break returning players fatigued. 18 Roma opener from through-run. 54 Ricci releases Leão. 65 Nascimento shot saved. 82 Roma win after sustained pressure and box finish. Giménez introduced, Pulisic narrowly misses stoppage time.",
          perf: "Leão best 7.9; Metodija 6.6; Moretti booked, no injuries. Milan fall to 5th."
        },
        {
          id: "cit-sf-1",
          date: "2029-04-04",
          comp: "cit",
          round: "Semi-final, leg 1",
          opp: "Fiorentina",
          venue: "H",
          score: [1, 1],
          tactic: "Total Possession",
          goals: [
            { min: 22, side: "us", player: "Giménez", assist: "Valera" },
            { min: 69, side: "them", player: "Moise Kean" }
          ],
          matchStats: { possession: 64, shots: 16, xg: 1.87 },
          oppStats: { possession: 36, shots: 9, xg: 1.09 },
          best: "Ricci 8.0",
          cards: ["Fofana"],
          selection: "Giménez ST, Bartesaghi LB, Leão/Ricci minutes monitored.",
          report: "Total Possession to manage key players. 22 Valera finds Giménez between CBs. 69 buildup mispass lets Kean equalize. Late Milan pressure without breakthrough.",
          perf: "Milan best Ricci 8.0; Fofana yellow, no injury. Aggregate 1-1."
        },
        {
          id: "sa-md31",
          date: "2029-04-07",
          comp: "sa",
          round: "MD31",
          opp: "Sassuolo",
          venue: "A",
          score: [3, 0],
          tactic: "All-Out Attack",
          goals: [
            { min: 8, side: "us", player: "Pulisic", assist: "Jashari" },
            { min: 29, side: "us", player: "Bellini", assist: "Metodija" },
            { min: 72, side: "us", player: "Ferri", assist: "Saelemaekers" }
          ],
          matchStats: { possession: 59, shots: 18, xg: 2.81 },
          oppStats: { possession: 41, shots: 7, xg: 0.68 },
          potm: "Metodija 8.6",
          selection: "Full starting XI not separately preserved for this fixture; no lineup invented.",
          report: "All-out attacking early to allow pre-Frankfurt rest. Bellini ST, Ferri CM, Metodija LB, Leão bench. 8 Jashari finds Pulisic. 29 Metodija low cross to Bellini. 2-0 halftime allows Pulisic/Jashari off for Saelemaekers/Fofana. 72 Saelemaekers feeds Ferri.",
          perf: "MOTM Metodija 8.6; no cards or injury."
        },
        {
          id: "uel-qf-1",
          date: "2029-04-12",
          comp: "uel",
          round: "Quarter-final, leg 1",
          opp: "Eintracht Frankfurt",
          venue: "A",
          score: [2, 1],
          tactic: "Disciplined Counter",
          goals: [
            { min: 16, side: "them", player: null },
            { min: 43, side: "us", player: "Valera", assist: "Ricci" },
            { min: 77, side: "us", player: "Leão", assist: "Pulisic" }
          ],
          matchStats: { possession: 43, shots: 12, xg: 1.58 },
          oppStats: { possession: 57, shots: 15, xg: 1.71 },
          potm: "Maignan 8.6",
          cards: ["Moretti"],
          selection: "Fofana shields Ricci, Bartesaghi LB, Metodija recovers.",
          report: "Disciplined counter to avoid Lyon-style issue. Frankfurt transition scores 16. Maignan important save 31. 43 Ricci intercepts and releases Valera. 77 Pulisic diagonal assist to Leão for away winner. Tomori added to preserve lead, Moretti stops overlapping.",
          perf: "MOTM Maignan 8.6; Moretti yellow, no injuries. Aggregate 2-1."
        },
        {
          id: "sa-md32",
          date: "2029-04-15",
          comp: "sa",
          round: "MD32",
          opp: "Inter",
          venue: "H",
          score: [2, 3],
          note: "Moved from 14 Apr",
          tactic: "Tej Special",
          goals: [
            { min: 12, side: "them", player: "Lautaro Martínez" },
            { min: 36, side: "us", player: "Leão", assist: "Pulisic" },
            { min: 48, side: "them", player: "Marcus Thuram" },
            { min: 65, side: "us", player: "Valera", assist: "Ricci" },
            { min: 89, side: "them", player: null }
          ],
          matchStats: { possession: 55, shots: 19, onTarget: 8, xg: 2.39 },
          oppStats: { possession: 45, shots: 16, onTarget: 8, xg: 2.74 },
          best: "Valera 8.1",
          cards: ["Pavlović"],
          selection: "Inter match rescheduled from Apr14 explicitly, no game omitted.",
          report: "TEJ SPECIAL all-out attacking rematch; Inter have adapted. 12 Lautaro transitions past high press. 36 Pulisic feeds Leão. 48 Thuram finishes another counter. 65 Ricci finds Valera 2-2. 80 Maignan save; 86 Leão hits post. 89 Milan turnover with six forward, Inter midfielder scores winner; 90+4 Giménez header over.",
          perf: "Milan best Valera 8.1; Pavlović yellow; no injuries. The same tactical surprise does not work twice."
        },
        {
          id: "uel-qf-2",
          date: "2029-04-19",
          comp: "uel",
          round: "Quarter-final, leg 2",
          opp: "Eintracht Frankfurt",
          venue: "H",
          score: [1, 1],
          agg: "3–2",
          goals: [
            { min: 24, side: "them", player: null },
            { min: 81, side: "us", player: "Nascimento", assist: "Pulisic" }
          ],
          matchStats: { possession: 58, shots: 14, onTarget: 5, xg: 1.53 },
          oppStats: { possession: 42, shots: 12, onTarget: 5, xg: 1.38 },
          potm: "Maignan 8.5",
          cards: ["Fofana"],
          selection: "Giménez starts, Fofana shields, Metodija LB.",
          report: "Aggregate 2-1 entering. 24 long pass beats midfield, Frankfurt score and tie 2-2. Valera introduced at halftime/second period to speed play; 64 Nascimento for Giménez. 81 Valera finds Pulisic to right, Pulisic crosses low to Nascimento winner on aggregate. Maignan punches late corner and Tomori blocks stoppage shot.",
          perf: "MOTM Maignan 8.5; Metodija 7.1; Fofana yellow; no injuries. Aggregate Milan 3-2, into SF."
        },
        {
          id: "sa-md33",
          date: "2029-04-22",
          comp: "sa",
          round: "MD33",
          opp: "Lecce",
          venue: "A",
          score: [2, 0],
          tactic: "All-Out Attack",
          goals: [
            { min: 17, side: "us", player: "Bellini", assist: "Saelemaekers" },
            { min: 39, side: "us", player: "Ferri", assist: "Jashari" }
          ],
          matchStats: { possession: 62, shots: 15, xg: 2.24 },
          oppStats: { possession: 38, shots: 6, xg: 0.57 },
          potm: "Ferri 8.6",
          selection: "Full starting XI not separately preserved for this fixture; no lineup invented.",
          report: "Heavily rotated all-out early attack to protect stars for Coppa. Bellini ST, Saelemaekers RW, Ferri/Jashari midfield; Bartesaghi LB. 17 Saelemaekers crosses for Bellini. 39 Jashari intercepts and feeds Ferri. 2-0 halftime: drop pressing intensity, bench Bellini after 20 more minutes for Nascimento, Jashari and Odogu rotated.",
          perf: "MOTM Ferri 8.6, no injuries/cards."
        },
        {
          id: "cit-sf-2",
          date: "2029-04-25",
          comp: "cit",
          round: "Semi-final, leg 2",
          opp: "Fiorentina",
          venue: "A",
          score: [2, 1],
          agg: "3–2",
          tactic: "Hybrid Control",
          goals: [
            { min: 28, side: "them", player: "Moise Kean" },
            { min: 52, side: "us", player: "Pulisic", assist: "Ricci" },
            { min: 88, side: "us", player: "Metodija", assist: "Valera" }
          ],
          matchStats: { possession: 51, shots: 12, xg: 1.65 },
          oppStats: { possession: 49, shots: 14, xg: 1.72 },
          potm: "Metodija 9.0",
          cards: ["Tomori"],
          highlight: "Metodija's moment",
          story: "Kean put Fiorentina ahead on aggregate. Pulisic levelled the tie, and in the 88th minute Leão and Valera worked the ball to Metodija, overlapping from left-back, for his first senior goal. Milan were into the final; Metodija was rated 9.0.",
          selection: "Maignan, Metodija, Ricci, Valera, Fofana; Hybrid Control.",
          report: "Aggregate 1-1 entering. 28 Kean puts Fiorentina ahead aggregate 2-1. Halftime Pulisic moves inward. 52 Ricci beats press to release Pulisic. 67 Maignan key save. Metodija at 74 shows fatigue but is medically cleared to continue. 88 Leão draws defenders and returns to Valera, who releases Metodija LB overlapping into box; teenager fires across keeper for his FIRST SENIOR GOAL. 90+3 Maignan saves Kean header. 90+5 final whistle.",
          perf: "MOTM Metodija 9.0, full 90; Tomori yellow; no injuries. Milan win 3-2 aggregate, Coppa final vs Juve."
        },
        {
          id: "sa-md34",
          date: "2029-04-29",
          comp: "sa",
          round: "MD34",
          opp: "Como",
          venue: "H",
          score: [1, 1],
          goals: [
            { min: 36, side: "us", player: "Nascimento", assist: "Pulisic" },
            { min: 74, side: "them", player: null }
          ],
          matchStats: { possession: 59, shots: 14, xg: 1.52 },
          oppStats: { possession: 41, shots: 10, xg: 1.18 },
          best: "Nascimento 7.7",
          cards: ["Jashari"],
          selection: "Metodija rests, Bartesaghi LB; Ferri midfield, shared striker minutes.",
          report: "Post-Fiorentina tired side. 36 Pulisic through-ball for Nascimento. 74 Como equalize via poorly defended set piece. Leão enters late, crosses for Giménez at 88 but header over.",
          perf: "Milan best Nascimento 7.7; Jashari yellow; no injuries."
        },
        {
          id: "uel-sf-1",
          date: "2029-05-03",
          comp: "uel",
          round: "Semi-final, leg 1",
          opp: "Tottenham Hotspur",
          venue: "H",
          score: [4, 1],
          tactic: "All-Out Attack",
          goals: [
            { min: 8, side: "us", player: "Leão", assist: "Valera" },
            { min: 21, side: "us", player: "Pulisic", assist: "Ricci" },
            { min: 39, side: "us", player: "Nascimento", assist: "Leão" },
            { min: 61, side: "them", player: null },
            { min: 78, side: "us", player: "Giménez", assist: "Moretti" }
          ],
          matchStats: { possession: 56, shots: 22, xg: 3.29 },
          oppStats: { possession: 44, shots: 12, xg: 1.48 },
          potm: "Leão 9.3",
          highlight: "Three by half-time",
          story: "Tej asked for six first-half goals; Milan settled for three. Leão, Pulisic and Nascimento scored before the break and Giménez added a fourth. Leão was rated 9.3.",
          selection: "Maignan, Moretti/Metodija full-backs, fast attack; more managed pressing after big lead.",
          report: "Tej demands all-out attack and six goals in first half, but staff do not make unrealistic guarantee or illegally remove earned defender bonuses. 8 Valera wins ball and feeds Leão. 21 Ricci through-pass Pulisic. 39 Leão cuts back for Nascimento: 3-0 halftime. Aggression dialed back and tired starters rotated. 61 Tottenham counter goal. 70 Giménez for Nascimento; 78 Moretti crosses for Giménez goal.",
          perf: "MOTM Leão 9.3; Metodija 7.3; no cards/injuries. Aggregate 4-1."
        },
        {
          id: "sa-md35",
          date: "2029-05-06",
          comp: "sa",
          round: "MD35",
          opp: "Cagliari",
          venue: "A",
          score: [2, 0],
          goals: [
            { min: 18, side: "us", player: "Bellini", assist: "Ferri" },
            { min: 43, side: "us", player: "Jashari", assist: "Metodija" }
          ],
          matchStats: { possession: 60, shots: 14 },
          oppStats: { possession: 40 },
          potm: "Jashari 8.4",
          selection: "Bellini ST, Ferri CM, Metodija LB.",
          report: "Heavy rotation while major stars bench. 18 Ferri through ball for Bellini. 43 Metodija low cross for Jashari. Two-goal halftime lead permits lowering press and minutes for Odogu/Athekame.",
          perf: "MOTM Jashari 8.4; no injuries or cards."
        },
        {
          id: "uel-sf-2",
          date: "2029-05-10",
          comp: "uel",
          round: "Semi-final, leg 2",
          opp: "Tottenham Hotspur",
          venue: "A",
          score: [1, 2],
          agg: "5–3",
          tactic: "Hybrid Control",
          goals: [
            { min: 14, side: "them", player: null },
            { min: 51, side: "us", player: "Valera", assist: "Pulisic" },
            { min: 83, side: "them", player: null }
          ],
          best: "Maignan 8.1",
          cards: ["Pavlović"],
          selection: "Hybrid Control after huge first leg.",
          report: "Aggregate enters Milan 4-1. 14 Tottenham strike, aggregate 4-2. Maignan saves twice in first half. 51 Pulisic carries and finds Valera for 1-1, aggregate 5-2. 83 Tottenham score second, aggregate 5-3. Late defense holds.",
          perf: "Milan best Maignan 8.1; no injuries; Pavlović yellow. Milan win tie 5-3 and qualify for UEL final."
        },
        {
          id: "sa-md36",
          date: "2029-05-13",
          comp: "sa",
          round: "MD36",
          opp: "Verona",
          venue: "H",
          score: [1, 1],
          goals: [
            { min: 33, side: "them", player: null },
            { min: 72, side: "us", player: "Ferri", assist: "Jashari" }
          ],
          matchStats: { possession: 62, shots: 15, xg: 1.47 },
          oppStats: { possession: 38, shots: 9, xg: 1.04 },
          best: "Ferri 8.0",
          selection: "Maignan in goal; Ferri/Bellini minutes, Bartesaghi LB.",
          report: "Rotated side three days before Coppa final. 33 Verona capitalize on midfield misplaced pass. 72 Jashari through-ball finds Ferri equalizer.",
          perf: "Milan best Ferri 8.0; no injuries. Roma build advantage over Milan."
        },
        {
          id: "cit-2029-final",
          date: "2029-05-16",
          comp: "cit",
          round: "Final",
          opp: "Juventus",
          venue: "N",
          ground: "Stadio Olimpico, Rome",
          score: [1, 2],
          tactic: "Hybrid Control",
          goals: [
            { min: 18, side: "them", player: "Kenan Yıldız" },
            { min: 65, side: "us", player: "Leão", assist: "Valera" },
            { min: 87, side: "them", player: "Dušan Vlahović" }
          ],
          matchStats: { possession: 51, shots: 13, onTarget: 5, xg: 1.51 },
          oppStats: { possession: 49, shots: 14, onTarget: 6, xg: 1.86 },
          best: "Leão 8.2",
          cards: ["Fofana"],
          lineup: "Maignan (C); Moretti, Tomori, Pavlović, Metodija; Ricci (VC), Jashari, Valera; Pulisic, Leão, Nascimento",
          highlight: "So close in Rome",
          story: "Yıldız scored early and Leão equalised from Valera's pass, but Vlahović won it for Juventus three minutes from time after a turnover in build-up. Milan finished as runners-up.",
          selection: "GK Maignan C; Moretti, Tomori, Pavlović, Metodija LB; Ricci VC, Jashari, Valera; Pulisic, Leão, Nascimento; adaptive hybrid.",
          report: "Neutral Stadio Olimpico Rome. Juventus press Ricci hard. 18 Yıldız scores; Maignan saves 35. Halftime Milan narrow midfield. 65 Valera finds Leão equalizer. 87 a buildup turnover lets Vlahović get in front of Pavlović and finish. Giménez heads over in stoppage time.",
          perf: "Milan standout Leão 8.2; Metodija 7.0, replaced by Bartesaghi at 81; Fofana yellow. No injuries. Juventus win trophy; Milan runners-up."
        },
        {
          id: "sa-md37",
          date: "2029-05-20",
          comp: "sa",
          round: "MD37",
          opp: "Pisa",
          venue: "A",
          score: [2, 0],
          goals: [
            { min: 22, side: "us", player: "Giménez", assist: "Saelemaekers" },
            { min: 49, side: "us", player: "Bellini", assist: "Ferri" }
          ],
          potm: "Giménez 8.4",
          selection: "Giménez starts; Bellini left, Ferri midfield, Bartesaghi LB.",
          report: "Cup-final recovery rotation. 22 Saelemaekers supplies Giménez header. 49 Ferri intercepts and feeds Bellini. At two-goal margin lower intensity and use replacements.",
          perf: "MOTM Giménez 8.4; no injuries or cards."
        },
        {
          id: "sa-md38",
          date: "2029-05-26",
          comp: "sa",
          round: "MD38",
          opp: "Cremonese",
          venue: "H",
          score: [1, 1],
          goals: [
            { min: 16, side: "us", player: "Nascimento", assist: "Moretti" },
            { min: 68, side: "them", player: null }
          ],
          best: "Nascimento 7.8",
          selection: "Moretti and De Winter back line, academy minutes.",
          report: "Last league game four days before European final, strong rotation. 16 Moretti early cross finds Nascimento. 68 Cremonese equalize following dangerous cross not cleared. Pulisic introduced briefly, Milan cannot find winner.",
          perf: "Milan best Nascimento 7.8; no injuries. Milan finish Serie A 5th on 75 pts."
        },
        {
          id: "uel-2029-final",
          date: "2029-05-30",
          comp: "uel",
          round: "Final",
          opp: "Athletic Club",
          venue: "N",
          score: [2, 1],
          aet: true,
          tactic: "Hybrid Control",
          goals: [
            { min: 27, side: "them", player: null },
            { min: 74, side: "us", player: "Pulisic", assist: "Metodija" },
            { min: 111, side: "us", player: "Leão", assist: "Ricci" }
          ],
          matchStats: { possession: 53, shots: 18, onTarget: 7, xg: 2.18 },
          oppStats: { possession: 47, shots: 16, onTarget: 6, xg: 1.87 },
          potm: "Leão 9.1",
          cards: ["Fofana"],
          lineup: "Maignan (C); Moretti, Tomori, Pavlović, Metodija; Ricci (VC), Jashari, Valera; Pulisic, Leão, Nascimento",
          highlight: "Trophy number five",
          story: "Athletic scored first. Metodija won the ball and set up Pulisic's equaliser on 74 minutes, and in the 111th minute Ricci won possession and released Leão, who fired across the keeper. Tomori and Pavlović held out to the end, and Maignan lifted Milan's first trophy of the Tej era.",
          selection: "Maignan C; Moretti, Tomori, Pavlović, Metodija; Ricci VC, Jashari, Valera; Pulisic, Leão, Nascimento. Hybrid Controlled Counter.",
          report: "Neutral European final, 120 min. 12 Maignan early save; 19 Pulisic forces keeper save. 27 Athletic score on low cross from Milan right. Half-time Milan 0-1, faster measured attacking requested. 60 Metodija sprints back to make critical sliding interception. 74 Metodija wins ball and plays diagonal to Pulisic; Pulisic cuts inside for 1-1. 86 Maignan important save. Full 90 1-1. 92 Metodija replaced by Bartesaghi under medical workload monitoring; Fofana adds midfield protection, Giménez replaces Nascimento. 105 still 1-1. 111 Ricci wins and releases Leão into left channel; Leão fires across keeper. 113 Maignan catches cross; 117 Tomori blocks shot; 119 Athletic free kick into wall; 120+2 Pavlović clears final ball. Whistle, Milan European champions.",
          perf: "MOTM Leão 9.1; Maignan 8.8; Metodija 8.1 in 92 minutes. Fofana yellow in ET. No serious injuries. Milan qualify for 2029/30 UCL as UEL winners."
        }
      ],

      notes: [
        "All 60 competitive matches are on record: 38 Serie A, 17 Europa League and 5 Coppa Italia, with every Milan scorer and assist.",
        "Opponent scorers the archive does not name are shown as unnamed. Full starting XIs were recorded for only a few matches.",
        "The save's season summary said 54 matches and 34 league goals conceded; the 60 recorded scores add up to 110 scored and 58 conceded, 33 of them in the league.",
        "Tactics are tagged only where the match report or that month's plan names one.",
        "Metodija's registration at 16 follows a fictional rule chosen for this save. It is not a real FIFA regulation."
      ]
    }
  ],

  /* All-time XI: the best player Tej has managed in each position, across
     both clubs. Rows go back line to front line, each row left to right.
     Built on his preferred 4-2-3-1. Swap anyone you like. */
  allTimeXI: {
    title: "The Tej Era XI",
    shape: "4-2-3-1",
    note: "Built on Tej's preferred 4-2-3-1, the shape that won the 2028 Champions League, with the best player he has managed in each position at either club.",
    rows: [
      [{ name: "Maignan", full: "Mike Maignan", pos: "GK", club: "acm", why: "Captain and Goalkeeper of the Season; lifted the Europa League" }],
      [
        { name: "Metodija", full: "Rana Metodija", pos: "LB", club: "acm", why: "Young Player of the Season at 16, from Tej's hometown" },
        { name: "Cubarsí", full: "Pau Cubarsí", pos: "CB", club: "mu", why: "Won the ball that started the 2028 Champions League winner" },
        { name: "Yoro", full: "Leny Yoro", pos: "CB", club: "mu", why: "Started the 2028 final; rated 86" },
        { name: "Koundé", full: "Jules Koundé", pos: "RB", club: "mu", why: "88-rated right-back of the 101-point side" }
      ],
      [
        { name: "Valera", full: "Mateo Valera", pos: "CM", club: "acm", why: "Signing of the Season: 11 goals, 18 assists" },
        { name: "Neves", full: "João Neves", pos: "CM", club: "mu", why: "34 assists in 2027/28" }
      ],
      [
        { name: "Leão", full: "Rafael Leão", pos: "LW", club: "acm", why: "Player of the Season; the 111th-minute European final winner" },
        { name: "Bruno", full: "Bruno Fernandes", pos: "CAM", club: "mu", captain: true, why: "Captain for four trophies; 92 goals and assists" },
        { name: "Rashford", full: "Marcus Rashford", pos: "RW", club: "mu", why: "80 goals in two seasons and the Wembley winner" }
      ],
      [{ name: "Cunha", full: "Matheus Cunha", pos: "ST", club: "mu", why: "Scored in both Champions League finals" }]
    ],
    bench: [
      { name: "Lammens", club: "mu" },
      { name: "Dimarco", club: "mu" },
      { name: "Ricci", club: "acm" },
      { name: "Mainoo", club: "mu" },
      { name: "Pulisic", club: "acm" },
      { name: "Diao", club: "mu" },
      { name: "Mbeumo", club: "mu" }
    ]
  },

  /* All-time Hall of Fame. Clubs, goals, assists, seasons, trophies and
     awards are added up from the seasons above. tier: "legend" gets a
     large plaque, "inductee" a small one. */
  hallOfFame: [
    {
      name: "Marcus Rashford", tier: "legend", position: "Forward", epithet: "The Closer", inducted: "2027/28",
      citation: "Scored in both Champions League finals: the opener in Lisbon and the 112th-minute winner at Wembley. His 88th-minute goal at Anfield made it 101 points. Man of the Match in the 2028 final (9.6)."
    },
    {
      name: "Bruno Fernandes", tier: "legend", position: "Captain, attacking midfield", epithet: "The Captain", inducted: "2027/28",
      citation: "Lifted every United trophy of the era. 25 goals and 24 assists in 2027/28, and the pass that sent Mbeumo away for the Wembley winner. 91 OVR, the highest Tej has managed."
    },
    {
      name: "Matheus Cunha", tier: "legend", position: "Forward", epithet: "Big-Game Hunter", inducted: "2027/28",
      citation: "Won the 2027 final with a 117th-minute goal, equalised in the 2028 final, and scored the 86th-minute winner against Arsenal that opened the title gap. Moved from left wing to centre-forward without missing a beat."
    },
    {
      name: "Rafael Leão", tier: "legend", position: "Left wing", epithet: "The 111th Minute", inducted: "2028/29",
      citation: "Player of the Season and Goal of the Season. 21 goals, the most at Milan, including two in the 4–2 win at Inter, and the 111th-minute strike that won the Europa League final."
    },
    {
      name: "Assane Diao", tier: "inductee", joined: "2027/28", position: "Left wing", epithet: "The Breakout", inducted: "2027/28",
      citation: "A €37M signing who grew from 81 to 84, took the left wing and scored in both Real Madrid legs and the Wembley final."
    },
    {
      name: "João Neves", tier: "inductee", joined: "2027/28", position: "Central midfield", epithet: "The Architect", inducted: "2027/28",
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
      name: "Roony Bardghji", tier: "inductee", joined: "2027/28", position: "Right wing", epithet: "Wembley Winner", inducted: "2027/28",
      citation: "Scored the 83rd-minute winner in the Carabao Cup final and created 17 goals."
    },
    {
      name: "Pau Cubarsí", tier: "inductee", position: "Centre-back", epithet: "The Wall", inducted: "2027/28",
      citation: "Won the ball against his former club to start the winning move in the 2028 final, then made the decisive interception at 118."
    },
    {
      name: "Christian Pulisic", tier: "inductee", position: "Right wing", epithet: "The Leveller", inducted: "2028/29",
      citation: "Led Milan with 34 goals and assists. Equalised in the Europa League final from Metodija's pass and scored a Goal of the Season nominee against Juventus."
    },
    {
      name: "Mike Maignan", tier: "inductee", position: "Goalkeeper", epithet: "Il Capitano", inducted: "2028/29",
      citation: "Club captain and Goalkeeper of the Season. Made the saves that carried Milan past Porto, Ajax and Frankfurt, then lifted the Europa League trophy."
    },
    {
      name: "Samuele Ricci", tier: "inductee", position: "Defensive midfield", epithet: "The Conductor", inducted: "2028/29",
      citation: "Vice-captain and Midfielder of the Season. 22 assists, the most at Milan, including the pass for Leão's winner in the Europa League final. Rated 9.0 in the Total Possession win over Juventus."
    },
    {
      name: "Mateo Valera", tier: "inductee", position: "Central midfield", epithet: "Between the Lines", inducted: "2028/29",
      citation: "Signing of the Season. 11 goals and 18 assists from the pockets between the lines, rising from 84 to 87."
    },
    {
      name: "Rana Metodija", tier: "inductee", position: "Left-back", epithet: "The Kid from Home", inducted: "2028/29",
      citation: "Scouted in Tej's hometown and converted to left-back at 16. Young Player of the Season: 10 assists, the 88th-minute Coppa semi-final winner, and the pass for the Europa League final equaliser."
    },
    {
      name: "Santiago Giménez", tier: "inductee", position: "Striker", epithet: "The Second Nine", inducted: "2028/29",
      citation: "Impact Player of the Season. Refused to be frozen out by Nascimento and scored 17 goals, including against Porto, Ajax and Lazio."
    },
    {
      name: "Giovanni Ferri", tier: "inductee", position: "Central midfield", epithet: "Academy Graduate", inducted: "2028/29",
      citation: "Academy Breakthrough of the Season. Rose from 70 to 75 and scored 7 goals with 7 assists, starting with his first senior goal against Pisa."
    }
  ],

  /* Record book. ticker: true also puts it on the scrolling LED board. */
  records: [
    { value: "101", unit: "pts", label: "Premier League points", detail: "Past Manchester City's 100-point benchmark, with a win at Anfield on the final day.", season: "2027/28", club: "mu", ticker: true },
    { value: "5", unit: "trophies", label: "Major trophies at two clubs", detail: "Two Champions Leagues, the Premier League and the Carabao Cup with United; the Europa League with Milan.", season: "2026–2029", ticker: true },
    { value: "3", unit: "of 3", label: "European finals won, all in extra time", detail: "Bayern in Lisbon 2027, Barcelona at Wembley 2028, Athletic Club in 2029.", season: "2026/27 – 2028/29", ticker: true },
    { value: "101", unit: "goals", label: "Premier League goals", detail: "101 scored, 33 conceded, goal difference +68.", season: "2027/28", club: "mu" },
    { value: "17", unit: "wins", label: "Consecutive league wins", detail: "Every league game from matchweek 22 to matchweek 38.", season: "2027/28", club: "mu", ticker: true },
    { value: "8–2", unit: "", label: "Manchester derby", detail: "18 September 2027. United won the two league derbies 13–4 on aggregate.", season: "2027/28", club: "mu", ticker: true },
    { value: "4–2", unit: "", label: "Milan derby, away", detail: "The Tej Special at Inter, 19 November 2028: Leão twice, Pulisic and Giménez.", season: "2028/29", club: "acm", ticker: true },
    { value: "1", unit: "defeat", label: "League defeats all season", detail: "Bournemouth 2–1 United, 23 January 2028.", season: "2027/28", club: "mu" },
    { value: "45", unit: "goals", label: "Rashford in one season", detail: "All competitions, up from 35 the year before.", season: "2027/28", club: "mu", ticker: true },
    { value: "34", unit: "assists", label: "Neves in one season", detail: "The squad's leading creator in all competitions.", season: "2027/28", club: "mu" },
    { value: "154", unit: "goals", label: "Goals in one season", detail: "65 matches in all competitions, 59 conceded.", season: "2027/28", club: "mu" },
    { value: "21", unit: "goals", label: "Leão, Milan's top scorer", detail: "Player of the Season, with 10 assists on top.", season: "2028/29", club: "acm" },
    { value: "16", unit: "years old", label: "Metodija's semi-final winner", detail: "His first senior goal, in the 88th minute at Fiorentina, sent Milan to the Coppa Italia final.", season: "2028/29", club: "acm" }
  ]
};
