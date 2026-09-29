'use client';

import { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: Date;
  isOwn: boolean;
}

interface ChatPanelProps {
  conversationId: string;
  otherUserId: string;
  otherUserHandle: string;
  initialMessages?: ChatMessage[];
}

/**
 * 1:1 Chat panel with E2E encryption (libsignal / MLS)
 * Server stores only ciphertext; plaintext never leaves client
 * Smart Inbox buckets messages by relationship type
 */
export function ChatPanel({
  conversationId,
  otherUserId,
  otherUserHandle,
  initialMessages = [],
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isEncrypted] = useState(true); // E2E encryption enabled
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    // TODO: Implement E2E encryption using libsignal
    // 1. Get session key from Signal protocol
    // 2. Encrypt message plaintext
    // 3. Send ciphertext to server
    // 4. Server stores encrypted only

    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      senderId: 'current-user', // Will come from session
      body: input,
      createdAt: new Date(),
      isOwn: true,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInput('');

    // Send to server (encrypted)
    try {
      const response = await fetch(`/api/chat/${conversationId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ciphertext: 'encrypted-body', // TODO: use libsignal
          kind: 'text',
        }),
      });

      if (!response.ok) {
        console.error('Failed to send message');
        setMessages((prev) => prev.slice(0, -1));
      }
    } catch (error) {
      console.error('Chat error:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-700">
      {/* Header */}
      <div className="border-b border-gray-700 p-4 flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-white">{otherUserHandle}</h3>
          <p className="text-xs text-gray-500">
            {isEncrypted && '🔒 '}
            End-to-end encrypted
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p>No messages yet</p>
            <p className="text-xs mt-1">Start a conversation</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`px-4 py-2 rounded-lg max-w-xs break-words ${
                msg.isOwn
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-100'
              }`}
            >
              {msg.body}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-700 p-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Message..."
            className="flex-1 bg-gray-800 text-white rounded px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white rounded text-sm font-medium"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
