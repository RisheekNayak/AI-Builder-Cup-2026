'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Upload, MessageSquare, ArrowRight } from 'lucide-react';
import { getShipments } from '@/lib/api';
import { Shipment } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const router = useRouter();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getShipments();
        setShipments(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const highRiskCount = shipments.filter(s => s.riskReport?.overallScore === 'high' || s.riskReport?.overallScore === 'critical').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-500">Total Shipments</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{loading ? '-' : shipments.length}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-500">High Risk</p>
          <p className="mt-2 text-3xl font-semibold text-red-600">{loading ? '-' : highRiskCount}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-500">Forms Generated</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{loading ? '-' : shipments.filter(s => s.status === 'complete').length * 2}</p>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border border-slate-200">
          <p className="text-sm font-medium text-slate-500">Estimated Duty Saved</p>
          <p className="mt-2 text-3xl font-semibold text-green-600">$0</p>
        </div>
      </div>

      <div className="flex space-x-4">
        <Link href="/shipments/new" className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
          <Upload className="mr-2 h-4 w-4" />
          Upload Invoice
        </Link>
        <Link href="/advisor" className="inline-flex items-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50">
          <MessageSquare className="mr-2 h-4 w-4 text-indigo-600" />
          Ask TradeAdvisor
        </Link>
      </div>

      <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200">
          <h3 className="text-lg leading-6 font-medium text-slate-900">Recent Shipments</h3>
        </div>
        {loading ? (
          <div className="p-6 text-center text-slate-500">Loading...</div>
        ) : shipments.length === 0 ? (
          <div className="p-6 text-center text-slate-500">No shipments found. Upload an invoice to get started.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Invoice #</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Destination</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Risk</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="relative px-6 py-3"><span className="sr-only">View</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {shipments.slice(0, 5).map((shipment) => (
                <tr key={shipment.id} onClick={() => router.push(`/shipments/${shipment.id}`)} className="cursor-pointer hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">{shipment.extractedData?.invoiceNumber || shipment.filename}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{shipment.extractedData?.buyerCountry || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{new Date(shipment.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {shipment.riskReport ? (
                      <span className={cn(
                        "px-2 inline-flex text-xs leading-5 font-semibold rounded-full",
                        shipment.riskReport.overallScore === 'low' ? "bg-green-100 text-green-800" :
                        shipment.riskReport.overallScore === 'medium' ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
                      )}>
                        {shipment.riskReport.overallScore === 'low' ? 'Low' : shipment.riskReport.overallScore === 'medium' ? 'Medium' : 'High'}
                      </span>
                    ) : (
                      <span className="text-sm text-slate-500">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 capitalize">{shipment.status}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <ArrowRight className="h-4 w-4 text-slate-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
