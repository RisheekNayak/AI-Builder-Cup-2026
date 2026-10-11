'use client';
import { StandalonePanel } from '@/components/workspace/StandalonePanel';
import { poCapturePanel } from '@/lib/workspace';

export default function NewOrder() {
  return <StandalonePanel panel={poCapturePanel} />;
}
