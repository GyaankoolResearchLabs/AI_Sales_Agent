import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bot, Send, User, Sparkles } from 'lucide-react';
import { useChat } from '../api/ai';
import { ChatMessage } from '../types';
import Button from '../components/Button';

const SUGGESTIONS = [
  'What should I focus on today?',
  'Which deals are at risk?',
  'Show my hottest leads',
  'Show my pipeline',
  'Who hasn\'t been contacted this week?',
  'Show deals above $50,000',
];

export default function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your AI Sales Agent. Ask me about your pipeline, deals, leads, or tasks — I only answer from your real CRM data.",
    },
  ]);
  const [input, setInput] = useState('');
  const chat = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Contextual entry point: pages like Deal Detail navigate here with a prefilled question.
  useEffect(() => {
    const prefill = (location.state as { prefill?: string } | null)?.prefill;
    if (prefill) {
      send(prefill);
      window.history.replaceState({}, document.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || chat.isPending) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content }]);

    try {
      const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
      const result = await chat.mutateAsync({ message: content, history });
      setMessages((prev) => [...prev, { role: 'assistant', content: result.message, suggestedActions: result.suggestedActions }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: "Sorry, I couldn't process that. Please try again." }]);
    }
  };

  return (
    <div className="flex h-[calc(100vh-7.5rem)] flex-col md:h-[calc(100vh-5.5rem)]">
      <div className="mb-3">
        <h1 className="text-lg font-semibold text-gray-900">AI Assistant</h1>
        <p className="text-sm text-gray-500">Ask anything about your pipeline — grounded in your real CRM data.</p>
      </div>

      <div className="flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-4">
        <div className="space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'assistant' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Bot size={14} />
                </div>
              )}
              <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'bg-brand-600 text-white' : 'bg-gray-50 text-gray-800'}`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                {m.suggestedActions && m.suggestedActions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.suggestedActions.map((a, j) => (
                      <button
                        key={j}
                        onClick={() => a.payload?.path && navigate(String(a.payload.path))}
                        className="rounded-full border border-brand-200 bg-white px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {m.role === 'user' && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-500">
                  <User size={14} />
                </div>
              )}
            </div>
          ))}
          {chat.isPending && (
            <div className="flex gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                <Bot size={14} />
              </div>
              <div className="rounded-xl bg-gray-50 px-3.5 py-2.5 text-sm text-gray-400">Thinking…</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {messages.length <= 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:border-brand-300 hover:text-brand-700"
            >
              <Sparkles size={12} /> {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mt-3 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything…"
          className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm focus-ring"
        />
        <Button type="submit" loading={chat.isPending} disabled={!input.trim()}>
          <Send size={15} />
        </Button>
      </form>
    </div>
  );
}
