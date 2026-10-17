'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2 } from 'lucide-react';
import type { CompanyProfile } from '@/lib/types';
import { companyFieldLabels, companySteps, emptyCompanyProfile, validateCompanyProfile, type CompanyField, type ProfileErrors } from '@/lib/company-profile';
import { ErrorState, errorMessage } from '@/components/ui/Feedback';
import { useCompany } from './CompanyProvider';
import { cn } from '@/lib/utils';

const hints: Partial<Record<CompanyField, string>> = {
  name: 'As shown on your registration documents', stateCode: 'Two-digit code, e.g. 27', iec: '10 letters or digits',
  gstin: '15 letters or digits', pan: 'ABCDE1234F', adCode: '14 letters or digits', portOfLoading: 'Port code, e.g. INNSA1',
};

export function CompanyProfileForm({ onboarding = false, onComplete }: { onboarding?: boolean; onComplete?: () => void }) {
  const { profile, save } = useCompany();
  const [draft, setDraft] = useState<CompanyProfile>(() => ({ ...emptyCompanyProfile, ...profile }));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const reviewing = onboarding && step === companySteps.length;

  function update(field: CompanyField, value: string) {
    setDraft(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined }));
    setError(null); setSaved(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const validation = validateCompanyProfile(draft, onboarding && !reviewing ? companySteps[step].fields : undefined);
    setErrors(validation);
    if (Object.keys(validation).length) {
      if (reviewing) setStep(companySteps.findIndex(s => s.fields.some(field => validation[field])));
      return;
    }
    if (onboarding && !reviewing) { setStep(value => value + 1); return; }
    setSaving(true); setError(null);
    try { await save(draft); setSaved(true); onComplete?.(); }
    catch (err) { setError(errorMessage(err, 'Could not save your company profile. Your entries are still here.')); }
    finally { setSaving(false); }
  }

  const sections = onboarding && !reviewing ? [companySteps[step]] : companySteps;

  return <form onSubmit={submit} noValidate className="space-y-7">
    {onboarding && <ol aria-label="Company setup progress" className="grid grid-cols-4 gap-2">
      {[...companySteps.map(s => s.title), 'Review'].map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} className="min-w-0">
        <div className={cn('mb-2 h-1 rounded-full', index <= step ? 'bg-indigo-600' : 'bg-slate-200')} />
        <span className={cn('text-xs', index === step ? 'font-semibold text-indigo-700' : 'text-slate-500')}>{label}</span>
      </li>)}
    </ol>}
    {onboarding && <div><p className="mb-2 text-xs font-medium text-indigo-600">Step {step + 1} of 4</p><h2 className="text-2xl font-semibold tracking-tight">{reviewing ? 'Review your company profile' : companySteps[step].title}</h2><p className="mt-2 text-sm text-slate-500">{reviewing ? 'These details will be used to prepare your export documents.' : companySteps[step].description}</p></div>}
    {sections.map(section => <section key={section.title} className="space-y-4">
      {(!onboarding || reviewing) && <h3 className="border-b border-slate-200 pb-3 text-sm font-semibold text-slate-700">{section.title}</h3>}
      <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
        {section.fields.map(field => <div key={field} className={cn(['name', 'factoryAddress'].includes(field) && 'sm:col-span-2')}>
          {reviewing ? <div><p className="text-xs text-slate-500">{companyFieldLabels[field]}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{draft[field]}</p></div> : <>
            <label htmlFor={`company-${field}`} className="mb-1.5 block text-sm font-medium text-slate-700">{companyFieldLabels[field]}</label>
            {field === 'factoryAddress' ? <textarea id={`company-${field}`} value={draft[field] ?? ''} onChange={e => update(field, e.target.value)} rows={3} required disabled={saving} aria-invalid={!!errors[field]} aria-describedby={errors[field] ? `error-${field}` : undefined} className="company-input" /> : <input id={`company-${field}`} value={draft[field] ?? ''} onChange={e => update(field, e.target.value)} required disabled={saving} aria-invalid={!!errors[field]} aria-describedby={errors[field] ? `error-${field}` : hints[field] ? `hint-${field}` : undefined} maxLength={field === 'gstin' ? 15 : field === 'adCode' ? 14 : ['iec', 'pan'].includes(field) ? 10 : field === 'stateCode' ? 2 : undefined} inputMode={field === 'stateCode' ? 'numeric' : 'text'} className="company-input" />}
            {errors[field] ? <p id={`error-${field}`} className="mt-1 text-xs text-red-600">{errors[field]}</p> : hints[field] && <p id={`hint-${field}`} className="mt-1 text-xs text-slate-500">{hints[field]}</p>}
          </>}
        </div>)}
      </div>
    </section>)}
    {error && <ErrorState message={error} />}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
      <div>{onboarding && step > 0 && <button type="button" disabled={saving} onClick={() => { setStep(value => value - 1); setError(null); }} className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"><ArrowLeft className="size-4" />Back</button>}{saved && !onboarding && <span role="status" className="flex items-center gap-2 text-sm text-green-700"><CheckCircle2 className="size-4" />Profile saved</span>}</div>
      <button type="submit" disabled={saving} className="primary-button">{saving ? 'Saving…' : onboarding ? reviewing ? 'Save & open workspace' : 'Continue' : 'Save Profile'}{reviewing ? <Check className="size-4" /> : onboarding && <ArrowRight className="size-4" />}</button>
    </div>
  </form>;
}
