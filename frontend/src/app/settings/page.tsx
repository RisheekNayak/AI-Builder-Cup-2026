'use client';

import { CompanyProfileForm } from '@/components/company/CompanyProfileForm';

export default function Settings() {
  return <div className="mx-auto max-w-3xl"><div className="mb-6"><h2 className="text-2xl font-semibold tracking-tight">Company Profile</h2><p className="mt-2 text-sm text-slate-500">Information used for shipment analysis and export documents.</p></div><div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8"><CompanyProfileForm /></div></div>;
}
