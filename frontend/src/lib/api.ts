import { Shipment, RiskReport, CompanyProfile, ExtractedData } from './types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ============ Upload ============
export async function uploadInvoice(file: File): Promise<{ shipment_id: string; status: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${BASE_URL}/api/upload/`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error('Failed to upload invoice');
  return response.json();
}

// ============ Shipments ============
export async function getShipments(): Promise<Shipment[]> {
  const response = await fetch(`${BASE_URL}/api/upload/shipments`);
  if (!response.ok) throw new Error('Failed to fetch shipments');
  const data = await response.json();
  return (data.shipments || []).map(mapShipment);
}

export async function getShipment(id: string): Promise<Shipment> {
  const response = await fetch(`${BASE_URL}/api/upload/shipments/${id}`);
  if (!response.ok) throw new Error('Failed to fetch shipment');
  const data = await response.json();
  return mapShipment(data);
}

// ============ Extraction ============
export async function getExtractedData(shipmentId: string): Promise<ExtractedData | null> {
  const response = await fetch(`${BASE_URL}/api/extraction/${shipmentId}`);
  if (!response.ok) throw new Error('Failed to fetch extracted data');
  const data = await response.json();
  return data.extracted_data ? mapExtractedData(data.extracted_data) : null;
}

// ============ Compliance ============
export async function getRiskReport(shipmentId: string): Promise<{ status: string; riskReport: RiskReport | null }> {
  const response = await fetch(`${BASE_URL}/api/compliance/${shipmentId}/risk-report`);
  if (!response.ok) throw new Error('Failed to fetch risk report');
  const data = await response.json();
  return {
    status: data.status,
    riskReport: data.risk_report ? mapRiskReport(data.risk_report) : null,
  };
}

// ============ Forms ============
export async function generateForms(shipmentId: string): Promise<{ status: string }> {
  const response = await fetch(`${BASE_URL}/api/forms/${shipmentId}/generate`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error('Failed to generate forms');
  return response.json();
}

export async function listForms(shipmentId: string): Promise<{ id: string; name: string }[]> {
  const response = await fetch(`${BASE_URL}/api/forms/${shipmentId}/forms`);
  if (!response.ok) throw new Error('Failed to list forms');
  const data = await response.json();
  return data.forms || [];
}

export function getFormDownloadUrl(shipmentId: string, formId: string): string {
  return `${BASE_URL}/api/forms/${shipmentId}/forms/${formId}/download`;
}

// ============ Advisor ============
export async function sendAdvisorMessage(message: string): Promise<{ reply: string; sources: string[] }> {
  const response = await fetch(`${BASE_URL}/api/advisor/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!response.ok) throw new Error('Failed to send message');
  return response.json();
}

// ============ Company Profile ============
export async function getCompanyProfile(): Promise<CompanyProfile | null> {
  const response = await fetch(`${BASE_URL}/api/company/`);
  if (!response.ok) throw new Error('Failed to fetch company profile');
  const data = await response.json();
  if (!data) return null;
  return mapCompanyProfile(data);
}

export async function saveCompanyProfile(profile: CompanyProfile): Promise<{ status: string }> {
  const response = await fetch(`${BASE_URL}/api/company/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: profile.name || '',
      iec_code: profile.iec,
      gstin: profile.gstin,
      pan: profile.pan,
      ad_code: profile.adCode,
      factory_address: profile.factoryAddress,
      state_code: profile.stateCode,
      port_of_loading: profile.portOfLoading,
      authorized_signatory: profile.authorizedSignatory,
      signatory_designation: profile.signatoryDesignation,
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = body?.detail;
    const message = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((item: { msg: string }) => item.msg).join(' ') : 'Failed to save company profile. Please try again.';
    throw new Error(message);
  }
  return response.json();
}

// ============ Mappers (snake_case → camelCase) ============
function mapShipment(raw: Record<string, unknown>): Shipment {
  return {
    id: (raw.id as string) || '',
    filename: (raw.filename as string) || '',
    status: (raw.status as Shipment['status']) || 'uploaded',
    extractedData: raw.extracted_data ? mapExtractedData(raw.extracted_data as Record<string, unknown>) : undefined,
    riskReport: raw.risk_report ? mapRiskReport(raw.risk_report as Record<string, unknown>) : undefined,
    createdAt: (raw.created_at as string) || new Date().toISOString(),
  };
}

function mapExtractedData(raw: Record<string, unknown>): ExtractedData {
  return {
    sellerName: (raw.seller_name as string) || '',
    sellerCountry: (raw.seller_country as string) || '',
    buyerName: (raw.buyer_name as string) || '',
    buyerCountry: (raw.buyer_country as string) || '',
    portOfLoading: (raw.port_of_loading as string) || '',
    portOfDischarge: (raw.port_of_discharge as string) || '',
    lineItems: ((raw.line_items as Array<Record<string, unknown>>) || []).map((item) => ({
      description: (item.description as string) || '',
      hsCode: (item.hs_code as string) || '',
      quantity: (item.quantity as number) || 0,
      unitPrice: (item.unit_price as number) || 0,
      totalValue: (item.total_value as number) || 0,
      weight: (item.weight as number) || 0,
      unit: (item.unit as string) || '',
    })),
    totalValue: (raw.total_value as number) || 0,
    currency: (raw.currency as string) || '',
    invoiceNumber: (raw.invoice_number as string) || '',
    invoiceDate: (raw.invoice_date as string) || '',
  };
}

function mapRiskReport(raw: Record<string, unknown>): RiskReport {
  return {
    overallScore: (raw.overall_score as RiskReport['overallScore']) || 'low',
    flags: ((raw.flags as Array<Record<string, unknown>>) || []).map((f) => ({
      severity: (f.severity as 'low' | 'medium' | 'high' | 'critical') || 'low',
      title: (f.title as string) || '',
      description: (f.description as string) || '',
      policyCitation: (f.policy_citation as string) || '',
      recommendation: (f.recommendation as string) || '',
    })),
    requiredForms: (raw.required_forms as string[]) || [],
    dutySavings: raw.duty_savings as string | undefined,
    analysisSummary: (raw.analysis_summary as string) || '',
  };
}

function mapCompanyProfile(raw: Record<string, unknown>): CompanyProfile {
  return {
    name: (raw.name as string) || '',
    iec: (raw.iec_code as string) || '',
    gstin: (raw.gstin as string) || '',
    pan: (raw.pan as string) || '',
    adCode: (raw.ad_code as string) || '',
    factoryAddress: (raw.factory_address as string) || '',
    stateCode: (raw.state_code as string) || '',
    portOfLoading: (raw.port_of_loading as string) || '',
    authorizedSignatory: (raw.authorized_signatory as string) || '',
    signatoryDesignation: (raw.signatory_designation as string) || '',
  };
}
