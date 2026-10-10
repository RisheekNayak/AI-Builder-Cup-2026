'use client';
import { useParams } from 'next/navigation';
import { ShipmentDetails } from '@/components/shipments/ShipmentDetails';

export default function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <ShipmentDetails key={id} id={id} />;
}
