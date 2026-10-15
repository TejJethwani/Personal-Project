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
   - *Mechanical failure*: per-lap probability = division rate × difficulty multiplier × e^((50 − reliability index)/28) × pace-mode factor × crew factor. 45% of failures give a **warning** first; nursing the car in Conserve mode slows the hidden damage and can save the finish.
   - *Track limits and jump starts* give time penalties.
4. **Pit stops**: pit-lane loss for the circuit, plus stationary time from the chief mechanic, a slow-stop chance, damage repairs and any time penalty being served. Under SC/VSC the effective loss shrinks.
5. **Battles**: cars are resolved front to back. If a car's lap would put it ahead of the car in front, it must pass:
   ```
   logit = 3.4 × pace advantage(s) + (attack − defence)/22 − 3.6 × overtaking difficulty + 0.6
           + DRS 0.9 + ERS overtake 0.45 − defending 0.35 + attack mode 0.25 + wet skill difference
   P(pass) = sigmoid(logit)
   ```
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
| Sponsorship (title 0.2B, two majors 0.1B, three minors 0.035B) × appeal | ≈ 0.5B |
| Constructors' prize money (P1 0.42B … P10 0.10B) | ≈ 0.24B |
| Race prize money, driver backing | ≈ 0.05-0.1B |
| Race operations | 0.13B |
| Entry fee | 0.03B |
| Driver and staff salaries (rating-driven, × division salary factor 0.7 … 3.0) | 0.1-0.2B |
| Facility upkeep (6k × 2^(level−1) per facility) | ≈ 0.05B |
| R&D (minor 0.016B / 3 weeks, major 0.05B / 6 weeks, radical 0.11B / 10 weeks) | discretionary |

Sponsor appeal follows reputation and results. Sponsors pay per race plus bonuses, judge an expectation (constructors' position, podiums, wins or points finishes), cut payments or walk away if unhappy, and offer renewals if happy. A negative balance accrues interest; past the difficulty's overdraft limit the board injects emergency money (limited per difficulty), and in Hardcore insolvency ends the career. AI owners take a share of surplus cash above 1.6B at the end of each season so relegated F1 money does not distort lower series forever.

## 7. Development

- **R&D**: expected gain = base gain × (0.68 + TD/190) × facility multiplier × TD specialisation × philosophy × ((100 − rating)/50)^1.15 / (1 + 0.32 × upgrades this season). Projects run through design, manufacture (possible 1-3 week delay) and testing, then resolve as success (×0.8-1.15), underwhelming (×0.15-0.5), breakthrough (×1.5-2.1) or reliability compromise (gain plus a reliability loss). Concurrent projects are limited by engineering capacity (2 + engineering level ÷ 2, +1 with a Technical Director rated 70+; a radical concept uses two slots). Minor updates are the most money-efficient, major packages the most capacity-efficient, radical concepts a high-risk leap.
- **Regulations**: announced in week 30. At season end every car is pulled back: `new = 50 + (fieldMean − 50) × 0.2 + (rating − fieldMean) × carry + adaptation`, with carry 0.82 (stable), 0.70 (minor) or 0.42 (major, harsher on the focus area).
- **Drivers**: a monthly tick adds `(potential − overall) × age factor × 0.03 × coaching × training intensity × morale × philosophy × variation`, distributed by training focus. Drivers over 31 decline in pace, qualifying, braking, wet skill and fitness; experience keeps growing with races. Intense training risks injury. Rare late bloomers gain potential.
- **Staff** age, gain experience, drift in rating and retire.

## 8. AI managers

Six personalities (`difficulty.ts`) weight the same decisions differently: R&D appetite and preferred project scale, facility appetite, cash reserve target, salary premium, youth focus, race risk and ruthlessness. Each week an AI team protects its finances (a takeover rescue below −0.25B), fills empty seats, ensures a substitute for injured or banned drivers, starts R&D projects aimed at the components that matter at the remaining circuits, upgrades facilities (prioritising the next division's licence when contending), hires staff, extends or replaces drivers for next season, and occasionally sacks an underperformer. In races it picks strategies with its strategist's accuracy (bold personalities gamble on alternatives) and manages pace, tyres, fuel, ERS and team orders lap by lap.
