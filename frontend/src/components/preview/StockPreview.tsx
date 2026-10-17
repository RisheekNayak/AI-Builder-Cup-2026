'use client';

import { getStock } from '@/lib/business';
import { formatQty } from '@/lib/format';
import { useData } from '@/lib/use-data';
import { ErrorState, LoadingState } from '@/components/ui/Feedback';
import { Badge, PanelHeader, PreviewNotice } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export function StockPreview() {
  const { data, error, loading, retry } = useData(getStock, []);
  if (loading && !data) return <LoadingState label="Loading stock…" />;
  if (error || !data) return <ErrorState message={error || 'Could not load stock.'} onRetry={retry} />;
  const short = new Set(data.shortages.map(s => s.id));

  return <section className="space-y-5">
    <PanelHeader eyebrow="Stock & reorder" title="What's running short" subtitle="Stock on hand, minus what open orders need, against each item's reorder level." aside={<Badge tone="warn">Preview</Badge>} />
    <PreviewNotice>Preview with sample stock. Stock updates when dispatches are recorded; goods receipts, production and job-work movements come in the next phase.</PreviewNotice>
    {data.shortages.length > 0 && <ul className="space-y-2">{data.shortages.map(s => <li key={s.id} className="rounded-lg border border-red-200 bg-red-50/60 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{s.code} · {s.name}</span>{s.short_for_orders > 0 ? <Badge tone="critical">Short for open orders</Badge> : <Badge tone="warn">Below reorder level</Badge>}</div>
      <p className="mt-1 text-xs text-slate-600">{formatQty(s.on_hand)} {s.unit} on hand{s.reserved > 0 && `, ${formatQty(s.reserved)} needed for open orders`}. Reorder level {formatQty(s.reorder_level)}. Shortfall <b>{formatQty(s.shortfall)} {s.unit}</b>.</p>
    </li>)}</ul>}
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500"><tr><th className="p-3 font-medium">Item</th><th className="p-3 font-medium">Type</th><th className="p-3 text-right font-medium">On hand</th><th className="p-3 text-right font-medium">For open orders</th><th className="p-3 text-right font-medium">Available</th><th className="p-3 text-right font-medium">Reorder at</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{data.items.map(i => <tr key={i.id} className={cn(short.has(i.id) && 'bg-red-50/40')}>
          <td className="p-3"><span className="font-medium">{i.code}</span><span className="block text-xs text-slate-500">{i.name}</span></td>
          <td className="p-3 text-xs text-slate-500">{i.kind === 'raw' ? 'Raw material' : 'Finished'}</td>
          <td className="p-3 text-right tabular-nums">{formatQty(i.on_hand)} {i.unit}</td>
          <td className="p-3 text-right tabular-nums">{i.reserved ? formatQty(i.reserved) : '—'}</td>
          <td className={cn('p-3 text-right tabular-nums', i.available < i.reorder_level && 'font-medium text-red-700')}>{formatQty(i.available)}</td>
          <td className="p-3 text-right tabular-nums text-slate-600">{formatQty(i.reorder_level)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
