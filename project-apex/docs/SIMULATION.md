# Simulation model

All tunable constants live in `src/engine/config/` (`tuning.ts`, `divisions.ts`, `difficulty.ts`). Lap-time constants are written for a 90-second reference lap and scaled to each circuit and division.

## 1. Pace model

Every lap time in practice, qualifying and the race starts from the same function (`race/pace.ts`):

```
scale  = baseLap / 90
lap    = baseLap
       + (60 − carPerf)    × 0.046 × scale     # car: the dominant factor
       + (60 − driverPerf) × 0.030 × scale     # driver
       − (setupQuality − 50)/50 × 0.0042 × baseLap
```

- `baseLap` = circuit reference lap × division factor (F1 1.00, F2 1.08, F3 1.15, F4 1.22, F5 1.30).
- `carPerf` = Σ component rating × circuit weight over the seven pace components (aero, chassis, power unit, braking, suspension, straight-line speed, cornering). Weights come from each circuit's power, downforce, mechanical and braking demands, so a low-drag car shines at Monza and struggles at Monaco.
- `driverPerf` blends pace, braking, adaptability (weighted by the circuit's driver demand), experience, consistency and mentality, plus a confidence/morale modifier. On a wet track it shifts towards the wet-weather attribute, which is why rain reshuffles results.

A 30-point spread in car performance is worth about 1.4 s per lap; a 25-point driver spread about 0.75 s. A great driver in a bad car struggles; an average driver in a great car scores well.

## 2. Race step (lap by lap)

`stepRaceLap` (`race/engine.ts`) for each running car:

1. **Decisions**: the strategist (AI, or the player's car with auto modes on) sets pace, tyre, fuel and ERS modes and decides pit stops; manual player commands override.
2. **Lap time** = pace model + compound offset (soft −0.68 s, hard +0.55 s, intermediates/wets depending on wetness) + wear penalty (0.017 s per % wear, plus a steep cliff) + fuel mass (0.032 s/kg) + instruction offsets + damage + dirty air (up to 0.32 s inside 1.3 s, worse at hard-to-pass tracks) + Gaussian noise (σ from 0.11 to 0.43 s by consistency).
3. **Incidents**:
   - *Mistakes*: base 1.05% per lap, scaled by inconsistency, pace mode, wetness, fatigue, pressure, slicks on a wet track, confidence and the first lap. Outcomes: small time loss, spin (5-12 s), or crash (DNF, possible injury).
   - *Mechanical failure*: per-lap probability = division rate × difficulty multiplier × e^((field average reliability − reliability index)/28) × pace-mode factor × crew factor. Judging reliability against the field keeps breakdown rates stable as a series develops over the years (about 0.5-1 mechanical retirement per race). 45% of failures give a **warning** first; nursing the car in Conserve mode slows the hidden damage and can save the finish.
   - *Track limits and jump starts* give time penalties.
4. **Pit stops**: pit-lane loss for the circuit, plus stationary time from the chief mechanic, a slow-stop chance, damage repairs and any time penalty being served. Under SC/VSC the effective loss shrinks.
5. **Battles**: cars are resolved front to back. If a car's lap would put it ahead of the car in front, it must pass:
   ```
   logit = 2.2 × gap closed this lap(s) + 2.5 × underlying pace advantage(s/lap, ×0.3 on lap 1)
           + (attack − defence)/22 − 3.6 × overtaking difficulty − 0.8 + series modifier
           + DRS 0.8 + ERS overtake 0.45 − defending 0.35 + attack mode 0.25 + wet skill difference
           − 1.4 if the car ahead passed this one in the last two laps
   P(pass) = sigmoid(logit)
   ```
   The underlying pace advantage ignores the lap's random noise, so a pass needs a genuinely faster car, fresher tyres or a mistake ahead, not one lucky lap; the re-pass penalty stops cars swapping places every lap. The series modifier reflects how well cars follow: junior cars +0.2 … −0.3, Formula 1 −1.1 (dirty air). A car can make at most two passes per lap (three on lap 1). Driving modes are worth a few tenths (conserve +0.38 s, push −0.18 s, attack −0.32 s; ERS overtake −0.32 s).

   Typical results over many simulated races: Formula 1 about 45 on-track passes per race (plus 10-15 position changes on lap 1), safety car in about a third of races, 1-2 retirements, winning margin around 8 s; the junior series 30-50 passes, closer finishes, and dry races usually run without a pit stop (tyres last a sprint race, but stopping for softs stays an option).
   A failed attempt leaves the attacker 0.25-0.65 s behind (and in dirty air). Every attempt carries a contact risk (aggression, wetness, first lap, attack/defend modes); collisions cause damage, punctures or retirements, and the stewards may hand out time penalties and penalty points (12 points = race ban). Team orders (hold / let your team-mate by) are respected.
6. **Safety cars**: crashes and stopped cars can trigger a safety car (3-5 laps, field compresses, no overtaking) or a VSC (1-3 laps, everyone slower, gaps kept). The chance scales with the circuit's safety-car risk.
7. **Tyres, fuel, energy, fatigue** update. Running out of fuel retires the car; ERS (F1) charges and depletes by mode.

Weather is generated once per event from the seed: rain cells with start, length and intensity produce a per-lap rain and wetness curve; teams only see a forecast whose accuracy depends on the strategy department and head strategist.

## 3. Weekend

- **Practice**: each driver/circuit pair has a hidden ideal setup (five parameters) from the track's character, the driver's preferences and the weekend's conditions. Every run returns per-parameter feedback that is correct with probability 0.52 + experience/260 + engineer/320 + 0.018 × simulator level. The best setup found is used for qualifying and the race. **AI teams run the same feedback-and-adjust programme** as the player's race engineer, so neither side has a hidden setup advantage.
- **Qualifying**: single session (F5-F3, three runs) or knockout (F2: 20 → 10, F1: 20 → 15 → 10, two runs per session). Track evolution, traffic, mistakes (which can delete a lap) and the chosen risk level shape each lap. Grid penalties are applied afterwards.
- **Strategy**: the strategist enumerates 0-3 stop plans over the legal compounds (two dry compounds are mandatory in F2/F1), optimises stint lengths with prefix-sum lap times and returns the fastest options. Wear estimates carry modelling error that shrinks with tyre knowledge from practice long runs and a better strategy team.

## 4. Championships and promotion

Points presets live in `divisions.ts` (club, junior, feeder with pole and fastest-lap bonuses, modern, classic, extended); a change takes effect next season. Standings use count-back on positions to break ties.

At season end, in each division the two highest-placed teams among the **top four** that pass **licensing** for the division above are promoted, and the same number are relegated from that division (every series always has ten teams). Licensing requires solvency, a cash reserve, minimum facility levels, a full senior staff (F2 and F1) and a minimum reputation. A promoted car is rebuilt to the new division's regulations: it starts a few points behind the field average, offset by the team's engineering strength. Everything else carries over.

## 5. Driver market

Drivers score an offer as a sum of utilities (`market/negotiation.ts`):

| Factor | Model |
| --- | --- |
| Salary | `w × ln(package / expected)`, w = 1.6 for mercenaries, 0.95 ambitious, 1.0 loyal, 1.2 otherwise; package includes amortised signing bonus and expected win/podium bonuses |
| Division | each tier below the driver's ambition costs `gap × (0.5 + 0.28 gap)` (more for ambitious drivers, less for teenagers and veterans); a step up is attractive |
| Competitiveness | projected finishing position of the team |
| Reputation | team reputation relative to its division |
| Role | No. 1 +0.35, No. 2 −0.3 (×1.5 if ambitious), reserve strongly negative unless the driver is weak or old |
| Length | distance from preferred length (young talents want short deals, veterans long ones) |
| Development | simulator, fitness centre and driver coach (drivers 24 and under) |
| Loyalty | current team bonus, larger for loyal drivers and academy graduates, plus morale |
| Philosophy | the player's philosophy attracts or repels certain profiles |

The offer is accepted if it beats the driver's **reservation**: staying under their current contract, or the best alternative offer from AI teams with an open seat, or a base level for free agents that drops as the season approaches. Otherwise the agent counters with the salary that would work, or rejects with the main objection. Lowballing repeatedly breaks off talks for six weeks. AI teams use the same evaluation for their own offers, and compete for the same drivers in pre-contract windows and in the six off-season transfer rounds.

## 6. Economy

All values scale from each division's *typical budget* B (F5 $1.2M, F4 $3M, F3 $7.5M, F2 $18M, F1 $150M).

| Flow | Size for an average team |
| --- | --- |
| Sponsorship (title 0.2B, two majors 0.1B, three minors 0.035B) × appeal; the player's offers × difficulty (Casual 1.8, Standard 1.35, Realistic 1.1, Hardcore 1.0) | ≈ 0.5B (AI) |
| Constructors' prize money (P1 0.42B … P10 0.10B) | ≈ 0.24B |
| Race prize money, driver backing | ≈ 0.05-0.1B |
| Race operations | 0.13B |
| Entry fee | 0.03B |
| Driver salaries (rating-driven, × division salary factor 0.7 … 3.0) | 0.02-0.1B |
| Staff salaries: series scale (F5 $26k … F1 $600k for typical staff) × role weight (technical director 1.6, engineer and strategist 1.0, chief mechanic 0.85, academy director 0.65, driver coach 0.6, scout 0.55) × e^(0.04 × rating above the series' typical staff) | 0.1-0.15B |
| Facility upkeep (6k × 2^(level−1) per facility) | ≈ 0.05B |
| R&D: quick fix 0.005B, minor update 0.01B, major package 0.022B, radical concept 0.04B (×0.85 in F2, ×0.65 in F1: an F1 radical concept costs about $4M); ambitious approach ×1.15, rushed build ×1.4 | discretionary (AI teams budget about 4.5% of the series' R&D cost scale a season, more for big teams) |

Sponsor appeal follows reputation and results. Sponsors pay per race plus bonuses, judge an expectation (constructors' position, podiums, wins or points finishes), cut payments or walk away if unhappy, and offer renewals if happy. A negative balance accrues interest; past the difficulty's overdraft limit the board injects emergency money (limited per difficulty), and in Hardcore insolvency ends the career. AI owners take a share of surplus cash above 1.6B at the end of each season so relegated F1 money does not distort lower series forever.

## 7. Development

- **R&D**: every upgrade is designed by the player from three choices:

  | Choice | Options |
  | --- | --- |
  | Package | Quick fix (+2 base, 2 weeks), Minor update (+4, 4 weeks), Major package (+7, 7 weeks), Radical concept (+10, 10 weeks, two capacity slots) |
  | Approach | Safe (gain ×0.85, risk ×0.5, fewer breakthroughs), Balanced, Ambitious (gain ×1.25, risk ×1.8, more breakthroughs, cost ×1.15) |
  | Timeline | Normal, or Rush (about 40% faster, cost ×1.4, risk ×1.3) |

  Expected gain = base gain × approach × (0.68 + TD/190) × facility multiplier × TD specialisation × philosophy × diminishing returns, where diminishing returns = clamp(1 − lead/45, 0.4, 1.15) × clamp((100 − rating)/35, 0.03, 1) / (1 + 0.4 × development load this season) and `lead` is the component's rating above the series average: catching up is easier than stretching a lead, gains taper above 65, and repeated upgrades to the same component in one season return less. For a car near its field's average, a balanced radical concept is worth about +8-9 and an ambitious one about +10-11. Projects run through design, manufacture (possible 1-3 week delay) and testing, then resolve as success (×0.8-1.15), underwhelming (×0.15-0.5), breakthrough (×1.5-2.1) or reliability compromise (gain plus a reliability loss). Concurrent projects are limited by engineering capacity (1 + (engineering level + 1) ÷ 2, +1 with a Technical Director rated 70+).
- **Regulations**: announced in week 30. What survives the winter depends on the difficulty (`carDevelopment` in `difficulty.ts`) and applies to every team alike:

  | Difficulty | Winter rule | Upgrade size |
  | --- | --- | --- |
  | Casual | Development is kept: no car ever loses rating over the winter | ×1 |
  | Standard | Same as Casual | ×1 |
  | Realistic | The series average is pulled halfway back to the baseline (50); each car keeps 90% / 80% / 60% of its advantage over the field under stable / minor / major rules | ×1.15 |
  | Hardcore | The series average is pulled 80% back to the baseline; each car keeps 82% / 70% / 42% of its advantage (less in the rules' focus area) | ×1.3 |

  When development is kept, teams behind the field average close part of the gap under rule changes (12% minor, 22% major, more in the focus area) and strong engineering departments find up to about half a point per component. Nothing is ever taken away; instead ratings rise steadily (about 2-3 points a season in junior series, 4-5 in Formula 1 in simulation) and gains taper towards the top of the scale. On Realistic and Hardcore upgrades are 1.15× / 1.3× bigger but the winter takes most of them back.
- **Season-end development boost**: every team adds a boost to every component by championship position: P1 +2.0, P2 +1.6, P3 +1.2, P4 +0.8, P5-P6 +0.5, P7 +0.8, P8 +1.1, P9 +1.4, P10 +1.8. The top teams are rewarded, the bottom teams get catch-up help, mid-table gets the least.
- **Promotion**: a promoted car keeps a share of its advantage over its old field as an advantage over the new field: all of it on Casual and Standard, 50% on Realistic, 25% on Hardcore (the rest is a fresh start near the new field's average). Relegated cars start a little ahead of their new field. The player's sponsor deals carry over with a promotion clause: payments rise part of the way to the new series' rates (×1.6 from F5 to F4, about ×3.6 from F2 to F1) and targets are eased; relegation cuts them to the lower series' rates.
- **Drivers**: a monthly tick adds `(potential − overall) × age factor × 0.03 × coaching × training intensity × morale × philosophy × variation`, distributed by training focus. Drivers over 31 decline in pace, qualifying, braking, wet skill and fitness; experience keeps growing with races. Intense training risks injury. Rare late bloomers gain potential.
- **Staff** age, gain experience, drift in rating and retire. Every off-season new staff enter the profession so each role keeps about 14 unemployed candidates across all levels; candidates are more willing than before to take a job in a lower series.

## 8. AI managers

Six personalities (`difficulty.ts`) weight the same decisions differently: R&D appetite and preferred project scale, facility appetite, cash reserve target, salary premium, youth focus, race risk and ruthlessness. Each week an AI team protects its finances (a takeover rescue below −0.25B), fills empty seats, ensures a substitute for injured or banned drivers, starts R&D projects aimed at the components that matter at the remaining circuits, upgrades facilities (prioritising the next division's licence when contending), hires staff, extends or replaces drivers for next season, and occasionally sacks an underperformer. In races it picks strategies with its strategist's accuracy (bold personalities gamble on alternatives) and manages pace, tyres, fuel, ERS and team orders lap by lap.
