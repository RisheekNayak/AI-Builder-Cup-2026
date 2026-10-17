'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { CompanyProvider, useCompany } from '@/components/company/CompanyProvider';
import { Onboarding } from '@/components/company/Onboarding';
import { isCompanyComplete } from '@/lib/company-profile';
import { WorkspaceProvider } from '@/components/workspace/WorkspaceProvider';
import { ErrorState, LoadingState } from '@/components/ui/Feedback';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';

function Shell({ children }: { children: React.ReactNode }) {
  const { profile, loading, error, retry } = useCompany();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const chat = pathname === '/' || pathname === '/advisor';
  if (loading) return <div className="flex min-h-dvh items-center justify-center"><LoadingState label="Opening your workspace…" /></div>;
  if (error) return <div className="mx-auto flex min-h-dvh max-w-lg items-center px-5"><ErrorState message={error} onRetry={retry} /></div>;
  if (!isCompanyComplete(profile)) return <Onboarding />;
  return <WorkspaceProvider><div className="flex h-dvh overflow-hidden bg-slate-50">
    <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
    {menuOpen && <button type="button" aria-label="Close navigation" className="fixed inset-0 z-20 bg-slate-950/40 md:hidden" onClick={() => setMenuOpen(false)} />}
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden"><Header onMenuToggle={() => setMenuOpen(value => !value)} menuOpen={menuOpen} /><main id="main-content" className={cn('min-h-0 flex-1', chat ? 'overflow-hidden' : 'overflow-y-auto p-4 sm:p-6')}>{children}</main></div>
  </div></WorkspaceProvider>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return <CompanyProvider><Shell>{children}</Shell></CompanyProvider>;
}
