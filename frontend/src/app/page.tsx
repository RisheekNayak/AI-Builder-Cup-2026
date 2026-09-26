import Link from 'next/link';
import { Upload, MessageSquare, Package, AlertTriangle, FileText, DollarSign } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-blue-100 p-3 text-blue-600">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Shipments</p>
              <p className="text-2xl font-semibold text-slate-900">0</p>
            </div>
          </div>
        </div>
        
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-red-100 p-3 text-red-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Flagged</p>
              <p className="text-2xl font-semibold text-slate-900">0</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-indigo-100 p-3 text-indigo-600">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Forms Generated</p>
              <p className="text-2xl font-semibold text-slate-900">0</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-green-100 p-3 text-green-600">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Duty Saved</p>
              <p className="text-2xl font-semibold text-slate-900">₹0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link 
          href="/shipments/new"
          className="group relative flex items-center gap-4 rounded-xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm transition-all hover:bg-indigo-100 hover:shadow-md"
        >
          <div className="rounded-full bg-indigo-200 p-4 text-indigo-700 transition-transform group-hover:scale-110">
            <Upload className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-indigo-900">New Shipment</h3>
            <p className="text-sm text-indigo-700">Upload an invoice for automated compliance check</p>
          </div>
        </Link>

        <Link 
          href="/advisor"
          className="group relative flex items-center gap-4 rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm transition-all hover:bg-blue-100 hover:shadow-md"
        >
          <div className="rounded-full bg-blue-200 p-4 text-blue-700 transition-transform group-hover:scale-110">
            <MessageSquare className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-blue-900">Trade Advisor</h3>
            <p className="text-sm text-blue-700">Chat with AI for regulatory compliance queries</p>
          </div>
        </Link>
      </div>

      {/* Recent Shipments */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Recent Shipments</h2>
        </div>
        <div className="flex flex-col items-center justify-center p-12 text-center">
          <Package className="h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-lg font-medium text-slate-900">No shipments found</h3>
          <p className="mt-2 text-sm text-slate-500">Get started by uploading your first commercial invoice.</p>
          <Link
            href="/shipments/new"
            className="mt-6 inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Invoice
          </Link>
        </div>
      </div>
    </div>
  );
}
