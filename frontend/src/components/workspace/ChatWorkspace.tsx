'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowUpRight, ExternalLink, FileCheck2, History, LoaderCircle, MessageSquare, Package, Paperclip, PanelRightOpen, X } from 'lucide-react';
import Link from 'next/link';
import { useCompany } from '@/components/company/CompanyProvider';
import { useWorkspace } from './WorkspaceProvider';
import { NewShipmentForm } from '@/components/shipments/NewShipmentForm';
import { ShipmentHistory } from '@/components/shipments/ShipmentHistory';
import { ShipmentDetails } from '@/components/shipments/ShipmentDetails';
import { newShipmentPanel, shipmentPanel } from '@/lib/workspace';
import { cn } from '@/lib/utils';

export function ChatWorkspace({ advisor = false }: { advisor?: boolean }) {
  const { profile } = useCompany();
  const { messages, pending, panels, activePanel, mobileView, setMobileView, openPanel, closePanel, submit } = useWorkspace();
  const [input, setInput] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, pending]);
  const starters = advisor ? [
    { title: 'Documents for UAE exports', prompt: 'What documents are needed to export to UAE?', icon: FileCheck2 },
    { title: 'Understand SCOMET', prompt: 'How should I check whether an item falls under SCOMET?', icon: MessageSquare },
  ] : [
    { title: 'Create a new shipment', prompt: 'Create a new shipment', icon: Package },
    { title: 'Open my latest shipment', prompt: 'Open my latest shipment', icon: PanelRightOpen },
    { title: 'Show shipment history', prompt: 'Show shipment history', icon: History },
    { title: 'Ask a compliance question', prompt: 'What documents are needed to export to UAE?', icon: FileCheck2 },
  ];

  function send(event: React.FormEvent) { event.preventDefault(); if (!input.trim() || pending) return; const text = input; setInput(''); void submit(text); }
  const standaloneHref = activePanel?.kind === 'new' ? '/shipments/new' : activePanel?.kind === 'history' ? '/shipments' : `/shipments/${activePanel?.shipmentId}`;

  return <div className="flex h-full min-h-0 flex-col">
    {activePanel && <div className="flex shrink-0 gap-2 border-b border-slate-200 bg-white px-4 py-2 xl:hidden"><button type="button" onClick={() => setMobileView('chat')} aria-pressed={mobileView === 'chat'} className={cn('rounded-md px-3 py-1.5 text-sm', mobileView === 'chat' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500')}>Conversation</button><button type="button" onClick={() => setMobileView('panel')} aria-pressed={mobileView === 'panel'} className={cn('min-w-0 truncate rounded-md px-3 py-1.5 text-sm', mobileView === 'panel' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500')}>{activePanel.title}</button></div>}
    <div className={cn('grid min-h-0 flex-1', activePanel ? 'xl:grid-cols-[minmax(340px,.85fr)_minmax(0,1.15fr)]' : 'grid-cols-1')}>
      <section aria-label="Conversation" className={cn('flex min-h-0 min-w-0 flex-col bg-white', activePanel && mobileView === 'panel' && 'hidden xl:flex')}>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-8 sm:px-8">
          {!messages.length ? <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center py-8"><MessageSquare className="mb-7 size-8 text-indigo-500" /><p className="mb-3 text-sm text-slate-500">{profile?.name}</p><h2 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight text-indigo-950 sm:text-4xl">{advisor ? 'What would you like to know about trade?' : 'What would you like to work on?'}</h2><p className="mt-4 max-w-lg text-sm leading-7 text-slate-500">{advisor ? 'Ask about export requirements, tariffs and policy guidance.' : 'Ask about shipments, review compliance, or upload an invoice. The details open right here as you work.'}</p><div className="mt-8 grid gap-3 sm:grid-cols-2">{starters.map(starter => <button type="button" key={starter.title} disabled={pending} onClick={() => void submit(starter.prompt)} className="group flex items-center gap-3 rounded-lg border border-slate-200 p-4 text-left text-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50"><starter.icon className="size-5 shrink-0 text-indigo-500" /><span className="flex-1">{starter.title}</span><ArrowUpRight className="size-4 text-slate-400 group-hover:text-indigo-600" /></button>)}</div></div> : <div className="mx-auto max-w-3xl space-y-7">{messages.map(message => <article key={message.id} className={cn(message.role === 'user' ? 'ml-8 flex justify-end' : '')}>
            {message.role === 'user' ? <p className="max-w-full whitespace-pre-wrap break-words rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-950">{message.content}</p> : <div><div className="mb-3 flex items-center gap-2 text-xs font-semibold text-indigo-600"><MessageSquare className="size-4" />ShipSure</div><p className={cn('whitespace-pre-wrap break-words text-sm leading-7', message.retryPrompt ? 'text-red-700' : 'text-slate-700')}>{message.content}</p>{message.citations && message.citations.length > 0 && <ul aria-label="Sources" className="mt-3 space-y-1 text-xs text-slate-500">{message.citations.map((source, index) => <li key={index} className="break-words">{/^https?:\/\//i.test(source) ? <a href={source} target="_blank" rel="noopener noreferrer" className="text-indigo-600 underline">{source}</a> : `Source: ${source}`}</li>)}</ul>}{message.panel && <button type="button" onClick={() => openPanel(message.panel!)} className="mt-4 flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left text-sm hover:bg-slate-50"><PanelRightOpen className="size-4 shrink-0 text-indigo-500" /><span className="flex-1 break-words">{message.panel.title}</span><ArrowUpRight className="size-4 shrink-0 text-slate-400" /></button>}{message.retryPrompt && <button type="button" disabled={pending} onClick={() => void submit(message.retryPrompt!)} className="mt-3 rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700 disabled:opacity-50">Retry request</button>}</div>}
          </article>)}{pending && <div role="status" className="flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" />Working on your request…</div>}<div ref={end} /></div>}
        </div>
        <div className="mx-auto w-full max-w-3xl shrink-0 px-5 pb-5 sm:px-8">
          {activePanel?.kind === 'shipment' && <p className="mb-2 truncate text-xs text-indigo-600">Selected shipment: {activePanel.title}</p>}
          <form onSubmit={send} className="rounded-xl border border-slate-300 bg-white p-3 focus-within:border-indigo-400"><label htmlFor="workspace-message" className="sr-only">Message ShipSure</label><textarea id="workspace-message" value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (input.trim() && !pending) { const text = input; setInput(''); void submit(text); } } }} placeholder="Ask about your shipments or compliance…" rows={2} className="block w-full resize-none border-0 bg-transparent p-1 text-sm leading-6 outline-none" /><div className="mt-2 flex items-center justify-between"><button type="button" onClick={() => openPanel(newShipmentPanel)} aria-label="Upload an invoice in New Shipment" className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><Paperclip className="size-4" /></button><button type="submit" aria-label="Send message" disabled={pending || !input.trim()} className="rounded-lg bg-indigo-600 p-2.5 text-white hover:bg-indigo-700 disabled:opacity-40"><ArrowUp className="size-4" /></button></div></form><p className="mt-2 text-center text-[11px] text-slate-400">Review compliance guidance and source documents before filing.</p>
        </div>
      </section>
      {activePanel && <aside aria-label="Shipment workspace panel" className={cn('flex min-h-0 min-w-0 flex-col border-l border-slate-200 bg-slate-50', mobileView === 'chat' && 'hidden xl:flex')}>
        <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-white p-2"><div className="flex min-w-0 flex-1 flex-wrap gap-1" aria-label="Open views">{panels.map(panel => <div key={panel.key} className={cn('flex max-w-full items-center rounded-md', activePanel.key === panel.key ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500')}><button type="button" aria-pressed={activePanel.key === panel.key} onClick={() => openPanel(panel)} className="max-w-44 truncate px-2 py-2 text-xs">{panel.title}</button><button type="button" aria-label={`Close ${panel.title}`} onClick={() => closePanel(panel.key)} className="rounded p-1 hover:bg-slate-200"><X className="size-3" /></button></div>)}</div><Link href={standaloneHref} aria-label="Open full page" className="shrink-0 rounded p-2 text-slate-500 hover:bg-slate-100"><ExternalLink className="size-4" /></Link></div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {activePanel.kind === 'new' && <NewShipmentForm onUploaded={id => { closePanel('new'); openPanel({ key: id, kind: 'shipment', title: 'Shipment Details', shipmentId: id }); }} />}
          {activePanel.kind === 'history' && <ShipmentHistory onSelect={shipment => openPanel(shipmentPanel(shipment))} onNew={() => openPanel(newShipmentPanel)} />}
          {activePanel.kind === 'shipment' && <ShipmentDetails key={activePanel.shipmentId} id={activePanel.shipmentId!} />}
        </div>
      </aside>}
    </div>
  </div>;
}
