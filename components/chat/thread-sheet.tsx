'use client';

import { useEffect, useState } from 'react';

type ThreadReply = {
  id: number;
  sender_id: string;
  created_at: string;
  parent_message_id: number;
};

export function ThreadSheet({
  conversationId,
  messageId,
  onClose,
}: {
  conversationId: string;
  messageId: number;
  onClose: () => void;
}) {
  const [replies, setReplies] = useState<ThreadReply[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/chat/${conversationId}/thread?messageId=${messageId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        setReplies(j.replies ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [conversationId, messageId]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink-900/90 backdrop-blur">
      <div className="flex items-center justify-between border-b border-line-2 px-4 py-3">
        <h2 className="text-[16px] font-semibold">Thread</h2>
        <button
          type="button"
          onClick={onClose}
          className="tap text-[14px] text-fg-3 hover:text-fg"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-4 text-[13px] text-fg-3">Loading replies…</p>
        ) : replies.length === 0 ? (
          <p className="p-4 text-[13px] text-fg-3">No replies yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 p-4">
            {replies.map((r) => (
              <li key={r.id} className="rounded-card bg-ink-850 px-3 py-2">
                <p className="text-[12px] text-fg-3">
                  {new Date(r.created_at).toLocaleTimeString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="btn-secondary m-4"
      >
        Done
      </button>
    </div>
  );
}
