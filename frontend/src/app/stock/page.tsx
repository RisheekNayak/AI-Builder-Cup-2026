'use client';
import { StandalonePanel } from '@/components/workspace/StandalonePanel';
import { stockPanel } from '@/lib/workspace';

export default function StockPage() {
  return <StandalonePanel panel={stockPanel} />;
}
