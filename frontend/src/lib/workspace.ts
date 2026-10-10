import type { Shipment } from './types';

export type WorkspacePanel = { key: string; kind: 'new' | 'history' | 'shipment'; title: string; shipmentId?: string };
export type WorkspaceMessage = { id: string; role: 'user' | 'assistant'; content: string; citations?: string[]; panel?: WorkspacePanel; retryPrompt?: string };

export const newShipmentPanel: WorkspacePanel = { key: 'new', kind: 'new', title: 'New Shipment' };
export const historyPanel: WorkspacePanel = { key: 'history', kind: 'history', title: 'Shipment History' };
export function shipmentPanel(shipment: Shipment): WorkspacePanel {
  return { key: shipment.id, kind: 'shipment', shipmentId: shipment.id, title: shipment.extractedData?.invoiceNumber || shipment.filename };
}

export function shipmentIntent(text: string): 'new' | 'history' | 'shipment' | 'settings' | null {
  const query = text.toLowerCase();
  if (/\b(company|settings|profile)\b/.test(query) && /\b(open|show|edit|update|change)\b/.test(query)) return 'settings';
  if (/\b(create|new|upload|add|start)\b/.test(query) && /\b(shipment|invoice|compliance)\b/.test(query)) return 'new';
  if (/\b(history|all shipments|my shipments|recent shipments|list shipments)\b/.test(query)) return 'history';
  const recordRequest = /\b(open|show|view|details|status|latest|recent|last|my|this|its)\b/.test(query);
  if ((recordRequest && /\b(shipment|invoice|risk report)\b/.test(query)) || /\b(this|its)\b.*\b(compliance|status|documents|details|forms)\b/.test(query) || /\b(shipped|delivered|dispatch date|delivery date)\b/.test(query)) return 'shipment';
  return null;
}

export function newestShipments(shipments: Shipment[]) {
  return [...shipments].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export function summarizeShipment(shipment: Shipment) {
  const data = shipment.extractedData;
  const created = new Date(shipment.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return [
    `${data?.invoiceNumber || shipment.filename} was uploaded on ${created}. Analysis status: ${shipment.status}.`,
    data?.buyerName ? `Buyer: ${data.buyerName}${data.buyerCountry ? ` (${data.buyerCountry})` : ''}.` : '',
    data?.currency ? `Invoice value: ${data.currency} ${data.totalValue.toLocaleString('en-IN')}.` : '',
    shipment.riskReport ? `Compliance risk: ${shipment.riskReport.overallScore}.${shipment.riskReport.analysisSummary ? ` ${shipment.riskReport.analysisSummary}` : ''}` : '',
    shipment.status === 'error' ? 'Analysis failed. Open the shipment or upload the invoice again.' : '',
  ].filter(Boolean).join('\n');
}
