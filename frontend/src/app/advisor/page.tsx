'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, AlertCircle } from 'lucide-react';
import { sendAdvisorMessage } from '@/lib/api';
import { ChatMessage } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function TradeAdvisor() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const starterChips = [
    'What are US tariffs for auto parts?',
    'Is HS 8501 under SCOMET?',
    'Documents needed to export to UAE?',
    'India-UAE CEPA benefits?'
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent, preset?: string) => {
    e?.preventDefault();
    const text = preset || input;
    if (!text.trim()) return;

    setInput('');
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await sendAdvisorMessage(text);
      const assistantMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: res.reply, citations: res.sources, timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Sorry, I encountered an error processing your request.', timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] bg-white rounded-lg shadow-sm border border-slate-200">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
            <Bot className="h-12 w-12 text-indigo-300" />
            <h2 className="text-xl font-medium text-slate-900">How can I help you with trade compliance?</h2>
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl mt-4">
              {starterChips.map(chip => (
                <button
                  key={chip}
                  suppressHydrationWarning
                  onClick={() => handleSubmit(undefined, chip)}
                  className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={cn("flex space-x-3 max-w-3xl", msg.role === 'user' ? "ml-auto flex-row-reverse space-x-reverse" : "")}>
              <div className={cn("flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center", msg.role === 'user' ? "bg-indigo-600" : "bg-slate-200")}>
                {msg.role === 'user' ? <User className="h-5 w-5 text-white" /> : <Bot className="h-5 w-5 text-slate-600" />}
              </div>
              <div className={cn("rounded-lg px-4 py-2", msg.role === 'user' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-900")}>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 mb-1">Sources:</p>
                    <ul className="list-disc list-inside text-xs text-slate-500">
                      {msg.citations.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex space-x-3 max-w-3xl">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
              <Bot className="h-5 w-5 text-slate-600" />
            </div>
            <div className="rounded-lg px-4 py-2 bg-slate-100 text-slate-900 flex items-center space-x-2">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t border-slate-200">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            suppressHydrationWarning
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about compliance, tariffs, or required documents..."
            className="flex-1 min-w-0 rounded-md border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-2 border"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
