'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileText, Pencil, RefreshCw, ShieldCheck } from 'lucide-react';
import { generateForms, getFormDownloadUrl, getShipment, listForms, reanalyzeShipment, updateExtractedData } from '@/lib/api';
import type { ExtractedData, RiskFlag } from '@/lib/types';
import { formatMoney, formatQty } from '@/lib/format';
import { useData } from '@/lib/use-data';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { ErrorState, LoadingState, errorMessage } from '@/components/ui/Feedback';
import { Badge, Card, SectionTitle, inputClass, secondaryButton } from '@/components/ui/primitives';
import { RISK_TONE, SHIPMENT_STATUS } from './ShipmentHistory';
import { cn } from '@/lib/utils';

const SEVERITY_RANK: Record<RiskFlag['severity'], number> = { critical: 0, high: 1, medium: 2, low: 3 };
const FIELDS: [keyof ExtractedData, string][] = [
  ['invoiceNumber', 'Invoice number'], ['invoiceDate', 'Invoice date'], ['buyerName', 'Buyer'], ['buyerCountry', 'Buyer country'],
  ['portOfLoading', 'Port of loading'], ['portOfDischarge', 'Port of discharge'], ['currency', 'Currency'], ['sellerName', 'Seller'],
];

export function ShipmentDetails({ id }: { id: string }) {
  const { dataChanged, notify } = useWorkspace();
  const shipmentData = useData(() => getShipment(id), [id]);
  const formsData = useData(() => listForms(id), [id]);
  const [editing, setEditing] = useState<ExtractedData | null>(null);
  const [busy, setBusy] = useState<'save' | 'retry' | 'forms' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const shipment = shipmentData.data;
  if (shipmentData.loading && !shipment) return <LoadingState label="Loading shipment details…" />;
  if (!shipment) return <ErrorState message={shipmentData.error || 'Shipment not found.'} onRetry={shipmentData.retry} />;
  const data = shipment.extractedData;
  const risk = shipment.riskReport;
  const forms = formsData.data || [];

  async function run(kind: 'save' | 'retry' | 'forms', task: () => Promise<unknown>, success: string) {
    setBusy(kind); setError(null);
    try { await task(); dataChanged(); notify(success); }
    catch (err) { setError(errorMessage(err, 'Something went wrong. Please try again.')); }
    finally { setBusy(null); }
  }

  const save = () => editing && run('save', async () => { await updateExtractedData(id, editing); setEditing(null); }, `Invoice details updated for ${editing.invoiceNumber || shipment.filename}. Compliance re-checked.`);

  return <div className="mx-auto max-w-5xl space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-medium text-indigo-600">Export shipment</p><h2 className="mt-1 break-words text-xl font-semibold tracking-tight">{data?.invoiceNumber || shipment.filename}</h2>
        <p className="mt-1 text-sm text-slate-500">{data?.buyerName ? `${data.buyerName}${data.buyerCountry ? ` · ${data.buyerCountry}` : ''}` : shipment.filename}</p></div>
      <Badge tone={SHIPMENT_STATUS[shipment.status].tone}>{SHIPMENT_STATUS[shipment.status].label}</Badge>
    </div>
    {error && <ErrorState message={error} />}
    {(shipment.status === 'error' || shipment.status === 'analysis_failed') && <Card className="space-y-3 border-red-200 bg-red-50/50 p-4">
      <p className="flex items-start gap-2 text-sm text-red-800"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{shipment.error || 'This shipment could not be analysed.'}</p>
      {shipment.status === 'analysis_failed' && <button type="button" disabled={!!busy} onClick={() => run('retry', () => reanalyzeShipment(id), 'Compliance analysis re-run.')} className={secondaryButton}><RefreshCw className="size-3.5" />{busy === 'retry' ? 'Retrying…' : 'Retry analysis'}</button>}
    </Card>}

    {risk && <Card className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle icon={ShieldCheck}>Compliance verdict</SectionTitle>
        <div className="flex items-center gap-2">{risk.mode === 'rules' && <Badge tone="warn">Rules-only check</Badge>}<Badge tone={RISK_TONE[risk.overallScore]} className="text-xs uppercase">{risk.overallScore} risk</Badge></div>
      </div>
      {risk.analysisSummary && <p className="text-sm leading-6 text-slate-600">{risk.analysisSummary}</p>}
      {shipment.ftaMatches.length > 0 && <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm">
        <p className="font-medium text-emerald-800">FTA available: {shipment.ftaMatches.map(m => m.name).join(', ')}</p>
        <p className="mt-1 text-xs text-emerald-900/80">{shipment.ftaMatches[0].benefits} Origin rule: {shipment.ftaMatches[0].originCriteria}</p>
      </div>}
      {risk.dutySavings && !shipment.ftaMatches.length && <p className="text-sm text-emerald-700">{risk.dutySavings}</p>}
      <ul className="space-y-2">{[...risk.flags].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]).map((flag, i) => <li key={i} className={cn('rounded-lg border p-3 text-sm',
        flag.severity === 'critical' || flag.severity === 'high' ? 'border-red-200 bg-red-50/50' : flag.severity === 'medium' ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-slate-50')}>
        <div className="flex flex-wrap items-center gap-2"><Badge tone={RISK_TONE[flag.severity]} className="capitalize">{flag.severity}</Badge><span className="font-medium">{flag.title}</span></div>
        <p className="mt-1 text-slate-600">{flag.description}</p>
        {flag.recommendation && <p className="mt-1 text-xs font-medium text-slate-700">Next step: {flag.recommendation}</p>}
        {flag.policyCitation && <p className="mt-1 text-[11px] text-slate-500">Source: {flag.policyCitation}</p>}
      </li>)}</ul>
      {!risk.flags.length && <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="size-4" />No compliance issues found.</p>}
    </Card>}

    {data && <Card className="space-y-4 p-4">
      <SectionTitle icon={FileText} aside={!editing && <button type="button" onClick={() => setEditing(structuredClone(data))} className={secondaryButton}><Pencil className="size-3.5" />Correct details</button>}>Invoice details</SectionTitle>
      {editing ? <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">{FIELDS.map(([key, label]) => <label key={key} className="text-xs text-slate-600">{label}
          <input value={String(editing[key] ?? '')} onChange={e => setEditing(d => d && ({ ...d, [key]: e.target.value }))} className={`${inputClass} mt-1`} /></label>)}</div>
        {editing.lineItems.map((item, i) => <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[minmax(0,2fr)_110px_90px]">
          <label className="text-xs text-slate-600">Description<input value={item.description} onChange={e => setEditing(d => d && ({ ...d, lineItems: d.lineItems.map((li, j) => j === i ? { ...li, description: e.target.value } : li) }))} className={`${inputClass} mt-1`} /></label>
          <label className="text-xs text-slate-600">HS code<input value={item.hsCode} onChange={e => setEditing(d => d && ({ ...d, lineItems: d.lineItems.map((li, j) => j === i ? { ...li, hsCode: e.target.value } : li) }))} className={`${inputClass} mt-1`} /></label>
          <label className="text-xs text-slate-600">Quantity<input type="number" value={item.quantity || ''} onChange={e => setEditing(d => d && ({ ...d, lineItems: d.lineItems.map((li, j) => j === i ? { ...li, quantity: Number(e.target.value) } : li) }))} className={`${inputClass} mt-1`} /></label>
        </div>)}
        <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className={secondaryButton}>Cancel</button><button type="button" disabled={!!busy} onClick={save} className="primary-button">{busy === 'save' ? 'Re-checking…' : 'Save & re-check'}</button></div>
      </div> : <>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          {FIELDS.map(([key, label]) => <div key={key}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-0.5 break-words">{String(data[key] || '—')}</dd></div>)}
          <div><dt className="text-xs text-slate-500">Total value</dt><dd className="mt-0.5 tabular-nums">{formatMoney(data.totalValue, data.currency)}</dd></div>
        </dl>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-2 font-medium">Description</th><th className="px-3 py-2 font-medium">HS code</th><th className="px-3 py-2 text-right font-medium">Qty</th><th className="px-3 py-2 text-right font-medium">Unit price</th><th className="px-3 py-2 text-right font-medium">Total</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{data.lineItems.map((item, i) => <tr key={i}><td className="px-3 py-2">{item.description}</td><td className={cn('px-3 py-2', !item.hsCode && 'text-amber-700')}>{item.hsCode || 'Missing'}</td><td className="px-3 py-2 text-right tabular-nums">{formatQty(item.quantity)} {item.unit}</td><td className="px-3 py-2 text-right tabular-nums">{formatMoney(item.unitPrice, data.currency)}</td><td className="px-3 py-2 text-right tabular-nums">{formatMoney(item.totalValue, data.currency)}</td></tr>)}</tbody>
          </table>
        </div>
      </>}
    </Card>}

    {shipment.status === 'complete' && <Card className="space-y-3 p-4">
      <SectionTitle icon={Download}>Export documents</SectionTitle>
      {formsData.error ? <ErrorState message={formsData.error} onRetry={formsData.retry} /> :
        <ul className="divide-y divide-slate-100">{forms.map(form => <li key={form.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
          <div className="min-w-0"><p className="text-sm font-medium">{form.name}</p><p className="text-xs text-slate-500">{form.reason}</p></div>
          {form.status === 'generated' ? <a href={getFormDownloadUrl(id, form.id)} aria-label={`Download ${form.name}`} target="_blank" rel="noopener noreferrer" className={secondaryButton}><Download className="size-3.5" />Download draft</a>
            : form.status === 'unsupported' ? <Badge>Not supported yet</Badge> : <Badge tone="info">Not generated</Badge>}
        </li>)}</ul>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">Drafts for review. File the shipping bill on ICEGATE and the CoO on the DGFT eCoO portal.</p>
        <button type="button" disabled={!!busy} onClick={() => run('forms', () => generateForms(id), `Export documents drafted for ${data?.invoiceNumber || shipment.filename}.`)} className="primary-button">
          {busy === 'forms' ? 'Generating…' : forms.some(f => f.status === 'generated') ? 'Regenerate documents' : 'Generate documents'}
        </button>
      </div>
    </Card>}
  </div>;
}
