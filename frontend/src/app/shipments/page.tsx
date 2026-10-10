'use client';
import { useRouter } from 'next/navigation';
import { ShipmentHistory } from '@/components/shipments/ShipmentHistory';

export default function ShipmentHistoryPage() {
  const router = useRouter();
  return <ShipmentHistory onSelect={shipment => router.push(`/shipments/${shipment.id}`)} onNew={() => router.push('/shipments/new')} />;
}
