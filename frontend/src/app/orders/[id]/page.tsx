'use client';
import { useParams } from 'next/navigation';
import { StandalonePanel } from '@/components/workspace/StandalonePanel';
import { orderPanel } from '@/lib/workspace';

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  return <StandalonePanel key={id} panel={orderPanel(id)} />;
}
