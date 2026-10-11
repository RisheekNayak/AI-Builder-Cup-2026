'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PanelView } from './PanelView';
import { standaloneHref, type WorkspacePanel } from '@/lib/workspace';

/** Full-page version of a workspace panel. Same-kind changes (like an order filter) stay on the page; others navigate. */
export function StandalonePanel({ panel: initial }: { panel: WorkspacePanel }) {
  const router = useRouter();
  const [panel, setPanel] = useState(initial);
  return <div className="mx-auto max-w-5xl">
    <PanelView key={panel.key + (panel.filter || '')} panel={panel} open={next => next.kind === panel.kind && next.kind === 'orders' ? setPanel(next) : router.push(standaloneHref(next))} />
  </div>;
}
