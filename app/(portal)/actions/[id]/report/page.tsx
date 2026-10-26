'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface QrIssueDetail {
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
  status: string;
  completed_by: string | null;
  completed_at: string | null;
  resolution_notes: string | null;
  completion_photos: string[];
  completion_report_sent: boolean;
  created_at: string;
}

export default function QrIssueCompletionReportPage() {
  const params = useParams<{ id: string }>();
  const [issue, setIssue] = useState<QrIssueDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!params?.id) return;
    fetch(`/api/qr-issues/${params.id}`)
      .then(r => r.json())
      .then(j => setIssue(j.data ?? null))
      .finally(() => setLoading(false));
  }, [params?.id]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading Issue Completion Report...</div>;
  }

  if (!issue) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#dc2626', fontWeight: 700 }}>Required Action not found.</p>
        <Link href="/actions" style={{ color: '#0284c7', fontWeight: 700 }}>
          ← Back to Required Actions
        </Link>
      </div>
    );
  }

  const isClosed = issue.status === 'completed';

  return (
    <div style={{ padding: '28px 32px', maxWidth: 940, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Link href="/actions" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 700, fontSize: 14 }}>
          ← Back to Required Actions Register
        </Link>

        <button
          type="button"
          onClick={() => window.print()}
          style={{
            padding: '9px 18px',
            borderRadius: 8,
            border: 'none',
            background: '#0f3460',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          🖨️ Print / Save Completion Report PDF
        </button>
      </div>

      <div
        style={{
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            background: isClosed
              ? 'linear-gradient(135deg, #0f3460, #16a34a)'
              : 'linear-gradient(135deg, #0f3460, #dc2626)',
            color: '#ffffff',
            padding: '26px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#dcfce7' }}>
              MJ Hygiene Services &bull; Nu-Pure Beverages (Stapylton)
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0' }}>
              Required Action &amp; Issue Close-Out Report
            </h1>
            <div style={{ fontSize: 13, color: '#f0fdf4' }}>
              Action Ref: <strong>{issue.action_number}</strong> &bull; Zone: <strong>{issue.zone}</strong>
            </div>
          </div>

          <div
            style={{
              background: 'rgba(255,255,255,0.2)',
              padding: '10px 18px',
              borderRadius: 10,
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            {isClosed ? 'CLOSED OUT & VERIFIED ✓' : 'OPEN REQUIRED ACTION'}
          </div>
        </div>

        <div style={{ padding: 32 }}>
          {/* Section 1: Issue Raised */}
          <h3 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#475569', margin: '0 0 12px' }}>
            1. Issue Raised via Site QR Code
          </h3>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              padding: 20,
              marginBottom: 24,
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Room / Area</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>{issue.area}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Issue Category</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{issue.category}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Reported By</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                  {issue.reported_by_name || 'Site QR Scan'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Logged At</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                  {new Date(issue.created_at).toLocaleString('en-AU')}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 14, color: '#0f172a', lineHeight: 1.6 }}>
              <strong>Issue Description:</strong> {issue.description}
            </div>

            {Array.isArray(issue.issue_photos) && issue.issue_photos.length > 0 && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
                {issue.issue_photos.map((u, idx) => (
                  <img
                    key={idx}
                    src={u}
                    alt="Reported Issue"
                    style={{ width: 160, height: 140, objectFit: 'cover', borderRadius: 8, border: '1px solid #cbd5e1' }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Corrective Action & Close-Out */}
          <h3 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#15803d', margin: '0 0 12px' }}>
            2. Corrective Action &amp; Close-Out Verification
          </h3>
          <div
            style={{
              background: isClosed ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${isClosed ? '#bbf7d0' : '#fde68a'}`,
              borderRadius: 10,
              padding: 20,
            }}
          >
            {isClosed ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                      Rectified &amp; Signed Off By
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#14532d', marginTop: 2 }}>
                      {issue.completed_by || 'MJ Hygiene Team'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                      Completion Timestamp
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#14532d', marginTop: 2 }}>
                      {issue.completed_at ? new Date(issue.completed_at).toLocaleString('en-AU') : 'Verified'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                      Action Status
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#15803d', marginTop: 2 }}>
                      CLOSED OUT ✓
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 14, color: '#14532d', lineHeight: 1.6 }}>
                  <strong>Corrective Action Taken:</strong> {issue.resolution_notes}
                </div>

                {Array.isArray(issue.completion_photos) && issue.completion_photos.length > 0 && (
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
                    {issue.completion_photos.map((u, idx) => (
                      <img
                        key={idx}
                        src={u}
                        alt="Completed Rectification"
                        style={{ width: 160, height: 140, objectFit: 'cover', borderRadius: 8, border: '1px solid #16a34a' }}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 14, color: '#92400e', fontWeight: 600 }}>
                This Required Action is currently open and awaiting sign-off by the MJ Hygiene site team.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
