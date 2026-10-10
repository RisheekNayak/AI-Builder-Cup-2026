'use client';

import { useId, useRef, useState } from 'react';
import { Upload, FileText, ArrowRight, LoaderCircle } from 'lucide-react';
import { uploadInvoice } from '@/lib/api';
import { ErrorState, errorMessage } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils';

export function NewShipmentForm({ onUploaded }: { onUploaded: (id: string) => void }) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function select(value?: File) {
    if (!value || loading) return;
    if (!/\.(pdf|json|png|jpe?g)$/i.test(value.name)) { setError('Choose a PDF, JSON, PNG or JPG invoice.'); return; }
    if (value.size > 10 * 1024 * 1024) { setError('Choose an invoice smaller than 10 MB.'); return; }
    if (value.size === 0) { setError('This file is empty. Choose another invoice.'); return; }
    setFile(value); setError(null);
  }
  async function upload() {
    if (!file || loading) return;
    setLoading(true); setError(null);
    try {
      const response = await uploadInvoice(file);
      if (!response.shipment_id) throw new Error('The upload did not return a shipment. Please try again.');
      if (response.status === 'error') { setError('The invoice was uploaded, but analysis failed. You can view the shipment or try another invoice.'); }
      onUploaded(response.shipment_id);
    } catch (err) { setError(errorMessage(err, 'Upload failed. Your file is still selected; please try again.')); }
    finally { setLoading(false); }
  }

  return <section className="mx-auto max-w-2xl space-y-6">
    <div><p className="text-xs font-medium text-indigo-600">Invoice → Analysis → Documents</p><h2 className="mt-2 text-2xl font-semibold tracking-tight">New Shipment</h2><p className="mt-2 text-sm leading-6 text-slate-500">Upload a commercial invoice to extract shipment details and review compliance.</p></div>
    <div className={cn('rounded-xl border-2 border-dashed bg-white p-7 text-center transition-colors', dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300', loading && 'opacity-60')} onDragOver={event => { event.preventDefault(); if (!loading) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); select(event.dataTransfer.files[0]); }}>
      {file ? <FileText className="mx-auto size-9 text-indigo-500" /> : <Upload className="mx-auto size-9 text-indigo-400" />}
      <p className="mt-4 break-all text-sm font-medium">{file ? file.name : 'Drop your invoice here'}</p>
      <p className="mt-2 text-xs text-slate-500">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'PDF, JSON, PNG or JPG · Up to 10 MB'}</p>
      <input id={inputId} ref={input} type="file" accept=".pdf,.json,.png,.jpg,.jpeg" disabled={loading} onChange={event => select(event.target.files?.[0])} className="sr-only" />
      <button type="button" disabled={loading} onClick={() => input.current?.click()} className="mt-5 rounded-md border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">{file ? 'Choose another file' : 'Choose file'}</button>
    </div>
    {error && <ErrorState message={error} />}
    {loading && <p role="status" className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Extracting invoice data and analyzing compliance…</p>}
    <div className="flex justify-end"><button type="button" onClick={upload} disabled={!file || loading} className="primary-button">{loading ? 'Analyzing…' : 'Analyze Invoice'}<ArrowRight className="size-4" /></button></div>
  </section>;
}
