'use client';
import { StandalonePanel } from '@/components/workspace/StandalonePanel';
import { gstPanel } from '@/lib/workspace';

export default function GstPage() {
  return <StandalonePanel panel={gstPanel} />;
}
