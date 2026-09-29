'use client';

import { useState, useEffect } from 'react';

interface MeetProposal {
  meetId: string;
  otherUserId: string;
  otherUserHandle: string;
  etaMinutes: number;
  meetType: 'public' | 'a_place' | 'b_place';
  status: 'proposed' | 'accepted' | 'active' | 'ended';
  endsAt: Date;
}

interface MeetModeProps {
  proposal: MeetProposal;
  trustedContact?: { name: string; phone: string };
  onAccept?: () => void;
  onDecline?: () => void;
}

/**
 * Meet Mode + SafeMeet
 * - 2-hour precise sharing window (exact distance + animated bridge line)
 * - Check-in timer (5/15/30/45 min) with push notifications
 * - Missed check-in sends reminder, then SMS via Twilio
 * - Block & report ends the meet
 * - Everything reverts when ends_at passes
 */
export function MeetMode({
  proposal,
  trustedContact,
  onAccept,
  onDecline,
}: MeetModeProps) {
  const [checkInInterval, setCheckInInterval] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [distance, setDistance] = useState<string>('?');
  const [isActivelyMeeting, setIsActivelyMeeting] = useState(false);

  useEffect(() => {
    if (proposal.status !== 'active') return;

    const timer = setInterval(() => {
      const now = new Date();
      const end = new Date(proposal.endsAt);
      const diff = end.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Meet ended');
        setIsActivelyMeeting(false);
        clearInterval(timer);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeRemaining(`${minutes}:${String(seconds).padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [proposal]);

  if (proposal.status === 'proposed') {
    return (
      <div className="bg-gray-900 rounded-lg border border-purple-600 p-6 space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Meet Mode Proposed</h2>
          <p className="text-gray-400">
            {proposal.otherUserHandle} wants to meet in {proposal.etaMinutes} minutes
          </p>
        </div>

        <div className="bg-purple-900 bg-opacity-30 rounded p-4 text-sm text-gray-300">
          <p className="mb-2">
            <span className="font-semibold">Meet Type:</span> {proposal.meetType === 'public' ? 'Public area' : 'Specific place'}
          </p>
          <p>During the meet, you&apos;ll share your precise location for 2 hours.</p>
          <p className="text-xs text-gray-500 mt-2">You can end it anytime with Block & Report</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onDecline}
            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium"
          >
            Accept
          </button>
        </div>
      </div>
    );
  }

  if (proposal.status === 'active') {
    return (
      <div className="bg-gray-900 rounded-lg border border-green-600 p-6 space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Meet Mode Active</h2>
          <p className="text-gray-400">Meeting with {proposal.otherUserHandle}</p>
        </div>

        {/* Time remaining */}
        <div className="bg-green-900 bg-opacity-30 rounded p-4 text-center">
          <p className="text-xs text-gray-400 mb-1">Time remaining</p>
          <p className="text-3xl font-mono font-bold text-green-400">{timeRemaining}</p>
        </div>

        {/* Distance & Bridge Line */}
        <div className="bg-gray-800 rounded p-4 text-center">
          <p className="text-xs text-gray-400 mb-2">Distance</p>
          <p className="text-2xl font-bold text-white">{distance}</p>
          <div className="mt-4 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-green-500 w-3/4 animate-pulse" />
          </div>
          <p className="text-xs text-gray-400 mt-2">Animated bridge line</p>
        </div>

        {/* Check-in timer */}
        <div className="space-y-2">
          <p className="text-xs text-gray-400">Check-in interval</p>
          <div className="grid grid-cols-4 gap-2">
            {[5, 15, 30, 45].map((minutes) => (
              <button
                key={minutes}
                onClick={() => setCheckInInterval(minutes)}
                className={`py-2 rounded text-sm font-medium transition ${
                  checkInInterval === minutes
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {minutes}m
              </button>
            ))}
          </div>
        </div>

        {/* Trusted contact (if available) */}
        {trustedContact && (
          <div className="bg-orange-900 bg-opacity-20 rounded p-3 border border-orange-700 text-sm">
            <p className="font-semibold text-orange-400">Trusted contact</p>
            <p className="text-gray-300">
              {trustedContact.name}: <code className="text-orange-300">{trustedContact.phone}</code>
            </p>
            <p className="text-xs text-gray-400 mt-1">If you miss a check-in, we&apos;ll notify them after 2 missed alerts.</p>
          </div>
        )}

        {/* End meet */}
        <button className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium">
          Block & Report / End Meet
        </button>
      </div>
    );
  }

  return null;
}
