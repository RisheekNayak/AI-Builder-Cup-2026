'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, Package, RefreshCw } from 'lucide-react';
import { getShipments } from '@/lib/api';
import { newestShipments } from '@/lib/workspace';
import type { Shipment } from '@/lib/types';
import { ErrorState, LoadingState, errorMessage } from '@/components/ui/Feedback';

export function ShipmentHistory({ onSelect, onNew }: { onSelect: (shipment: Shipment) => void; onNew: () => void }) {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    getShipments().then(data => { if (!cancelled) { setShipments(newestShipments(data)); setError(null); } }).catch(err => { if (!cancelled) setError(errorMessage(err, 'Could not load shipment history.')); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attempt]);
  function refresh() { setLoading(true); setAttempt(value => value + 1); }
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight">Shipment History</h2><p className="mt-2 text-sm text-slate-500">Your invoices, analysis and compliance records.</p></div><button type="button" aria-label="Refresh shipment history" onClick={refresh} disabled={loading} className="rounded-md border border-slate-200 bg-white p-2 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className="size-4" /></button></div>
    {loading ? <LoadingState label="Loading shipment history…" /> : error ? <ErrorState message={error} onRetry={refresh} /> : !shipments.length ? <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center"><Package className="mx-auto size-9 text-indigo-300" /><h3 className="mt-4 font-medium">Your first shipment starts here</h3><p className="mt-2 text-sm text-slate-500">Upload an invoice to start its compliance analysis.</p><button type="button" onClick={onNew} className="primary-button mt-5">New Shipment</button></div> : <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500"><tr><th className="p-3 font-medium">Invoice / file</th><th className="p-3 font-medium">Destination</th><th className="p-3 font-medium">Uploaded</th><th className="p-3 font-medium">Analysis</th><th className="p-3 font-medium">Risk</th></tr></thead><tbody className="divide-y divide-slate-100">{shipments.map(shipment => <tr key={shipment.id} className="hover:bg-slate-50"><td className="p-3"><button type="button" onClick={() => onSelect(shipment)} className="flex items-center gap-2 text-left font-medium text-indigo-600"><span className="max-w-48 break-words">{shipment.extractedData?.invoiceNumber || shipment.filename}</span><ArrowUpRight className="size-3.5 shrink-0" /></button></td><td className="p-3">{shipment.extractedData?.buyerCountry || '—'}</td><td className="whitespace-nowrap p-3 text-xs text-slate-500">{new Date(shipment.createdAt).toLocaleDateString('en-IN')}</td><td className="p-3 capitalize">{shipment.status}</td><td className="p-3 capitalize">{shipment.riskReport?.overallScore || 'Pending'}</td></tr>)}</tbody></table></div>}
  </section>;
}
