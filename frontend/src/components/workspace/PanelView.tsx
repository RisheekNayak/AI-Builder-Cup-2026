'use client';

import { NewShipmentForm } from '@/components/shipments/NewShipmentForm';
import { ShipmentHistory } from '@/components/shipments/ShipmentHistory';
import { ShipmentDetails } from '@/components/shipments/ShipmentDetails';
import { OrderBook } from '@/components/orders/OrderBook';
import { OrderDetail } from '@/components/orders/OrderDetail';
import { PoCapture } from '@/components/orders/PoCapture';
import { Receivables } from '@/components/receivables/Receivables';
import { CustomerStatement } from '@/components/receivables/CustomerStatement';
import { StockPreview } from '@/components/preview/StockPreview';
import { GstPreview } from '@/components/preview/GstPreview';
import { customerPanel, newShipmentPanel, orderPanel, ordersPanel, poCapturePanel, shipmentPanel, type WorkspacePanel } from '@/lib/workspace';

/** Renders one workspace panel. `open` decides where follow-on views go (a side panel in chat, a route on standalone pages). */
export function PanelView({ panel, open, close }: { panel: WorkspacePanel; open: (panel: WorkspacePanel) => void; close?: (key: string) => void }) {
  switch (panel.kind) {
    case 'new':
      return <NewShipmentForm onUploaded={id => { close?.('new'); open(shipmentPanel(id)); }} />;
    case 'history':
      return <ShipmentHistory onSelect={s => open(shipmentPanel(s.id, s.extractedData?.invoiceNumber || s.filename))} onNew={() => open(newShipmentPanel)} />;
    case 'shipment':
      return <ShipmentDetails key={panel.id} id={panel.id!} />;
    case 'orders':
      return <OrderBook filter={panel.filter || 'open'} onFilter={filter => open(ordersPanel(filter))} onOpenOrder={o => open(orderPanel(o.id, o.po_number))} onCapture={() => open(poCapturePanel)} />;
    case 'order':
      return <OrderDetail key={panel.id} id={panel.id!} onOpenCustomer={(id, name) => open(customerPanel(id, name))} onCreateExportShipment={() => open(newShipmentPanel)} />;
    case 'po-capture':
      return <PoCapture onCreated={order => { close?.('po-capture'); open(orderPanel(order.id, order.po_number)); }} />;
    case 'receivables':
      return <Receivables onOpenCustomer={c => open(customerPanel(c.customer_id, c.name))} />;
    case 'customer':
      return <CustomerStatement key={panel.id} id={panel.id!} />;
    case 'stock':
      return <StockPreview />;
    case 'gst':
      return <GstPreview />;
  }
}
