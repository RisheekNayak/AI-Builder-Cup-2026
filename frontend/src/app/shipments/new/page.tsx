'use client';
import { StandalonePanel } from '@/components/workspace/StandalonePanel';
import { newShipmentPanel } from '@/lib/workspace';

export default function NewShipment() {
  return <StandalonePanel panel={newShipmentPanel} />;
}
