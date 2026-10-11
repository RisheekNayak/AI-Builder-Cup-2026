'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowUpRight, Boxes, CheckCircle2, ClipboardCheck, FileText, Landmark, Ship, Truck, Wallet } from 'lucide-react';
import { completeTask, createTask, getInbox, invoiceDispatch, type InboxItem } from '@/lib/business';
import { addDaysISO, formatINR, formatINRShort } from '@/lib/format';
import { useData } from '@/lib/use-data';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { ErrorState, LoadingState, errorMessage } from '@/components/ui/Feedback';
import { Badge, Kpi, secondaryButton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  collection: Wallet, order: Truck, invoice: FileText, stock: Boxes, gst: Landmark, export: Ship, task: ClipboardCheck,
};
const STRIPE: Record<string, string> = { critical: 'bg-red-500', high: 'bg-orange-400', medium: 'bg-amber-300', low: 'bg-slate-300' };

export function TodayInbox({ onOpen, onAsk }: { onOpen: (entity: InboxItem['entity']) => void; onAsk: (text: string) => void }) {
  const { dataChanged, notify, pending } = useWorkspace();
  const { data, error, loading, retry } = useData(getInbox, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  if (loading && !data) return <LoadingState label="Checking what needs attention…" />;
  if (error || !data) return <ErrorState message={error || 'Could not load today’s items.'} onRetry={retry} />;
  const k = data.kpis;
  const items = showAll ? data.items : data.items.slice(0, 6);

  async function act(item: InboxItem, action: string) {
    setBusy(`${item.id}-${action}`);
    try {
      if (action === 'draft_reminder') onAsk(`Draft a payment reminder for ${item.title.split(':')[0]}`);
      else if (action === 'record_dispatch' || action === 'open') onOpen(item.entity);
      else if (action === 'create_invoice') {
        const invoice = await invoiceDispatch(item.payload?.dispatch_id as number);
        dataChanged(); notify(`Invoice ${invoice.number} created for ${formatINR(invoice.amount)}.`);
      } else if (action === 'create_task') {
        const due = addDaysISO(1);
        const task = await createTask({ title: `Follow up: ${item.title}`, assignee_role: item.kind === 'collection' ? 'accounts' : 'dispatch', due_date: due,
          entity_type: item.entity.type, entity_id: item.entity.id != null ? String(item.entity.id) : null });
        dataChanged(); notify(`Task created for ${task.assignee_role}: "${task.title}".`);
      } else if (action === 'complete_task') {
        await completeTask(item.entity.id as number);
        dataChanged(); notify(`Marked done: "${item.title}".`);
      }
    } catch (err) { notify(errorMessage(err, 'Could not complete that action.')); }
    finally { setBusy(null); }
  }

  const label: Record<string, string> = { draft_reminder: 'Draft reminder', create_task: 'Add task', record_dispatch: 'Record dispatch', create_invoice: 'Create invoice', complete_task: 'Mark done', open: 'Open' };

  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
      <button type="button" onClick={() => onOpen({ type: 'receivables' })} className="self-start text-left"><Kpi label="Customers owe you" value={formatINRShort(k.outstanding)} /></button>
      <button type="button" onClick={() => onOpen({ type: 'receivables' })} className="self-start text-left"><Kpi label="Unpaid past 45 days" value={formatINRShort(k.past_45)} tone={k.past_45 > 0 ? 'critical' : 'good'} /></button>
      <button type="button" onClick={() => onAsk('Which orders are late?')} className="self-start text-left"><Kpi label="Late orders" value={String(k.late_orders)} tone={k.late_orders ? 'critical' : 'good'} hint={`${k.open_orders} open in total`} /></button>
      <button type="button" onClick={() => onAsk('Which orders are due this week?')} className="self-start text-left"><Kpi label="Due this week" value={String(k.due_this_week)} tone={k.due_this_week ? 'warn' : 'neutral'} /></button>
    </div>
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-slate-800">Needs attention today</h3>
      <span className="text-xs text-slate-500">{data.items.length} items</span>
    </div>
    {!data.items.length ? <p className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm text-emerald-700"><CheckCircle2 className="size-4" />Nothing needs attention right now.</p> :
      <ul className="space-y-2">
        {items.map(item => {
          const Icon = ICONS[item.kind] || AlertTriangle;
          return <li key={item.id} className="relative overflow-hidden rounded-lg border border-slate-200 bg-white py-3 pl-4 pr-3">
            <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', STRIPE[item.severity])} />
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-slate-500" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-slate-900">{item.title}</p>{item.preview && <Badge tone="warn">Preview</Badge>}<span className="sr-only">Severity {item.severity}</span></div>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">{item.detail}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.actions.map(action => <button key={action} type="button" disabled={!!busy || (action === 'draft_reminder' && pending)} onClick={() => act(item, action)} className={secondaryButton}>
                    {busy === `${item.id}-${action}` ? 'Working…' : label[action] || action}
                  </button>)}
                  {!item.actions.includes('open') && item.entity.type !== 'task' && <button type="button" onClick={() => onOpen(item.entity)} className={secondaryButton}>Open<ArrowUpRight className="size-3" /></button>}
                </div>
              </div>
            </div>
          </li>;
        })}
      </ul>}
    {data.items.length > 6 && <button type="button" onClick={() => setShowAll(v => !v)} className="text-xs font-medium text-indigo-600 hover:underline">{showAll ? 'Show fewer' : `Show all ${data.items.length}`}</button>}
  </div>;
}
