'use client';
import { StandalonePanel } from '@/components/workspace/StandalonePanel';
import { ordersPanel } from '@/lib/workspace';

export default function Orders() {
  return <StandalonePanel panel={ordersPanel()} />;
}
