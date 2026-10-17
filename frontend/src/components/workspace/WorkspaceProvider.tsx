'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { askAssistant, createTask, recordDispatch, recordPayment, type ProposedAction } from '@/lib/business';
import { panelFor, type ActionState, type WorkspaceMessage, type WorkspacePanel } from '@/lib/workspace';
import { errorMessage } from '@/components/ui/Feedback';
import { formatINR } from '@/lib/format';

const STORAGE_KEY = 'shipsure.workspace.v2';

type WorkspaceValue = {
  messages: WorkspaceMessage[]; pending: boolean; panels: WorkspacePanel[];
  activePanel: WorkspacePanel | null; mobileView: 'chat' | 'panel'; dataVersion: number;
  setMobileView: (view: 'chat' | 'panel') => void;
  openPanel: (panel: WorkspacePanel) => void; closePanel: (key: string) => void;
  submit: (text: string) => Promise<void>; reset: () => void;
  runAction: (messageId: string, index: number) => Promise<void>; dismissAction: (messageId: string, index: number) => void;
  notify: (content: string) => void; dataChanged: () => void;
};
const WorkspaceContext = createContext<WorkspaceValue | null>(null);

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<WorkspaceMessage[]>([]);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [panels, setPanels] = useState<WorkspacePanel[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'chat' | 'panel'>('chat');
  const [dataVersion, setDataVersion] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const activePanel = panels.find(panel => panel.key === activeKey) ?? null;

  // Restore the conversation and open panels after reload (client only, so the server render stays empty).
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved) {
        /* eslint-disable react-hooks/set-state-in-effect -- one-time restore from localStorage */
        setMessages(saved.messages || []);
        setPanels(saved.panels || []);
        setActiveKey(saved.activeKey || null);
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch { /* storage unavailable or corrupt: start fresh */ }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: messages.slice(-60), panels, activeKey })); } catch { /* ignore quota/private mode */ }
  }, [messages, panels, activeKey, loaded]);

  const openPanel = useCallback((panel: WorkspacePanel) => {
    setPanels(previous => previous.some(p => p.key === panel.key) ? previous.map(p => p.key === panel.key ? panel : p) : [...previous, panel].slice(-6));
    setActiveKey(panel.key);
    setMobileView('panel');
  }, []);

  function closePanel(key: string) {
    const remaining = panels.filter(p => p.key !== key);
    setPanels(remaining);
    if (activeKey === key) setActiveKey(remaining.at(-1)?.key ?? null);
    if (!remaining.length) setMobileView('chat');
  }

  const addMessage = useCallback((message: Omit<WorkspaceMessage, 'id'>) => {
    setMessages(previous => [...previous, { id: newId(), ...message }]);
  }, []);
  const notify = useCallback((content: string) => addMessage({ role: 'assistant', content }), [addMessage]);
  const dataChanged = useCallback(() => setDataVersion(v => v + 1), []);

  async function submit(raw: string) {
    const text = raw.trim();
    if (!text || busy.current) return;
    busy.current = true;
    setPending(true);
    const history = [...messages, { id: '', role: 'user' as const, content: text }]
      .filter(m => !m.isError).slice(-12).map(m => ({ role: m.role, content: m.content }));
    addMessage({ role: 'user', content: text });
    try {
      const context = activePanel ? { kind: activePanel.kind, id: activePanel.id ?? null, title: activePanel.title } : null;
      const reply = await askAssistant(history, context);
      const panel = panelFor(reply.panel) ?? undefined;
      if (panel) openPanel(panel);
      addMessage({
        role: 'assistant', content: reply.reply, citations: reply.citations, panel, actions: reply.actions,
        actionStates: reply.actions.map(() => 'pending' as ActionState), followups: reply.followups, mode: reply.mode, notice: reply.notice,
      });
    } catch (err) {
      addMessage({ role: 'assistant', content: errorMessage(err, 'Could not complete that request. Please try again.'), retryPrompt: text, isError: true });
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  function setActionState(messageId: string, index: number, state: ActionState) {
    setMessages(previous => previous.map(m => m.id === messageId
      ? { ...m, actionStates: (m.actionStates || m.actions?.map(() => 'pending' as ActionState) || []).map((s, i) => i === index ? state : s) }
      : m));
  }

  async function execute(action: ProposedAction): Promise<string> {
    const p = action.payload;
    switch (action.type) {
      case 'record_payment': {
        const result = await recordPayment(p);
        return `Recorded ${formatINR(result.allocations.reduce((sum, a) => sum + a.amount, 0))} from ${result.statement.customer.name} against ${result.allocations.map(a => a.invoice_number).join(', ')}. Outstanding is now ${formatINR(result.statement.outstanding)}.`;
      }
      case 'record_dispatch': {
        const order = await recordDispatch(p.order_id as number, { lines: p.lines });
        return `Dispatch recorded for PO ${order.po_number}. ${order.open_qty ? `${order.open_qty.toLocaleString('en-IN')} pcs still open.` : 'The order is fully dispatched.'}${order.new_invoice ? ` Invoice ${order.new_invoice.number} created for ${formatINR(order.new_invoice.amount)}.` : ''}`;
      }
      case 'create_task': {
        const task = await createTask(p);
        return `Task created for ${task.assignee_role}: "${task.title}"${task.due_date ? `, due ${new Date(task.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}.`;
      }
      default:
        return '';
    }
  }

  async function runAction(messageId: string, index: number) {
    const action = messages.find(m => m.id === messageId)?.actions?.[index];
    if (!action || action.type === 'reminder') return;
    try {
      const confirmation = await execute(action);
      setActionState(messageId, index, 'done');
      dataChanged();
      notify(confirmation);
    } catch (err) {
      notify(errorMessage(err, 'Could not save that. Please try again.'));
    }
  }

  function dismissAction(messageId: string, index: number) { setActionState(messageId, index, 'dismissed'); }

  function reset() {
    if (busy.current) return;
    setMessages([]); setPanels([]); setActiveKey(null); setMobileView('chat');
  }

  return <WorkspaceContext.Provider value={{ messages, pending, panels, activePanel, mobileView, dataVersion, setMobileView, openPanel, closePanel, submit, reset, runAction, dismissAction, notify, dataChanged }}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return context;
}

