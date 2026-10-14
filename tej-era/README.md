# The Tej Era

A portfolio site for the managerial career of **Tej Jethwani** at Manchester United, built from the career-mode save archive. It has:

- **Manager card**: trophies, seasons, league win rate, points per game, finals record
- **Trophy cabinet**: every trophy won, each with its final, plus space reserved for the ones still to win
- **Honours board**: every competition, every season, with the top scorer
- **Season archive**: finals with goal timelines and match stats, the title run-in chart, league tables, every result on record, the goals and assists leaderboard, the preferred XI on a pitch, the squad with ratings, tactics, transfers and finances
- **Hall of Fame**: legends and inductees, with career totals added up across seasons
- **Record book** and **career timeline**

It is a fictional save. Nothing on the site is real football history, and the footer says so.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page structure |
| `data/career.js` | **All the career data.** This is the only file you need to edit. |
| `assets/app.js` | Draws every section from the data |
| `assets/styles.css` | All styling |

## Preview it

Open `index.html` in a browser. Or, from this folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Adding a new season

Everything updates from `data/career.js`. To add season three:

1. Copy the last object in `seasons` (from `{ id: "2027-28"` to its closing `}`) and paste it after it, with a comma between them.
2. Change `id` (for example `"2028-29"`), `label` (`"2028/29"`), `title` and `summary`.
3. Fill in `competitions`: one row per competition, with `stage` (for example `"Winners"`, `"Semi-final"`, `"2nd"`) and `won: true` for every trophy. A trophy appears in the cabinet automatically. Point `final` at the id of the final in `matches` to link the trophy to its match.
4. Update `league` (`position`, `p`, `w`, `d`, `l`, `gf`, `ga`, `pts`) and `allComps`.
5. Replace `stats` (goals and assists), `squad`, `formation`, `table` and `matches` with the new season's data. Leave out any section you don't have; the site skips it.
6. Update `manager.archive` with the new save code and date.

The cabinet, honours board, manager card, hall of fame totals, LED board and timeline all recalculate.

### Rules that keep the totals right

- Write each player's **full name the same way every season** (`"Marcus Rashford"`, not `"Rashford"` one year and `"M. Rashford"` the next). Hall of Fame totals are added up by name.
- Use `null` for anything the save didn't record. It shows as a dash, and Hall of Fame totals show a `+` so nobody thinks the number is complete. Never guess a number.
- `score` is always **[United goals, opponent goals]**, whatever the venue. `venue` is `"H"`, `"A"` or `"N"` (neutral, for finals).
- Add `aet: true` for extra time and `pens: [United, opponent]` for a shoot-out.
- A match with a `highlight` (a short headline) and a `story` appears on the career timeline.
- A match with `round: "Final"` gets the full match-centre treatment. Give it `goals` with minutes to draw the goal timeline.

### New competitions

If Tej wins something new (Community Shield, UEFA Super Cup, Club World Cup, or a trophy with another club), add it to `competitions` at the top:

```js
csh: { name: "Community Shield", short: "Shield", trophy: "cup", metal: "silver" }
```

`trophy` picks the drawing: `"ucl"`, `"pl"`, `"lc"`, `"fac"`, or `"cup"` for a generic cup. `metal` can be `"silver"` or `"gold"`.

### Hall of Fame and records

- Add a player to `hallOfFame` with `tier: "legend"` (large plaque) or `"inductee"`, plus an `epithet`, `position`, `inducted` season and a `citation`. Goals, assists, trophies and seasons are counted for you.
- Add to `records` with a `value`, `unit`, `label`, `detail` and `season`. Add `ticker: true` to put it on the scrolling LED board.

## Links into the page

- `#season-2027-28` opens that season in the archive
- `#m-ucl-2028-final` opens the season and jumps to that match (use any match `id`)

## Publishing

It is plain HTML, CSS and JavaScript, so it works on GitHub Pages. Deploy the repository root and the site is at `/tej-era/`.
