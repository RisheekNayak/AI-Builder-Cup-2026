'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { resetDemo } from '@/lib/business';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { ErrorState, errorMessage } from '@/components/ui/Feedback';
import { secondaryButton } from '@/components/ui/primitives';

export function DemoReset() {
  const { dataChanged, reset } = useWorkspace();
  const [state, setState] = useState<'idle' | 'confirm' | 'working' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setState('working'); setError(null);
    try { await resetDemo(); reset(); dataChanged(); setState('done'); }
    catch (err) { setError(errorMessage(err, 'Could not reset the sample data.')); setState('idle'); }
  }

  return <div className="space-y-3">
    <p className="text-sm text-slate-600">The workspace runs on sample factory data: customers, orders, invoices, payments, stock and job-work challans, dated relative to today.</p>
    {state === 'confirm' ? <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      This deletes every order, payment, task and shipment you added, and clears the chat.
      <button type="button" onClick={run} className="primary-button !px-3 !py-1.5 !text-xs">Reset sample data</button>
      <button type="button" onClick={() => setState('idle')} className={secondaryButton}>Keep my changes</button>
    </div> : <button type="button" disabled={state === 'working'} onClick={() => setState('confirm')} className={secondaryButton}><RotateCcw className="size-3.5" />{state === 'working' ? 'Resetting…' : 'Reset sample data'}</button>}
    {state === 'done' && <p role="status" className="text-sm text-emerald-700">Sample data restored.</p>}
    {error && <ErrorState message={error} />}
  </div>;
}
