'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Anchor, Boxes, ClipboardList, History, Landmark, MessageSquare, Settings, Sparkles, Upload, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/components/company/CompanyProvider';
import { useWorkspace } from '@/components/workspace/WorkspaceProvider';
import { gstPanel, historyPanel, newShipmentPanel, ordersPanel, receivablesPanel, stockPanel, type WorkspacePanel } from '@/lib/workspace';

type NavItem = { name: string; href: string; icon: React.ComponentType<{ className?: string }>; panel?: WorkspacePanel; preview?: boolean };
const GROUPS: { label?: string; items: NavItem[] }[] = [
  { items: [{ name: 'Assistant', href: '/', icon: Sparkles }] },
  { label: 'Business', items: [
    { name: 'Orders', href: '/orders', icon: ClipboardList, panel: ordersPanel() },
    { name: 'Receivables', href: '/receivables', icon: Wallet, panel: receivablesPanel },
    { name: 'Stock', href: '/stock', icon: Boxes, panel: stockPanel, preview: true },
    { name: 'GST', href: '/gst', icon: Landmark, panel: gstPanel, preview: true },
  ] },
  { label: 'Export', items: [
    { name: 'New Shipment', href: '/shipments/new', icon: Upload, panel: newShipmentPanel },
    { name: 'Shipment History', href: '/shipments', icon: History, panel: historyPanel },
    { name: 'Trade Advisor', href: '/advisor', icon: MessageSquare },
  ] },
  { items: [{ name: 'Settings', href: '/settings', icon: Settings }] },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  if (href === '/shipments') return pathname === '/shipments' || (pathname.startsWith('/shipments/') && pathname !== '/shipments/new');
  if (href === '/orders') return pathname === '/orders' || pathname.startsWith('/orders/');
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const { profile } = useCompany();
  const { openPanel, activePanel } = useWorkspace();
  const onChat = pathname === '/' || pathname === '/advisor';

  return (
    <aside id="workspace-navigation" className={cn('fixed inset-y-0 left-0 z-30 flex w-60 shrink-0 flex-col bg-indigo-950 text-white transition-transform md:static md:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
      <div className="flex h-16 items-center border-b border-indigo-900 px-6">
        <Anchor className="mr-2 h-6 w-6 text-indigo-400" />
        <span className="text-xl font-bold tracking-tight">ShipSure</span>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4" aria-label="Main">
        {GROUPS.map((group, gi) => <div key={gi} className="space-y-1">
          {group.label && <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-indigo-400">{group.label}</p>}
          {group.items.map(item => {
            const inPanel = onChat && item.panel && activePanel?.kind === item.panel.kind;
            const active = inPanel || (!onChat || !item.panel ? isActive(pathname, item.href) : false);
            return <Link key={item.name} href={item.href} aria-current={active ? 'page' : undefined}
              onClick={event => {
                if (onChat && item.panel) { event.preventDefault(); openPanel(item.panel); }
                onNavigate();
              }}
              className={cn('group flex items-center rounded-md px-3 py-2 text-sm font-medium', active ? 'bg-indigo-900 text-white' : 'text-indigo-200 hover:bg-indigo-800 hover:text-white')}>
              <item.icon className={cn('mr-3 h-5 w-5 flex-shrink-0', active ? 'text-white' : 'text-indigo-300 group-hover:text-white')} aria-hidden="true" />
              {item.name}
              {item.preview && <span className="ml-auto rounded bg-amber-300/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-200">Preview</span>}
            </Link>;
          })}
        </div>)}
      </nav>
      <div className="border-t border-indigo-900 px-6 py-5"><p className="truncate text-sm font-medium">{profile?.name}</p><p className="mt-1 text-xs text-indigo-300">Your company workspace</p></div>
    </aside>
  );
}
