import { Minus, Plus } from 'lucide-react';
import { customPointsProblem, expandedTable, MAX_CUSTOM_PLACES, POINTS_PRESETS } from '@/engine/config/divisions';
import { Button, cn } from './ui';

/** Every scoring place of a table, compactly: P1 50 · P2 45 ... */
export function PointsTablePreview({ positions, className }: { positions: number[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-5 gap-1 sm:grid-cols-10', className)}>
      {positions.map((p, i) => (
        <div key={i} className="rounded border border-apex-line bg-apex-bg/60 px-1 py-0.5 text-center">
          <div className="text-[9px] text-apex-dim">P{i + 1}</div>
          <div className="num text-xs font-bold">{p}</div>
        </div>
      ))}
    </div>
  );
}

/** Edit a custom points table position by position, with a check that it makes sense. */
export function PointsEditor({ value, onChange }: { value: number[]; onChange: (table: number[]) => void }) {
  const problem = customPointsProblem(value);
  const set = (i: number, v: string) => {
    const next = [...value];
    next[i] = v === '' ? 0 : Math.max(0, Math.min(1000, Math.round(Number(v) || 0)));
    onChange(next);
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => onChange([...POINTS_PRESETS.modern.positions])}>
          Start from Classic F1
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onChange(expandedTable(40))}>
          Start from Expanded
        </Button>
        <Button size="sm" variant="ghost" disabled={value.length <= 1} onClick={() => onChange(value.slice(0, -1))}>
          <Minus size={14} /> Place
        </Button>
        <Button size="sm" variant="ghost" disabled={value.length >= MAX_CUSTOM_PLACES} onClick={() => onChange([...value, 0])}>
          <Plus size={14} /> Place
        </Button>
      </div>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8 lg:grid-cols-10">
        {value.map((p, i) => (
          <label key={i} className="flex flex-col rounded border border-apex-line bg-apex-bg/60 px-1.5 py-1">
            <span className="text-[10px] text-apex-dim">P{i + 1}</span>
            <input type="number" min={0} max={1000} value={p} onChange={(e) => set(i, e.target.value)} className="num w-full bg-transparent text-sm font-bold outline-none" aria-label={`Points for P${i + 1}`} />
          </label>
        ))}
      </div>
      <p className={cn('text-xs', problem ? 'text-red-300' : 'text-apex-muted')}>{problem ?? `${value.length} scoring place${value.length === 1 ? '' : 's'}; places beyond the size of a grid never score.`}</p>
    </div>
  );
}
