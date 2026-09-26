'use client';

import { usePathname } from 'next/navigation';

export function Header() {
  const pathname = usePathname();
  
  const getPageTitle = () => {
    if (pathname === '/') return 'Dashboard';
    if (pathname === '/advisor') return 'Trade Advisor';
    if (pathname === '/shipments/new') return 'New Shipment';
    if (pathname === '/shipments') return 'Shipment History';
    if (pathname === '/settings') return 'Settings';
    if (pathname?.startsWith('/shipments/')) return 'Shipment Details';
    return 'ShipSure';
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-x-4 border-b border-slate-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex flex-1 items-center">
          <h1 className="text-2xl font-semibold leading-7 text-slate-900">{getPageTitle()}</h1>
        </div>
      </div>
    </header>
  );
}
