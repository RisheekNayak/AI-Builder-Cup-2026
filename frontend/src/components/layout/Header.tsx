'use client';
import { usePathname } from 'next/navigation';

export function Header() {
  const pathname = usePathname();
  
  let title = 'Dashboard';
  if (pathname.includes('/advisor')) title = 'Trade Advisor';
  else if (pathname.includes('/shipments/new')) title = 'New Shipment';
  else if (pathname.includes('/shipments/') && pathname !== '/shipments/new') title = 'Shipment Details';
  else if (pathname.includes('/shipments')) title = 'Shipment History';
  else if (pathname.includes('/settings')) title = 'Settings';

  return (
    <header className="bg-white border-b border-slate-200 h-16 flex items-center px-6">
      <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
    </header>
  );
}
