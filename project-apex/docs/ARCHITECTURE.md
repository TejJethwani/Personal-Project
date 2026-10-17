# Architecture

PROJECT APEX is split into a **pure TypeScript engine** and a **React interface**. The engine knows nothing about the browser; the UI never computes game outcomes itself.

```
┌──────────────────────────── Browser ────────────────────────────┐
│  React pages & components (src/pages, src/components)           │
│        │ read GameState                  ▲ re-render on rev++   │
│        ▼                                 │                      │
│  Zustand store (src/store/gameStore.ts)                         │
│    act(fn) → runs an engine action on the GameState,            │
│              bumps `rev`, shows toasts, schedules autosave      │
│        │                                                        │
│        ▼                                                        │
│  Engine actions (src/engine/**)  ── validate → mutate state     │
│        │                                                        │
│  Persistence (src/store/persistence.ts) → IndexedDB / JSON file │
└──────────────────────────────────────────────────────────────────┘
```

## The game state

`GameState` (`src/engine/types.ts`) is one plain, JSON-serialisable object:

- `teams`, `drivers`, `staff`, `circuits`: entity tables keyed by id.
- `calendars`: the current season's events per division; `results`: this season's classified races.
- `weekend`: the player's in-progress race weekend (practice runs, qualifying sessions, strategies, and the live `RaceState`).
- `history`: one `SeasonHistory` per completed season, holding final standings, compacted race results, champions, awards, promotions and relegations.
- `news`, `player` (scouting knowledge, negotiations, sponsor offers, opportunities), `settings`.
- `processed`: idempotency keys. Every one-off payout or state transition (race result, season finalisation, off-season start, opportunity, title clinch) records a key and refuses to run twice.
- `seed` and `rng`: the world seed; all randomness derives from it.

There are no class instances, Maps, Sets, `Infinity` or functions anywhere in the state, so it can be cloned, saved and exported without adapters. A `NO_TIME` sentinel stands in for "no lap time yet".

## Engine actions

All mutations go through exported functions such as `offerContract`, `startProject`, `signSponsor`, `advanceWeek`, `runPractice`, `applyRaceCommand`. Each one:

1. validates with `assertRule(condition, message)`, which throws a `GameRuleError` with a player-facing message (shown as a toast), and
2. only then mutates the state. Money only moves through `postTransaction`, so the ledger always reconciles with cash.

AI teams use exactly the same actions. AI decisions are wrapped in `aiTry`, so a decision that would break a rule is skipped rather than stalling the world.

`validateState` (`src/engine/validation.ts`) checks cross-entity invariants: no driver in two seats or two teams, contracts consistent with line-ups, no negative contract durations, ten teams per division, results present exactly for completed events, valid classifications. Tests run it every simulated week; imported saves must pass it.

## Time and flow

```
preseason (week 0) ──Start Season──► season weeks 1..44 ──last race──► seasonReview
     ▲                                  │  each week: finances, R&D,                │
     │                                  │  facilities, scouting, injuries,          │
     │                                  │  AI managers, other divisions' races,     │
     │                                  │  monthly development/news                 │
     │                                  ▼                                           │
     │                     player race week ► weekend phase                         │
     │                     (practice → qualifying → strategy → race → result)       │
     │                                                                              ▼
     └──── off-season weeks −6..−1 (AI transfer rounds, staff, sponsors) ◄─── beginOffseason
```

- `advanceWeek` (`season/advance.ts`) is the single clock. `advanceToNextEvent` repeats it until something needs the player (a race weekend, a decision, a blocker such as a missing driver).
- Other divisions' events run through `simulateEventAutomatically`, which uses the same qualifying and race engine as the player's weekend.
- `finalizeSeason` closes the championships (titles, prize money, sponsor reviews, awards, board review, reputation, history snapshot) and computes promotions. `beginOffseason` applies division moves, regulation resets, contract expiries, ageing, retirements and new talent, and builds the next calendar.

## Game modes

`GameState.mode` is absent for a Classic career, `'european'` for a European League career and `'daily'` for a daily challenge. Mode-specific division rules live in `config/ruleset.ts`: `applyRuleset(state)` swaps the values in `DIVISIONS` in place (Classic values are kept in a snapshot), so every system and page reads the right league names, field sizes, race counts and prize tables without passing the mode around. The store applies it on load, new game and quit; engine entry points (week advance, weekend close, season end) apply it defensively. `activeDivisions(state)` lists the divisions a career actually races.

A European career adds `state.europe`: clubs (with `teamId` for full teams), leagues, associations and their coefficients, the season's fixtures, ties, continental competitions and cups, the player's cup and continental race events, and guest teams. Cup and continental races for the player are ordinary `CalendarEvent`s with `teamIds`, a `laps` override, the `h2h` points preset and `euro` metadata; the weekend engine treats them like any race, and the competition module turns the classification into a fixture result. A league gameweek is one race; a cup or continental fixture in the same week runs first, and finishing it starts the league race straight away.

A career can also start by taking over an existing team (`NewCareerConfig.takeover`): the world generator fills every seat with an established team and `career/manager.ts` hands the chosen one to the player. `player.managerHistory` records each appointment, the groundwork for moving between teams.

European saves use their own IndexedDB slots (`euro-autosave`, `euro-slot-1…5`), and the title screen offers a separate continue entry.

## Determinism

- `Rng` is mulberry32 with a single uint32 of state. `Rng.from(seed, ...labels)` derives independent streams with a hash, so results do not depend on the order of unrelated actions.
- Each race seeds its own stream from `(worldSeed, eventId)` and stores the RNG state inside `RaceState`. Stepping one lap at a time, jumping to the next key event or running to the finish all call the same `stepRaceLap`, so the outcome is identical at any playback speed, and identical after a save/load mid-race.
- Player commands only change car instructions between laps, so the same decisions always give the same race.
- Negotiations and sponsor talks use deterministic streams keyed by driver, team and week, so repeating an identical offer cannot re-roll the answer.

## User interface

- `App.tsx` switches between the title screen, the career wizard and the game shell. Pages are selected by a `page` value in the store (no URL routing; the game is a single-screen app).
- `useGame()` subscribes to the store's revision counter and returns the live `GameState`.
- The live race keeps its animation outside React: `BroadcastMap` runs a `requestAnimationFrame` loop that positions SVG markers by interpolating each car's gap to the leader across the current lap (close cars side by side), drives the cameras (including the broadcast director) and labels, while React re-renders only once per simulated lap. The start lights, alerts and feeds are presentation only; every view and every simulate-to button runs the same laps.
- `components/ui` is a small shadcn-style kit (Button, Panel, Tabs, Segmented, Modal, RatingBar and so on) built with `class-variance-authority` and `tailwind-merge`.

## Persistence

- `serializeGame` wraps the state in an envelope `{ format, version, savedAt, checksum, meta }`. The checksum is an FNV-1a hash of the state JSON.
- `deserializeGame` rejects foreign files, newer versions, checksum mismatches (checked on the save as written) and states that fail `validateState`, then runs `save/migrate.ts`. Version 2 migrations move European League weekends to one race per gameweek and queue Expanded points for the next season; every step only fills in or retires what is needed, so no raced result is lost.
- `store/persistence.ts` stores envelopes in IndexedDB (`project-apex` database, `saves` store): one autosave slot (written about a second after any action) and five manual slots. Export downloads the same JSON; import accepts it back.

## Testing

Vitest runs in Node against the engine directly (`src/engine/__tests__`) plus the IndexedDB layer with `fake-indexeddb` (`src/store/__tests__`). Test helpers run full seasons with the assistant manager (`ai/assistant.ts`) controlling the player's team, which is the same logic as the in-game holiday mode.
