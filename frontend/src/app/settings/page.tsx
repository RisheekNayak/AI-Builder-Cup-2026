'use client';
import { useEffect, useState } from 'react';
import { getCompanyProfile, saveCompanyProfile } from '@/lib/api';
import { CompanyProfile } from '@/lib/types';
import { CheckCircle } from 'lucide-react';

export default function Settings() {
  const [profile, setProfile] = useState<CompanyProfile>({
    name: '', iec: '', gstin: '', pan: '', adCode: '', factoryAddress: '', stateCode: '', portOfLoading: '', authorizedSignatory: '', signatoryDesignation: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const p = await getCompanyProfile();
        if (p) setProfile(p);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
    setSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveCompanyProfile(profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Loading settings...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white shadow-sm rounded-lg border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-200">
          <h3 className="text-lg leading-6 font-medium text-slate-900">Company Profile</h3>
          <p className="mt-1 text-sm text-slate-500">Information used for automatic form generation.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Company Name</label>
              <input type="text" name="name" value={profile.name || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700">IEC Code</label>
              <input type="text" name="iec" value={profile.iec || ''} onChange={handleChange} maxLength={10} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700">GSTIN</label>
              <input type="text" name="gstin" value={profile.gstin || ''} onChange={handleChange} maxLength={15} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700">PAN</label>
              <input type="text" name="pan" value={profile.pan || ''} onChange={handleChange} maxLength={10} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700">AD Code</label>
              <input type="text" name="adCode" value={profile.adCode || ''} onChange={handleChange} maxLength={14} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Factory / Registered Address</label>
              <textarea name="factoryAddress" rows={3} value={profile.factoryAddress || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700">State Code</label>
              <input type="text" name="stateCode" value={profile.stateCode || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700">Port of Loading</label>
              <input type="text" name="portOfLoading" value={profile.portOfLoading || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700">Authorized Signatory</label>
              <input type="text" name="authorizedSignatory" value={profile.authorizedSignatory || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700">Signatory Designation</label>
              <input type="text" name="signatoryDesignation" value={profile.signatoryDesignation || ''} onChange={handleChange} className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
          </div>
          
          <div className="flex items-center justify-end space-x-4 pt-4 border-t border-slate-200">
            {saved && (
              <span className="flex items-center text-sm text-green-600">
                <CheckCircle className="w-4 h-4 mr-1" /> Saved successfully
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
