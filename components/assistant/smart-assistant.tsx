'use client';

import { useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Claude-powered people search assistant
 * Helps users find matches using natural language
 * Learns from user preferences over time
 * Part of Premium tier
 */
export function SmartAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hey! I\'m your personal search assistant. Tell me what you\'re looking for and I\'ll help you find your perfect match.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/assistant/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: input }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: data.response || 'Found some great matches for you!',
          },
        ]);
      }
    } catch (error) {
      console.error('Assistant error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen rounded-hero border border-line-1 bg-ink-900 overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs p-3 rounded-lg text-[12px] ${
                msg.role === 'user'
                  ? 'bg-green text-ink-950'
                  : 'bg-white/10 text-white'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-center text-fg-3 text-[12px]">Thinking...</div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-line-2 p-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && handleSend()}
            placeholder="Tell me what you\'re looking for..."
            className="flex-1 p-2 rounded bg-white/5 text-white text-[12px] placeholder-fg-4 focus:outline-none focus:ring-2 focus:ring-green"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-4 py-2 rounded bg-green text-ink-950 font-bold text-[12px] disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
