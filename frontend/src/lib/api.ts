import { Shipment, RiskReport, CompanyProfile, ExtractedData, ShipmentForm } from './types';
import { API_BASE_URL, request } from './http';

type UploadResult = { shipment_id: string; status: Shipment['status']; error?: string | null };

// ============ Upload ============
export async function uploadInvoice(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  return request<UploadResult>('/api/upload/', { method: 'POST', body: formData });
}

export async function uploadSampleInvoice(name: 'clean-pass' | 'fta-eligible' | 'scomet-flag'): Promise<UploadResult> {
  return request<UploadResult>(`/api/upload/sample/${name}`, { method: 'POST' });
}

// ============ Shipments ============
export async function getShipments(): Promise<Shipment[]> {
  const data = await request<{ shipments: Record<string, unknown>[] }>('/api/upload/shipments');
  return (data.shipments || []).map(mapShipment);
}

export async function getShipment(id: string): Promise<Shipment> {
  return mapShipment(await request<Record<string, unknown>>(`/api/upload/shipments/${id}`));
}

// ============ Extraction ============
export async function updateExtractedData(shipmentId: string, data: ExtractedData): Promise<Shipment> {
  const raw = await request<Record<string, unknown>>(`/api/extraction/${shipmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(unmapExtractedData(data)),
  });
  return mapShipment(raw);
}

// ============ Compliance ============
export async function reanalyzeShipment(shipmentId: string): Promise<Shipment> {
  return mapShipment(await request<Record<string, unknown>>(`/api/compliance/${shipmentId}/analyze`, { method: 'POST' }));
}

// ============ Forms ============
export async function generateForms(shipmentId: string): Promise<ShipmentForm[]> {
  const data = await request<{ forms: ShipmentForm[] }>(`/api/forms/${shipmentId}/generate`, { method: 'POST' });
  return data.forms || [];
}

export async function listForms(shipmentId: string): Promise<ShipmentForm[]> {
  const data = await request<{ forms: ShipmentForm[] }>(`/api/forms/${shipmentId}/forms`);
  return data.forms || [];
}

export function getFormDownloadUrl(shipmentId: string, formId: string): string {
  return `${API_BASE_URL}/api/forms/${shipmentId}/forms/${formId}/download`;
}

// ============ Company Profile ============
export async function getCompanyProfile(): Promise<CompanyProfile | null> {
  let data: Record<string, unknown> | null;
  try {
    data = await request<Record<string, unknown> | null>('/api/company/');
  } catch {
    throw new Error('Failed to fetch company profile');
  }
  return data ? mapCompanyProfile(data) : null;
}

export async function saveCompanyProfile(profile: CompanyProfile): Promise<{ status: string }> {
  return request<{ status: string }>('/api/company/', {
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
}

// ============ Mappers (snake_case ↔ camelCase) ============
function mapShipment(raw: Record<string, unknown>): Shipment {
  return {
    id: (raw.id as string) || '',
    filename: (raw.filename as string) || '',
    status: (raw.status as Shipment['status']) || 'uploaded',
    error: (raw.error as string) || null,
    extractedData: raw.extracted_data ? mapExtractedData(raw.extracted_data as Record<string, unknown>) : undefined,
    riskReport: raw.risk_report ? mapRiskReport(raw.risk_report as Record<string, unknown>) : undefined,
    ftaMatches: ((raw.fta_matches as Record<string, unknown>[]) || []).map(m => ({
      name: (m.name as string) || '', originCriteria: (m.origin_criteria as string) || '',
      certificate: (m.certificate_form_name as string) || '', benefits: (m.key_benefits as string) || '',
    })),
    scometFlags: ((raw.scomet_flags as Record<string, unknown>[]) || []).map(f => ({ item: (f.item as string) || '', name: (f.name as string) || (f.category as string) || '' })),
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

function unmapExtractedData(data: ExtractedData): Record<string, unknown> {
  return {
    seller_name: data.sellerName || null, seller_country: data.sellerCountry || null,
    buyer_name: data.buyerName || null, buyer_country: data.buyerCountry || null,
    port_of_loading: data.portOfLoading || null, port_of_discharge: data.portOfDischarge || null,
    total_value: data.totalValue || null, currency: data.currency || null,
    invoice_number: data.invoiceNumber || null, invoice_date: data.invoiceDate || null,
    line_items: data.lineItems.map(item => ({
      description: item.description, hs_code: item.hsCode || null, quantity: item.quantity || null,
      unit_price: item.unitPrice || null, total_value: item.totalValue || null, weight: item.weight || null, unit: item.unit || null,
    })),
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
    dutySavings: (raw.duty_savings as string) || undefined,
    analysisSummary: (raw.analysis_summary as string) || '',
    mode: (raw.mode as RiskReport['mode']) || 'ai',
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
