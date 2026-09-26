import { Shipment, RiskReport, GeneratedForm, ChatMessage, CompanyProfile } from './types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export async function uploadInvoice(file: File): Promise<Shipment> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${BASE_URL}/shipments`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error('Failed to upload invoice');
  return response.json();
}

export async function getShipment(id: string): Promise<Shipment> {
  const response = await fetch(`${BASE_URL}/shipments/${id}`);
  if (!response.ok) throw new Error('Failed to fetch shipment');
  return response.json();
}

export async function getShipments(): Promise<Shipment[]> {
  const response = await fetch(`${BASE_URL}/shipments`);
  if (!response.ok) throw new Error('Failed to fetch shipments');
  return response.json();
}

export async function getRiskReport(shipmentId: string): Promise<RiskReport> {
  const response = await fetch(`${BASE_URL}/shipments/${shipmentId}/risk-report`);
  if (!response.ok) throw new Error('Failed to fetch risk report');
  return response.json();
}

export async function generateForms(shipmentId: string): Promise<GeneratedForm[]> {
  const response = await fetch(`${BASE_URL}/shipments/${shipmentId}/forms`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to generate forms');
  return response.json();
}

export async function sendAdvisorMessage(message: string, history: ChatMessage[]): Promise<ChatMessage> {
  const response = await fetch(`${BASE_URL}/advisor/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });
  if (!response.ok) throw new Error('Failed to send message');
  return response.json();
}

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const response = await fetch(`${BASE_URL}/settings/profile`);
  if (!response.ok) throw new Error('Failed to fetch company profile');
  return response.json();
}

export async function saveCompanyProfile(profile: CompanyProfile): Promise<CompanyProfile> {
  const response = await fetch(`${BASE_URL}/settings/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (!response.ok) throw new Error('Failed to save company profile');
  return response.json();
}
