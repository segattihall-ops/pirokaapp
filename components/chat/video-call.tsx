'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { iceServers, joinCallChannel, type CallSignal, type Signaler } from '@/lib/realtime/call';

type Phase = 'idle' | 'calling' | 'incoming' | 'connecting' | 'live' | 'ended';

const RING_EVERY_MS = 3000;
const RING_TIMEOUT_MS = 45_000;

/**
 * 1:1 video call inside a conversation. Media goes peer-to-peer (DTLS-SRTP, so it is encrypted end to end);
 * only the signalling passes through Supabase, and nothing is stored.
 *
 * Flow: caller rings every 3 s until the callee accepts → caller sends the offer → answer + ICE → live.
 * Ringing instead of sending the offer straight away means a callee who opens the chat late still gets the call.
 */
export function VideoCall({
  conversationId,
  userId,
  peerHandle,
  onPhase,
}: {
  conversationId: string;
  userId: string;
  peerHandle: string | null;
  onPhase?: (p: Phase) => void;
}) {
  const [phase, setPhaseState] = useState<Phase>('idle');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [error, setError] = useState('');
  const [signalLive, setSignalLive] = useState(false);
  const phaseRef = useRef<Phase>('idle');
  const signaler = useRef<Signaler | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const ringTimer = useRef<ReturnType<typeof setInterval>>();
  const ringDeadline = useRef<ReturnType<typeof setTimeout>>();
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const name = peerHandle ? `@${peerHandle}` : 'Anonymous';

  const setPhase = useCallback(
    (p: Phase) => {
      phaseRef.current = p;
      setPhaseState(p);
      onPhase?.(p);
    },
    [onPhase],
  );

  const stopRinging = () => {
    clearInterval(ringTimer.current);
    clearTimeout(ringDeadline.current);
  };

  const teardown = useCallback(
    (final: Phase = 'ended') => {
      stopRinging();
      pc.current?.close();
      pc.current = null;
      local.current?.getTracks().forEach((t) => t.stop());
      local.current = null;
      pendingIce.current = [];
      if (remoteVideo.current) remoteVideo.current.srcObject = null;
      if (localVideo.current) localVideo.current.srcObject = null;
      setMuted(false);
      setCameraOff(false);
      setPhase(final);
      if (final === 'ended') setTimeout(() => phaseRef.current === 'ended' && setPhase('idle'), 1500);
    },
    [setPhase],
  );

  const getMedia = async () => {
    if (local.current) return local.current;
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: true });
    local.current = stream;
    if (localVideo.current) localVideo.current.srcObject = stream;
    return stream;
  };

  const createPeer = async () => {
    const stream = await getMedia();
    const conn = new RTCPeerConnection({ iceServers: iceServers() });
    stream.getTracks().forEach((t) => conn.addTrack(t, stream));
    conn.onicecandidate = (e) => e.candidate && signaler.current?.send({ type: 'ice', candidate: e.candidate.toJSON() });
    conn.ontrack = (e) => {
      if (remoteVideo.current && e.streams[0]) remoteVideo.current.srcObject = e.streams[0];
    };
    conn.onconnectionstatechange = () => {
      if (conn.connectionState === 'connected') setPhase('live');
      if (conn.connectionState === 'failed') {
        setError('Could not connect. A TURN server may be needed on this network.');
        teardown();
      }
      if (conn.connectionState === 'disconnected' || conn.connectionState === 'closed') if (phaseRef.current === 'live') teardown();
    };
    pc.current = conn;
    return conn;
  };

  const flushIce = async (conn: RTCPeerConnection) => {
    for (const c of pendingIce.current.splice(0)) await conn.addIceCandidate(c).catch(() => {});
  };

  const onSignal = useCallback(
    async (s: CallSignal, from: string) => {
      const p = phaseRef.current;
      try {
        switch (s.type) {
          case 'ring':
            if (p === 'idle' || p === 'ended') setPhase('incoming');
            else if (p === 'calling') {
              // Both rang at once: the higher id keeps calling, the lower one stops and answers.
              if (userId > from) return;
              stopRinging();
              setPhase('incoming');
            } else if (p === 'live' || p === 'connecting') signaler.current?.send({ type: 'busy' });
            return;
          case 'accept':
            if (p !== 'calling') return;
            stopRinging();
            setPhase('connecting');
            {
              const conn = await createPeer();
              const offer = await conn.createOffer();
              await conn.setLocalDescription(offer);
              await signaler.current?.send({ type: 'offer', sdp: offer });
            }
            return;
          case 'offer':
            if (p !== 'connecting' && p !== 'incoming') return;
            {
              const conn = pc.current ?? (await createPeer());
              await conn.setRemoteDescription(s.sdp);
              await flushIce(conn);
              const answer = await conn.createAnswer();
              await conn.setLocalDescription(answer);
              await signaler.current?.send({ type: 'answer', sdp: answer });
            }
            return;
          case 'answer':
            if (pc.current && !pc.current.currentRemoteDescription) {
              await pc.current.setRemoteDescription(s.sdp);
              await flushIce(pc.current);
            }
            return;
          case 'ice':
            if (pc.current?.remoteDescription) await pc.current.addIceCandidate(s.candidate).catch(() => {});
            else pendingIce.current.push(s.candidate);
            return;
          case 'decline':
            if (p === 'calling') {
              setError(`${name} declined`);
              teardown();
            }
            return;
          case 'busy':
            if (p === 'calling') {
              setError(`${name} is on another call`);
              teardown();
            }
            return;
          case 'hangup':
            if (p !== 'idle') teardown();
            return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Call failed');
        teardown();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, name, setPhase, teardown],
  );

  useEffect(() => {
    signaler.current = joinCallChannel(conversationId, userId, onSignal, setSignalLive);
    return () => {
      if (phaseRef.current !== 'idle') signaler.current?.send({ type: 'hangup' }).catch(() => {});
      teardown('idle');
      signaler.current?.close();
      signaler.current = null;
    };
  }, [conversationId, userId, onSignal, teardown]);

  const call = async () => {
    setError('');
    try {
      await getMedia();
    } catch {
      return setError('Camera and microphone access is needed to call.');
    }
    setPhase('calling');
    fetch(`/api/chat/${conversationId}/ring`, { method: 'POST' }).catch(() => {});
    const ring = () => signaler.current?.send({ type: 'ring' }).catch(() => {});
    ring();
    ringTimer.current = setInterval(ring, RING_EVERY_MS);
    ringDeadline.current = setTimeout(() => {
      if (phaseRef.current === 'calling') {
        setError(`${name} didn't answer`);
        teardown();
      }
    }, RING_TIMEOUT_MS);
  };

  const accept = async () => {
    setError('');
    try {
      await getMedia();
    } catch {
      setError('Camera and microphone access is needed to answer.');
      signaler.current?.send({ type: 'decline' }).catch(() => {});
      return teardown();
    }
    setPhase('connecting');
    await createPeer();
    await signaler.current?.send({ type: 'accept' });
  };

  // UI closes immediately; the signal goes out in the background (the channel may still be connecting).
  const decline = () => {
    signaler.current?.send({ type: 'decline' }).catch(() => {});
    teardown('idle');
  };

  const hangup = () => {
    signaler.current?.send({ type: 'hangup' }).catch(() => {});
    teardown();
  };

  const toggleMute = () => {
    const next = !muted;
    local.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  };
  const toggleCamera = () => {
    const next = !cameraOff;
    local.current?.getVideoTracks().forEach((t) => (t.enabled = !next));
    setCameraOff(next);
  };

  if (phase === 'idle' || phase === 'ended') {
    return (
      <>
        <button
          type="button"
          onClick={call}
          aria-label={`Video call ${name}`}
          title={signalLive ? 'Video call' : 'Video call (connecting to signalling…)'}
          className="tap flex items-center justify-center rounded-[12px] text-fg-3 hover:bg-ink-850 hover:text-fg"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="13" height="12" rx="2.5" />
            <path d="M16 10l5-3v10l-5-3z" />
          </svg>
        </button>
        {error && (
          <p role="status" className="absolute inset-x-0 top-full z-20 bg-ink-900 px-4 py-1.5 text-[12px] text-fg-3">
            {error}
          </p>
        )}
      </>
    );
  }

  if (phase === 'incoming') {
    return (
      <div role="dialog" aria-label="Incoming call" className="fixed inset-x-3 top-[calc(12px+var(--safe-top))] z-50 mx-auto max-w-[420px] rounded-card border border-line-2 bg-ink-900 p-4 shadow-sheet">
        <p className="text-[15px] font-semibold">📹 {name} is calling</p>
        <p className="mt-0.5 text-[12px] text-fg-3">Video call · encrypted peer-to-peer</p>
        {error && <p className="mt-1 text-[12px] text-danger">{error}</p>}
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={decline} className="btn-secondary h-11 flex-1">
            Decline
          </button>
          <button type="button" onClick={accept} className="btn-primary h-11 flex-1 bg-green hover:bg-green-hover">
            Answer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div role="dialog" aria-label="Video call" className="fixed inset-0 z-50 flex flex-col bg-black">
      <video ref={remoteVideo} autoPlay playsInline className="h-full w-full flex-1 object-cover" />
      <video ref={localVideo} autoPlay playsInline muted className="absolute right-3 top-[calc(12px+var(--safe-top))] h-[160px] w-[110px] rounded-[14px] border border-line-2 object-cover" />
      {phase !== 'live' && (
        <p className="absolute inset-x-0 top-[calc(24px+var(--safe-top))] text-center text-[14px] text-fg-2">
          {phase === 'calling' ? `Calling ${name}…` : `Connecting to ${name}…`}
        </p>
      )}
      {error && <p className="absolute inset-x-4 top-[calc(56px+var(--safe-top))] text-center text-[12px] text-danger">{error}</p>}
      <div className="absolute inset-x-0 bottom-[calc(24px+var(--safe-bottom))] flex justify-center gap-3">
        <button type="button" onClick={toggleMute} aria-pressed={muted} aria-label={muted ? 'Unmute' : 'Mute'} className={`tap h-14 w-14 rounded-full text-[20px] ${muted ? 'bg-white text-ink-950' : 'bg-white/15 text-white'}`}>
          {muted ? '🔇' : '🎙️'}
        </button>
        <button type="button" onClick={hangup} aria-label="Hang up" className="tap h-14 w-16 rounded-full bg-danger text-[20px] text-white">
          📵
        </button>
        <button type="button" onClick={toggleCamera} aria-pressed={cameraOff} aria-label={cameraOff ? 'Camera on' : 'Camera off'} className={`tap h-14 w-14 rounded-full text-[20px] ${cameraOff ? 'bg-white text-ink-950' : 'bg-white/15 text-white'}`}>
          {cameraOff ? '🚫' : '📷'}
        </button>
      </div>
    </div>
  );
}
