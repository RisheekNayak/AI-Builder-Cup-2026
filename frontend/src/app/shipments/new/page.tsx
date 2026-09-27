'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, File, AlertCircle } from 'lucide-react';
import { uploadInvoice } from '@/lib/api';
import { cn } from '@/lib/utils';

export default function NewShipment() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setError('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await uploadInvoice(file);
      router.push(`/shipments/${res.shipment_id}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Upload failed');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
        <h2 className="text-lg font-medium text-slate-900 mb-4">Upload Invoice</h2>
        
        <div 
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-md transition-colors",
            isDragging ? "border-indigo-500 bg-indigo-50" : "border-slate-300 hover:border-slate-400",
            loading && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="space-y-1 text-center">
            {file ? (
              <File className="mx-auto h-12 w-12 text-indigo-500" />
            ) : (
              <Upload className="mx-auto h-12 w-12 text-slate-400" />
            )}
            <div className="flex text-sm text-slate-600 justify-center">
              <label htmlFor="file-upload" className="relative cursor-pointer bg-transparent rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500">
                <span>{file ? 'Change file' : 'Upload a file'}</span>
                <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleChange} accept=".pdf,.json,.png,.jpg,.jpeg" disabled={loading} />
              </label>
              {!file && <p className="pl-1">or drag and drop</p>}
            </div>
            <p className="text-xs text-slate-500">
              {file ? file.name : 'PDF, JSON, PNG, JPG up to 10MB'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Analyze Invoice'}
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <h3 className="text-sm font-medium text-slate-900 mb-4">Progress</h3>
          <div className="flex items-center space-x-4">
            <div className="flex-1 bg-slate-200 rounded-full h-2">
              <div className="bg-indigo-600 h-2 rounded-full w-1/3 animate-pulse"></div>
            </div>
            <span className="text-xs font-medium text-slate-500">Extracting...</span>
          </div>
        </div>
      )}
    </div>
  );
}
