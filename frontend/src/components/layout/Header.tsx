'use client';
import { usePathname } from 'next/navigation';
import { Menu, Plus } from 'lucide-react';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';

export function Header({ onMenuToggle, menuOpen }: { onMenuToggle: () => void; menuOpen: boolean }) {
  const pathname = usePathname();
  const { reset, pending } = useWorkspace();
  
  let title = 'Dashboard';
  if (pathname.includes('/advisor')) title = 'Trade Advisor';
  else if (pathname.includes('/shipments/new')) title = 'New Shipment';
  else if (pathname.includes('/shipments/') && pathname !== '/shipments/new') title = 'Shipment Details';
  else if (pathname.includes('/shipments')) title = 'Shipment History';
  else if (pathname.includes('/settings')) title = 'Settings';

  return (
    <header className="bg-white border-b border-slate-200 h-16 shrink-0 flex items-center gap-3 px-4 sm:px-6">
      <button type="button" aria-label="Toggle navigation" aria-expanded={menuOpen} aria-controls="workspace-navigation" onClick={onMenuToggle} className="rounded-md p-2 text-slate-600 hover:bg-slate-100 md:hidden"><Menu className="size-5" /></button>
      <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
      {(pathname === '/' || pathname === '/advisor') && <button type="button" disabled={pending} onClick={reset} className="ml-auto inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"><Plus className="size-4" /><span className="hidden sm:inline">New conversation</span></button>}
    </header>
  );
}
