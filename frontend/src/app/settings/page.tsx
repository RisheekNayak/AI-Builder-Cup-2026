'use client';

import { useState } from 'react';
import { Save, Loader2, CheckCircle2 } from 'lucide-react';
import { CompanyProfile } from '@/lib/types';

export default function SettingsPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [formData, setFormData] = useState<CompanyProfile>({
    iec: '',
    gstin: '',
    pan: '',
    adCode: '',
    factoryAddress: '',
    stateCode: '',
    portOfLoading: '',
    authorizedSignatory: '',
    signatoryDesignation: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API save
    setTimeout(() => {
      setIsLoading(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 1000);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Company Profile</h2>
          <p className="mt-1 text-sm text-slate-500">
            This information is used to automatically populate your customs documents and verify compliance.
          </p>
        </div>

        {showSuccess && (
          <div className="mt-4 flex items-center gap-2 rounded-md bg-green-50 p-4 text-green-800">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <p className="text-sm font-medium">Settings saved successfully.</p>
          </div>
        )}

        <form onSubmit={handleSave} className="mt-8 space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="iec" className="block text-sm font-medium text-slate-700">IEC (Import Export Code)</label>
              <input type="text" name="iec" id="iec" value={formData.iec} onChange={handleChange} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label htmlFor="gstin" className="block text-sm font-medium text-slate-700">GSTIN</label>
              <input type="text" name="gstin" id="gstin" value={formData.gstin} onChange={handleChange} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label htmlFor="pan" className="block text-sm font-medium text-slate-700">PAN</label>
              <input type="text" name="pan" id="pan" value={formData.pan} onChange={handleChange} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label htmlFor="adCode" className="block text-sm font-medium text-slate-700">AD Code</label>
              <input type="text" name="adCode" id="adCode" value={formData.adCode} onChange={handleChange} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="factoryAddress" className="block text-sm font-medium text-slate-700">Factory / Registered Address</label>
              <textarea name="factoryAddress" id="factoryAddress" rows={3} value={formData.factoryAddress} onChange={handleChange} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label htmlFor="stateCode" className="block text-sm font-medium text-slate-700">State Code</label>
              <input type="text" name="stateCode" id="stateCode" value={formData.stateCode} onChange={handleChange} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label htmlFor="portOfLoading" className="block text-sm font-medium text-slate-700">Default Port of Loading</label>
              <input type="text" name="portOfLoading" id="portOfLoading" value={formData.portOfLoading} onChange={handleChange} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label htmlFor="authorizedSignatory" className="block text-sm font-medium text-slate-700">Authorized Signatory Name</label>
              <input type="text" name="authorizedSignatory" id="authorizedSignatory" value={formData.authorizedSignatory} onChange={handleChange} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
            <div>
              <label htmlFor="signatoryDesignation" className="block text-sm font-medium text-slate-700">Signatory Designation</label>
              <input type="text" name="signatoryDesignation" id="signatoryDesignation" value={formData.signatoryDesignation} onChange={handleChange} className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 rounded-md bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
