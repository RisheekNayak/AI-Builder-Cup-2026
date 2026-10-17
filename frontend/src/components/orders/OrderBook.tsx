'use client';

import { ArrowUpRight, FilePlus2, Globe2 } from 'lucide-react';
import { getOrders, type Order, type OrderStatus } from '@/lib/business';
import { dueLabel, formatDate, formatINRShort, formatQty } from '@/lib/format';
import { useData } from '@/lib/use-data';
import { ErrorState, LoadingState } from '@/components/ui/Feedback';
import { Badge, PanelHeader, Progress, secondaryButton, type Tone } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export const STATUS_TONE: Record<OrderStatus, Tone> = { late: 'critical', partial: 'warn', open: 'info', dispatched: 'good' };
export const STATUS_LABEL: Record<OrderStatus, string> = { late: 'Late', partial: 'Partly dispatched', open: 'Not started', dispatched: 'Dispatched' };
const FILTERS = [['open', 'Open'], ['due_this_week', 'Due this week'], ['late', 'Late'], ['dispatched', 'Dispatched'], ['all', 'All']] as const;

export function OrderBook({ filter, onFilter, onOpenOrder, onCapture }: {
  filter: string; onFilter: (filter: string) => void; onOpenOrder: (order: Order) => void; onCapture: () => void;
}) {
  const { data, error, loading, retry } = useData(
    () => filter === 'due_this_week' ? getOrders('open', 7) : getOrders(filter), [filter]);

  return <section className="space-y-5">
    <PanelHeader eyebrow="Order book" title="Customer orders" subtitle="What each customer ordered, what has left the factory, and what is still open."
      aside={<button type="button" onClick={onCapture} className={secondaryButton}><FilePlus2 className="size-3.5" />Add from PO</button>} />
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter orders">
      {FILTERS.map(([key, label]) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => onFilter(key)}
        className={cn('rounded-md px-2.5 py-1.5 text-xs font-medium', filter === key ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50')}>{label}</button>)}
    </div>
    {loading && !data ? <LoadingState label="Loading orders…" /> : error ? <ErrorState message={error} onRetry={retry} /> : !data?.length ?
      <p className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">No orders in this view.</p> :
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {data.map(order => <li key={order.id}>
          <button type="button" onClick={() => onOpenOrder(order)} className="grid w-full gap-2 px-4 py-3 text-left hover:bg-slate-50">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-900">{order.po_number}</span>
              <Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>
              {order.customer.country !== 'IN' && <Badge tone="accent"><Globe2 className="size-3" />Export</Badge>}
              <ArrowUpRight className="ml-auto size-3.5 text-slate-400" />
            </div>
            <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>{order.customer.name}</span>
              <span className={cn(order.status === 'late' && 'font-medium text-red-700')}>
                {order.status === 'dispatched' ? `Last dispatch ${formatDate(order.last_dispatch_date)}` : `${dueLabel(order.due_in_days)} · ${formatDate(order.promised_date)}`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Progress value={order.progress} tone={STATUS_TONE[order.status]} />
              <span className="shrink-0 text-xs tabular-nums text-slate-600">{formatQty(order.dispatched_qty)}/{formatQty(order.ordered_qty)} pcs</span>
              {order.open_value > 0 && <span className="shrink-0 text-xs tabular-nums text-slate-500">{formatINRShort(order.open_value)} open</span>}
            </div>
          </button>
        </li>)}
      </ul>}
  </section>;
}
