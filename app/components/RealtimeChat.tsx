'use client';

import { useEffect, useRef, useState } from 'react';
import { subscribeToMessages, broadcastTyping } from '@/lib/realtime/messages';
import { encryptMessage, decryptMessage } from '@/lib/encryption/messages';
import type { MessagePayload } from '@/lib/realtime/messages';

type Message = {
  id: string;
  sender_id: string;
  plaintext: string;
  created_at: string;
  is_mine: boolean;
};

export function RealtimeChat({
  conversationId,
  userId,
  otherUserHandle
}: {
  conversationId: string;
  userId: string;
  otherUserHandle: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Subscribe to realtime messages
  useEffect(() => {
    const handleNewMessage = async (payload: MessagePayload) => {
      // Decrypt message
      const plaintext = await decryptMessage(
        payload.ciphertext,
        payload.ciphertext, // IV is same for this stub
        conversationId
      );

      if (plaintext) {
        setMessages((prev) => [
          ...prev,
          {
            id: payload.id,
            sender_id: payload.sender_id,
            plaintext,
            created_at: payload.created_at,
            is_mine: payload.sender_id === userId
          }
        ]);
      }
    };

    const unsubscribe = subscribeToMessages(conversationId, handleNewMessage);
    if (unsubscribe) unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) unsubscribeRef.current();
    };
  }, [conversationId, userId]);

  // Handle typing indicator
  const handleTyping = () => {
    broadcastTyping(conversationId, userId, true);

    // Clear previous timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // Stop typing after 1s of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      broadcastTyping(conversationId, userId, false);
    }, 1000);
  };

  // Send encrypted message
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setIsLoading(true);
    try {
      // Encrypt before sending
      const encrypted = await encryptMessage(input, conversationId);
      if (!encrypted) {
        console.error('Encryption failed');
        return;
      }

      // Send to Supabase (in real implementation)
      // const { error } = await supabase.from('messages').insert({
      //   conversation_id: conversationId,
      //   sender_id: userId,
      //   ciphertext: encrypted.ciphertext,
      //   kind: 'text',
      //   created_at: new Date().toISOString()
      // });

      console.log('Message sent (encrypted):', {
        ciphertext: encrypted.ciphertext.slice(0, 20) + '...',
        iv: encrypted.iv
      });

      // Stop typing indicator
      await broadcastTyping(conversationId, userId, false);

      setInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold text-gray-900">{otherUserHandle}</h2>
        {typingUsers.length > 0 && (
          <p className="text-xs text-gray-500">typing...</p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.is_mine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs rounded-lg px-3 py-2 ${
                  msg.is_mine
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-900'
                }`}
              >
                <p className="break-words">{msg.plaintext}</p>
                <p
                  className={`text-xs mt-1 ${
                    msg.is_mine ? 'text-green-100' : 'text-gray-500'
                  }`}
                >
                  {new Date(msg.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="border-t p-4 flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            handleTyping();
          }}
          placeholder="Type a message..."
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-lg bg-green-500 text-white px-4 py-2 text-sm font-medium hover:bg-green-600 disabled:opacity-50"
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
