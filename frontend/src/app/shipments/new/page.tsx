'use client';
import { useRouter } from 'next/navigation';
import { NewShipmentForm } from '@/components/shipments/NewShipmentForm';

export default function NewShipment() {
  const router = useRouter();
  return <NewShipmentForm onUploaded={id => router.push(`/shipments/${id}`)} />;
}
