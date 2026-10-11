'use client';

import { ArrowUpRight, Globe2 } from 'lucide-react';
import { getReceivables, type CustomerOutstanding } from '@/lib/business';
import { formatDate, formatINR, formatINRShort } from '@/lib/format';
import { useData } from '@/lib/use-data';
import { ErrorState, LoadingState } from '@/components/ui/Feedback';
import { Badge, Card, Kpi, PanelHeader } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

const BUCKET_COLORS: Record<string, string> = { '0-30': 'bg-slate-300', '31-45': 'bg-amber-300', '46-60': 'bg-orange-400', '60+': 'bg-red-500' };

export function Receivables({ onOpenCustomer }: { onOpenCustomer: (customer: CustomerOutstanding) => void }) {
  const { data, error, loading, retry } = useData(getReceivables, []);
  if (loading && !data) return <LoadingState label="Loading receivables…" />;
  if (error || !data) return <ErrorState message={error || 'Could not load receivables.'} onRetry={retry} />;
  const total = data.buckets.reduce((sum, b) => sum + b.amount, 0) || 1;

  return <section className="space-y-5">
    <PanelHeader eyebrow="Collections" title="Who owes you money" subtitle={`As of ${formatDate(data.as_of)} · amounts include GST`} />
    <Card className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
      <Kpi label="Outstanding" value={formatINRShort(data.total_outstanding)} hint={`${data.open_invoices} open invoices`} />
      <Kpi label="Overdue" value={formatINRShort(data.overdue)} tone="warn" hint="past credit period" />
      <Kpi label="Past 45 days" value={formatINRShort(data.past_45)} tone="critical" hint={`${data.past_45_customers} domestic customers`} />
      <Kpi label="Collected this month" value={formatINRShort(data.collected_this_month)} tone="good" />
    </Card>
    <Card className="space-y-3 p-4">
      <p className="text-xs font-medium text-slate-700">Ageing by invoice date</p>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        {data.buckets.map(b => b.amount > 0 && <div key={b.key} className={BUCKET_COLORS[b.key]} style={{ width: `${(b.amount / total) * 100}%` }} />)}
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {data.buckets.map(b => <div key={b.key} className="text-xs"><dt className="flex items-center gap-1.5 text-slate-500"><span className={cn('size-2 rounded-full', BUCKET_COLORS[b.key])} />{b.label}</dt><dd className="mt-0.5 font-medium tabular-nums text-slate-900">{formatINR(b.amount)}</dd><dd className="text-slate-500">{b.count} invoice{b.count === 1 ? '' : 's'}</dd></div>)}
      </dl>
      <p className="text-[11px] text-slate-500">Under the MSMED Act and Section 43B(h), domestic buyers must pay micro and small suppliers within 45 days. Export customers are tracked against their credit period.</p>
    </Card>
    {!data.customers.length ? <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">Nothing is outstanding. Every invoice is paid.</p> :
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500"><tr><th className="p-3 font-medium">Customer</th><th className="p-3 text-right font-medium">Outstanding</th><th className="p-3 text-right font-medium">Overdue</th><th className="p-3 text-right font-medium">Past 45 days</th><th className="p-3 text-right font-medium">Oldest</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{data.customers.map(c => <tr key={c.customer_id} className="hover:bg-slate-50">
            <td className="p-3"><button type="button" onClick={() => onOpenCustomer(c)} className="flex items-center gap-1.5 text-left font-medium text-indigo-700 hover:underline">{c.name}<ArrowUpRight className="size-3.5" /></button>
              {c.country !== 'IN' && <Badge tone="accent" className="mt-1"><Globe2 className="size-3" />Export</Badge>}</td>
            <td className="p-3 text-right tabular-nums">{formatINR(c.outstanding)}</td>
            <td className={cn('p-3 text-right tabular-nums', c.overdue > 0 && 'text-amber-700')}>{c.overdue > 0 ? formatINR(c.overdue) : '—'}</td>
            <td className={cn('p-3 text-right tabular-nums', c.past_45 > 0 && 'font-medium text-red-700')}>{c.past_45 > 0 ? formatINR(c.past_45) : '—'}</td>
            <td className="p-3 text-right tabular-nums text-slate-600">{c.oldest_days} days</td>
          </tr>)}</tbody>
        </table>
      </div>}
  </section>;
}
