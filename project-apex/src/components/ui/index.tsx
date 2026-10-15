import { cva, type VariantProps } from 'class-variance-authority';
import { clsx, type ClassValue } from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { forwardRef, useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-all disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apex-red/60 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-apex-red text-white hover:bg-apex-redhi shadow-[0_8px_24px_-10px_rgba(225,6,0,0.7)]',
        secondary: 'bg-apex-raised text-white border border-apex-line2 hover:border-apex-muted/60 hover:bg-[#262b35]',
        ghost: 'text-apex-muted hover:text-white hover:bg-white/5',
        outline: 'border border-apex-line2 text-white hover:border-apex-red hover:text-white',
        danger: 'bg-transparent border border-red-900/70 text-red-300 hover:bg-red-950/60',
        success: 'bg-emerald-600/90 text-white hover:bg-emerald-500',
      },
      size: {
        xs: 'h-7 px-2.5 text-xs',
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4 text-sm',
        lg: 'h-11 px-6 text-sm uppercase tracking-wider font-display text-base',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => (
  <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = 'Button';

export function Panel({ title, actions, children, className, bodyClass, icon }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string; icon?: ReactNode }) {
  return (
    <section className={cn('panel min-w-0', className)}>
      {(title || actions) && (
        <header className="panel-head">
          <h3 className="panel-title flex items-center gap-2">
            {icon}
            {title}
          </h3>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('overflow-x-auto p-4', bodyClass)}>{children}</div>
    </section>
  );
}

const badgeVariants = cva('chip', {
  variants: {
    tone: {
      neutral: 'bg-white/[0.06] text-apex-muted',
      red: 'bg-apex-red/15 text-red-300',
      green: 'bg-emerald-500/15 text-emerald-300',
      amber: 'bg-amber-500/15 text-amber-300',
      blue: 'bg-sky-500/15 text-sky-300',
      purple: 'bg-fuchsia-500/15 text-fuchsia-300',
      gold: 'bg-yellow-400/15 text-yellow-300',
      solid: 'bg-apex-red text-white',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ children, tone, className, title }: { children: ReactNode; className?: string; title?: string } & VariantProps<typeof badgeVariants>) {
  return (
    <span title={title} className={cn(badgeVariants({ tone }), className)}>
      {children}
    </span>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { id: T; label: ReactNode; count?: number }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('flex flex-wrap gap-1 border-b border-apex-line', className)}>
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'relative -mb-px px-4 py-2.5 font-display text-sm font-semibold uppercase tracking-[0.08em] transition-colors',
            value === t.id ? 'text-white' : 'text-apex-muted hover:text-white',
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded bg-white/10 px-1.5 text-[10px]">{t.count}</span>}
          {value === t.id && <motion.span layoutId={`tab-underline-${tabs.map((x) => x.id).join('')}`} className="absolute inset-x-2 bottom-0 h-[2px] bg-apex-red" />}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange, size = 'sm', className, fill = false }: { options: { value: T; label: ReactNode; title?: string; disabled?: boolean }[]; value: T; onChange: (v: T) => void; size?: 'xs' | 'sm'; className?: string; fill?: boolean }) {
  return (
    <div className={cn('inline-flex max-w-full rounded-md border border-apex-line2 bg-apex-bg p-0.5', fill && 'flex w-full', className)}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          title={o.title}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded px-2.5 font-semibold transition-colors disabled:opacity-30',
            fill && 'min-w-0 flex-1 truncate px-1',
            size === 'xs' ? 'h-6 text-[11px]' : 'h-7 text-xs',
            value === o.value ? 'bg-apex-red text-white shadow' : 'text-apex-muted hover:text-white',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = 'max-w-3xl', footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: string; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div
            className={cn('panel relative my-auto w-full overflow-hidden', width)}
            initial={{ y: 16, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.18 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="panel-head stripe-red">
              <h2 className="panel-title pl-2 text-lg">{title}</h2>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <X size={16} />
              </Button>
            </div>
            <div className="max-h-[78vh] overflow-y-auto p-5">{children}</div>
            {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-apex-line px-5 py-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Select<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={cn('input cursor-pointer pr-8', className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-apex-panel">
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Rating bar 0-100 with a colour scale. */
export function RatingBar({ value, max = 100, low, high, className, showValue = true, color }: { value: number; max?: number; low?: number; high?: number; className?: string; showValue?: boolean; color?: string }) {
  const pctv = Math.max(0, Math.min(100, (value / max) * 100));
  const tone = color ?? ratingColor(value);
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
        {low !== undefined && high !== undefined && high > low && <div className="absolute inset-y-0 rounded-full bg-white/15" style={{ left: `${low}%`, width: `${high - low}%` }} />}
        <motion.div className="absolute inset-y-0 left-0 rounded-full" style={{ background: tone }} initial={false} animate={{ width: `${pctv}%` }} transition={{ duration: 0.4 }} />
      </div>
      {showValue && <span className="num w-9 text-right text-sm font-semibold">{low !== undefined && high !== undefined && high > low ? `${low}–${high}` : Math.round(value)}</span>}
    </div>
  );
}

export function ratingColor(v: number): string {
  if (v >= 85) return '#b45cff';
  if (v >= 75) return '#22c55e';
  if (v >= 62) return '#84cc16';
  if (v >= 50) return '#f5c542';
  if (v >= 38) return '#f59e0b';
  return '#ef4444';
}

export function RatingPill({ value, label, className, estimate }: { value: number; label?: string; className?: string; estimate?: { low: number; high: number; exact: boolean } }) {
  const text = estimate && !estimate.exact ? `${estimate.low}–${estimate.high}` : Math.round(value);
  return (
    <span className={cn('inline-flex min-w-[2.6rem] items-center justify-center gap-1 rounded-md px-1.5 py-0.5 font-display text-sm font-bold tabular-nums', className)} style={{ background: `${ratingColor(value)}22`, color: ratingColor(value) }} title={estimate && !estimate.exact ? 'Scouting estimate' : undefined}>
      {label && <span className="text-[10px] font-semibold opacity-70">{label}</span>}
      {text}
    </span>
  );
}

export function Stat({ label, value, sub, accent, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; accent?: boolean; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="label truncate">{label}</div>
      <div className={cn('num mt-0.5 truncate text-2xl font-bold leading-tight', accent && 'text-apex-red')}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-apex-muted">{sub}</div>}
    </div>
  );
}

export function Progress({ value, className, color = '#e10600' }: { value: number; className?: string; color?: string }) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-white/[0.07]', className)}>
      <motion.div className="h-full rounded-full" style={{ background: color }} initial={false} animate={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Empty({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-lg border border-dashed border-apex-line2 px-4 py-8 text-center text-sm text-apex-muted', className)}>{children}</div>;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm">
      <span onClick={() => onChange(!checked)} className={cn('relative h-5 w-9 rounded-full transition-colors', checked ? 'bg-apex-red' : 'bg-apex-line2')}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      {label && <span onClick={() => onChange(!checked)}>{label}</span>}
    </label>
  );
}

export function Field({ label, children, hint, className }: { label: ReactNode; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="label mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-apex-muted">{hint}</span>}
    </label>
  );
}

export function SectionTitle({ children, sub, right }: { children: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-[0.04em] text-white">{children}</h1>
        {sub && <p className="mt-1 text-sm text-apex-muted">{sub}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  );
}
