'use client';
import { StandalonePanel } from '@/components/workspace/StandalonePanel';
import { historyPanel } from '@/lib/workspace';

export default function ShipmentHistoryPage() {
  return <StandalonePanel panel={historyPanel} />;
}
