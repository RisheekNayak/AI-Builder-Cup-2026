'use client';

import { createContext, useContext, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getShipment, getShipments, sendAdvisorMessage } from '@/lib/api';
import { historyPanel, newShipmentPanel, newestShipments, shipmentIntent, shipmentPanel, summarizeShipment, type WorkspaceMessage, type WorkspacePanel } from '@/lib/workspace';
import { useCompany } from '@/components/company/CompanyProvider';
import { errorMessage } from '@/components/ui/Feedback';

type WorkspaceValue = {
  messages: WorkspaceMessage[]; pending: boolean; panels: WorkspacePanel[];
  activePanel: WorkspacePanel | null; mobileView: 'chat' | 'panel';
  setMobileView: (view: 'chat' | 'panel') => void;
  openPanel: (panel: WorkspacePanel) => void; closePanel: (key: string) => void;
  submit: (text: string) => Promise<void>; reset: () => void;
};
const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useCompany();
  const router = useRouter();
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [panels, setPanels] = useState<WorkspacePanel[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'chat' | 'panel'>('chat');
  const activePanel = panels.find(panel => panel.key === activeKey) ?? null;

  function openPanel(panel: WorkspacePanel) {
    setPanels(previous => previous.some(p => p.key === panel.key) ? previous.map(p => p.key === panel.key ? panel : p) : [...previous, panel]);
    setActiveKey(panel.key); setMobileView('panel');
  }
  function closePanel(key: string) {
    const remaining = panels.filter(p => p.key !== key);
    setPanels(remaining);
    if (activeKey === key) setActiveKey(remaining.at(-1)?.key ?? null);
    if (!remaining.length) setMobileView('chat');
  }
  function addReply(content: string, extras: Partial<WorkspaceMessage> = {}) {
    setMessages(previous => [...previous, { id: crypto.randomUUID(), role: 'assistant', content, ...extras }]);
  }

  async function submit(raw: string) {
    const text = raw.trim();
    if (!text || busy.current) return;
    busy.current = true; setPending(true);
    setMessages(previous => [...previous, { id: crypto.randomUUID(), role: 'user', content: text }]);
    try {
      const intent = shipmentIntent(text);
      if (intent === 'settings') {
        addReply('Opening Settings so you can review and update your company profile.'); router.push('/settings');
      } else if (intent === 'new') {
        openPanel(newShipmentPanel); addReply('New Shipment is open. Upload your invoice to extract its details and assess compliance.', { panel: newShipmentPanel });
      } else if (intent === 'history') {
        const shipments = newestShipments(await getShipments());
        openPanel(historyPanel);
        addReply(shipments.length ? `You have ${shipments.length} recorded shipment${shipments.length === 1 ? '' : 's'}. Shipment History is open, with the latest uploads first.` : 'You have no recorded shipments yet. Start with New Shipment and upload an invoice.', { panel: historyPanel, citations: ['Shipment History'] });
      } else if (intent === 'shipment') {
        const useSelected = !/\b(latest|recent|last)\b/i.test(text) && activePanel?.kind === 'shipment';
        let shipment;
        if (useSelected) shipment = await getShipment(activePanel.shipmentId!);
        else {
          const shipments = newestShipments(await getShipments());
          const query = text.toLowerCase();
          shipment = shipments.find(s => query.includes(s.id.toLowerCase()) || (s.extractedData?.invoiceNumber && query.includes(s.extractedData.invoiceNumber.toLowerCase())) || query.includes(s.filename.toLowerCase())) ?? shipments[0];
        }
        if (!shipment) { addReply('No shipment is recorded yet. Upload an invoice in New Shipment to get started.', { panel: newShipmentPanel }); }
        else {
          const panel = shipmentPanel(shipment); openPanel(panel);
          const dispatchQuestion = /\b(shipped|dispatch|delivery|delivered|tracking)\b/i.test(text);
          addReply(dispatchQuestion ? 'The current records contain invoice analysis and compliance status, but no confirmed dispatch or delivery dates.\n\n' + summarizeShipment(shipment) : summarizeShipment(shipment), { panel, citations: [`Shipment record: ${shipment.extractedData?.invoiceNumber || shipment.filename}`] });
        }
      } else {
        let context = '';
        if (activePanel?.kind === 'shipment') context = `\nSelected shipment record: ${JSON.stringify(await getShipment(activePanel.shipmentId!))}`;
        const previous = messages.slice(-6).map(message => `${message.role}: ${message.content}`).join('\n');
        const result = await sendAdvisorMessage(`Company: ${profile?.name || 'Exporter'}.\n${previous ? `Conversation so far:\n${previous}\n` : ''}${context}\nCurrent question: ${text}\nUse only available records for business facts. If a fact is missing, say so.`);
        if (!result.reply || /^API Error:/i.test(result.reply)) throw new Error('Trade Advisor could not answer right now. Please try again.');
        addReply(result.reply, { citations: (result.sources || []).filter((source): source is string => typeof source === 'string' && !!source) });
      }
    } catch (err) { addReply(errorMessage(err, 'Could not complete that request. Please try again.'), { retryPrompt: text }); }
    finally { busy.current = false; setPending(false); }
  }

  function reset() { if (busy.current) return; setMessages([]); setPanels([]); setActiveKey(null); setMobileView('chat'); }

  return <WorkspaceContext.Provider value={{ messages, pending, panels, activePanel, mobileView, setMobileView, openPanel, closePanel, submit, reset }}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return context;
}
