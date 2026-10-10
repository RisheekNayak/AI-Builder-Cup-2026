import type { CompanyProfile } from './types';

export const emptyCompanyProfile: CompanyProfile = {
  name: '', iec: '', gstin: '', pan: '', adCode: '', factoryAddress: '',
  stateCode: '', portOfLoading: '', authorizedSignatory: '', signatoryDesignation: '',
};

export type CompanyField = keyof typeof emptyCompanyProfile;
export type ProfileErrors = Partial<Record<CompanyField, string>>;

export const companySteps: { title: string; description: string; fields: CompanyField[] }[] = [
  { title: 'Company details', description: 'Tell us about your company and its registered location.', fields: ['name', 'factoryAddress', 'stateCode'] },
  { title: 'Registrations', description: 'Add the identifiers used on your export documents.', fields: ['iec', 'gstin', 'pan', 'adCode'] },
  { title: 'Shipping & signatory', description: 'Set your loading port and authorized signatory.', fields: ['portOfLoading', 'authorizedSignatory', 'signatoryDesignation'] },
];

export const companyFieldLabels: Partial<Record<CompanyField, string>> = {
  name: 'Company name', factoryAddress: 'Factory / registered address', stateCode: 'State code',
  iec: 'IEC code', gstin: 'GSTIN', pan: 'PAN', adCode: 'AD code',
  portOfLoading: 'Port of loading', authorizedSignatory: 'Authorized signatory', signatoryDesignation: 'Signatory designation',
};

export function validateCompanyProfile(profile: CompanyProfile, fields = companySteps.flatMap(step => step.fields)): ProfileErrors {
  const errors: ProfileErrors = {};
  const patterns: Partial<Record<CompanyField, { pattern: RegExp; message: string }>> = {
    iec: { pattern: /^[A-Z0-9]{10}$/i, message: 'Enter 10 letters or digits.' },
    gstin: { pattern: /^[A-Z0-9]{15}$/i, message: 'Enter 15 letters or digits.' },
    pan: { pattern: /^[A-Z]{5}[0-9]{4}[A-Z]$/i, message: 'Use the format ABCDE1234F.' },
    adCode: { pattern: /^[A-Z0-9]{14}$/i, message: 'Enter 14 letters or digits.' },
    stateCode: { pattern: /^\d{2}$/, message: 'Enter a two-digit state code.' },
  };
  for (const field of fields) {
    const value = String(profile[field] ?? '').trim();
    if (!value) errors[field] = `${companyFieldLabels[field]} is required.`;
    else if (patterns[field] && !patterns[field]!.pattern.test(value)) errors[field] = patterns[field]!.message;
  }
  return errors;
}

export function normalizeCompanyProfile(profile: CompanyProfile): CompanyProfile {
  const result = { ...profile };
  for (const step of companySteps) for (const field of step.fields) {
    const value = String(profile[field] ?? '').trim();
    Object.assign(result, { [field]: ['iec', 'gstin', 'pan', 'adCode', 'portOfLoading'].includes(field) ? value.toUpperCase() : value });
  }
  return result;
}

export function isCompanyComplete(profile: CompanyProfile | null) {
  return !!profile && Object.keys(validateCompanyProfile(profile)).length === 0;
}
