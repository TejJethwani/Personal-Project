import { AnimatePresence, motion } from 'framer-motion';
import { Award, Flag, Smile, TrendingUp, Trophy, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { driverShortName } from '@/engine/drivers/ratings';
import { raceReport, strategyVerdict, type ChampionshipMove, type StintSummary } from '@/engine/race/postrace';
import type { CalendarEvent, GameState, RaceResult, RaceState, TireCompound } from '@/engine/types';
import { DriverLink, TeamDot, TeamLink } from '@/components/common';
import { Badge, cn, Panel } from '@/components/ui';
import { lapTime } from '@/lib/format';

const COMPOUND_COLOR: Record<TireCompound, string> = { soft: '#ef4444', medium: '#facc15', hard: '#e5e7eb', intermediate: '#22c55e', wet: '#3b82f6' };

function Stints({ stints, laps }: { stints: StintSummary[]; laps: number }) {
  return (
    <span className="flex h-2 w-full overflow-hidden rounded bg-white/[0.05]">
      {stints.map((s, i) => (
        <span key={i} className="h-full border-r border-apex-bg last:border-0" title={`${s.compound} L${s.from}-${s.to}`} style={{ width: `${((s.to - s.from + 1) / laps) * 100}%`, background: COMPOUND_COLOR[s.compound] }} />
      ))}
    </span>
  );
}

function Moves({ game, rows, kind, highlight }: { game: GameState; rows: ChampionshipMove[]; kind: 'driver' | 'team'; highlight: (id: string) => boolean }) {
  const shown = rows.filter((r, i) => i < 8 || highlight(r.id));
  return (
    <div className="space-y-1">
      {shown.map((r) => {
        const moved = r.before > 0 ? r.before - r.after : 0;
        return (
          <div key={r.id} className={cn('flex items-center gap-2 rounded px-1.5 py-0.5 text-sm', highlight(r.id) && 'bg-apex-red/[0.1]')}>
            <span className="num w-6 font-bold">{r.after}</span>
            <span className={cn('w-8 text-[11px]', moved > 0 ? 'text-emerald-400' : moved < 0 ? 'text-red-400' : 'text-apex-dim')}>{moved > 0 ? `▲${moved}` : moved < 0 ? `▼${-moved}` : '–'}</span>
            <span className="min-w-0 flex-1 truncate">{kind === 'driver' ? <DriverLink driver={game.drivers[r.id]} /> : <TeamLink team={game.teams[r.id]} />}</span>
            {r.gained > 0 && <span className="text-[11px] text-emerald-300">+{r.gained}</span>}
            <span className="num w-10 text-right font-semibold">{r.points}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Confetti and a banner when the player's team wins. */
function Celebration({ title, text }: { title: string; text: string }) {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 4200);
    return () => clearTimeout(t);
  }, []);
  const pieces = useMemo(() => Array.from({ length: 46 }, (_, i) => ({ x: (i * 37) % 100, delay: (i % 9) * 0.08, color: ['#e10600', '#facc15', '#ffffff', '#22c55e', '#3b82f6'][i % 5], rot: (i * 53) % 360 })), []);
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {pieces.map((p, i) => (
            <motion.span key={i} className="absolute top-0 block h-3 w-1.5 rounded-sm" style={{ left: `${p.x}%`, background: p.color }} initial={{ y: -20, rotate: p.rot }} animate={{ y: '105vh', rotate: p.rot + 540 }} transition={{ duration: 2.6 + (i % 5) * 0.3, delay: p.delay, ease: 'easeIn' }} />
          ))}
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 16 }} className="absolute left-1/2 top-1/3 -translate-x-1/2 rounded-2xl border border-amber-400/60 bg-black/80 px-10 py-6 text-center shadow-panel">
            <Trophy size={52} className="mx-auto text-amber-400" />
            <div className="mt-2 font-display text-4xl font-black uppercase tracking-[0.12em] text-white">{title}</div>
            <div className="mt-1 text-sm text-amber-100">{text}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PostRaceReport({ game, event, result, race }: { game: GameState; event: CalendarEvent; result: RaceResult; race: RaceState }) {
  const report = useMemo(() => raceReport(game, event, result, race), [game, event, result, race]);
  const playerTeam = game.player.teamId;
  const isMine = (id: string) => game.drivers[id]?.contract?.teamId === playerTeam;
  const verdict = strategyVerdict(game, report);
  const mood = game.weekend?.startMood ?? {};
  const won = result.entries[0]?.teamId === playerTeam && result.entries[0]?.status === 'finished';
  const fx = event.euro?.fixtureId ? game.europe?.fixtures[event.euro.fixtureId] : null;
  const tie = fx?.tieId ? game.europe?.ties[fx.tieId] : null;
  const pc = game.teams[playerTeam]?.clubId;
  const trophy = tie?.stage === 'final' && tie.winner && tie.winner === pc;
  return (
    <div className="space-y-5">
      {trophy && <Celebration title="Champions!" text={`${game.europe?.clubs[pc!]?.name} win the ${event.euro?.label.split(' · ')[0]}.`} />}
      {!trophy && won && <Celebration title="Victory!" text={`${driverShortName(game.drivers[result.entries[0].driverId])} wins at ${game.circuits[result.circuitId].name}.`} />}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Driver of the race" icon={<Award size={15} className="text-amber-400" />}>
          {report.driverOfTheRace ? (
            <div>
              <div className="flex items-center gap-2">
                <TeamDot team={game.teams[report.driverOfTheRace.teamId]} />
                <DriverLink driver={game.drivers[report.driverOfTheRace.driverId]} className="font-display text-xl font-bold uppercase" />
                {isMine(report.driverOfTheRace.driverId) && <Badge tone="red">Yours</Badge>}
              </div>
              <p className="mt-1 text-sm text-apex-muted">{report.driverOfTheRace.reason}</p>
            </div>
          ) : (
            <p className="text-sm text-apex-muted">No classified finishers.</p>
          )}
          {result.fastestLapDriverId && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-apex-purple" /> Fastest lap: <DriverLink driver={game.drivers[result.fastestLapDriverId]} />
              <span className="mono text-apex-muted">{race.fastestLap ? lapTime(race.fastestLap.time) : ''}</span>
            </div>
          )}
        </Panel>
        <Panel title="Biggest gains" icon={<TrendingUp size={15} className="text-emerald-400" />}>
          {report.gainers.length ? (
            <div className="space-y-1">
              {report.gainers.map((g) => (
                <div key={g.driverId} className={cn('flex items-center gap-2 text-sm', isMine(g.driverId) && 'text-white')}>
                  <TeamDot team={game.teams[g.teamId]} />
                  <span className="flex-1 truncate">{driverShortName(game.drivers[g.driverId])}</span>
                  <span className="text-xs text-apex-muted">
                    P{g.grid} → P{g.position}
                  </span>
                  <Badge tone="green">+{g.gained}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-apex-muted">Nobody made up ground today.</p>
          )}
        </Panel>
        <Panel title="Your drivers" icon={<Smile size={15} className="text-sky-300" />}>
          <div className="space-y-2">
            {result.entries
              .filter((e) => e.teamId === playerTeam)
              .map((e) => {
                const d = game.drivers[e.driverId];
                const before = mood[e.driverId];
                const dm = before ? Math.round(d.morale - before.morale) : 0;
                const dc = before ? Math.round(d.confidence - before.confidence) : 0;
                return (
                  <div key={e.driverId} className="text-sm">
                    <div className="flex items-center justify-between">
                      <DriverLink driver={d} />
                      <span className="text-xs text-apex-muted">{e.status === 'finished' ? `P${e.position}` : 'DNF'}</span>
                    </div>
                    <div className="flex gap-3 text-xs text-apex-muted">
                      <span>
                        Morale {Math.round(d.morale)} <span className={dm > 0 ? 'text-emerald-400' : dm < 0 ? 'text-red-400' : ''}>{dm > 0 ? `+${dm}` : dm < 0 ? dm : ''}</span>
                      </span>
                      <span>
                        Confidence {Math.round(d.confidence)} <span className={dc > 0 ? 'text-emerald-400' : dc < 0 ? 'text-red-400' : ''}>{dc > 0 ? `+${dc}` : dc < 0 ? dc : ''}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </Panel>
      </div>
      {report.drivers.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Drivers' championship after this race" icon={<Trophy size={15} className="text-amber-400" />}>
            <Moves game={game} rows={report.drivers} kind="driver" highlight={isMine} />
          </Panel>
          <Panel title="Teams' championship after this race" icon={<Trophy size={15} className="text-amber-400" />}>
            <Moves game={game} rows={report.constructors} kind="team" highlight={(id) => id === playerTeam} />
          </Panel>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Pit stops & tyres" icon={<Wrench size={15} className="text-apex-red" />}>
          <div className="space-y-1.5">
            {report.stops.map((s) => (
              <div key={s.driverId} className={cn('grid grid-cols-[28px_90px_1fr_44px] items-center gap-2 text-xs', isMine(s.driverId) && 'text-white')}>
                <span className="num font-bold">{s.finished ? `P${s.position}` : 'DNF'}</span>
                <span className="truncate">{driverShortName(game.drivers[s.driverId])}</span>
                <Stints stints={s.stints} laps={race.totalLaps} />
                <span className="text-right text-apex-muted">
                  {s.stops} stop{s.stops === 1 ? '' : 's'}
                </span>
              </div>
            ))}
          </div>
          {verdict.length > 0 && (
            <div className="mt-3 space-y-1 border-t border-apex-line pt-3 text-xs text-white/85">
              <div className="label">Strategy review</div>
              {verdict.map((v) => (
                <p key={v}>{v}</p>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Incidents" icon={<Flag size={15} className="text-amber-300" />}>
          {report.incidents.length ? (
            <div className="max-h-[260px] space-y-1 overflow-y-auto">
              {report.incidents.map((l, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <span className="mono w-7 shrink-0 text-apex-dim">L{l.lap}</span>
                  <span className={cn(l.driverIds.some(isMine) ? 'text-white' : 'text-apex-muted')}>{l.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-apex-muted">A clean race: no crashes, failures or penalties.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {result.safetyCars > 0 && <Badge tone="amber">{result.safetyCars}× safety car</Badge>}
            {race.safetyCar.vscCount > 0 && <Badge tone="amber">{race.safetyCar.vscCount}× VSC</Badge>}
            {race.passes && <Badge>{race.passes.total} overtakes</Badge>}
            {result.wet && <Badge tone="blue">Wet race</Badge>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
