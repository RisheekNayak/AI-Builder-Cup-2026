'use client';

import Link from 'next/link';
import { Package, ChevronRight } from 'lucide-react';

export default function ShipmentsHistoryPage() {
  const shipments = [
    { id: '1', invoice: 'INV-2023-089', destination: 'USA', date: '2023-10-24', score: 'High', status: 'Requires Action' },
    { id: '2', invoice: 'INV-2023-088', destination: 'UAE', date: '2023-10-21', score: 'Low', status: 'Complete' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">All Shipments</h2>
        <Link
          href="/shipments/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          New Shipment
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {shipments.length > 0 ? (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Invoice</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Destination</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Risk Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Status</th>
                <th className="relative px-6 py-3"><span className="sr-only">View</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {shipments.map((shipment) => (
                <tr key={shipment.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">{shipment.invoice}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">{shipment.destination}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">{shipment.date}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                      shipment.score === 'High' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {shipment.score}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">{shipment.status}</td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                    <Link href={`/shipments/${shipment.id}`} className="text-indigo-600 hover:text-indigo-900">
                      View<span className="sr-only">, {shipment.invoice}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <Package className="h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-medium text-slate-900">No shipments found</h3>
            <p className="mt-2 text-sm text-slate-500">Upload an invoice to start your first compliance check.</p>
          </div>
        )}
      </div>
    </div>
  );
}
