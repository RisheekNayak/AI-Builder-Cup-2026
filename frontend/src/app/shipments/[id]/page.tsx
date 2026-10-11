'use client';
import { useParams } from 'next/navigation';
import { StandalonePanel } from '@/components/workspace/StandalonePanel';
import { shipmentPanel } from '@/lib/workspace';

export default function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <StandalonePanel key={id} panel={shipmentPanel(id)} />;
}
