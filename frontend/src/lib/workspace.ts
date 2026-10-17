import type { Citation, PanelDirective, ProposedAction } from './business';

export type PanelKind = 'new' | 'history' | 'shipment' | 'orders' | 'order' | 'receivables' | 'customer' | 'stock' | 'gst' | 'po-capture';
export type WorkspacePanel = { key: string; kind: PanelKind; title: string; id?: string; filter?: string };
export type ActionState = 'pending' | 'done' | 'dismissed';
export type WorkspaceMessage = {
  id: string; role: 'user' | 'assistant'; content: string;
  citations?: Citation[]; panel?: WorkspacePanel; actions?: ProposedAction[]; actionStates?: ActionState[];
  followups?: string[]; mode?: 'ai' | 'offline'; notice?: string; retryPrompt?: string; isError?: boolean;
};

export const newShipmentPanel: WorkspacePanel = { key: 'new', kind: 'new', title: 'New Shipment' };
export const historyPanel: WorkspacePanel = { key: 'history', kind: 'history', title: 'Shipment History' };
export const receivablesPanel: WorkspacePanel = { key: 'receivables', kind: 'receivables', title: 'Receivables' };
export const stockPanel: WorkspacePanel = { key: 'stock', kind: 'stock', title: 'Stock' };
export const gstPanel: WorkspacePanel = { key: 'gst', kind: 'gst', title: 'GST' };
export const poCapturePanel: WorkspacePanel = { key: 'po-capture', kind: 'po-capture', title: 'Capture PO' };

const ORDER_FILTER_TITLES: Record<string, string> = { open: 'Open orders', late: 'Late orders', due_this_week: 'Due this week', dispatched: 'Dispatched', all: 'All orders' };

export const ordersPanel = (filter = 'open'): WorkspacePanel => ({ key: 'orders', kind: 'orders', title: ORDER_FILTER_TITLES[filter] || 'Orders', filter });
export const orderPanel = (id: number | string, title?: string): WorkspacePanel => ({ key: `order-${id}`, kind: 'order', id: String(id), title: title ? `PO ${title}` : 'Order' });
export const customerPanel = (id: number | string, title?: string): WorkspacePanel => ({ key: `customer-${id}`, kind: 'customer', id: String(id), title: title || 'Customer' });
export const shipmentPanel = (id: string, title?: string): WorkspacePanel => ({ key: `shipment-${id}`, kind: 'shipment', id, title: title || 'Shipment Details' });

/** Turn the assistant's panel directive, an inbox entity or a citation into a panel. */
export function panelFor(target: PanelDirective | Citation | { type: string; id?: number | string } | null | undefined): WorkspacePanel | null {
  if (!target) return null;
  const kind = 'kind' in target ? target.kind : target.type;
  const id = target.id;
  const title = 'title' in target ? target.title : 'label' in target ? target.label : undefined;
  switch (kind) {
    case 'receivables': return receivablesPanel;
    case 'customer': return id != null ? customerPanel(id, title) : receivablesPanel;
    case 'order': return id != null ? orderPanel(id, title?.replace(/^PO\s+/, '')) : ordersPanel();
    case 'orders': return ordersPanel('filter' in target && target.filter ? target.filter : 'open');
    case 'stock': return stockPanel;
    case 'gst': return gstPanel;
    case 'history': return historyPanel;
    case 'new':
    case 'new_shipment': return newShipmentPanel;
    case 'shipment': return id != null ? shipmentPanel(String(id), title) : historyPanel;
    case 'po-capture': return poCapturePanel;
    default: return null;
  }
}

export function standaloneHref(panel: WorkspacePanel): string {
  switch (panel.kind) {
    case 'new': return '/shipments/new';
    case 'history': return '/shipments';
    case 'shipment': return `/shipments/${panel.id}`;
    case 'orders': return '/orders';
    case 'order': return `/orders/${panel.id}`;
    case 'receivables': return '/receivables';
    case 'customer': return `/receivables/${panel.id}`;
    case 'stock': return '/stock';
    case 'gst': return '/gst';
    case 'po-capture': return '/orders/new';
  }
}
