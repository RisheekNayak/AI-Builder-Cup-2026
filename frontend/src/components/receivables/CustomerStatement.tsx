'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, MessageCircle, Wallet } from 'lucide-react';
import { createTask, draftReminder, getStatement, recordPayment, whatsappLink } from '@/lib/business';
import { addDaysISO, formatDate, formatINR, todayISO } from '@/lib/format';
import { useData } from '@/lib/use-data';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { ErrorState, LoadingState, errorMessage } from '@/components/ui/Feedback';
import { Badge, Card, Kpi, PanelHeader, SectionTitle, inputClass, secondaryButton } from '@/components/ui/primitives';

export function ReminderBox({ text, phone, onTask }: { text: string; phone?: string | null; onTask?: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
  }
  return <div className="space-y-2">
    <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 font-sans text-xs leading-5 text-slate-700">{text}</pre>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={copy} className={secondaryButton}>{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? 'Copied' : 'Copy text'}</button>
      {phone && <a href={whatsappLink(phone, text)} target="_blank" rel="noopener noreferrer" className={secondaryButton}><ExternalLink className="size-3.5" />Open in WhatsApp</a>}
      {onTask && <button type="button" onClick={onTask} className={secondaryButton}>Add follow-up task</button>}
    </div>
    {phone && <p className="text-[11px] text-slate-500">WhatsApp: {phone}. Nothing is sent until you send it yourself.</p>}
  </div>;
}

export function CustomerStatement({ id }: { id: string }) {
  const { dataChanged, notify } = useWorkspace();
  const { data, error, loading, retry } = useData(() => getStatement(id), [id]);
  const [payment, setPayment] = useState({ amount: '', reference: '', payment_date: todayISO() });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reminder, setReminder] = useState<{ text: string; mode: string; whatsapp: string | null } | null>(null);
  const [drafting, setDrafting] = useState<'en' | 'hinglish' | null>(null);

  if (loading && !data) return <LoadingState label="Loading statement…" />;
  if (error || !data) return <ErrorState message={error || 'Customer not found.'} onRetry={retry} />;
  const c = data.customer;
  const openInvoices = data.invoices.filter(i => i.status !== 'paid');

  async function savePayment(event: React.FormEvent) {
    event.preventDefault();
    const amount = Number(payment.amount);
    if (!amount || amount <= 0) { setFormError('Enter the amount received.'); return; }
    setSaving(true); setFormError(null);
    try {
      const result = await recordPayment({ customer_id: c.id, amount, reference: payment.reference || null, payment_date: payment.payment_date });
      setPayment({ amount: '', reference: '', payment_date: todayISO() });
      dataChanged();
      notify(`Recorded ${formatINR(amount)} from ${c.name} against ${result.allocations.map(a => a.invoice_number).join(', ')}. Outstanding is now ${formatINR(result.statement.outstanding)}.`);
    } catch (err) { setFormError(errorMessage(err, 'Could not record the payment.')); }
    finally { setSaving(false); }
  }

  async function draft(language: 'en' | 'hinglish') {
    setDrafting(language);
    try { setReminder(await draftReminder(c.id, language)); }
    catch (err) { notify(errorMessage(err, 'Could not draft the reminder.')); }
    finally { setDrafting(null); }
  }

  async function followUp() {
    try {
      const due = addDaysISO(2);
      const task = await createTask({ title: `Follow up with ${c.name} on ${formatINR(data!.outstanding)} outstanding`, assignee_role: 'accounts', due_date: due, entity_type: 'customer', entity_id: String(c.id) });
      dataChanged();
      notify(`Task created for accounts: "${task.title}", due ${formatDate(due)}.`);
    } catch (err) { notify(errorMessage(err, 'Could not create the task.')); }
  }

  return <section className="space-y-5">
    <PanelHeader eyebrow="Customer statement" title={c.name} subtitle={[c.city, c.gstin && `GSTIN ${c.gstin}`, `${c.credit_days}-day credit`].filter(Boolean).join(' · ')}
      aside={c.country !== 'IN' ? <Badge tone="accent">Export customer</Badge> : undefined} />
    <Card className="grid grid-cols-3 gap-4 p-4">
      <Kpi label="Outstanding" value={formatINR(data.outstanding)} />
      <Kpi label="Overdue" value={formatINR(data.overdue)} tone={data.overdue > 0 ? 'warn' : 'neutral'} />
      <Kpi label="Past 45 days" value={c.country === 'IN' ? formatINR(data.past_45) : 'n/a'} tone={data.past_45 > 0 ? 'critical' : 'neutral'} />
    </Card>

    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500"><tr><th className="p-3 font-medium">Invoice</th><th className="p-3 font-medium">Date</th><th className="p-3 text-right font-medium">Amount</th><th className="p-3 text-right font-medium">Balance</th><th className="p-3 text-right font-medium">Age</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{data.invoices.map(i => <tr key={i.id} className={i.status === 'paid' ? 'text-slate-400' : ''}>
          <td className="p-3">{i.number}<div className="mt-1">{i.status === 'paid' ? <Badge tone="good">Paid</Badge> : i.past_45 ? <Badge tone="critical">Past 45 days</Badge> : i.status === 'overdue' ? <Badge tone="warn">Overdue {i.overdue_days}d</Badge> : <Badge>Due {formatDate(i.due_date)}</Badge>}</div></td>
          <td className="p-3 text-slate-600">{formatDate(i.invoice_date)}</td>
          <td className="p-3 text-right tabular-nums">{formatINR(i.amount)}</td>
          <td className="p-3 text-right font-medium tabular-nums">{i.balance > 0 ? formatINR(i.balance) : '—'}</td>
          <td className="p-3 text-right tabular-nums">{i.age_days}d</td>
        </tr>)}</tbody>
      </table>
    </div>

    {openInvoices.length > 0 && <Card className="space-y-3 p-4">
      <SectionTitle icon={MessageCircle}>Payment reminder</SectionTitle>
      {reminder ? <ReminderBox text={reminder.text} phone={reminder.whatsapp} onTask={followUp} /> :
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!!drafting} onClick={() => draft('en')} className={secondaryButton}>{drafting === 'en' ? 'Drafting…' : 'Draft in English'}</button>
          <button type="button" disabled={!!drafting} onClick={() => draft('hinglish')} className={secondaryButton}>{drafting === 'hinglish' ? 'Drafting…' : 'Draft in Hinglish'}</button>
          <button type="button" onClick={followUp} className={secondaryButton}>Add follow-up task</button>
        </div>}
    </Card>}

    {openInvoices.length > 0 && <Card className="p-4">
      <form onSubmit={savePayment} className="space-y-3" aria-label="Record payment">
        <SectionTitle icon={Wallet}>Record payment received</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-slate-600">Amount (₹)<input type="number" min={1} step="any" value={payment.amount} onChange={e => setPayment(p => ({ ...p, amount: e.target.value }))} className={`${inputClass} mt-1`} /></label>
          <label className="text-xs text-slate-600">Date<input type="date" max={todayISO()} value={payment.payment_date} onChange={e => setPayment(p => ({ ...p, payment_date: e.target.value }))} className={`${inputClass} mt-1`} /></label>
          <label className="text-xs text-slate-600">UTR / reference<input value={payment.reference} onChange={e => setPayment(p => ({ ...p, reference: e.target.value }))} className={`${inputClass} mt-1`} /></label>
        </div>
        {formError && <ErrorState message={formError} />}
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] text-slate-500">Applied to the oldest open invoices first.</p><button type="submit" disabled={saving} className="primary-button">{saving ? 'Saving…' : 'Record payment'}</button></div>
      </form>
    </Card>}

    {data.payments.length > 0 && <Card className="space-y-2 p-4">
      <SectionTitle icon={Wallet}>Payments received</SectionTitle>
      <ul className="divide-y divide-slate-100 text-sm">{data.payments.slice(0, 8).map(p => <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{formatDate(p.payment_date)}{p.reference && <span className="ml-2 text-xs text-slate-500">{p.reference}</span>}</span><span className="tabular-nums">{formatINR(p.amount)}{p.invoice_number && <span className="ml-2 text-xs text-slate-500">→ {p.invoice_number}</span>}</span></li>)}</ul>
    </Card>}
  </section>;
}
