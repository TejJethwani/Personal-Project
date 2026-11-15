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
- A documented xG model (`src/engine/match/xg.ts`); xA is the xG of the shot a pass creates. xG measures chance quality only (tap-ins ≈ 0.85, a clean one-on-one ≈ 0.6, a pressured shot from the penalty spot ≈ 0.2); a striker who keeps shooting, or who is scoring freely over the season ("marked man"), gets tighter marking that lowers his real chance without changing xG, which keeps season tallies in a realistic range (top scorers around 30–45 in all competitions).
- Weapon levels scale their effect strongly (×1.8 per-level growth), and match performance drives development: a 9.0 display is worth roughly three times a 6.5.
- Bench life: the coach may plan a late cameo for you, and from the bench you can ask to be brought on (chance from coach trust, time and score).
- 32 weapons, 12 passives, 10 ultimates (including Dead Angle Genesis). You start with one weapon and can hold four in a career; the other slots are earned and weapons are permanent once learned. The ultimate chosen at creation is dormant until you have a level-3 weapon, five Flow entries and twelve appearances. Each ability comes each with description, activation, effects, costs, counterplay, limits, five levels and commentary; evolutions, hybrids, chemical reactions, learning from other players, a custom ability builder, and Flow that builds, boosts, drains and gets harder to re-enter.

**NEL** – five clubs, ten fixtures, five rounds with a resting team; bids per player, club and round (annual salary in yen) with reasons and history; Blue Lock ranking and top-23 selection; Player/Team of the Round; a full conclusion screen; a U-20 World Cup between the NEL and the first professional season.

**Professional football** – England (Premier League, Championship, League One with promotion, relegation and play-offs), Spain, Germany, Italy, France, the Netherlands and Portugal top divisions, a domestic cup per country, a 36-club Champions League and 24-club Europa League (single league phase of eight matches, knockout play-off for 9th–24th, then round of 16 to the final), World Cup and continental tournaments, international breaks. Transfers, loans, contracts, managerial changes, ageing, retirement, youth intake, weekly/monthly/season/world awards, records, news generated from real simulation events.

**International football** – World Cup, European Championship, Copa América, Asian Cup, Africa Cup of Nations and Gold Cup on a four-year cycle, plus the U-20 World Cup (odd years), U-20 Asian Cup and U-21 European Championship (even years). A finished tournament (and the NEL) keeps its tables, fixtures and scorers until the next edition is drawn.

**Awards** – weekly, monthly (Player, Goal and Team of the Month) and season awards per league (including Defender / Midfielder / Forward / Signing of the Season), tournament awards (best player, top scorer, golden glove, young player, team of the tournament) and world awards (Ballon d'Or, Golden Boy, European Golden Shoe, positional awards, World Eleven). The season's major awards are presented in an **awards ceremony**.

**Match Centre** – a canvas pitch where players and ball are interpolated on one clock (a carried ball stays at the carrier's feet, a pass arrives exactly with its receiver); every shot zooms into the 3D view; each of the ten ultimates has its own cut-in animation (previewable under Weapons → Ultimate) and shooting ultimates get their own 3D strike effects; 3D replays (a small built-in canvas renderer, no library) of every goal and big chance, with a chase-camera animation for strikes from outside the box; a club / national-team switch; "Sim ahead" for 1 week up to a full year.

**Hall of Fame** – a career portfolio (trophy cabinet, season campaigns, ledger, records, timeline, every recorded result). You can retire at any age from the Hall of Fame, Career History or Settings.

**Controls** – every decision can be made from the list or directly on the pitch: tap a team-mate to pass, tap the goal to shoot, swipe from your player to pick a run or a defensive action (each target shows its success chance). After your action the match holds the picture and tells you what happened (pass complete, cut out, beaten him…).

**3D view** – players have faces and hair; each shot is one of about twenty finish types (top bins, bicycle kick, diving header, chip, rocket, knuckleball, curler, Panenka, in off the post, through the keeper's legs…) with its own camera; goals end with one of seven celebrations; a goal that follows an ultimate is replayed with that ultimate's own 3D effects. Your ultimate can be used once per match without Flow. Weapons → Ultimate has a gallery of all of these.

**Accounts** – create an account or sign in from the main menu; save slots are scoped to the signed-in account. Accounts are local to the browser (the game has no server): they keep people's careers apart on one device but do not sync between devices. A built-in administrator account opens an admin panel that can edit the loaded career (attributes, abilities, club, any player, every rule) and manage accounts and saves.

**Ultimates** – usable once per match without Flow from any attacking touch; a user's ultimate finishes the move itself and scores about nine times in ten. Each plays as a multi-angle 3D cutscene (close-up with a line of dialogue, charge-up orbit, strike, behind-the-net cut, celebration with commentary).

**Chance and xG agree** – the percentage on a shot is its xG adjusted only for the finisher against the keeper and for how tightly a prolific scorer is marked. Outside the box a shot is worth about 0.2 at the edge of the area (0.13 at 30 m); inside it chances sit between about 0.2 and 0.65.

**Off the ball** – a chosen run moves your player at once and visibly differs by type; you can also call for the pass where you stand or tell the man on the ball to shoot.

**Awards night** – routine recognition (Team/Player of the Week, Round, Month) stays out of the career timeline. Season awards split into rankings decided by one number (Golden Boot, Golden Shoe, Iron Man…) and judged awards weighing several things (Golden Glove, Playmaker, Manager of the Season, Ballon d'Or…); the ceremony runs a league gala then a world gala, with the Ballon d'Or counted down from 30th to the podium. A weekly newspaper reports results and award favourites, and the hub shows the Team of the Week on a pitch.

**Match simulator** – from the main menu: any two clubs, NEL sides or national teams, editable team sheets (formation and every slot), one match with ratings, stats and 3D replays, or 100 simulations with outcome shares and common scores. It never touches a save.

**Goalkeepers** – choose GK in the creator. Every shot at your goal is your decision (set and react, guess a side, rush out, stay big), each with its save chance; goalkeeping attributes grow from training and from saves and clean sheets.

**Nations and qualifying** – all 211 FIFA nations (India, Pakistan, China, Thailand, Fiji…, with their own name pools). In the season before a World Cup, qualifying groups in all six confederations are played in the international breaks; your nation's ties are real matches when you are called up, and the 32 finalists come out of the tables.

**Rivals** – rivalries form from matches (two players deciding the same game, a keeper who keeps getting beaten by the same striker) or can be declared (up to five). Each keeps a head-to-head and a duel record; winning the duel brings reputation and extra development. Before a match against a rival there is a 3D tunnel face-off (answer cold, fiery or respectful — it changes the Flow you start with), opponents talk during matches, and rival matches or big nights end with a 3D post-match interview whose answer shapes your image, coach trust and the rivalry. More than 500 lines of original banter across eight personality types plus named Blue Lock characters.

**The Touchline** – the news is a weekly newspaper with a lead story and columns. When a season ends, only the stories about you are kept.

**Play as an existing player** – in the creator's *Team & Start* step you can take over any NEL player (Isagi, Kaiser, …) with his attributes, weapons, ultimate and club instead of creating your own.

**People** – about 3,600 tracked players: the Blue Lock cast, master strikers, baseline professionals and original fictional players. Relationships track respect, trust, friendship, rivalry and chemistry separately, with stored memories that later dialogue refers to.

**Persistence** – IndexedDB autosave and manual slots, versioned schema with migrations, validated JSON export/import, interactive matches saved at decision points.

## Data notes

- Baseline season is **2025/26**. Squads and ratings are written from memory and are **not live or verified data**; results are fictional.
- The five Blue Lock clubs take the league places of their real-world inspirations (for example Bastard München in the Bundesliga).
- `src/engine/data/nel.ts` is the editable NEL roster file. Every entry carries a confidence label (`canon`, `likely`, `uncertain`, `original`); "original" players are fictional and not canon. Canonical results are only used if you turn off "canonical outcomes may change".

## Known limitations

- Only the leagues listed above are simulated. Clubs relegated out of the simulated pyramid are swapped with clubs from the division below; if that happens to your club, a release clause lets you move.
- International qualifying is not simulated: tournament fields are chosen from nation strength. Only your own nation plays friendlies in international breaks.
- Continental competitions contain clubs from the seven simulated top divisions only. There is no third European competition.
- Accounts are stored in the browser, not on a server: they are a convenience for sharing a device, not a security boundary, and the administrator credentials are embedded (hashed) in the client.
- 3D replays re-enact the stored shot snapshot (positions at the moment of the strike, the pass before it and the outcome); they are not a frame-by-frame recording, and are only captured in interactive / highlights modes.
- Youth international squads are picked from players aged 21 or under for every youth tournament.
- No reserve leagues: a "development squad" role means limited first-team minutes at a big club.
- Match volume is coarser than real football: roughly 600–670 passes, 8 shots and 2.2–3.3 goals per match across both teams: xG is deliberately generous (see above), so players take far fewer, better shots than in real football and about 40% of them go in. Tackle and interception counts run higher than real football.
- Squad registration rules, work permits, financial fair play and agents' fees are not modelled.
- A week of world simulation takes around a second; full seasons simulated in one go take 20–30 seconds.
- Stats within a season are attributed to the club a player ends the competition with, unless he moved to a different league.
