'use client';

import { useState } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { ChatMessage } from '@/lib/types';

export default function AdvisorPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const starterQuestions = [
    'What are US tariffs for auto parts?',
    'Is HS 8501 under SCOMET?',
    'Documents needed to export to UAE?',
    'India-UAE CEPA duty benefits?'
  ];

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Simulate API call for now since backend might not be ready
    setTimeout(() => {
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Here is a simulated response to: "${text}". I can help with customs compliance, tariffs, and trade documentation.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, botMsg]);
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center space-y-8">
            <div className="text-center">
              <Bot className="mx-auto h-12 w-12 text-indigo-600" />
              <h2 className="mt-4 text-xl font-semibold text-slate-900">Trade Advisor AI</h2>
              <p className="mt-2 text-slate-500">Ask me anything about trade compliance and regulations.</p>
            </div>
            <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
              {starterQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(q)}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {msg.role === 'user' ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                </div>
                <div className={`rounded-lg px-4 py-3 max-w-[80%] ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-900'}`}>
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                  <Bot className="h-5 w-5" />
                </div>
                <div className="flex items-center rounded-lg bg-slate-100 px-4 py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-200 p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="relative flex items-center"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about HS codes, duties, documentation..."
            className="w-full rounded-lg border border-slate-300 py-3 pl-4 pr-12 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 rounded-md p-2 text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
