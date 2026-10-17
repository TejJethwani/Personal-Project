# PROJECT APEX: From Backmarkers to World Champions

A browser-based motorsport team management simulator with two career modes:

- **Classic Career**: found a tiny Formula 5 team and drag it up a five-division pyramid (F5 → F4 → F3 → F2 → F1), then build a Formula 1 dynasty.
- **European League**: join one of 32 national associations, race full 40-car grids with two championship races every weekend, climb through promotion and relegation, win domestic cups, and take on Europe in the Apex Champions, Europa and Conference Leagues.

Every race is simulated lap by lap from game variables (car, driver, setup, tyres, fuel, weather, strategy, incidents). Rival teams are run by AI managers that follow the same economic and contractual rules as you. Seasons, results, transfers and records persist for as long as you keep playing.

## Quick start

Requirements: Node.js 18 or newer (developed on Node 22) and npm.

```bash
cd project-apex
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Type-check and build a production bundle into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run build:artifact` | Production build plus `dist/artifact.html`, the page body used to host the game on claude.ai (assets load by relative path) |
| `npm test` | Run the full Vitest suite (engine, simulation, economy, saves) |
| `npm run sim` | Run only the long-run multi-season simulation test |
| `APEX_SEASONS=15 npm run sim` | Same, over 15 seasons |
| `npm run typecheck` | TypeScript strict type-check |

No server, account or paid API is needed. Everything runs in the browser; saves live in IndexedDB.

## How to play

1. **Create your team**: name, abbreviation, nationality, colours, livery, principal, philosophy, difficulty and financial start.
2. **Pre-season briefing**: the Headquarters page shows your budget, drivers, car rating and the board's objectives.
3. **Prepare**: sign sponsors (Finances), hire the three vacant staff roles (Staff & Facilities), start R&D (Car Development), scout and sign drivers (Driver Market).
4. **Advance time** with the red button in the top bar. It simulates week by week (other divisions race, AI teams develop and trade) and stops automatically for your race weekends and for decisions.
5. **Race weekend** (Race Center):
   - *Practice*: tune five setup parameters from driver feedback, or let your race engineer do it. Long runs reveal tyre wear.
   - *Qualifying*: choose risk per driver (banker lap, normal, maximum attack) and run each session (knockout format in F2/F1).
   - *Strategy*: pick from your strategist's tyre plans, opening pace and (F2/F1) fuel load.
   - *Race*: watch at 1×, 5×, 20× or 60×, jump to the next key event or the finish. Give each driver pace, tyre, fuel and ERS modes, defend, team orders, and call pit stops with any compound.
6. **Season end**: review awards and board objectives, accept or decline promotion, then work the six-week off-season transfer window.
7. Repeat until you are Formula 1 world champions. Then keep winning.

Holiday mode (Settings) lets your assistant run the team to the end of the season using the same logic as the AI teams.

### European League career

1. **New Career → European League**: pick an association (ranked by coefficient, with its divisions and European places shown) and the race 2 grid rule (its own qualifying, race 1 result with the top ten reversed, or the race 1 grid). You start in the bottom division.
2. **League weekends** have two races, both paying full Formula 1 points (25-18-15-12-10-8-6-4-2-1, no fastest-lap bonus by default). Practice and qualifying set up race 1; race 2 follows straight after with your setup work carried over. Constructors' standings decide titles, promotion, relegation and European places; drivers' standings run alongside.
3. **Cups**: the domestic cup (every club in the pyramid), the league cup (top two levels) and the super cup (champion against cup winner) are knockout head-to-head races.
4. **Europe**: the top of the league table and the cup winner qualify, by coefficient rank, for the Apex Champions League, Europa League or Conference League. Each has 36 clubs in one league-phase table (8 opponents for the Champions and Europa League, 6 for the Conference League), top 8 into the Round of 16, 9-24 into two-legged knockout play-offs, then two-legged rounds and a single-race final. Head-to-head races score 4-3-2-1 per car; level ties go to an extra race, then a qualifying shoot-out.
5. The **Europe & Cups** page has every table, matchday, bracket, coefficient ranking and the roll of honour. European saves use their own slots and never overwrite a Classic career.

## Feature overview

- **Five divisions** with distinct budgets (F5 $1.2M to F1 $150M), race counts (8/10/12/14/22), race lengths, lap times, tyre rules (single compound in F5 up to mandatory two-compound rules in F2/F1), DRS (F3+), fuel management (F2/F1), ERS (F1), qualifying formats, reliability and points systems.
- **Promotion and relegation** with transparent licensing requirements (solvency, cash reserve, facility levels, full staff, reputation). Promoted cars are rebuilt to the new series' regulations; drivers, staff, facilities, finances and history carry forward. AI teams move between divisions too.
- **320+ fictional drivers** (about 90 free agents and 50 youth prospects at the start) with twelve attributes, archetypes (Generational Talent, Qualifying Specialist, Tyre Whisperer, Wet Weather Master, Veteran Leader, Aggressive Overtaker, Inconsistent Prodigy and more), personalities, morale, confidence, injuries, penalty points and race bans, full career records. The pool regenerates every season with new prospects, while veterans retire.
- **Driver market**: search and filter the whole universe, scout hidden attributes and potential, negotiate salary, length, signing/win/podium bonuses and status, pre-contracts for next season, buyouts, releases with severance, reserves and the academy. Drivers evaluate offers on salary, division, competitiveness, reputation, role, contract length, development and loyalty, and compare them to their alternatives.
- **Car engineering**: ten components with track-dependent weighting, customisable R&D projects (package from a quick fix to a +10 radical concept, safe/balanced/ambitious approach, normal or rushed build) with cost, engineering capacity, duration, facilities and testing; outcomes include breakthroughs, underwhelming results, reliability compromises and delays; diminishing returns; development that carries over between seasons and through promotion on Casual and Standard, while Realistic and Hardcore winter rule changes take part of it away (with bigger upgrades to compensate); a season-end development boost by finishing position; rival comparison with uncertainty.
- **Race engine**: lap-by-lap, deterministic and seeded. Car performance, driver skill in the conditions, setup, tyre compound and wear, fuel load, dirty air, overtaking difficulty, DRS/ERS, defending, team orders, fatigue, mistakes, collisions with stewards' penalties, mechanical failures with warnings you can nurse, safety cars and VSCs, weather that evolves through the race, pit-stop crews and slow stops.
- **AI managers** with six personalities (financially conservative, aggressive recruiter, engineering-focused, youth specialist, high-risk strategist, championship obsessive) that run R&D, facilities, staff, driver markets, race strategy and in-race decisions.
- **Finances**: ledger-based accounting, weekly salaries and upkeep, race operations, repairs, entry fees, prize money, driver backing, investors, sponsorship deals with tiers, risk profiles, expectations, satisfaction, renewals and negotiation; forecasts and contract obligations.
- **Organisation**: eight facilities with ten levels each, seven staff roles with ratings, experience, specialisations and contracts, a youth academy with yearly trialists.
- **World**: dynamic news (race reports, rumours, transfers, interviews, previews, predictions, title fights, regulation news, principal statements), board objectives and confidence, random opportunities (investors, wind-tunnel time, pay drivers, test days, transfer bids), reputation.
- **Fresh every season**: season twists change how each series races (Monsoon Season, Tyre War, New Power Units, Overtaking Package, Double-Points Finale, Reverse-Grid Round, Development Race, Bumper TV Deal, Heatwave Summer); three season challenges with cash, reputation and car-development rewards, one of them to beat a named rival team with a live head-to-head; next season's twists previewed in the season review.
- **Reasons to come back**: 31 career achievements in a trophy cabinet (plus daily trophies kept across careers in the browser), a daily challenge (the same race weekend scenario for everyone on a date, scored in stars, with a day streak), and a one-click *Simulate weekend* for the races you don't want to play in full.
- **European League mode**: 32 associations with 2-3 divisions each (1,150 clubs). Your association runs on the full simulation (teams, drivers, staff, cars, money); other clubs race on a calibrated quick model driven by club strength. Full grids of up to 40 cars with three-session knockout qualifying, two races per weekend, promotion and relegation in every association, domestic cup, league cup and super cups, coefficient-based allocation of exactly 36 clubs per continental competition, qualifying knockouts, a constraint-solved league-phase draw (balanced home and away, no same-association opponents, matchday schedule), knockout play-offs, two-legged ties, finals, the European Super Cup, prize money, coefficients, honours and history. Any race your team takes part in runs on the full race engine: foreign opponents get a car and drivers tuned to their club's strength.
- **83 circuits**, including 35 new venues across every category: ultra-short club tracks (under 2.2 km), street circuits, speed bowls, stop-and-go braking tracks, high-downforce technical tracks, mountain passes at altitude (up to 2,000 m), extreme-endurance loops (up to 14.2 km) and changeable-weather coastlines. Fuel use scales with lap length and throttle share, altitude strains engines and cooling, volatile climates bring more and shorter showers, and each category has its own procedurally drawn layout. A circuit guide shows every venue's tags and characteristics. Calendars rotate every season.
- **Live race**: four views on the same simulation (Broadcast, Manager, Highlights and Fast simulation). The broadcast map moves cars by their real gaps and shows battles, the pit lane, the safety car, caution and rain, sector colours and follow or battle cameras. Commentary is built from the race record and never repeats itself, with banners for the big moments. The timing tower shows tyres and their age, pit status, sectors, battles, live points and a rejoin ghost row. The strategy panel covers the pit window, undercut maths, the weather radar, fuel, ERS and one-click strategist calls.
- **Race weekend and post-race**: setup presets from simulator data, a qualifying drop zone, strategy stint charts; after the flag, driver of the race, biggest gains, championship movement, every car's stints and stops, a strategy review, incidents, morale changes, and celebrations for wins and trophies.
- **History**: every season's standings and race results, awards, promotions and relegations, team and driver careers, records (titles, wins, poles, podiums, constructors' titles, consecutive titles, youngest champion, greatest comeback) and a Hall of Fame.
- **Saves**: autosave plus five manual slots in IndexedDB, JSON export/import with version and checksum validation.
- **Difficulties**: Casual, Standard, Realistic, Hardcore (fragile cars for everyone, ruthless AI market, no rescues, insolvency ends the career).

## Technology

| Choice | Why |
| --- | --- |
| React 18 + TypeScript (strict) | Component UI with a fully typed game model |
| Vite 5 | Fast dev server and production builds |
| Tailwind CSS 3 + a small shadcn-style component kit (`src/components/ui`) built with `class-variance-authority`, `clsx` and `tailwind-merge` | Same pattern and look as shadcn/ui, without generating dozens of files the game does not use |
| Zustand | Minimal store; the engine mutates the game state in place and the store bumps a revision counter |
| IndexedDB via `idb` | Durable, large save files (a long career is several MB) |
| Recharts | Finance, standings and rating charts |
| Framer Motion | Animated timing tower, page and modal transitions |
| Vitest (+ `fake-indexeddb`) | Engine, economy, determinism and persistence tests |
| Fontsource fonts | Barlow Condensed, Inter and JetBrains Mono bundled locally, so the game works offline |

## Project structure

```
project-apex/
├── docs/
│   ├── ARCHITECTURE.md      # layers, state model, data flow
│   └── SIMULATION.md        # race, economy, market and AI models with formulas
├── src/
│   ├── engine/              # pure TypeScript game engine (no React, no DOM)
│   │   ├── config/          # divisions, mode rules (ruleset), tuning constants, difficulty, philosophies, AI personalities
│   │   ├── data/            # names, circuits, team seeds, sponsor names
│   │   ├── world/           # universe generation
│   │   ├── drivers/         # ratings, generation, development
│   │   ├── car/             # car model, R&D
│   │   ├── race/            # tyres, weather, setup, qualifying, strategy, engine, weekend, live analysis, commentary, post-race report
│   │   ├── championship/    # points and standings
│   │   ├── market/          # negotiation, transfers, scouting
│   │   ├── finance/         # ledger, weekly costs, sponsors
│   │   ├── staff/ team/     # staff market, facilities
│   │   ├── ai/              # AI managers, AI market, assistant manager
│   │   ├── season/          # calendar, weekly advance, season end, promotion
│   │   ├── europe/          # European League: associations, world, leagues, cups, continental competitions, draw, coefficients
│   │   ├── history/         # records and Hall of Fame
│   │   ├── news/ events/    # news templates, opportunities
│   │   ├── save/            # serialisation with checksum
│   │   ├── validation.ts    # invariants checked by tests and on import
│   │   └── __tests__/       # Vitest suites
│   ├── store/               # Zustand store and IndexedDB persistence
│   ├── components/          # shell, modals, circuit map, UI kit
│   └── pages/               # the eleven pages plus race-weekend screens
└── index.html
```

## Testing

`npm test` runs 94 tests across thirteen files:

- **World**: 250+ drivers, ten teams per division, a valid state, a Formula 5 start that is not overpowered, divisions getting progressively stronger.
- **Race**: determinism with the same seed; identical results at every playback speed (lap-by-lap, key events, straight to the end); identical outcome after a JSON save/resume mid-race; valid classification; a race cannot be recorded twice; strategy changes the result; a much faster car wins most but not all races; better drivers beat worse drivers in equal cars; unreliable cars break down more; knockout qualifying and grid penalties.
- **Championship**: points presets, fastest-lap and pole rules, count-back tie-breaks, standings equal the sum of results.
- **Contracts**: a star refuses a Formula 5 team; fair offers to suitable free agents succeed; repeated offers get the same answer; talks break down after lowballing; release with severance; invalid terms rejected; no double pre-contracts; max two race contracts next season; buyouts move money from buyer to seller; academy capacity.
- **Finances and R&D**: the ledger reconciles with cash; salaries reduce available money; sponsor slots and negotiation patience; prize money cannot be collected twice; R&D cost, capacity, completion and diminishing returns; facility upgrades.
- **Promotion**: licensing checks; ten teams per division after moves; an ineligible winner is not promoted and is told which licence requirements were missing; a promotion offered at season end stands even if money is spent afterwards; a dominant licensed team climbs F5 → F4 → F3 → F2 → F1 with rebuilt cars and higher costs; declining promotion.
- **Saves**: exact round trip; a loaded game continues identically; tampered, foreign and invalid files are rejected; IndexedDB slots save, list, load and delete.
- **Balance**: no car loses rating over the winter below the regulation ceiling; on Casual the player's car never drops even at the speed limit; on Hardcore winter rules take most development away; upgrades are bigger where they do not last; promoted cars keep their advantage (all of it on Casual and Standard, part on Hardcore); the season-end boost rewards the top and helps the bottom; upgrade packages scale up to a big step and the approach and timeline options trade gain for risk, time and money; Formula 1 upgrades are affordable; sponsor deals pay more after promotion; above it every car slows equally and the order holds; staff pay by role and series; the staff pool is topped up; plenty of free-agent drivers; easier difficulties attract bigger sponsors; Formula 1 races have a realistic amount of overtaking and retirements.
- **Features**: twists are fresh each season and identical for the same world; the double-points finale pays twice and the reverse-grid round flips the top ten; challenges (one against a rival) are drawn every season, pay once and settle at season end; achievements unlock once each and never in a daily challenge; the daily challenge is the same for everyone on a date, starts a valid weekend and records the best finish; stars against the goal.
- **European League**: valid worlds for large and small associations with the right league sizes, two-race calendars and modern points; Classic rules untouched alongside; exactly 36 clubs per competition with nobody in two; a full season where every competition finishes with 144/144/108 league-phase fixtures, eight opponents (six in the Conference League) half at home, the top eight into the Round of 16 and 9-24 into the play-offs, and every tie and cup decided; league points scored once per race and standings equal to the sum of the results; race 2 lined up on the reversed race 1 top ten; season rollover with coefficients, holders, promotion and relegation and no guest teams left behind; extra races and qualifying shoot-outs; draw constraints over many random draws; saves round-trip and stay in their own slots; determinism; a three-season stress run; commentary that never repeats a line back to back.
- **Long run**: five full seasons with the assistant managing the player, validating every invariant every week, checking AI finances stay sane, every seat filled, the driver pool stable, history complete, winners mostly from the stronger half of the field and backmarker podiums rare.

## Implementation checklist

| Area | Status |
| --- | --- |
| Five divisions, calendars, distinct regulations and economics | Done |
| Team creation (name, colours, livery, philosophy, difficulty, finances) | Done |
| Universe generation (50 teams, 320+ drivers, ~450 staff, 83 circuits) | Done |
| Lap-by-lap deterministic race engine, practice, knockout qualifying | Done |
| Live race center with SVG track, timing tower, controls, radio | Done |
| Championship points, standings, configurable presets | Done |
| Promotion/relegation with licensing, car rebuilds | Done |
| Driver market, negotiation, scouting, buyouts, academy | Done |
| Car R&D, facilities, staff market | Done |
| Finances, sponsors, forecasts, bailouts, bankruptcy | Done |
| AI managers with personalities | Done |
| Driver development, ageing, retirements, new prospects | Done |
| News, board objectives, opportunities, rivalries | Done |
| History, records, Hall of Fame | Done |
| Autosave, save slots, export/import | Done |
| Automated tests including multi-season simulation | Done |
| European League mode: associations, two-race full-grid leagues, cups, continental competitions, coefficients, separate saves | Done |
| 35 new circuits with category layouts and race effects | Done |
| Live race views, broadcast map, commentary, strategy tools, post-race report | Done |

Possible future work: head-to-head qualifying statistics, a driver morale dialogue system, managing a club in another association mid-career, and a mobile-optimised race center (the game is desktop-first; pages stay usable on small screens but the live race is designed for wide displays).
