'use client';

import { CalendarDays, FileWarning, PackageOpen } from 'lucide-react';
import { getGst } from '@/lib/business';
import { formatDate, formatINR, formatQty } from '@/lib/format';
import { useData } from '@/lib/use-data';
import { ErrorState, LoadingState } from '@/components/ui/Feedback';
import { Badge, Card, PanelHeader, PreviewNotice, SectionTitle } from '@/components/ui/primitives';

function when(days: number) {
  if (days < 0) return { text: `${-days} day${days === -1 ? '' : 's'} ago`, tone: 'neutral' as const };
  if (days === 0) return { text: 'Today', tone: 'critical' as const };
  return { text: `In ${days} day${days === 1 ? '' : 's'}`, tone: days <= 5 ? 'warn' as const : 'neutral' as const };
}

export function GstPreview() {
  const { data, error, loading, retry } = useData(getGst, []);
  if (loading && !data) return <LoadingState label="Loading GST calendar…" />;
  if (error || !data) return <ErrorState message={error || 'Could not load GST data.'} onRetry={retry} />;

  return <section className="space-y-5">
    <PanelHeader eyebrow="GST & compliance" title="Deadlines and risks this month" subtitle={`As of ${formatDate(data.as_of)}`} aside={<Badge tone="warn">Preview</Badge>} />
    <PreviewNotice>Preview: standard due dates and checks on your invoices and job-work challans. Government extensions and portal filing status are not tracked yet.</PreviewNotice>
    <Card className="space-y-3 p-4">
      <SectionTitle icon={CalendarDays}>Due dates</SectionTitle>
      <ul className="divide-y divide-slate-100">{data.calendar.map(e => { const w = when(e.days_left); return <li key={e.name} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
        <span><span className="font-medium">{e.name}</span><span className="ml-2 text-xs text-slate-500">{e.detail}</span></span>
        <span className="flex items-center gap-2 text-xs text-slate-600">{formatDate(e.due_date)}<Badge tone={w.tone}>{w.text}</Badge></span>
      </li>; })}</ul>
    </Card>
    <Card className="space-y-3 p-4">
      <SectionTitle icon={FileWarning}>E-invoice 30-day limit</SectionTitle>
      <p className="text-xs text-slate-500">With turnover of ₹10 Cr or more, invoices must be reported to the IRP within 30 days, or the buyer cannot claim input credit.</p>
      {!data.irn_guard.length ? <p className="text-sm text-emerald-700">No invoices are near the limit.</p> :
        <ul className="space-y-2">{data.irn_guard.map(r => <li key={r.invoice_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm">
          <span><span className="font-medium">{r.number}</span><span className="ml-2 text-xs text-slate-500">{r.customer} · {formatINR(r.amount)}</span></span>
          <Badge tone={r.days_left <= 2 ? 'critical' : 'warn'}>{r.days_left > 0 ? `${r.days_left} days left` : 'Limit passed'}</Badge>
        </li>)}</ul>}
    </Card>
    <Card className="space-y-3 p-4">
      <SectionTitle icon={PackageOpen}>Material with job workers (ITC-04)</SectionTitle>
      <p className="text-xs text-slate-500">Inputs not returned within 1 year are treated as supplied, and GST becomes payable on them.</p>
      {!data.job_work.length ? <p className="text-sm text-emerald-700">No material is pending with job workers.</p> :
        <ul className="space-y-2">{data.job_work.map(j => <li key={j.challan_no} className="rounded-lg border border-slate-200 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{j.challan_no} · {j.job_worker}</span>
            <Badge tone={j.status === 'deemed_supply' ? 'critical' : j.status === 'due_soon' ? 'warn' : 'neutral'}>{j.status === 'deemed_supply' ? `Past 1 year by ${-j.days_left} days` : j.status === 'due_soon' ? `${j.days_left} days to 1 year` : `${j.age_days} days out`}</Badge></div>
          <p className="mt-1 text-xs text-slate-500">{j.process} · {j.item} · {formatQty(j.qty_pending)} of {formatQty(j.qty_sent)} {j.unit} still out · sent {formatDate(j.sent_date)}</p>
        </li>)}</ul>}
    </Card>
  </section>;
}
