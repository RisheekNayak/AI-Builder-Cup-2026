'use client';

import { useParams } from 'next/navigation';
import { AlertTriangle, FileText, Download, CheckCircle, Info, ShieldAlert } from 'lucide-react';

export default function ShipmentDetailsPage() {
  const params = useParams();
  
  // Mock data for display
  const riskScore = 'high';
  
  const extractedData = {
    invoiceNumber: 'INV-2023-089',
    date: 'Oct 24, 2023',
    buyer: 'Global Tech Corp (USA)',
    seller: 'India Electronics Ltd',
    totalValue: '$45,000.00 USD',
  };

  const lineItems = [
    { hsCode: '8501.10', description: 'Electric Motors <= 37.5W', qty: 500, value: '$12,500' },
    { hsCode: '8542.31', description: 'Processors and Controllers', qty: 200, value: '$32,500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Overall Risk */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Shipment {extractedData.invoiceNumber}</h2>
          <p className="text-sm text-slate-500">Uploaded on Oct 25, 2023</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-500">Risk Assessment:</span>
          <div className="flex items-center gap-2 rounded-full bg-red-100 px-4 py-2 text-red-700">
            <ShieldAlert className="h-5 w-5" />
            <span className="font-bold uppercase tracking-wider">{riskScore} RISK</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Extracted Data */}
        <div className="lg:col-span-1 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
              <h3 className="text-lg font-semibold text-slate-900">Extracted Data</h3>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <dl className="space-y-4 text-sm text-slate-700">
                <div className="grid grid-cols-3 gap-2">
                  <dt className="font-medium text-slate-500">Invoice No:</dt>
                  <dd className="col-span-2 font-semibold">{extractedData.invoiceNumber}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="font-medium text-slate-500">Date:</dt>
                  <dd className="col-span-2">{extractedData.date}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="font-medium text-slate-500">Buyer:</dt>
                  <dd className="col-span-2">{extractedData.buyer}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="font-medium text-slate-500">Seller:</dt>
                  <dd className="col-span-2">{extractedData.seller}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="font-medium text-slate-500">Total Value:</dt>
                  <dd className="col-span-2 font-semibold text-slate-900">{extractedData.totalValue}</dd>
                </div>
              </dl>

              <div className="mt-6">
                <h4 className="mb-2 text-sm font-semibold text-slate-900">Line Items</h4>
                <div className="space-y-3">
                  {lineItems.map((item, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs">
                      <div className="flex justify-between font-semibold">
                        <span>HS: {item.hsCode}</span>
                        <span>{item.value}</span>
                      </div>
                      <div className="mt-1 text-slate-600">{item.description} (Qty: {item.qty})</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Risk & Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Risk Flags */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
              <h3 className="text-lg font-semibold text-slate-900">Compliance Flags</h3>
            </div>
            <div className="px-4 py-5 sm:p-6 space-y-4">
              <div className="flex gap-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <AlertTriangle className="h-6 w-6 shrink-0 text-red-600" />
                <div>
                  <h4 className="font-semibold text-red-900">SCOMET License Required (Critical)</h4>
                  <p className="mt-1 text-sm text-red-700">HS Code 8542.31 is classified under dual-use goods. Export requires prior authorization from DGFT.</p>
                  <p className="mt-2 text-xs font-medium text-red-800">Recommendation: Apply for SCOMET license via DGFT portal before shipping.</p>
                </div>
              </div>
              
              <div className="flex gap-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <Info className="h-6 w-6 shrink-0 text-yellow-600" />
                <div>
                  <h4 className="font-semibold text-yellow-900">US Section 301 Tariffs (Medium)</h4>
                  <p className="mt-1 text-sm text-yellow-700">Goods may be subject to additional 25% tariff under Section 301 upon entry to the US.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
              <h3 className="text-lg font-semibold text-slate-900">Customs Documents</h3>
              <button className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
                Generate Forms
              </button>
            </div>
            <div className="px-4 py-5 sm:p-6">
              <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
                <li className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-indigo-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-900">Commercial Invoice (Compliant)</p>
                      <p className="text-xs text-slate-500">Auto-generated with required declarations</p>
                    </div>
                  </div>
                  <button className="text-slate-400 hover:text-indigo-600"><Download className="h-5 w-5" /></button>
                </li>
                <li className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-slate-300" />
                    <div>
                      <p className="text-sm font-medium text-slate-500">Certificate of Origin</p>
                      <p className="text-xs text-slate-400">Requires manual generation</p>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
