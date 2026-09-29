'use client';

import { useState } from 'react';

interface Report {
  id: string;
  reporterId: string;
  targetId: string;
  reason: string;
  status: 'open' | 'under_review' | 'resolved' | 'dismissed';
  createdAt: Date;
}

/**
 * Admin reports queue
 * Moderators review and action reports
 * Actions: warning → limited → suspended → removed
 * All moderation logged to audit_log
 * Appeals reviewed by different moderator
 */
export function ReportsQueue() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [action, setAction] = useState<'warn' | 'limit' | 'suspend' | 'remove'>('warn');
  const [reason, setReason] = useState('');

  const handleAction = async () => {
    if (!selectedReport) return;

    try {
      const res = await fetch('/api/admin/mod-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedReport.targetId,
          step: action,
          reason,
          ruleRef: selectedReport.reason,
        }),
      });

      if (res.ok) {
        setSelectedReport(null);
        setReason('');
        // Refresh reports
      }
    } catch (error) {
      console.error('Action failed:', error);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-hero border border-line-1 bg-ink-900 p-6">
      <h2 className="text-[18px] font-bold text-white">Reports Queue</h2>

      <div className="flex gap-4">
        {/* Reports list */}
        <div className="flex-1 space-y-2 max-h-[400px] overflow-y-auto">
          {reports.length === 0 ? (
            <div className="text-center text-fg-3 py-8">No reports</div>
          ) : (
            reports.map(report => (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedReport?.id === report.id
                    ? 'border-green bg-white/[0.08]'
                    : 'border-line-2 bg-white/5 hover:border-line-1'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[12px] font-semibold text-fg-2">{report.id}</p>
                    <p className="text-[12px] text-fg-3">{report.reason}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                    report.status === 'open' ? 'bg-red-900 text-red-200' : 'bg-gray-700 text-gray-200'
                  }`}>
                    {report.status}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Action panel */}
        {selectedReport && (
          <div className="flex-1 flex flex-col gap-3 p-4 rounded-lg border border-line-2 bg-white/[0.04]">
            <h3 className="text-[14px] font-bold text-white">Moderate</h3>

            <div>
              <label className="text-[12px] font-semibold text-fg-2">Action</label>
              <select
                value={action}
                onChange={e => setAction(e.target.value as any)}
                className="w-full mt-1 p-2 rounded border border-line-2 bg-white/5 text-white text-[12px]"
              >
                <option value="warn">Warning</option>
                <option value="limit">Limited (temporary)</option>
                <option value="suspend">Suspended</option>
                <option value="remove">Removed</option>
              </select>
            </div>

            <div>
              <label className="text-[12px] font-semibold text-fg-2">Reason</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full mt-1 p-2 rounded border border-line-2 bg-white/5 text-white text-[12px] resize-none"
                rows={3}
              />
            </div>

            <button
              onClick={handleAction}
              className="w-full py-2 rounded bg-red-600 hover:bg-red-700 text-white font-semibold text-[12px]"
            >
              Take Action
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
