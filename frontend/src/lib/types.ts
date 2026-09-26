export interface CompanyProfile {
  id?: string;
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
  weight: number;
  unit: string;
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
}

export interface Shipment {
  id: string;
  filename: string;
  status: 'uploaded' | 'extracting' | 'analyzing' | 'complete' | 'error';
  extractedData?: ExtractedData;
  riskReport?: RiskReport;
  createdAt: string;
}

export interface GeneratedForm {
  id: string;
  shipmentId: string;
  formType: string;
  fileUrl: string;
  generatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
  timestamp: string;
}
