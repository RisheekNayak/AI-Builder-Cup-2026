'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Anchor, LayoutDashboard, MessageSquare, Upload, History, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompany } from '@/components/company/CompanyProvider';

export function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();
  const { profile } = useCompany();

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Trade Advisor', href: '/advisor', icon: MessageSquare },
    { name: 'New Shipment', href: '/shipments/new', icon: Upload },
    { name: 'Shipment History', href: '/shipments', icon: History },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside id="workspace-navigation" className={cn('fixed inset-y-0 left-0 z-30 flex w-60 shrink-0 flex-col bg-indigo-950 text-white transition-transform md:static md:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
      <div className="flex h-16 items-center px-6 border-b border-indigo-900">
        <Anchor className="h-6 w-6 text-indigo-400 mr-2" />
        <span className="text-xl font-bold tracking-tight">ShipSure</span>
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href === '/shipments' && pathname.startsWith('/shipments/') && pathname !== '/shipments/new');
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'group flex items-center rounded-md px-3 py-2 text-sm font-medium',
                  isActive
                    ? 'bg-indigo-900 text-white'
                    : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
                )}
              >
                <item.icon
                  className={cn(
                    'mr-3 h-5 w-5 flex-shrink-0',
                    isActive ? 'text-white' : 'text-indigo-300 group-hover:text-white'
                  )}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t border-indigo-900 px-6 py-5"><p className="truncate text-sm font-medium">{profile?.name}</p><p className="mt-1 text-xs text-indigo-300">Your company workspace</p></div>
    </aside>
  );
}
