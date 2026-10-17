'use client';

import { Anchor, FileCheck2, MessageSquare, Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CompanyProfileForm } from './CompanyProfileForm';

export function Onboarding() {
  const router = useRouter();
  return <div className="min-h-dvh bg-slate-50 px-5 py-8 sm:px-8">
    <header className="mx-auto flex max-w-5xl items-center gap-2 text-xl font-semibold text-indigo-950"><Anchor className="size-6 text-indigo-600" />ShipSure</header>
    <main className="mx-auto mt-10 grid max-w-5xl gap-10 lg:grid-cols-[.8fr_1.2fr] lg:gap-16">
      <aside className="lg:pt-10"><p className="text-sm font-medium text-indigo-600">Welcome to your workspace</p><h1 className="mt-4 max-w-sm text-4xl font-semibold leading-tight tracking-tight text-indigo-950">Start with your<br />company details.</h1><p className="mt-5 max-w-sm text-sm leading-7 text-slate-500">Set up your profile once. ShipSure uses it across shipment analysis, compliance and export documents.</p><ul className="mt-8 space-y-4 text-sm text-slate-600"><li className="flex items-center gap-3"><MessageSquare className="size-5 text-indigo-500" />Ask questions in one conversation</li><li className="flex items-center gap-3"><Package className="size-5 text-indigo-500" />Open shipment details as you work</li><li className="flex items-center gap-3"><FileCheck2 className="size-5 text-indigo-500" />Prepare documents with your company profile</li></ul><p className="mt-8 text-xs text-slate-500">You can update these details in Settings.</p></aside>
      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8"><CompanyProfileForm onboarding onComplete={() => router.replace('/')} /></div>
    </main>
  </div>;
}
