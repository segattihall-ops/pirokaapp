'use client';

import { useState } from 'react';

export function HealthUpload({ onSuccess }: { onSuccess?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [testType, setTestType] = useState<'hiv' | 'sti'>('hiv');
  const [testDate, setTestDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file || !testDate) {
      setError('Please select a file and test date');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1];

        const res = await fetch('/api/health', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            testType,
            testDate,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Upload failed');
          return;
        }

        const data = await res.json();
        setVerified(data.verified);
        setFile(null);
        setTestDate('');

        if (onSuccess) onSuccess();
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Upload failed. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (verified) {
    return (
      <div className="rounded-lg border border-green/30 bg-green/10 p-4 text-center">
        <p className="text-[13px] font-medium text-green">✓ Test result uploaded and verified</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-line-1 bg-ink-900 p-4">
      <div>
        <label className="text-[12px] font-semibold text-fg-2">Test Type</label>
        <select
          value={testType}
          onChange={e => setTestType(e.target.value as 'hiv' | 'sti')}
          className="mt-2 w-full rounded-lg border border-line-2 bg-white/5 px-3 py-2 text-[13px] text-white focus:border-green focus:outline-none"
        >
          <option value="hiv">HIV Test</option>
          <option value="sti">STI Panel</option>
        </select>
      </div>

      <div>
        <label className="text-[12px] font-semibold text-fg-2">Test Date</label>
        <input
          type="date"
          value={testDate}
          onChange={e => setTestDate(e.target.value)}
          className="mt-2 w-full rounded-lg border border-line-2 bg-white/5 px-3 py-2 text-[13px] text-white focus:border-green focus:outline-none"
        />
      </div>

      <div>
        <label className="text-[12px] font-semibold text-fg-2">Test Result Photo</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="mt-2 w-full text-[12px] text-fg-4 file:mr-2 file:rounded file:border-0 file:bg-green file:px-3 file:py-1 file:text-[12px] file:font-medium file:text-ink-950"
        />
        {file && <p className="mt-1 text-[11px] text-fg-3">{file.name}</p>}
      </div>

      {error && <p className="text-[12px] text-red-400">{error}</p>}

      <button
        onClick={handleUpload}
        disabled={!file || !testDate || loading}
        className="w-full rounded-lg bg-green py-2 font-medium text-ink-950 disabled:opacity-50"
      >
        {loading ? 'Verifying...' : 'Upload & Verify'}
      </button>

      <p className="text-[11px] text-fg-4">
        Your test photo will be analyzed securely. We never store the image — only the verified result. Low-confidence results
        go to our review team.
      </p>
    </div>
  );
}
