'use client';
import { useEffect, useState } from 'react';
import { FileText, AlertTriangle, ShieldCheck, Download, } from 'lucide-react';
import { getShipment, getExtractedData, getRiskReport, generateForms, listForms, getFormDownloadUrl } from '@/lib/api';
import { Shipment, ExtractedData, RiskReport } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ErrorState, LoadingState, errorMessage } from '@/components/ui/Feedback';

export function ShipmentDetails({ id }: { id: string }) {
  
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [data, setData] = useState<ExtractedData | null>(null);
  const [risk, setRisk] = useState<RiskReport | null>(null);
  const [forms, setForms] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [formsReady, setFormsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [s, d, r, f] = await Promise.all([getShipment(id), getExtractedData(id), getRiskReport(id), listForms(id)]);
        if (!cancelled) { setShipment(s); setData(d); setRisk(r.riskReport); setForms(f); setError(null); }
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, 'Could not load shipment details.'));
      } finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [id, attempt]);

  const handleGenerateForms = async () => {
    setGenerating(true);
    setError(null);
    try {
      await generateForms(id);
      const f = await listForms(id);
      setForms(f);
      setFormsReady(true);
    } catch (err) {
      setError(errorMessage(err, 'Could not generate forms. Please try again.'));
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <LoadingState label="Loading shipment details…" />;
  if (!shipment) return <ErrorState message={error || 'Shipment not found.'} onRetry={() => { setLoading(true); setAttempt(value => value + 1); }} />;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {error && <ErrorState message={error} />}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">
          Shipment: {data?.invoiceNumber || shipment.filename}
        </h2>
        <span className="px-3 py-1 rounded-full text-sm font-medium bg-slate-100 text-slate-800 capitalize">
          {shipment.status}
        </span>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
        <div className="2xl:col-span-2 space-y-6">
          {/* Extracted Data */}
          <div className="bg-white shadow-sm rounded-lg border border-slate-200 p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-indigo-500" />
              Extracted Invoice Data
            </h3>
            
            {data ? (
              <>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-6 mb-6">
                  <div><dt className="text-sm font-medium text-slate-500">Invoice Date</dt><dd className="mt-1 text-sm text-slate-900">{data.invoiceDate}</dd></div>
                  <div><dt className="text-sm font-medium text-slate-500">Total Value</dt><dd className="mt-1 text-sm text-slate-900">{data.currency} {data.totalValue}</dd></div>
                  <div><dt className="text-sm font-medium text-slate-500">Seller</dt><dd className="mt-1 text-sm text-slate-900">{data.sellerName} ({data.sellerCountry})</dd></div>
                  <div><dt className="text-sm font-medium text-slate-500">Buyer</dt><dd className="mt-1 text-sm text-slate-900">{data.buyerName} ({data.buyerCountry})</dd></div>
                  <div><dt className="text-sm font-medium text-slate-500">Port of Loading</dt><dd className="mt-1 text-sm text-slate-900">{data.portOfLoading}</dd></div>
                  <div><dt className="text-sm font-medium text-slate-500">Port of Discharge</dt><dd className="mt-1 text-sm text-slate-900">{data.portOfDischarge}</dd></div>
                </dl>
                
                <h4 className="text-sm font-medium text-slate-900 mb-2">Line Items</h4>
                <div className="overflow-x-auto border border-slate-200 rounded-md">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Desc</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">HS Code</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Qty</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Price</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {data.lineItems?.map((item, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 text-sm text-slate-900">{item.description}</td>
                          <td className="px-4 py-2 text-sm text-slate-500">{item.hsCode}</td>
                          <td className="px-4 py-2 text-sm text-slate-500 text-right">{item.quantity}</td>
                          <td className="px-4 py-2 text-sm text-slate-500 text-right">{item.unitPrice}</td>
                          <td className="px-4 py-2 text-sm text-slate-900 text-right">{item.totalValue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">No data extracted yet.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Risk Assessment */}
          <div className="bg-white shadow-sm rounded-lg border border-slate-200 p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4 flex items-center">
              <ShieldCheck className="h-5 w-5 mr-2 text-indigo-500" />
              Risk Assessment
            </h3>
            
            {risk ? (
              <div>
                {risk.analysisSummary && <p className="mb-4 text-sm leading-6 text-slate-600">{risk.analysisSummary}</p>}
                {risk.dutySavings && <p className="mb-4 text-sm text-green-700">Duty savings: {risk.dutySavings}</p>}
                <div className="flex items-center justify-between mb-6 p-4 rounded-lg bg-slate-50">
                  <span className="text-sm font-medium text-slate-700">Overall Score</span>
                  <span className={cn(
                    "text-2xl font-bold uppercase",
                    risk.overallScore === 'low' ? "text-green-600" :
                    risk.overallScore === 'medium' ? "text-yellow-600" : "text-red-600"
                  )}>
                    {risk.overallScore}
                  </span>
                </div>
                
                <div className="space-y-4">
                  {risk.flags?.map((flag, i) => (
                    <div key={i} className={cn(
                      "p-3 rounded-md border text-sm",
                      flag.severity === 'high' || flag.severity === 'critical' ? "bg-red-50 border-red-200" :
                      flag.severity === 'medium' ? "bg-yellow-50 border-yellow-200" : "bg-blue-50 border-blue-200"
                    )}>
                      <div className="flex font-medium mb-1">
                        <AlertTriangle className={cn("h-4 w-4 mr-2", 
                          flag.severity === 'high' || flag.severity === 'critical' ? "text-red-500" :
                          flag.severity === 'medium' ? "text-yellow-500" : "text-blue-500"
                        )} />
                        <span className={cn(
                          flag.severity === 'high' || flag.severity === 'critical' ? "text-red-800" :
                          flag.severity === 'medium' ? "text-yellow-800" : "text-blue-800"
                        )}>{flag.title}</span>
                      </div>
                      <p className="text-slate-600 ml-6 mb-2">{flag.description}</p>
                      {flag.policyCitation && <p className="mb-2 ml-6 text-xs text-slate-500">Source: {flag.policyCitation}</p>}
                      {flag.recommendation && (
                        <p className="text-xs ml-6 font-medium text-slate-700">Rec: {flag.recommendation}</p>
                      )}
                    </div>
                  ))}
                  {(!risk.flags || risk.flags.length === 0) && (
                    <p className="text-sm text-green-600 flex items-center"><ShieldCheck className="w-4 h-4 mr-1"/> No risks detected.</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Risk report pending...</p>
            )}
          </div>

          {/* Forms Panel */}
          <div className="bg-white shadow-sm rounded-lg border border-slate-200 p-6">
            <h3 className="text-lg font-medium text-slate-900 mb-4 flex items-center">
              <Download className="h-5 w-5 mr-2 text-indigo-500" />
              Customs Forms
            </h3>
            
            {formsReady && forms.length > 0 ? (
              <ul className="space-y-2 mb-4">
                {forms.map(form => (
                  <li key={form.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded border border-slate-100">
                    <span className="text-sm font-medium text-slate-700">{form.name}</span>
                    <a href={getFormDownloadUrl(id, form.id)} aria-label={`Download ${form.name}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 p-1">
                      <Download className="h-4 w-4" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 mb-4">No forms generated yet.</p>
            )}
            
            <button
              onClick={handleGenerateForms}
              disabled={generating || shipment.status !== 'complete'}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            >
              {generating ? 'Generating...' : formsReady ? 'Regenerate Forms' : 'Generate Forms'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
