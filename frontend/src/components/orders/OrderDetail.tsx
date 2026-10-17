'use client';

import { useState } from 'react';
import { CheckCircle2, FileText, Truck } from 'lucide-react';
import { getOrder, invoiceDispatch, recordDispatch } from '@/lib/business';
import { dueLabel, formatDate, formatINR, formatQty, todayISO } from '@/lib/format';
import { useData } from '@/lib/use-data';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { ErrorState, LoadingState, errorMessage } from '@/components/ui/Feedback';
import { Badge, Card, PanelHeader, Progress, SectionTitle, inputClass, secondaryButton } from '@/components/ui/primitives';
import { STATUS_LABEL, STATUS_TONE } from './OrderBook';

export function OrderDetail({ id, onOpenCustomer, onCreateExportShipment }: { id: string; onOpenCustomer?: (id: number, name: string) => void; onCreateExportShipment?: () => void }) {
  const { dataChanged, notify } = useWorkspace();
  const { data: order, error, loading, retry } = useData(() => getOrder(id), [id]);
  const [qty, setQty] = useState<Record<number, string>>({});
  const [meta, setMeta] = useState({ dispatch_date: todayISO(), challan_no: '', vehicle_no: '', eway_bill_no: '' });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [invoicing, setInvoicing] = useState<number | null>(null);

  if (loading && !order) return <LoadingState label="Loading order…" />;
  if (error || !order) return <ErrorState message={error || 'Order not found.'} onRetry={retry} />;

  const openLines = order.lines.filter(l => l.open > 0);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!order) return;
    const lines = openLines.map(l => ({ order_line_id: l.id, qty: Number(qty[l.id] || 0) })).filter(l => l.qty > 0);
    if (!lines.length) { setFormError('Enter the quantity dispatched for at least one line.'); return; }
    setSaving(true); setFormError(null);
    try {
      const updated = await recordDispatch(order.id, { ...meta, lines, recorded_by: 'Dispatch' });
      setQty({});
      setMeta(m => ({ ...m, challan_no: '', vehicle_no: '', eway_bill_no: '' }));
      dataChanged();
      notify(`Dispatch recorded for PO ${updated.po_number}: ${formatQty(lines.reduce((s, l) => s + l.qty, 0))} pcs.${updated.new_invoice ? ` Invoice ${updated.new_invoice.number} created for ${formatINR(updated.new_invoice.amount)}.` : ''}`);
    } catch (err) { setFormError(errorMessage(err, 'Could not record the dispatch.')); }
    finally { setSaving(false); }
  }

  async function createInvoice(dispatchId: number) {
    setInvoicing(dispatchId);
    try {
      const invoice = await invoiceDispatch(dispatchId);
      dataChanged();
      notify(`Invoice ${invoice.number} created for ${formatINR(invoice.amount)}.`);
    } catch (err) { notify(errorMessage(err, 'Could not create the invoice.')); }
    finally { setInvoicing(null); }
  }

  return <div className="space-y-5">
    <PanelHeader eyebrow={`Order · ${order.customer.country !== 'IN' ? 'Export' : 'Domestic'}`} title={`PO ${order.po_number}`}
      subtitle={<button type="button" className="text-indigo-600 hover:underline" onClick={() => onOpenCustomer?.(order.customer.id, order.customer.name)}>{order.customer.name}</button>}
      aside={<Badge tone={STATUS_TONE[order.status]}>{STATUS_LABEL[order.status]}</Badge>} />

    <Card className="space-y-3 p-4">
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><p className="text-xs text-slate-500">PO date</p><p>{formatDate(order.po_date)}</p></div>
        <div><p className="text-xs text-slate-500">Promised</p><p className={order.status === 'late' ? 'font-medium text-red-700' : ''}>{formatDate(order.promised_date)}</p>{order.open_qty > 0 && <p className="text-[11px] text-slate-500">{dueLabel(order.due_in_days)}</p>}</div>
        <div><p className="text-xs text-slate-500">Order value</p><p className="tabular-nums">{formatINR(order.order_value)}</p><p className="text-[11px] text-slate-500">before GST</p></div>
        <div><p className="text-xs text-slate-500">Still to dispatch</p><p className="tabular-nums">{formatINR(order.open_value)}</p></div>
      </div>
      <div className="flex items-center gap-3"><Progress value={order.progress} tone={STATUS_TONE[order.status]} /><span className="shrink-0 text-xs tabular-nums text-slate-600">{formatQty(order.dispatched_qty)} of {formatQty(order.ordered_qty)} pcs left the factory</span></div>
    </Card>

    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500"><tr><th className="p-3 font-medium">Item</th><th className="p-3 text-right font-medium">Ordered</th><th className="p-3 text-right font-medium">Dispatched</th><th className="p-3 text-right font-medium">Open</th><th className="p-3 text-right font-medium">Rate</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{order.lines.map(l => <tr key={l.id}><td className="p-3">{l.description}</td><td className="p-3 text-right tabular-nums">{formatQty(l.qty)}</td><td className="p-3 text-right tabular-nums">{formatQty(l.dispatched)}</td><td className="p-3 text-right font-medium tabular-nums">{formatQty(l.open)}</td><td className="p-3 text-right tabular-nums">{formatINR(l.rate)}</td></tr>)}</tbody>
      </table>
    </div>

    {openLines.length > 0 && <Card className="p-4">
      <form onSubmit={save} className="space-y-3" aria-label="Record dispatch">
        <SectionTitle icon={Truck}>Record dispatch</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {openLines.map(l => <label key={l.id} className="text-xs text-slate-600">{l.description} <span className="text-slate-400">(open {formatQty(l.open)})</span>
            <input type="number" min={0} max={l.open} step="any" inputMode="numeric" value={qty[l.id] ?? ''} disabled={saving}
              onChange={e => setQty(q => ({ ...q, [l.id]: e.target.value }))} className={`${inputClass} mt-1`} aria-label={`Quantity dispatched for ${l.description}`} />
            <button type="button" className="mt-1 text-[11px] text-indigo-600 hover:underline" onClick={() => setQty(q => ({ ...q, [l.id]: String(l.open) }))}>Dispatch all {formatQty(l.open)}</button>
          </label>)}
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="text-xs text-slate-600">Date<input type="date" max={todayISO()} value={meta.dispatch_date} onChange={e => setMeta(m => ({ ...m, dispatch_date: e.target.value }))} className={`${inputClass} mt-1`} /></label>
          <label className="text-xs text-slate-600">Challan no.<input value={meta.challan_no} onChange={e => setMeta(m => ({ ...m, challan_no: e.target.value }))} className={`${inputClass} mt-1`} /></label>
          <label className="text-xs text-slate-600">Vehicle no.<input value={meta.vehicle_no} onChange={e => setMeta(m => ({ ...m, vehicle_no: e.target.value }))} className={`${inputClass} mt-1`} /></label>
          <label className="text-xs text-slate-600">E-way bill<input value={meta.eway_bill_no} onChange={e => setMeta(m => ({ ...m, eway_bill_no: e.target.value }))} className={`${inputClass} mt-1`} /></label>
        </div>
        {formError && <ErrorState message={formError} />}
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] text-slate-500">An invoice (18% GST) is created with the dispatch.</p><button type="submit" disabled={saving} className="primary-button">{saving ? 'Saving…' : 'Record dispatch'}</button></div>
      </form>
    </Card>}

    <Card className="space-y-3 p-4">
      <SectionTitle icon={Truck}>Dispatch history</SectionTitle>
      {!order.dispatches.length ? <p className="text-sm text-slate-500">Nothing has left the factory for this order yet.</p> :
        <ol className="space-y-3">{[...order.dispatches].reverse().map(d => <li key={d.id} className="flex flex-wrap items-start justify-between gap-2 border-l-2 border-indigo-200 pl-3 text-sm">
          <div><p className="font-medium">{formatDate(d.dispatch_date)} · {formatQty(d.total_qty)} pcs</p>
            <p className="text-xs text-slate-500">{[d.challan_no && `Challan ${d.challan_no}`, d.vehicle_no && `Vehicle ${d.vehicle_no}`, d.eway_bill_no && `E-way ${d.eway_bill_no}`, d.recorded_by && `by ${d.recorded_by}`].filter(Boolean).join(' · ')}</p></div>
          {d.invoiced ? <Badge tone="good"><CheckCircle2 className="size-3" />Invoiced</Badge> :
            <button type="button" disabled={invoicing === d.id} onClick={() => createInvoice(d.id)} className={secondaryButton}><FileText className="size-3.5" />{invoicing === d.id ? 'Creating…' : 'Create invoice'}</button>}
        </li>)}</ol>}
      <p className="text-[11px] text-slate-500">Shows when goods left the factory. Delivery at the customer is not tracked yet.</p>
    </Card>

    {!!order.invoices?.length && <Card className="space-y-2 p-4">
      <SectionTitle icon={FileText}>Invoices</SectionTitle>
      <ul className="divide-y divide-slate-100 text-sm">{order.invoices.map(i => <li key={i.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{i.number} · {formatDate(i.invoice_date)}</span><span className="tabular-nums">{formatINR(i.amount)}{i.paid > 0 && <span className="ml-2 text-xs text-emerald-700">paid {formatINR(i.paid)}</span>}</span></li>)}</ul>
    </Card>}

    {order.customer.country !== 'IN' && onCreateExportShipment && <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
      <p className="text-sm text-slate-600">Export order: check SCOMET, FTA benefits and documents before dispatch.</p>
      <button type="button" onClick={onCreateExportShipment} className={secondaryButton}>Check export compliance</button>
    </Card>}
  </div>;
}
