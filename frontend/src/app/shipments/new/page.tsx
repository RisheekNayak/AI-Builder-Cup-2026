'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, FileText, CheckCircle2, ChevronRight } from 'lucide-react';

export default function NewShipmentPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState(1);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleAnalyze = () => {
    if (!file) return;
    setStep(2);
    // Simulate processing steps
    setTimeout(() => setStep(3), 1500);
    setTimeout(() => {
      setStep(4);
      // Simulate navigation to a real ID
      setTimeout(() => router.push('/shipments/123'), 500);
    }, 3000);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {['Upload', 'Extract', 'Analyze', 'Complete'].map((label, idx) => (
            <div key={label} className="flex flex-col items-center">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${step > idx ? 'bg-indigo-600 border-indigo-600 text-white' : step === idx + 1 ? 'border-indigo-600 text-indigo-600' : 'border-slate-300 text-slate-400'}`}>
                {step > idx + 1 ? <CheckCircle2 className="h-6 w-6" /> : (idx + 1)}
              </div>
              <span className={`mt-2 text-sm font-medium ${step >= idx + 1 ? 'text-indigo-600' : 'text-slate-500'}`}>{label}</span>
            </div>
          ))}
        </div>
        <div className="relative mt-[-2rem] flex items-center px-5">
            <div className="absolute top-1/2 -z-10 h-0.5 w-[calc(100%-2.5rem)] bg-slate-200">
               <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${(step - 1) * 33.33}%` }} />
            </div>
        </div>
      </div>

      {step === 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors ${
              isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:bg-slate-50'
            }`}
          >
            <UploadCloud className="h-16 w-16 text-slate-400" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">Drop your invoice here</h3>
            <p className="mt-2 text-sm text-slate-500">Supports PDF, PNG, JPG up to 10MB</p>
            <label className="mt-6 cursor-pointer rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500">
              Browse Files
              <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileChange} />
            </label>
          </div>

          {file && (
            <div className="mt-6 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-4">
                <FileText className="h-8 w-8 text-indigo-500" />
                <div>
                  <p className="text-sm font-medium text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <button
                onClick={handleAnalyze}
                className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
              >
                Analyze Invoice
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {step > 1 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-16 shadow-sm">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <div className="absolute h-full w-full animate-ping rounded-full bg-indigo-200 opacity-75"></div>
            <UploadCloud className="relative h-12 w-12 text-indigo-600" />
          </div>
          <h3 className="mt-6 text-xl font-semibold text-slate-900">
            {step === 2 ? 'Extracting Data...' : step === 3 ? 'Analyzing Compliance Risks...' : 'Complete!'}
          </h3>
          <p className="mt-2 text-slate-500">
            Our AI is reading your invoice and checking it against trade regulations.
          </p>
        </div>
      )}
    </div>
  );
}
