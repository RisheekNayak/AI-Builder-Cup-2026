'use client';

import { useId, useRef, useState } from 'react';
import { Upload, FileText, ArrowRight, LoaderCircle } from 'lucide-react';
import { uploadInvoice, uploadSampleInvoice } from '@/lib/api';
import { ErrorState, errorMessage } from '@/components/ui/Feedback';
import { secondaryButton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

const SAMPLES = [
  { key: 'fta-eligible', label: 'UAE buyer (FTA)' },
  { key: 'clean-pass', label: 'US buyer' },
  { key: 'scomet-flag', label: 'Possible SCOMET item' },
] as const;

export function NewShipmentForm({ onUploaded }: { onUploaded: (id: string) => void }) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);

  function select(value?: File) {
    if (!value || loading) return;
    if (!/\.(pdf|json|png|jpe?g)$/i.test(value.name)) { setError('Choose a PDF, JSON, PNG or JPG invoice.'); return; }
    if (value.size > 10 * 1024 * 1024) { setError('Choose an invoice smaller than 10 MB.'); return; }
    if (value.size === 0) { setError('This file is empty. Choose another invoice.'); return; }
    setFile(value); setError(null); setFailedId(null);
  }

  async function run(label: string, call: () => ReturnType<typeof uploadInvoice>) {
    setLoading(label); setError(null); setFailedId(null);
    try {
      const response = await call();
      if (response.status === 'error') {
        setError(response.error || 'This invoice could not be read.');
        setFailedId(response.shipment_id);
        return;
      }
      onUploaded(response.shipment_id);
    } catch (err) { setError(errorMessage(err, 'Upload failed. Your file is still selected; please try again.')); }
    finally { setLoading(null); }
  }

  return <section className="mx-auto max-w-2xl space-y-6">
    <div><p className="text-xs font-medium text-indigo-600">Export invoice → Compliance check → Documents</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">New Shipment</h2><p className="mt-2 text-sm leading-6 text-slate-500">Upload the commercial invoice for an export shipment. ShipSure checks SCOMET, FTA benefits, HS codes and ports, then drafts the documents.</p></div>
    <div className={cn('rounded-xl border-2 border-dashed bg-white p-7 text-center transition-colors', dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300', loading && 'opacity-60')} onDragOver={event => { event.preventDefault(); if (!loading) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); select(event.dataTransfer.files[0]); }}>
      {file ? <FileText className="mx-auto size-9 text-indigo-500" /> : <Upload className="mx-auto size-9 text-indigo-400" />}
      <p className="mt-4 break-all text-sm font-medium">{file ? file.name : 'Drop your invoice here'}</p>
      <p className="mt-2 text-xs text-slate-500">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'PDF, JSON, PNG or JPG · Up to 10 MB'}</p>
      <input id={inputId} ref={input} type="file" accept=".pdf,.json,.png,.jpg,.jpeg" disabled={!!loading} onChange={event => select(event.target.files?.[0])} className="sr-only" />
      <button type="button" disabled={!!loading} onClick={() => input.current?.click()} className="mt-5 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">{file ? 'Choose another file' : 'Choose file'}</button>
    </div>
    {error && <div className="space-y-2"><ErrorState message={error} />{failedId && <p className="text-xs text-slate-500">The upload is kept in Shipment History. You can also try a sample invoice below.</p>}</div>}
    {loading && <p role="status" className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Reading the invoice and checking compliance…</p>}
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">Or try a sample:
        {SAMPLES.map(s => <button key={s.key} type="button" disabled={!!loading} onClick={() => run(s.key, () => uploadSampleInvoice(s.key))} className={secondaryButton}>{loading === s.key ? 'Checking…' : s.label}</button>)}
      </div>
      <button type="button" onClick={() => file && run('file', () => uploadInvoice(file))} disabled={!file || !!loading} className="primary-button">{loading === 'file' ? 'Analyzing…' : 'Analyze Invoice'}<ArrowRight className="size-4" /></button>
    </div>
  </section>;
}
