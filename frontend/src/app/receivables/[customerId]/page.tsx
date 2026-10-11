'use client';
import { useParams } from 'next/navigation';
import { StandalonePanel } from '@/components/workspace/StandalonePanel';
import { customerPanel } from '@/lib/workspace';

export default function CustomerPage() {
  const { customerId } = useParams<{ customerId: string }>();
  return <StandalonePanel key={customerId} panel={customerPanel(customerId)} />;
}
