export interface CompanyProfile {
  id?: string;
  name?: string;
  iec: string;
  gstin: string;
  pan: string;
  adCode: string;
  factoryAddress: string;
  stateCode: string;
  portOfLoading: string;
  authorizedSignatory: string;
  signatoryDesignation: string;
}

export interface LineItem {
  description: string;
  hsCode: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  weight?: number;
  unit?: string;
}

export interface ExtractedData {
  sellerName: string;
  sellerCountry: string;
  buyerName: string;
  buyerCountry: string;
  portOfLoading: string;
  portOfDischarge: string;
  lineItems: LineItem[];
  totalValue: number;
  currency: string;
  invoiceNumber: string;
  invoiceDate: string;
}

export interface RiskFlag {
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  policyCitation: string;
  recommendation: string;
}

export interface RiskReport {
  overallScore: 'low' | 'medium' | 'high' | 'critical';
  flags: RiskFlag[];
  requiredForms: string[];
  dutySavings?: string;
  analysisSummary?: string;
  mode: 'ai' | 'rules';
}

export interface FtaMatch { name: string; originCriteria: string; certificate: string; benefits: string }

export interface Shipment {
  id: string;
  filename: string;
  status: 'uploaded' | 'extracting' | 'analyzing' | 'complete' | 'analysis_failed' | 'error';
  error?: string | null;
  extractedData?: ExtractedData;
  riskReport?: RiskReport;
  ftaMatches: FtaMatch[];
  scometFlags: { item: string; name: string }[];
  createdAt: string;
}

export interface ShipmentForm {
  id: string;
  name: string;
  status: 'generated' | 'not_generated' | 'unsupported';
  reason: string;
}
