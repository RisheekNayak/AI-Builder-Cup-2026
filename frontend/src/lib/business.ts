// Types mirror the FastAPI business endpoints (snake_case kept as returned).
import { API_BASE_URL, request } from './http';

export type OrderStatus = 'open' | 'partial' | 'late' | 'dispatched';

export interface OrderLine { id: number; item_id: number | null; description: string; qty: number; rate: number; dispatched: number; open: number; value: number }
export interface DispatchRecord {
  id: number; dispatch_date: string; challan_no: string | null; vehicle_no: string | null; eway_bill_no: string | null;
  recorded_by: string | null; total_qty: number; invoiced?: boolean; lines: { order_line_id: number; description: string; qty: number }[];
}
export interface Order {
  id: number; po_number: string; po_date: string; promised_date: string; due_in_days: number;
  customer: { id: number; name: string; city: string | null; country: string };
  status: OrderStatus; ordered_qty: number; dispatched_qty: number; open_qty: number; progress: number;
  order_value: number; open_value: number; lines: OrderLine[]; dispatches: DispatchRecord[]; last_dispatch_date: string | null;
  notes: string | null; source: string; updated_at: string | null;
  invoices?: { id: number; number: string; invoice_date: string; amount: number; paid: number; dispatch_id: number | null }[];
  new_invoice?: { number: string; amount: number } | null;
}
export interface Masters {
  customers: { id: number; name: string; city: string | null; country: string }[];
  items: { id: number; code: string; name: string; unit: string; rate: number }[];
}
export interface OrderDraft {
  mode: 'ai' | 'rules'; filename: string; customer_id: number | null; customer_name: string | null; customer_gstin: string | null;
  new_customer: boolean; po_number: string | null; po_date: string | null; promised_date: string | null;
  lines: { item_id: number | null; item_code: string | null; description: string; qty: number | null; rate: number | null; unit: string | null }[];
  low_confidence: string[];
}

export interface CustomerOutstanding {
  customer_id: number; name: string; city: string | null; country: string; credit_days: number; contact_name: string | null;
  whatsapp: string | null; outstanding: number; overdue: number; past_45: number; invoice_count: number; oldest_days: number;
}
export interface ReceivablesSummary {
  as_of: string; total_outstanding: number; overdue: number; past_45: number; past_45_customers: number;
  collected_this_month: number; open_invoices: number;
  buckets: { key: string; label: string; amount: number; count: number }[]; customers: CustomerOutstanding[];
}
export interface InvoiceRow {
  id: number; number: string; invoice_date: string; due_date: string; amount: number; paid: number; balance: number;
  age_days: number; overdue_days: number; bucket: string; past_45: boolean; status: 'paid' | 'overdue' | 'due';
  order_id: number | null; irn_generated: boolean;
}
export interface CustomerStatement {
  customer: { id: number; name: string; city: string | null; country: string; gstin: string | null; credit_days: number; contact_name: string | null; whatsapp: string | null };
  as_of: string; outstanding: number; overdue: number; past_45: number; invoices: InvoiceRow[];
  payments: { id: number; payment_date: string; amount: number; reference: string | null; invoice_number: string | null }[];
}

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export interface InboxItem {
  id: string; kind: string; severity: Severity; title: string; detail: string; amount: number | null; preview?: boolean;
  entity: { type: string; id?: number | string }; actions: string[]; payload?: Record<string, unknown>;
}
export interface Inbox {
  as_of: string; items: InboxItem[];
  kpis: { outstanding: number; past_45: number; overdue: number; open_orders: number; late_orders: number; due_this_week: number };
}

export interface StockItem {
  id: number; code: string; name: string; kind: 'finished' | 'raw'; unit: string; hsn: string | null; on_hand: number; reserved: number;
  available: number; reorder_level: number; shortfall: number; short_for_orders: number; below_reorder: boolean;
}
export interface GstOverview {
  as_of: string;
  calendar: { name: string; detail: string; due_date: string; days_left: number }[];
  irn_guard: { invoice_id: number; number: string; customer: string; amount: number; invoice_date: string; age_days: number; days_left: number }[];
  job_work: { challan_no: string; job_worker: string; process: string; item: string; unit: string; sent_date: string; qty_sent: number; qty_pending: number; age_days: number; days_left: number; status: 'ok' | 'due_soon' | 'deemed_supply' }[];
}
export interface Task { id: number; title: string; assignee_role: string; due_date: string | null; status: 'open' | 'done'; entity_type: string | null; entity_id: string | null }

export interface Citation { label: string; kind: string; id?: number | string; url?: string | null }
export type PanelDirective = { kind: string; id?: number | string; title?: string; filter?: string };
export interface ProposedAction { type: 'record_payment' | 'record_dispatch' | 'create_task' | 'reminder'; title: string; detail?: string; text?: string; whatsapp?: string | null; payload: Record<string, unknown> }
export interface AssistantReply {
  reply: string; mode: 'ai' | 'offline'; notice?: string; citations: Citation[]; actions: ProposedAction[]; followups: string[]; panel: PanelDirective | null;
}

const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const getOrders = (status = 'open', dueWithinDays?: number) =>
  request<{ orders: Order[] }>(`/api/orders/?status=${status}${dueWithinDays != null ? `&due_within_days=${dueWithinDays}` : ''}`).then(r => r.orders);
export const getOrder = (id: number | string) => request<Order>(`/api/orders/${id}`);
export const getMasters = () => request<Masters>('/api/orders/masters');
export const createOrder = (payload: Record<string, unknown>) => request<Order>('/api/orders/', json(payload));
export const recordDispatch = (orderId: number | string, payload: Record<string, unknown>) => request<Order>(`/api/orders/${orderId}/dispatches`, json(payload));
export const invoiceDispatch = (dispatchId: number | string) => request<{ number: string; amount: number; order_id: number }>(`/api/orders/dispatches/${dispatchId}/invoice`, { method: 'POST' });
export function capturePo(file: File) {
  const form = new FormData();
  form.append('file', file);
  return request<OrderDraft>('/api/orders/capture', { method: 'POST', body: form });
}

export const getReceivables = () => request<ReceivablesSummary>('/api/receivables/summary');
export const getStatement = (customerId: number | string) => request<CustomerStatement>(`/api/receivables/customers/${customerId}`);
export const recordPayment = (payload: Record<string, unknown>) => request<{ allocations: { invoice_number: string; amount: number }[]; statement: CustomerStatement }>('/api/receivables/payments', json(payload));
export const draftReminder = (customerId: number | string, language: 'en' | 'hinglish') =>
  request<{ text: string; mode: string; whatsapp: string | null; customer: string }>(`/api/receivables/customers/${customerId}/reminder`, json({ language }));

export const getInbox = () => request<Inbox>('/api/inbox/today');
export const getStock = () => request<{ items: StockItem[]; shortages: StockItem[] }>('/api/stock');
export const getGst = () => request<GstOverview>('/api/gst');
export const createTask = (payload: Record<string, unknown>) => request<Task>('/api/tasks', json(payload));
export const completeTask = (id: number | string) => request<Task>(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'done' }) });
export const resetDemo = () => request<{ status: string }>('/api/demo/reset', { method: 'POST' });

export const askAssistant = (messages: { role: 'user' | 'assistant'; content: string }[], context: Record<string, unknown> | null) =>
  request<AssistantReply>('/api/assistant/chat', json({ messages, context }));

export function whatsappLink(phone: string | null | undefined, text: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export { API_BASE_URL };
