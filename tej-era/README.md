# The Tej Era

A portfolio site for the managerial career of **Tej Jethwani**: Manchester United (2026/27, 2027/28) and AC Milan (2028/29 onwards), built from the career-mode save archives. It is split into tabs:

| Tab | What's on it |
| --- | --- |
| **Overview** | Manager card, LED headline board, the two club chapters, the honours board and career totals |
| **Cabinet** | Every trophy on a spotlit shelf per club, runners-up medals and space reserved for trophies still to win |
| **Seasons** | One tab per season: finals with goal timelines and match stats, the league race chart, final table, every result on record (with full match reports where the archive has them), the goals + assists leaderboard, awards, squad and ratings, tactics, transfers, staff and finances |
| **Lineups** | The elevens that defined each season, drawn on a pitch |
| **Stats** | Season-by-season comparison, the all-time goals + assists leaders, and what the match records show: results by competition and venue, when the goals come, partnerships, Man of the Match awards, bookings, record by tactic, month-by-month form and rating rises |
| **Hall of Fame** | The all-time XI across both clubs, then every inductee, filterable by club |
| **Records** | The record book |
| **Timeline** | The nights that made the era |

It is a fictional save. Nothing on the site is real football history, and the footer says so.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page structure and tabs |
| `data/career.js` | **All the career data.** This is the only file you need to edit. |
| `assets/app.js` | Draws every tab from the data |
| `assets/styles.css` | All styling |

## Preview it

Open `index.html` in a browser. Or, from this folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Adding a new season

Everything updates from `data/career.js`. To add season four:

1. Copy the last object in `seasons` (from `{ id: "2028-29"` to its closing `}`) and paste it after it, with a comma between them.
2. Change `id` (for example `"2029-30"`), `label` (`"2029/30"`), `club`, `title` and `summary`.
3. Fill in `competitions`: one row per competition, with `stage` (for example `"Winners"`, `"Runners-up"`, `"Semi-final"`, `"2nd"`) and `won: true` for every trophy. Trophies appear in the cabinet automatically; `"Runners-up"` adds a silver medal. Point `final` at the id of the final in `matches` to link the trophy to its match.
4. Update `league` (`position`, `p`, `w`, `d`, `l`, `gf`, `ga`, `pts`) and `allComps`.
5. Replace `stats`, `squad`, `lineups`, `table`, `matches` and the rest with the new season's data. Leave out any section you don't have; the site skips it.
6. Update `manager.archive` with the new save code and date.

The cabinet, honours board, manager card, stats, hall of fame totals, LED board and timeline all recalculate.

### Changing club

Add the club once to `clubs` at the top, then set `club` on the season:

```js
rma: { name: "Real Madrid", short: "Madrid", tag: "RMA", from: 2029, to: null }
```

Set `to` on the previous club when Tej leaves it.

### New competitions

Add them to `competitions`:

```js
csh: { name: "Community Shield", short: "Shield", type: "cup", trophy: "cup", metal: "silver" }
```

`type` decides the honours board column: `"league"`, `"europe"`, `"cup"` or `"leagueCup"`. `trophy` picks the drawing: `"ucl"`, `"pl"`, `"lc"`, `"fac"`, `"uel"`, `"coppa"`, `"scudetto"`, or `"cup"` for a generic cup.

### Rules that keep the totals right

- Write each player's **full name the same way every season** in `stats` and `squad`. All-time totals are added up by name. Match goals can use short names ("Leão"); the site maps them to full names.
- Use `null` for anything the save didn't record. It shows as a dash. `goalsAtLeast: 1` records a known minimum, shown as "1+".
- `score` is always **[Tej's team goals, opponent goals]**, whatever the venue. `venue` is `"H"`, `"A"` or `"N"` (neutral). If the score wasn't recorded, use `score: null` and `result: "W"`, `"D"`, `"L"` or `null`.
- Add `aet: true` for extra time and `pens: [ours, theirs]` for a shoot-out.
- `goals`: `{ min, side: "us" | "them", player, assist }`. Use `player: null` when the scorer wasn't named.
- A match with a `highlight` (a short headline) and a `story` appears on the timeline. A match with `round: "Final"` gets the full match-centre treatment.
- `tactic` on a match feeds the record-by-tactic table; use the same name as in the season's `tactics` list.

### Lineups

Each lineup lists rows from the goalkeeper forward, each row left to right:

```js
{
  title: "Europa League final", when: "30 May 2029", shape: "4-3-3", match: "uel-2029-final",
  rows: [
    [{ name: "Maignan", pos: "GK", captain: true }],
    [{ name: "Metodija", pos: "LB" }, { name: "Pavlović", pos: "CB" }, { name: "Tomori", pos: "CB" }, { name: "Moretti", pos: "RB" }],
    ...
  ],
  benchLabel: "Came on", bench: ["Bartesaghi (92')"], note: "..."
}
```

A season with no recorded XI can list `core` players instead (2026/27 does this).

### Hall of Fame, all-time XI and records

- `hallOfFame`: add a player with `tier: "legend"` (large plaque) or `"inductee"`, plus `epithet`, `position`, `inducted` and `citation`. Goals, assists, trophies, seasons, clubs and awards are counted for you.
- `allTimeXI`: rows like a lineup, with `club` on every player and an optional `why` line. Swap anyone you like.
- `records`: `value`, `unit`, `label`, `detail`, `season`, optional `club`. Add `ticker: true` to put it on the LED board. The first record gets the big tile.

## Links into the page

- `#cabinet`, `#seasons`, `#lineups`, `#stats`, `#hall-of-fame`, `#records`, `#timeline` open a tab
- `#season-2028-29` opens that season
- `#m-uel-2029-final` opens the season and jumps to that match (use any match `id`)
- `#lineup-2027-28` jumps to that season's lineups

## Publishing

It is plain HTML, CSS and JavaScript, so it works on GitHub Pages. Deploy the repository root and the site is at `/tej-era/`.
