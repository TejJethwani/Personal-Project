import { Download, Palmtree, Save, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { renameTeam, setDifficulty, setPointsPreset, setRace2Grid, updateSettings } from '@/engine/actions';
import { activeDivisions } from '@/engine/config/ruleset';
import { assistantManage } from '@/engine/ai/assistant';
import { DIFFICULTIES } from '@/engine/config/difficulty';
import { DIVISIONS, POINTS_PRESETS } from '@/engine/config/divisions';
import { autoplayPlayerWeekend } from '@/engine/game';
import { advanceBlocker, advanceWeek, finishWeekendAndContinue } from '@/engine/season/advance';
import { playerTeam } from '@/engine/selectors';
import type { Difficulty, GameState, Race2GridRule } from '@/engine/types';
import { Badge, Button, Field, Panel, SectionTitle, Segmented, Select, Toggle } from '@/components/ui';
import { deleteSlot, exportSave, importSave, listSaves, loadFromSlot, manualSlotsFor, saveToSlot, type SaveSummary } from '@/store/persistence';
import { useGame, useStore } from '@/store/gameStore';
import { askConfirm } from '@/store/confirm';

/** Holiday mode: the assistant manager runs the team until the season review. */
function holiday(g: GameState): string {
  let guard = 0;
  while ((g.phase === 'preseason' || g.phase === 'season' || g.phase === 'weekend') && guard++ < 300) {
    assistantManage(g);
    if (g.phase === 'weekend') {
      autoplayPlayerWeekend(g);
      finishWeekendAndContinue(g);
      continue;
    }
    if (advanceBlocker(g)) break;
    advanceWeek(g);
  }
  return g.phase === 'seasonReview' ? 'The season is over. Your assistant has handed back control.' : `Holiday interrupted: ${advanceBlocker(g) ?? 'attention needed'}`;
}

export function SettingsPage() {
  const game = useGame();
  const act = useStore((s) => s.act);
  const toast = useStore((s) => s.toast);
  const loadGame = useStore((s) => s.loadGame);
  const quit = useStore((s) => s.quitToTitle);
  const setPage = useStore((s) => s.setPage);
  const lastSaved = useStore((s) => s.lastSaved);
  const team = playerTeam(game);
  const [saves, setSaves] = useState<SaveSummary[]>([]);
  const [name, setName] = useState(team.name);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => listSaves().then(setSaves).catch(() => setSaves([]));
  useEffect(() => {
    void refresh();
  }, []);
  const pending = game.settings.pendingPointsPreset;

  return (
    <div className="space-y-6">
      <SectionTitle sub="Career options, simulation preferences and saves.">Settings</SectionTitle>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Career">
          <div className="space-y-4">
            <Field label="Team name">
              <div className="flex gap-2">
                <input className="input flex-1" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
                <Button onClick={() => act((g) => renameTeam(g, name), { success: 'Team renamed.' })}>Rename</Button>
              </div>
            </Field>
            <Field label="Difficulty" hint={DIFFICULTIES[game.settings.difficulty].description}>
              <Select<Difficulty>
                value={game.settings.difficulty}
                onChange={async (v) => (await askConfirm(`Switch difficulty to ${DIFFICULTIES[v].label}? This changes finances, reliability, car development and AI behaviour from now on.`)) && act((g) => setDifficulty(g, v), { success: `Difficulty: ${DIFFICULTIES[v].label}` })}
                options={(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => ({ value: d, label: DIFFICULTIES[d].label }))}
              />
            </Field>
            <div>
              <div className="label mb-2">Championship points systems {pending && <Badge tone="amber">changes apply next season</Badge>}</div>
              <div className="space-y-2">
                {[...activeDivisions(game)].reverse().map((d) => (
                  <div key={d} className="flex items-center gap-3 text-sm">
                    <span className="w-36 truncate">{DIVISIONS[d].name}</span>
                    <Select value={(pending ?? game.settings.pointsPreset)[d]} onChange={(v) => act((g) => setPointsPreset(g, d, v))} options={Object.values(POINTS_PRESETS).filter((p) => p.id !== 'h2h').map((p) => ({ value: p.id, label: p.label }))} className="flex-1" />
                  </div>
                ))}
              </div>
            </div>
            {game.europe && (
              <Field label="Race 2 starting grid" hint="Both races of a weekend score full points. Changes apply to every second race still to run.">
                <Select<Race2GridRule>
                  value={game.europe.race2Grid}
                  onChange={(v) => act((g) => setRace2Grid(g, v), { success: 'Race 2 grid rule updated.' })}
                  options={[
                    { value: 'qualifying', label: 'Its own qualifying session' },
                    { value: 'reverseTop10', label: 'Race 1 result, top ten reversed' },
                    { value: 'sameGrid', label: 'Same grid as race 1' },
                  ]}
                />
              </Field>
            )}
          </div>
        </Panel>
        <Panel title="Simulation">
          <div className="space-y-4">
            <Field label="Default live race speed">
              <Segmented value={game.settings.defaultRaceSpeed} onChange={(v) => act((g) => updateSettings(g, { defaultRaceSpeed: v }))} options={[1, 5, 20, 60].map((s) => ({ value: s as 1 | 5 | 20 | 60, label: `${s}×` }))} />
            </Field>
            <Toggle checked={game.settings.autosave} onChange={(v) => act((g) => updateSettings(g, { autosave: v }))} label="Autosave after every action" />
            <p className="text-xs text-apex-muted">Races are fully deterministic: the same decisions always give the same result, whichever speed you watch at. Reloading cannot re-roll a race.</p>
            <div className="rounded-lg border border-apex-line p-4">
              <div className="flex items-center gap-2 font-semibold">
                <Palmtree size={16} className="text-apex-red" /> Holiday mode
              </div>
              <p className="mt-1 text-xs text-apex-muted">Your assistant manages signings, sponsors, R&amp;D and race weekends with the same logic the AI teams use, until the season review.</p>
              <Button
                className="mt-3"
                disabled={!(game.phase === 'season' || game.phase === 'preseason' || game.phase === 'weekend')}
                onClick={async () => {
                  if (!(await askConfirm('Hand the team to your assistant until the end of the season?'))) return;
                  const msg = act((g) => holiday(g));
                  if (msg) toast('info', msg);
                  if (useStore.getState().game?.phase === 'seasonReview') setPage('seasonReview');
                }}
              >
                Simulate to season end
              </Button>
            </div>
          </div>
        </Panel>
      </div>
      <Panel title="Saves" actions={<span className="text-xs text-apex-muted">{lastSaved ? `Autosaved ${new Date(lastSaved).toLocaleTimeString()}` : 'Autosave on next action'}</span>}>
        <div className="space-y-2">
          {manualSlotsFor(game).map((slot, i) => {
            const s = saves.find((x) => x.slot === slot);
            return (
              <div key={slot} className="flex flex-wrap items-center gap-3 rounded-md border border-apex-line px-3 py-2">
                <span className="label w-14">Slot {i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {s ? (
                    <>
                      {s.meta.teamName} · {s.meta.league ?? s.meta.division} · Season {s.meta.season} ({s.meta.year}) <span className="text-apex-muted">· {new Date(s.savedAt).toLocaleString()} · {(s.size / 1024).toFixed(0)} KB</span>
                    </>
                  ) : (
                    <span className="text-apex-dim">Empty</span>
                  )}
                </span>
                <Button
                  size="sm"
                  onClick={async () => {
                    if (s && !(await askConfirm('Overwrite this slot?'))) return;
                    try {
                      await saveToSlot(slot, game);
                      toast('success', `Saved to slot ${i + 1}.`);
                      void refresh();
                    } catch (e) {
                      toast('error', (e as Error).message);
                    }
                  }}
                >
                  <Save size={14} /> Save
                </Button>
                <Button
                  size="sm"
                  disabled={!s}
                  onClick={async () => {
                    if (!(await askConfirm('Load this save? Unsaved progress since your last save will be lost.'))) return;
                    try {
                      loadGame(await loadFromSlot(slot));
                      toast('success', 'Game loaded.');
                    } catch (e) {
                      toast('error', (e as Error).message);
                    }
                  }}
                >
                  Load
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={!s}
                  onClick={async () => {
                    if (!(await askConfirm('Delete this save?'))) return;
                    await deleteSlot(slot);
                    void refresh();
                  }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              try {
                if (await exportSave(game)) toast('success', 'Save file exported.');
              } catch (e) {
                toast('error', (e as Error).message);
              }
            }}
          >
            <Download size={14} /> Export save file
          </Button>
          <Button onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Import save file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                loadGame(await importSave(f));
                toast('success', 'Save imported.');
              } catch (err) {
                toast('error', (err as Error).message);
              }
              e.target.value = '';
            }}
          />
          <Button variant="danger" className="ml-auto" onClick={async () => (await askConfirm('Quit to the title screen? Your game is autosaved.')) && quit()}>
            Quit to title
          </Button>
        </div>
      </Panel>
      <Panel title="How to play">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-white/80">
          <li>Use the red button in the top bar to advance time. It stops automatically for race weekends and decisions.</li>
          <li>Between races: sign sponsors (Finances), start R&amp;D projects (Car Development), hire staff and upgrade facilities, scout and sign drivers.</li>
          <li>At each weekend: set up the car in practice, choose qualifying risk, pick a tyre strategy, then manage both drivers live: pace, tyres, fuel, ERS, pit calls and team orders.</li>
          <li>Finish in the top two with a valid licence (see Championship → Promotion) to move up a division. Five divisions stand between you and Formula 1.</li>
          <li>In Formula 1, build a dynasty: titles, records and a place in the Hall of Fame.</li>
        </ol>
      </Panel>
    </div>
  );
}
