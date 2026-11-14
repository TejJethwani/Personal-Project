# EGO: Beyond Blue Lock

A single-player football career game that runs entirely in the browser. You create one player, start in the Neo Egoist League (NEL), get valued in yen by the world's clubs, and then take the same save into a professional football pyramid that keeps running for as many seasons as you play.

Fan-made and non-commercial. All artwork is original SVG/CSS (portraits, badges, pitch); no anime screenshots or official crests are used. Fonts (Barlow, Barlow Condensed — SIL Open Font Licence) are bundled, so the game works offline with no API keys or paid services.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open the URL Vite prints (usually `http://localhost:5173`).

Other commands:

```bash
npm test
```

```bash
npm run build
```

```bash
npm run preview
```

`npm test` runs 32 automated tests, including a full NEL plus two professional seasons (about 2–3 minutes).

## How to play

- **Main menu** – New Career, load a save slot, or import a `.json` save.
- **Career creator** – nine tabs: identity, team and start (pick your NEL club, or skip the NEL and join a professional club directly), body and position, appearance, ego, rating (any OVR 1–99), attributes, abilities, rules. *Balanced* mode distributes attributes to hit your chosen OVR exactly; *Unrestricted* lets you type every attribute and shows the calculated OVR.
- **Continue** (top-right, always visible) – advances time to the next thing that needs you: a match, a decision, an important event. The career hub shows what that is.
- **Match Centre** – choose *Full interactive*, *Key highlights* or *Quick simulation*; you can switch during the match.
  - Click a choice or press **1–9**. **Space** pauses. Speed 1×/2×/4×.
  - Every choice shows its percentage chance. Hover a choice to see it drawn on the pitch.
  - On the ball: shoot (several finishes), ground, driven and lofted passes, through balls and lobs over the top, high and low crosses, one-two, take-on, skill move, carry, hold, weapons, ultimates.
  - Off the ball: run in behind, blindside run, near/far post, overlap, come short, hold position.
  - Defending: tackle, press, jockey, cut the passing lane.
  - Each choice shows a qualitative risk and intent; turn on numeric probabilities in Settings.
- **Training** – one session a day; the weekly plan repeats until you change it.
- **Relationships** – answer conversations that arise from events, or spend limited weekly social time on a specific person.
- **Transfers** – accept, reject, negotiate (three rounds) or simply wait until the deadline.
- **Settings** – manual saves, JSON export/import, difficulty, frequency, reduce motion, sandbox editor.

## What is implemented

**Simulation core** (`src/engine`, no React)

- Seeded, deterministic RNG whose state is stored in the save; per-fixture seeds make results independent of processing order.
- 31 outfield + 5 goalkeeper attributes on one 1–99 scale; OVR is always computed from position-specific weights.
- One possession engine for every match and mode, with two separate rule state machines: **NEL** (first to three, playing-time clock, no 90-minute ending, Star Change, substitutions) and **regulation** (halves, stoppage time, extra time, penalties, offsides).
- A documented xG model (`src/engine/match/xg.ts`); xA is the xG of the shot a pass creates. xG measures chance quality only (tap-ins ≈ 0.8, a clean one-on-one ≈ 0.55); a striker who keeps shooting, or who is scoring freely over the season ("marked man"), gets tighter marking that lowers his real chance without changing xG, which keeps season tallies in a realistic range (top scorers around 30–45 in all competitions).
- Weapon levels scale their effect strongly (×1.8 per-level growth), and match performance drives development: a 9.0 display is worth roughly three times a 6.5.
- Bench life: the coach may plan a late cameo for you, and from the bench you can ask to be brought on (chance from coach trust, time and score).
- 32 weapons, 12 passives, 10 ultimates (including Dead Angle Genesis). You start with one weapon and can hold four in a career; the other slots are earned and weapons are permanent once learned. The ultimate chosen at creation is dormant until you have a level-3 weapon, five Flow entries and twelve appearances. Each ability comes each with description, activation, effects, costs, counterplay, limits, five levels and commentary; evolutions, hybrids, chemical reactions, learning from other players, a custom ability builder, and Flow that builds, boosts, drains and gets harder to re-enter.

**NEL** – five clubs, ten fixtures, five rounds with a resting team; bids per player, club and round (annual salary in yen) with reasons and history; Blue Lock ranking and top-23 selection; Player/Team of the Round; a full conclusion screen; a U-20 World Cup between the NEL and the first professional season.

**Professional football** – England (Premier League, Championship, League One with promotion, relegation and play-offs), Spain, Germany, Italy, France, the Netherlands and Portugal top divisions, a domestic cup per country, a 36-club Champions League and 24-club Europa League (single league phase of eight matches, knockout play-off for 9th–24th, then round of 16 to the final), World Cup and continental tournaments, international breaks. Transfers, loans, contracts, managerial changes, ageing, retirement, youth intake, weekly/monthly/season/world awards, records, news generated from real simulation events.

**International football** – World Cup, European Championship, Copa América, Asian Cup, Africa Cup of Nations and Gold Cup on a four-year cycle, plus the U-20 World Cup (odd years), U-20 Asian Cup and U-21 European Championship (even years). A finished tournament (and the NEL) keeps its tables, fixtures and scorers until the next edition is drawn.

**Awards** – weekly, monthly (Player, Goal and Team of the Month) and season awards per league (including Defender / Midfielder / Forward / Signing of the Season), tournament awards (best player, top scorer, golden glove, young player, team of the tournament) and world awards (Ballon d'Or, Golden Boy, European Golden Shoe, positional awards, World Eleven). The season's major awards are presented in an **awards ceremony**.

**Match Centre** – 3D replays (a small built-in canvas renderer, no library) of every goal and big chance, with a chase-camera animation for strikes from outside the box; a club / national-team switch; "Sim ahead" for 1 week up to a full year.

**Hall of Fame** – a career portfolio (trophy cabinet, season campaigns, ledger, records, timeline, every recorded result). You can retire at any age from the Hall of Fame, Career History or Settings.

**People** – about 3,600 tracked players: the Blue Lock cast, master strikers, baseline professionals and original fictional players. Relationships track respect, trust, friendship, rivalry and chemistry separately, with stored memories that later dialogue refers to.

**Persistence** – IndexedDB autosave and manual slots, versioned schema with migrations, validated JSON export/import, interactive matches saved at decision points.

## Data notes

- Baseline season is **2025/26**. Squads and ratings are written from memory and are **not live or verified data**; results are fictional.
- The five Blue Lock clubs take the league places of their real-world inspirations (for example Bastard München in the Bundesliga).
- `src/engine/data/nel.ts` is the editable NEL roster file. Every entry carries a confidence label (`canon`, `likely`, `uncertain`, `original`); "original" players are fictional and not canon. Canonical results are only used if you turn off "canonical outcomes may change".

## Known limitations

- Goalkeeper careers are not supported; the user plays any of the twelve outfield positions.
- Only the leagues listed above are simulated. Clubs relegated out of the simulated pyramid are swapped with clubs from the division below; if that happens to your club, a release clause lets you move.
- International qualifying is not simulated: tournament fields are chosen from nation strength. Only your own nation plays friendlies in international breaks.
- Continental competitions contain clubs from the seven simulated top divisions only. There is no third European competition.
- 3D replays re-enact the stored shot snapshot (positions at the moment of the strike, the pass before it and the outcome); they are not a frame-by-frame recording, and are only captured in interactive / highlights modes.
- Youth international squads are picked from players aged 21 or under for every youth tournament.
- No reserve leagues: a "development squad" role means limited first-team minutes at a big club.
- Match volume is coarser than real football: roughly 600 passes, 20 shots and 2.2–2.8 goals per match across both teams. Tackle and interception counts run higher than real football.
- Squad registration rules, work permits, financial fair play and agents' fees are not modelled.
- A week of world simulation takes around a second; full seasons simulated in one go take 20–30 seconds.
- Stats within a season are attributed to the club a player ends the competition with, unless he moved to a different league.
