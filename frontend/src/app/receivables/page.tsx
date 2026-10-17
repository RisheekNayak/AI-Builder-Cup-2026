'use client';
import { StandalonePanel } from '@/components/workspace/StandalonePanel';
import { receivablesPanel } from '@/lib/workspace';

export default function ReceivablesPage() {
  return <StandalonePanel panel={receivablesPanel} />;
}
