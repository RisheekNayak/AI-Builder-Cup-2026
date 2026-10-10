import { AlertCircle, LoaderCircle } from 'lucide-react';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <div role="status" className="flex items-center justify-center gap-3 p-12 text-sm text-slate-500"><LoaderCircle className="size-5 animate-spin" />{label}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><div className="flex items-start gap-2"><AlertCircle className="mt-0.5 size-4 shrink-0" /><p>{message}</p></div>{onRetry && <button type="button" onClick={onRetry} className="mt-3 rounded-md border border-red-200 px-3 py-1.5 font-medium hover:bg-red-100">Try again</button>}</div>;
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
