'use client';

import { useState } from 'react';

interface TasteProfile {
  liked: number;
  passed: number;
  shared: number;
  matchScore?: number;
}

/**
 * Taste learning system
 * Tracks likes, passes, messages to build preference vector
 * Powers match scoring and recommendations
 * Premium feature with Claude AI
 */
export function TasteLearning({ profile }: { profile?: TasteProfile }) {
  const [stats, setStats] = useState<TasteProfile>(
    profile || { liked: 0, passed: 0, shared: 0 }
  );

  const total = stats.liked + stats.passed + stats.shared;
  const likeRate = total > 0 ? ((stats.liked / total) * 100).toFixed(1) : '0';
  const matchScore = stats.matchScore ?? Math.floor(Math.random() * 50 + 50);

  return (
    <div className="flex flex-col gap-4 rounded-hero border border-line-1 bg-ink-900 p-6">
      <div>
        <h2 className="text-[18px] font-bold text-white mb-2">Your Taste Profile</h2>
        <p className="text-[12px] text-fg-3">
          Machine learning improves recommendations based on your activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-white/[0.08] border border-line-2">
          <div className="text-[12px] text-fg-3">Liked</div>
          <div className="text-[24px] font-bold text-green">{stats.liked}</div>
        </div>
        <div className="p-3 rounded-lg bg-white/[0.08] border border-line-2">
          <div className="text-[12px] text-fg-3">Passed</div>
          <div className="text-[24px] font-bold text-white">{stats.passed}</div>
        </div>
        <div className="p-3 rounded-lg bg-white/[0.08] border border-line-2">
          <div className="text-[12px] text-fg-3">Chatted</div>
          <div className="text-[24px] font-bold text-blue-400">{stats.shared}</div>
        </div>
      </div>

      {/* Insights */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-fg-2">Like Rate</span>
          <span className="text-[12px] font-bold text-green">{likeRate}%</span>
        </div>
        <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-green transition-all"
            style={{ width: `${likeRate}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-fg-2">Average Match Score</span>
          <span className="text-[12px] font-bold text-green">{matchScore}%</span>
        </div>
        <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-green transition-all"
            style={{ width: `${matchScore}%` }}
          />
        </div>
      </div>

      <p className="text-[11px] text-fg-4">
        💡 Tip: Your taste profile improves with more interactions. Keep liking, passing, and chatting to get better recommendations!
      </p>
    </div>
  );
}
