'use client';

import { useRef, useState } from 'react';
import { FileUp, LoaderCircle, Plus, Sparkles, Trash2 } from 'lucide-react';
import { capturePo, createOrder, getMasters, type Masters, type Order, type OrderDraft } from '@/lib/business';
import { formatINR, todayISO } from '@/lib/format';
import { useData } from '@/lib/use-data';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { ErrorState, LoadingState, errorMessage } from '@/components/ui/Feedback';
import { Badge, Card, PanelHeader, inputClass, secondaryButton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

type DraftLine = { item_id: string; description: string; qty: string; rate: string };
type Draft = { customer_id: string; customer_name: string; po_number: string; po_date: string; promised_date: string; lines: DraftLine[] };

const emptyDraft = (): Draft => ({ customer_id: '', customer_name: '', po_number: '', po_date: todayISO(), promised_date: '', lines: [{ item_id: '', description: '', qty: '', rate: '' }] });

function fromCapture(d: OrderDraft): Draft {
  return {
    customer_id: d.customer_id ? String(d.customer_id) : '', customer_name: d.customer_id ? '' : d.customer_name || '',
    po_number: d.po_number || '', po_date: d.po_date || todayISO(), promised_date: d.promised_date || '',
    lines: d.lines.length ? d.lines.map(l => ({ item_id: l.item_id ? String(l.item_id) : '', description: l.description, qty: l.qty != null ? String(l.qty) : '', rate: l.rate != null ? String(l.rate) : '' }))
      : emptyDraft().lines,
  };
}

export function PoCapture({ onCreated }: { onCreated: (order: Order) => void }) {
  const { dataChanged, notify } = useWorkspace();
  const masters = useData(getMasters, []);
  const fileInput = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<'upload' | 'reading' | 'review'>('upload');
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [capture, setCapture] = useState<OrderDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function read(file?: File) {
    if (!file) return;
    if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) { setError('Upload the PO as a PDF, PNG or JPG.'); return; }
    setStage('reading'); setError(null);
    try {
      const result = await capturePo(file);
      setCapture(result); setDraft(fromCapture(result)); setStage('review');
    } catch (err) {
      setError(`${errorMessage(err, 'Could not read this PO.')} You can enter it below instead.`);
      setCapture(null); setDraft(emptyDraft()); setStage('review');
    }
  }

  const unsure = (key: string) => capture?.low_confidence.includes(key);
  const setLine = (index: number, patch: Partial<DraftLine>) => setDraft(d => ({ ...d, lines: d.lines.map((l, i) => i === index ? { ...l, ...patch } : l) }));

  function pickItem(index: number, itemId: string, list: Masters['items']) {
    const item = list.find(i => String(i.id) === itemId);
    setLine(index, { item_id: itemId, description: item?.name || '', rate: item && !draft.lines[index].rate ? String(item.rate) : draft.lines[index].rate });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setError(null);
    try {
      const order = await createOrder({
        customer_id: draft.customer_id ? Number(draft.customer_id) : null,
        customer_name: draft.customer_id ? null : draft.customer_name, customer_gstin: capture?.customer_gstin ?? null,
        po_number: draft.po_number, po_date: draft.po_date, promised_date: draft.promised_date,
        source: capture ? 'document' : 'manual',
        lines: draft.lines.filter(l => l.qty).map(l => ({ item_id: l.item_id ? Number(l.item_id) : null, description: l.description, qty: Number(l.qty), rate: l.rate === '' ? null : Number(l.rate) })),
      });
      dataChanged();
      notify(`Order PO ${order.po_number} from ${order.customer.name} added to the order book: ${order.ordered_qty.toLocaleString('en-IN')} pcs worth ${formatINR(order.order_value)} (before GST), promised ${new Date(order.promised_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}.`);
      onCreated(order);
    } catch (err) { setError(errorMessage(err, 'Could not save the order.')); }
    finally { setSaving(false); }
  }

  return <section className="space-y-5">
    <PanelHeader eyebrow="Order capture" title="Add a customer PO" subtitle="Upload the PO the customer sent. Check the details, then save it to the order book." />
    {stage !== 'review' && <Card className="p-6 text-center">
      {stage === 'reading' ? <div role="status" className="flex flex-col items-center gap-3 py-6 text-sm text-slate-600"><LoaderCircle className="size-6 animate-spin text-indigo-500" />Reading the PO…</div> : <>
        <FileUp className="mx-auto size-8 text-indigo-400" />
        <p className="mt-3 text-sm font-medium">Upload the customer&apos;s purchase order</p>
        <p className="mt-1 text-xs text-slate-500">PDF, PNG or JPG. Nothing is saved until you confirm.</p>
        <input ref={fileInput} type="file" accept=".pdf,.png,.jpg,.jpeg" className="sr-only" aria-label="Purchase order file" onChange={e => read(e.target.files?.[0])} />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" className="primary-button" onClick={() => fileInput.current?.click()}>Choose PO file</button>
          <button type="button" className={secondaryButton} onClick={() => { setCapture(null); setDraft(emptyDraft()); setStage('review'); }}>Enter manually</button>
        </div>
      </>}
    </Card>}
    {error && <ErrorState message={error} />}
    {stage === 'review' && (masters.loading && !masters.data ? <LoadingState label="Loading customers and items…" /> : masters.error ? <ErrorState message={masters.error} onRetry={masters.retry} /> :
      <form onSubmit={save} className="space-y-4" aria-label="Review order">
        {capture && <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <Badge tone="accent"><Sparkles className="size-3" />{capture.mode === 'ai' ? 'Read by AI' : 'Read by text rules (AI offline)'}</Badge>
          <span>{capture.filename}</span>
          {capture.low_confidence.length > 0 && <Badge tone="warn">{capture.low_confidence.length} field{capture.low_confidence.length > 1 ? 's' : ''} to check</Badge>}
        </div>}
        <Card className="grid gap-3 p-4 sm:grid-cols-2">
          <label className="text-xs text-slate-600 sm:col-span-2">Customer
            <select value={draft.customer_id} onChange={e => setDraft(d => ({ ...d, customer_id: e.target.value }))} aria-invalid={unsure('customer_name') || undefined} className={cn(inputClass, 'mt-1', unsure('customer_name') && 'bg-amber-50')}>
              <option value="">{draft.customer_name ? `New customer: ${draft.customer_name}` : 'Choose a customer…'}</option>
              {masters.data!.customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.city ? `, ${c.city}` : ''}</option>)}
            </select>
            {!draft.customer_id && <input placeholder="Or type a new customer name" value={draft.customer_name} onChange={e => setDraft(d => ({ ...d, customer_name: e.target.value }))} className={`${inputClass} mt-2`} aria-label="New customer name" />}
          </label>
          <label className="text-xs text-slate-600">PO number<input required value={draft.po_number} onChange={e => setDraft(d => ({ ...d, po_number: e.target.value }))} aria-invalid={unsure('po_number') || undefined} className={cn(inputClass, 'mt-1', unsure('po_number') && 'bg-amber-50')} /></label>
          <label className="text-xs text-slate-600">PO date<input required type="date" value={draft.po_date} onChange={e => setDraft(d => ({ ...d, po_date: e.target.value }))} className={cn(inputClass, 'mt-1', unsure('po_date') && 'bg-amber-50')} /></label>
          <label className="text-xs text-slate-600">Promised delivery<input required type="date" value={draft.promised_date} onChange={e => setDraft(d => ({ ...d, promised_date: e.target.value }))} className={cn(inputClass, 'mt-1', unsure('promised_date') && 'bg-amber-50')} /></label>
        </Card>
        <Card className="space-y-3 p-4">
          <p className="text-xs font-medium text-slate-700">Order lines</p>
          {draft.lines.map((line, index) => <div key={index} className="grid items-end gap-2 sm:grid-cols-[minmax(0,2fr)_90px_100px_32px]">
            <label className="text-xs text-slate-600">Item
              <select value={line.item_id} onChange={e => pickItem(index, e.target.value, masters.data!.items)} className={cn(inputClass, 'mt-1', unsure(`lines.${index}.item`) && 'bg-amber-50')}>
                <option value="">{line.description ? `Unlisted: ${line.description}` : 'Choose an item…'}</option>
                {masters.data!.items.map(i => <option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-600">Qty<input required type="number" min={1} step="any" value={line.qty} onChange={e => setLine(index, { qty: e.target.value })} className={`${inputClass} mt-1`} /></label>
            <label className="text-xs text-slate-600">Rate (₹)<input type="number" min={0} step="any" value={line.rate} onChange={e => setLine(index, { rate: e.target.value })} className={cn(inputClass, 'mt-1', unsure(`lines.${index}.rate`) && 'bg-amber-50')} /></label>
            <button type="button" aria-label="Remove line" disabled={draft.lines.length === 1} onClick={() => setDraft(d => ({ ...d, lines: d.lines.filter((_, i) => i !== index) }))} className="mb-1 rounded p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30"><Trash2 className="size-4" /></button>
          </div>)}
          <button type="button" onClick={() => setDraft(d => ({ ...d, lines: [...d.lines, { item_id: '', description: '', qty: '', rate: '' }] }))} className={secondaryButton}><Plus className="size-3.5" />Add line</button>
        </Card>
        {capture && capture.low_confidence.length > 0 && <p className="text-xs text-amber-800">Highlighted fields were unclear in the document. Check them before saving.</p>}
        <div className="flex flex-wrap justify-between gap-2">
          <button type="button" className={secondaryButton} onClick={() => { setStage('upload'); setCapture(null); setError(null); }}>Use another file</button>
          <button type="submit" disabled={saving} className="primary-button">{saving ? 'Saving…' : 'Add to order book'}</button>
        </div>
      </form>)}
  </section>;
}
