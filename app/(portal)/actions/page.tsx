'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface QrIssue {
  id: string;
  action_number: string;
  zone: string;
  area: string;
  category: string;
  priority: string;
  description: string;
  reported_by_name: string;
  reported_by_email: string;
  reported_by_phone: string;
  issue_photos: string[];
  status: 'open' | 'in_progress' | 'completed';
  assigned_to: string | null;
  completed_by: string | null;
  completed_at: string | null;
  resolution_notes: string | null;
  completion_photos: string[];
  completion_report_sent: boolean;
  created_at: string;
}

export default function RequiredActionsPage() {
  const [issues, setIssues] = useState<QrIssue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Close-out modal state
  const [closingIssue, setClosingIssue] = useState<QrIssue | null>(null);
  const [completedBy, setCompletedBy] = useState<string>('MJ Hygiene Site Supervisor');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [completionPhotos, setCompletionPhotos] = useState<string[]>([]);
  const [notifyEmails, setNotifyEmails] = useState<string>('');
  const [uploading, setUploading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string; reportId?: string } | null>(null);

  const loadIssues = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/qr-issues');
      const json = await res.json();
      setIssues(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  const handleMarkInProgress = async (issue: QrIssue) => {
    await fetch(`/api/qr-issues/${issue.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
    await loadIssues();
  };

  const openCloseModal = (issue: QrIssue) => {
    setClosingIssue(issue);
    setResolutionNotes(`Completed full clean and sanitisation of ${issue.area} (${issue.category}). Verified to Nu-Pure specification.`);
    setCompletionPhotos([]);
    setNotifyEmails(issue.reported_by_email || '');
  };

  const handleUploadCompletionPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/qr-issues/upload', { method: 'POST', body: fd });
        const json = await res.json();
        if (res.ok && json.url) {
          setCompletionPhotos(prev => [...prev, json.url]);
        }
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleCompleteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingIssue) return;
    setSubmitting(true);
    setToast(null);
    try {
      const res = await fetch(`/api/qr-issues/${closingIssue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          completed_by: completedBy,
          resolution_notes: resolutionNotes,
          completion_photos: completionPhotos,
          notify_emails: notifyEmails,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to close out action');

      const closedId = closingIssue.id;
      const actNum = closingIssue.action_number;
      setClosingIssue(null);
      await loadIssues();
      setToast({
        type: 'success',
        text: `Required Action ${actNum} closed out & Completion Report issued!`,
        reportId: closedId,
      });
    } catch (err) {
      setToast({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error completing action',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const openCount = issues.filter(i => i.status === 'open').length;
  const inProgressCount = issues.filter(i => i.status === 'in_progress').length;
  const completedCount = issues.filter(i => i.status === 'completed').length;

  const filteredIssues =
    statusFilter === 'all' ? issues : issues.filter(i => i.status === statusFilter);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1360, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#dc2626' }}>
            Nu-Pure Beverages — QR Code Issue Register
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '4px 0 6px' }}>
            Required Actions &amp; Issue Close-Out Reports
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            All cleaning issues scanned via site QR codes are logged here as Required Actions. Complete and sign off an issue to generate and email the formal Completion Report.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Link
            href="/qr-codes"
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            🖨️ Printable Site QR Posters
          </Link>
          <Link
            href="/report-issue"
            target="_blank"
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: 'none',
              background: '#dc2626',
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            + Log New Action / Issue
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div
          onClick={() => setStatusFilter('open')}
          style={{
            background: '#ffffff',
            border: statusFilter === 'open' ? '2px solid #dc2626' : '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '18px 20px',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
            Open Required Actions
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#dc2626', marginTop: 4 }}>{openCount}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Awaiting rectification</div>
        </div>

        <div
          onClick={() => setStatusFilter('in_progress')}
          style={{
            background: '#ffffff',
            border: statusFilter === 'in_progress' ? '2px solid #d97706' : '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '18px 20px',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#d97706', textTransform: 'uppercase' }}>
            In Progress
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#d97706', marginTop: 4 }}>{inProgressCount}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Assigned to cleaner on shift</div>
        </div>

        <div
          onClick={() => setStatusFilter('completed')}
          style={{
            background: '#ffffff',
            border: statusFilter === 'completed' ? '2px solid #16a34a' : '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '18px 20px',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', textTransform: 'uppercase' }}>
            Closed Out &amp; Verified
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#16a34a', marginTop: 4 }}>{completedCount}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Completion Reports issued</div>
        </div>

        <div
          onClick={() => setStatusFilter('all')}
          style={{
            background: '#ffffff',
            border: statusFilter === 'all' ? '2px solid #0f3460' : '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '18px 20px',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
            All Logged QR Issues
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#0f3460', marginTop: 4 }}>{issues.length}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>View full history</div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
            color: toast.type === 'success' ? '#15803d' : '#dc2626',
            padding: '14px 18px',
            borderRadius: 10,
            marginBottom: 20,
            fontSize: 14,
            fontWeight: 700,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{toast.text}</span>
          {toast.reportId && (
            <Link
              href={`/actions/${toast.reportId}/report`}
              style={{
                background: '#15803d',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: 6,
                textDecoration: 'none',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              View / Print Completion Report →
            </Link>
          )}
        </div>
      )}

      {/* Close-Out Modal */}
      {closingIssue && (
        <form
          onSubmit={handleCompleteAction}
          style={{
            background: '#f0fdf4',
            border: '2px solid #16a34a',
            borderRadius: 14,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>
                Issue Close-Out &amp; Completion Report Generator
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '4px 0 0' }}>
                Closing Out {closingIssue.action_number} — {closingIssue.area} ({closingIssue.zone})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setClosingIssue(null)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                cursor: 'pointer',
                fontWeight: 700,
              }}
            >
              Cancel
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Completed &amp; Signed Off By *
              </label>
              <input
                type="text"
                required
                value={completedBy}
                onChange={e => setCompletedBy(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                Email Completion Report To (Reporter &amp; Client Contacts)
              </label>
              <input
                type="text"
                value={notifyEmails}
                onChange={e => setNotifyEmails(e.target.value)}
                placeholder="client@nupure.com.au, supervisor@mjhygiene.com.au"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Corrective Action Taken / Resolution Details *
            </label>
            <textarea
              rows={3}
              required
              value={resolutionNotes}
              onChange={e => setResolutionNotes(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14 }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>
              Upload Post-Rectification / Verification Photo(s) ({completionPhotos.length})
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleUploadCompletionPhoto}
              disabled={uploading}
              style={{ fontSize: 13 }}
            />
            {completionPhotos.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                {completionPhotos.map((u, i) => (
                  <img
                    key={i}
                    src={u}
                    alt="Completion"
                    style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid #16a34a' }}
                  />
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || uploading}
            style={{
              background: '#16a34a',
              color: '#ffffff',
              border: 'none',
              padding: '13px 26px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 800,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting ? 'Issuing Completion Report & Closing Action...' : '✓ Complete Action, Close Out & Issue Completion Report →'}
          </button>
        </form>
      )}

      {/* Issues List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b', background: '#ffffff', borderRadius: 12 }}>
            Loading Required Actions...
          </div>
        ) : filteredIssues.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b', background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
            No Required Actions found for this filter.
          </div>
        ) : (
          filteredIssues.map(issue => {
            const isClosed = issue.status === 'completed';
            const statusBg = isClosed ? '#dcfce7' : issue.status === 'in_progress' ? '#fef3c7' : '#fee2e2';
            const statusColor = isClosed ? '#15803d' : issue.status === 'in_progress' ? '#b45309' : '#dc2626';

            return (
              <div
                key={issue.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderLeft: `5px solid ${statusColor}`,
                  borderRadius: 12,
                  padding: '20px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 16,
                }}
              >
                <div style={{ flex: '1 1 520px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#0f3460' }}>{issue.action_number}</span>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 800,
                        background: statusBg,
                        color: statusColor,
                        textTransform: 'uppercase',
                      }}
                    >
                      {isClosed ? 'CLOSED & VERIFIED ✓' : issue.status === 'in_progress' ? 'IN PROGRESS' : 'REQUIRED ACTION — OPEN'}
                    </span>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        background: '#f1f5f9',
                        color: '#334155',
                      }}
                    >
                      Priority: {issue.priority}
                    </span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>
                      Logged {new Date(issue.created_at).toLocaleString('en-AU')}
                    </span>
                  </div>

                  <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '8px 0 4px' }}>
                    {issue.area} <span style={{ color: '#0284c7', fontWeight: 700 }}>({issue.zone})</span> — {issue.category}
                  </h3>

                  <p style={{ fontSize: 14, color: '#334155', margin: '6px 0 10px', lineHeight: 1.5 }}>
                    <strong>Issue Reported:</strong> {issue.description}
                  </p>

                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Reported by: <strong>{issue.reported_by_name || 'Site QR Scan'}</strong>
                    {issue.reported_by_email ? ` (${issue.reported_by_email})` : ''}
                    {issue.reported_by_phone ? ` • ${issue.reported_by_phone}` : ''}
                  </div>

                  {isClosed && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: '10px 14px',
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: 8,
                        fontSize: 13,
                        color: '#166534',
                      }}
                    >
                      <strong>✓ Closed Out by {issue.completed_by}:</strong> {issue.resolution_notes}
                      {issue.completed_at && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: '#15803d' }}>
                          ({new Date(issue.completed_at).toLocaleString('en-AU')})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                  {!isClosed ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openCloseModal(issue)}
                        style={{
                          padding: '10px 18px',
                          borderRadius: 8,
                          border: 'none',
                          background: '#16a34a',
                          color: '#ffffff',
                          fontSize: 13,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Complete &amp; Issue Report
                      </button>
                      {issue.status === 'open' && (
                        <button
                          type="button"
                          onClick={() => handleMarkInProgress(issue)}
                          style={{
                            padding: '7px 14px',
                            borderRadius: 8,
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#475569',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Mark In Progress
                        </button>
                      )}
                    </>
                  ) : (
                    <Link
                      href={`/actions/${issue.id}/report`}
                      style={{
                        padding: '10px 18px',
                        borderRadius: 8,
                        background: '#0f3460',
                        color: '#ffffff',
                        textDecoration: 'none',
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      📄 View Completion Report →
                    </Link>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
