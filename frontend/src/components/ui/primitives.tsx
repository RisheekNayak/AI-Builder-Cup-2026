import { cn } from '@/lib/utils';

export type Tone = 'neutral' | 'good' | 'warn' | 'critical' | 'info' | 'accent';

const TONES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  good: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warn: 'bg-amber-50 text-amber-800 ring-amber-200',
  critical: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  accent: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset', TONES[tone], className)}>{children}</span>;
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn('rounded-xl border border-slate-200 bg-white', className)}>{children}</section>;
}

export function SectionTitle({ icon: Icon, children, aside }: { icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode; aside?: React.ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">{Icon && <Icon className="size-4 text-indigo-500" />}{children}</h3>{aside}</div>;
}

export function Kpi({ label, value, hint, tone = 'neutral' }: { label: string; value: string; hint?: string; tone?: Tone }) {
  return <div className="min-w-0">
    <p className="text-xs text-slate-500">{label}</p>
    <p className={cn('mt-1 truncate text-xl font-semibold tabular-nums tracking-tight', tone === 'critical' ? 'text-red-700' : tone === 'warn' ? 'text-amber-700' : tone === 'good' ? 'text-emerald-700' : 'text-slate-900')}>{value}</p>
    {hint && <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p>}
  </div>;
}

export function Progress({ value, tone = 'accent' }: { value: number; tone?: Tone }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
    <div className={cn('h-full rounded-full', tone === 'critical' ? 'bg-red-500' : tone === 'good' ? 'bg-emerald-500' : tone === 'warn' ? 'bg-amber-500' : 'bg-indigo-500')} style={{ width: `${pct}%` }} />
  </div>;
}

export function PanelHeader({ eyebrow, title, subtitle, aside }: { eyebrow?: string; title: string; subtitle?: React.ReactNode; aside?: React.ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0">{eyebrow && <p className="text-xs font-medium text-indigo-600">{eyebrow}</p>}<h2 className="mt-1 break-words text-xl font-semibold tracking-tight text-slate-900">{title}</h2>{subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}</div>
    {aside}
  </div>;
}

export function PreviewNotice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">{children}</p>;
}

export const inputClass = 'block w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 focus:border-indigo-500 disabled:bg-slate-50 aria-invalid:border-red-400';
export const secondaryButton = 'inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
