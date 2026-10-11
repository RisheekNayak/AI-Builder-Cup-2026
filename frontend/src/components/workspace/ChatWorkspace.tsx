'use client';

import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowUp, ArrowUpRight, Check, ExternalLink, FilePlus2, LoaderCircle, MessageSquare, Paperclip, PanelRightOpen, Ship, X } from 'lucide-react';
import Link from 'next/link';
import { useCompany } from '@/components/company/CompanyProvider';
import { useWorkspace } from './WorkspaceProvider';
import { PanelView } from './PanelView';
import { TodayInbox } from '@/components/inbox/TodayInbox';
import { ReminderBox } from '@/components/receivables/CustomerStatement';
import { Badge, secondaryButton } from '@/components/ui/primitives';
import { newShipmentPanel, panelFor, poCapturePanel, standaloneHref, type WorkspaceMessage } from '@/lib/workspace';
import type { Citation } from '@/lib/business';
import { cn } from '@/lib/utils';

const STARTERS = ['Who owes me past 45 days?', 'Has PO 4512 shipped?', 'Which orders are late?', 'Draft a reminder for Western Motors in Hinglish'];
const ADVISOR_STARTERS = ['Is UAE covered by an FTA?', 'Which items need a SCOMET licence?', 'What documents do I need for exports to the UK?', 'Show shipments to UAE'];

function Markdown({ text }: { text: string }) {
  return <div className="space-y-2 break-words text-sm leading-6 text-slate-700 [&_li]:ml-4 [&_ol]:list-decimal [&_strong]:font-semibold [&_strong]:text-slate-900 [&_ul]:list-disc [&_ul]:space-y-1">
    <ReactMarkdown components={{ a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">{children}</a> }}>{text}</ReactMarkdown>
  </div>;
}

function AssistantMessage({ message }: { message: WorkspaceMessage }) {
  const { openPanel, submit, pending, runAction, dismissAction } = useWorkspace();
  const [running, setRunning] = useState<number | null>(null);
  const openCitation = (c: Citation) => { const panel = panelFor(c); if (panel) openPanel(panel); };

  return <div>
    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-indigo-600"><MessageSquare className="size-4" />ShipSure
      {message.mode === 'offline' && <Badge tone="neutral" className="font-normal">Answered from records · AI offline</Badge>}
    </div>
    {message.isError ? <p className="text-sm text-red-700">{message.content}</p> : <Markdown text={message.content} />}
    {!!message.citations?.length && <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Sources">
      <span className="text-[11px] text-slate-500">Sources</span>
      {message.citations.map((c, i) => c.url ? <a key={i} href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-full items-center gap-1 truncate rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-200">{c.label}<ExternalLink className="size-3" /></a>
        : panelFor(c) ? <button key={i} type="button" onClick={() => openCitation(c)} className="max-w-full truncate rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-indigo-50 hover:text-indigo-700">{c.label}</button>
        : <span key={i} className="max-w-full truncate rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{c.label}</span>)}
    </div>}
    {message.actions?.map((action, i) => {
      const state = message.actionStates?.[i] || 'pending';
      if (action.type === 'reminder') return <div key={i} className="mt-3 rounded-lg border border-slate-200 bg-white p-3"><p className="mb-2 text-xs font-medium text-slate-700">{action.title}</p><ReminderBox text={action.text || ''} phone={action.whatsapp} /></div>;
      return <div key={i} className={cn('mt-3 rounded-lg border p-3', state === 'done' ? 'border-emerald-200 bg-emerald-50/50' : 'border-indigo-200 bg-indigo-50/40')}>
        <p className="text-sm font-medium text-slate-800">{action.title}</p>
        {action.detail && <p className="mt-0.5 text-xs text-slate-500">{action.detail}</p>}
        {state === 'done' ? <p className="mt-2 flex items-center gap-1 text-xs text-emerald-700"><Check className="size-3.5" />Saved</p>
          : state === 'dismissed' ? <p className="mt-2 text-xs text-slate-500">Not saved</p>
          : <div className="mt-2 flex gap-2">
            <button type="button" disabled={running != null} onClick={async () => { setRunning(i); await runAction(message.id, i); setRunning(null); }} className="primary-button !px-3 !py-1.5 !text-xs">{running === i ? 'Saving…' : 'Confirm'}</button>
            <button type="button" disabled={running != null} onClick={() => dismissAction(message.id, i)} className={secondaryButton}>Cancel</button>
          </div>}
      </div>;
    })}
    {message.panel && <button type="button" onClick={() => openPanel(message.panel!)} className="mt-3 flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 text-left text-sm hover:bg-slate-50"><PanelRightOpen className="size-4 shrink-0 text-indigo-500" /><span className="flex-1 break-words">{message.panel.title}</span><ArrowUpRight className="size-4 shrink-0 text-slate-400" /></button>}
    {!!message.followups?.length && <div className="mt-3 flex flex-wrap gap-1.5">{message.followups.map(f => <button key={f} type="button" disabled={pending} onClick={() => void submit(f)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-indigo-200 hover:text-indigo-700 disabled:opacity-50">{f}</button>)}</div>}
    {message.retryPrompt && <button type="button" disabled={pending} onClick={() => void submit(message.retryPrompt!)} className="mt-3 rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700 disabled:opacity-50">Retry request</button>}
  </div>;
}

export function ChatWorkspace({ advisor = false }: { advisor?: boolean }) {
  const { profile } = useCompany();
  const { messages, pending, panels, activePanel, mobileView, setMobileView, openPanel, closePanel, submit } = useWorkspace();
  const [input, setInput] = useState('');
  const [attachOpen, setAttachOpen] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, pending]);

  function send(text: string) { if (!text.trim() || pending) return; setInput(''); void submit(text); }
  const starters = advisor ? ADVISOR_STARTERS : STARTERS;

  return <div className="flex h-full min-h-0 flex-col">
    {activePanel && <div className="flex shrink-0 gap-2 border-b border-slate-200 bg-white px-4 py-2 lg:hidden"><button type="button" onClick={() => setMobileView('chat')} aria-pressed={mobileView === 'chat'} className={cn('rounded-md px-3 py-1.5 text-sm', mobileView === 'chat' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500')}>Conversation</button><button type="button" onClick={() => setMobileView('panel')} aria-pressed={mobileView === 'panel'} className={cn('min-w-0 truncate rounded-md px-3 py-1.5 text-sm', mobileView === 'panel' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500')}>{activePanel.title}</button></div>}
    <div className={cn('grid min-h-0 flex-1', activePanel ? 'lg:grid-cols-[minmax(340px,.9fr)_minmax(0,1.1fr)]' : 'grid-cols-1')}>
      <section aria-label="Conversation" className={cn('flex min-h-0 min-w-0 flex-col bg-white', activePanel && mobileView === 'panel' && 'hidden lg:flex')}>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
          {!messages.length ? <div className="mx-auto max-w-3xl space-y-6 py-2">
            <div><p className="text-sm text-slate-500">{profile?.name}</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-indigo-950 sm:text-3xl">{advisor ? 'Ask about export rules and your shipments.' : 'Good to see you. Here is what needs attention.'}</h2></div>
            {!advisor && <TodayInbox onOpen={entity => { const panel = panelFor(entity); if (panel) openPanel(panel); }} onAsk={send} />}
            <div><p className="mb-2 text-xs font-medium text-slate-500">Or ask</p><div className="flex flex-wrap gap-2">{starters.map(s => <button key={s} type="button" disabled={pending} onClick={() => send(s)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 disabled:opacity-50">{s}</button>)}</div></div>
          </div> : <div className="mx-auto max-w-3xl space-y-6">
            {messages.map(message => <article key={message.id} className={cn(message.role === 'user' && 'ml-8 flex justify-end')}>
              {message.role === 'user' ? <p className="max-w-full whitespace-pre-wrap break-words rounded-xl bg-indigo-50 px-4 py-2.5 text-sm text-indigo-950">{message.content}</p> : <AssistantMessage message={message} />}
            </article>)}
            {pending && <div role="status" className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Checking your records…</div>}
            <div ref={end} />
          </div>}
        </div>
        <div className="mx-auto w-full max-w-3xl shrink-0 px-5 pb-5 sm:px-8">
          {activePanel?.id && <p className="mb-2 truncate text-xs text-indigo-600">Talking about: {activePanel.title}</p>}
          <form onSubmit={event => { event.preventDefault(); send(input); }} className="relative rounded-xl border border-slate-300 bg-white p-3 focus-within:border-indigo-400">
            <label htmlFor="workspace-message" className="sr-only">Message ShipSure</label>
            <textarea id="workspace-message" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(input); } }}
              placeholder="Ask about orders, payments, stock or exports… (English or Hinglish)" rows={2} className="block w-full resize-none border-0 bg-transparent p-1 text-sm leading-6 outline-none" />
            <div className="mt-2 flex items-center justify-between">
              <div className="relative">
                <button type="button" onClick={() => setAttachOpen(v => !v)} aria-expanded={attachOpen} aria-label="Add a document" className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><Paperclip className="size-4" /></button>
                {attachOpen && <div className="absolute bottom-11 left-0 z-10 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setAttachOpen(false); openPanel(poCapturePanel); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"><FilePlus2 className="size-4 text-indigo-500" />Customer PO</button>
                  <button type="button" role="menuitem" onClick={() => { setAttachOpen(false); openPanel(newShipmentPanel); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"><Ship className="size-4 text-indigo-500" />Export invoice</button>
                </div>}
              </div>
              <button type="submit" aria-label="Send message" disabled={pending || !input.trim()} className="rounded-lg bg-indigo-600 p-2.5 text-white hover:bg-indigo-700 disabled:opacity-40"><ArrowUp className="size-4" /></button>
            </div>
          </form>
          <p className="mt-2 text-center text-[11px] text-slate-500">Answers come from your records. Nothing is saved until you confirm.</p>
        </div>
      </section>
      {activePanel && <aside aria-label="Workspace panel" className={cn('flex min-h-0 min-w-0 flex-col border-l border-slate-200 bg-slate-50', mobileView === 'chat' && 'hidden lg:flex')}>
        <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-white p-2">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist" aria-label="Open views">{panels.map(panel => <div key={panel.key} className={cn('flex shrink-0 items-center rounded-md', activePanel.key === panel.key ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500')}>
            <button type="button" role="tab" aria-selected={activePanel.key === panel.key} onClick={() => openPanel(panel)} className="max-w-40 truncate px-2 py-2 text-xs">{panel.title}</button>
            <button type="button" aria-label={`Close ${panel.title}`} onClick={() => closePanel(panel.key)} className="rounded p-1 hover:bg-slate-200"><X className="size-3" /></button>
          </div>)}</div>
          <Link href={standaloneHref(activePanel)} aria-label="Open full page" className="shrink-0 rounded p-2 text-slate-500 hover:bg-slate-100"><ExternalLink className="size-4" /></Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><PanelView panel={activePanel} open={openPanel} close={closePanel} /></div>
      </aside>}
    </div>
  </div>;
}
