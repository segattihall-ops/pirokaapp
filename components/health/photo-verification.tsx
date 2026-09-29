'use client';

import { useState } from 'react';

interface PhotoVerificationProps {
  onPhotoCapture?: (photo: File) => void;
}

/**
 * Photo verification with Claude vision
 * Verifies photo matches profile photos
 * Uses webcam to reduce spoofing risk
 * Marks verified_at on success
 */
export function PhotoVerification({ onPhotoCapture }: PhotoVerificationProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'failed'>('idle');

  const handleCaptureStart = async () => {
    setIsCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      setTimeout(() => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0);
        const photo = canvas.toDataURL('image/jpeg');
        setCapturedPhoto(photo);

        stream.getTracks().forEach(track => track.stop());
        setIsCapturing(false);
      }, 3000);
    } catch (error) {
      console.error('Camera error:', error);
      setIsCapturing(false);
    }
  };

  const handleVerify = async () => {
    if (!capturedPhoto) return;

    setStatus('verifying');
    try {
      const res = await fetch('/api/health/verify-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo: capturedPhoto }),
      });

      if (res.ok) {
        setStatus('success');
        const blob = await (await fetch(capturedPhoto)).blob();
        onPhotoCapture?.(new File([blob], 'verification.jpg'));
      } else {
        setStatus('failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setStatus('failed');
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-hero border border-line-1 bg-ink-900 p-6">
      <h2 className="text-[18px] font-bold text-white">Verify Your Photo</h2>

      {!capturedPhoto ? (
        <>
          <p className="text-[14px] text-fg-3">
            Take a selfie to verify you match your profile photos. This helps keep our community safe and authentic.
          </p>

          <button
            onClick={handleCaptureStart}
            disabled={isCapturing}
            className="w-full py-3 rounded-lg bg-green text-ink-950 font-bold disabled:opacity-50"
          >
            {isCapturing ? 'Starting camera...' : 'Start Camera'}
          </button>
        </>
      ) : (
        <>
          <img
            src={capturedPhoto}
            alt="Captured selfie"
            className="w-full rounded-lg border border-line-2"
          />

          <div className="flex gap-2">
            <button
              onClick={() => {
                setCapturedPhoto(null);
                setStatus('idle');
              }}
              className="flex-1 py-2 rounded-lg bg-white/10 text-white font-semibold text-[12px]"
            >
              Retake
            </button>
            <button
              onClick={handleVerify}
              disabled={status === 'verifying'}
              className="flex-1 py-2 rounded-lg bg-green text-ink-950 font-bold disabled:opacity-50"
            >
              {status === 'verifying' ? 'Verifying...' : 'Verify'}
            </button>
          </div>

          {status === 'success' && (
            <div className="p-3 rounded-lg bg-green/20 border border-green text-green text-[12px]">
              ✓ Photo verified! Your profile is now flagged as authentic.
            </div>
          )}
          {status === 'failed' && (
            <div className="p-3 rounded-lg bg-red-900/20 border border-red-600 text-red-400 text-[12px]">
              Photo verification failed. Make sure it clearly shows your face.
            </div>
          )}
        </>
      )}
    </div>
  );
}
