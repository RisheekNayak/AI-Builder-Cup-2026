'use client';

import { ArrowUpRight, Package, RefreshCw } from 'lucide-react';
import { getShipments } from '@/lib/api';
import type { Shipment } from '@/lib/types';
import { formatDate } from '@/lib/format';
import { useData } from '@/lib/use-data';
import { ErrorState, LoadingState } from '@/components/ui/Feedback';
import { Badge, type Tone } from '@/components/ui/primitives';

export const SHIPMENT_STATUS: Record<Shipment['status'], { label: string; tone: Tone }> = {
  uploaded: { label: 'Uploaded', tone: 'neutral' }, extracting: { label: 'Reading', tone: 'info' }, analyzing: { label: 'Analyzing', tone: 'info' },
  complete: { label: 'Checked', tone: 'good' }, analysis_failed: { label: 'Analysis failed', tone: 'critical' }, error: { label: 'Could not read', tone: 'critical' },
};
export const RISK_TONE: Record<string, Tone> = { low: 'good', medium: 'warn', high: 'critical', critical: 'critical' };

export function ShipmentHistory({ onSelect, onNew }: { onSelect: (shipment: Shipment) => void; onNew: () => void }) {
  const { data: shipments, error, loading, retry } = useData(getShipments, []);
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight">Shipment History</h2><p className="mt-2 text-sm text-slate-500">Export invoices checked for compliance, newest first.</p></div><button type="button" aria-label="Refresh shipment history" onClick={retry} disabled={loading} className="rounded-md border border-slate-200 bg-white p-2 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className="size-4" /></button></div>
    {loading && !shipments ? <LoadingState label="Loading shipment history…" /> : error ? <ErrorState message={error} onRetry={retry} /> : !shipments?.length ?
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center"><Package className="mx-auto size-9 text-indigo-300" /><h3 className="mt-4 font-medium">Your first shipment starts here</h3><p className="mt-2 text-sm text-slate-500">Upload an export invoice to check compliance and draft documents.</p><button type="button" onClick={onNew} className="primary-button mt-5">New Shipment</button></div> :
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="w-full min-w-[520px] text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500"><tr><th className="p-3 font-medium">Invoice / file</th><th className="p-3 font-medium">Buyer</th><th className="p-3 font-medium">Uploaded</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Risk</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{shipments.map(shipment => <tr key={shipment.id} className="hover:bg-slate-50">
          <td className="p-3"><button type="button" onClick={() => onSelect(shipment)} className="flex items-center gap-2 text-left font-medium text-indigo-600"><span className="max-w-48 break-words">{shipment.extractedData?.invoiceNumber || shipment.filename}</span><ArrowUpRight className="size-3.5 shrink-0" /></button></td>
          <td className="p-3">{shipment.extractedData?.buyerName || '—'}{shipment.extractedData?.buyerCountry && <span className="ml-1 text-xs text-slate-500">({shipment.extractedData.buyerCountry})</span>}</td>
          <td className="whitespace-nowrap p-3 text-xs text-slate-500">{formatDate(shipment.createdAt)}</td>
          <td className="p-3"><Badge tone={SHIPMENT_STATUS[shipment.status].tone}>{SHIPMENT_STATUS[shipment.status].label}</Badge></td>
          <td className="p-3">{shipment.riskReport ? <Badge tone={RISK_TONE[shipment.riskReport.overallScore]} className="capitalize">{shipment.riskReport.overallScore}</Badge> : '—'}</td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}
