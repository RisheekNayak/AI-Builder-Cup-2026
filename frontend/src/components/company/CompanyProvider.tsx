'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { CompanyProfile } from '@/lib/types';
import { getCompanyProfile, saveCompanyProfile } from '@/lib/api';
import { normalizeCompanyProfile } from '@/lib/company-profile';
import { errorMessage } from '@/components/ui/Feedback';

type CompanyContextValue = {
  profile: CompanyProfile | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
  save: (profile: CompanyProfile) => Promise<void>;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCompanyProfile().then(value => {
      if (!cancelled) { setProfile(value); setError(null); }
    }).catch(err => {
      if (!cancelled) setError(errorMessage(err, 'Could not load your company profile.'));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attempt]);

  const save = useCallback(async (value: CompanyProfile) => {
    const normalized = normalizeCompanyProfile(value);
    await saveCompanyProfile(normalized);
    setProfile(normalized);
  }, []);

  function retry() { setLoading(true); setAttempt(value => value + 1); }

  return <CompanyContext.Provider value={{ profile, loading, error, retry, save }}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) throw new Error('useCompany must be used within CompanyProvider');
  return context;
}
