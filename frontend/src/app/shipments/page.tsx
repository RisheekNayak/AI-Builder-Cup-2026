'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getShipments } from '@/lib/api';
import { Shipment } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ArrowRight } from 'lucide-react';

export default function ShipmentHistory() {
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

  return (
    <div className="space-y-6">
      <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-500">Loading history...</div>
        ) : shipments.length === 0 ? (
          <div className="p-10 text-center text-slate-500">No shipments found.</div>
        ) : (
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Invoice #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Destination</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Risk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {shipments.map((shipment) => (
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
