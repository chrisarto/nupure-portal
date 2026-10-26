'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface CleaningRecordDetail {
  id: string;
  report_number: string;
  date: string;
  zone: string;
  location: string;
  frequency_badge: string;
  checklist_items: Array<{ label: string; completed: boolean }>;
  items_cleaned: string;
  total_time_minutes: number;
  shift_type: string;
  cleaning_type: string;
  chemicals_used: string[];
  operators_involved: string[];
  ssop_verified: boolean;
  visual_inspection_passed: boolean;
  corrective_action: string | null;
  before_photos: string[];
  after_photos: string[];
  comments: string | null;
  submitted_by: string;
  supervisor_signoff: string;
  site: string;
  created_at: string;
}

export default function CleaningEventDetailPage() {
  const params = useParams<{ id: string }>();
  const [record, setRecord] = useState<CleaningRecordDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!params?.id) return;
    fetch(`/api/cleaning-records/${params.id}`)
      .then(r => r.json())
      .then(j => setRecord(j.data ?? null))
      .finally(() => setLoading(false));
  }, [params?.id]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Loading Room Cleaning Event Report...</div>;
  }

  if (!record) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#dc2626', fontWeight: 700 }}>Cleaning Event Report not found.</p>
        <Link href="/reports/cleaning-events" style={{ color: '#0284c7', fontWeight: 700 }}>
          ← Back to Cleaning Event Reports
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 960, margin: '0 auto' }}>
      {/* Action Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <Link
          href="/reports/cleaning-events"
          style={{ color: '#0284c7', textDecoration: 'none', fontWeight: 700, fontSize: 14 }}
        >
          ← Back to Cleaning Event Reports
        </Link>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link
            href="/cleaning-report"
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            + Log Another Room
          </Link>
          <a
            href={`/api/cleaning-records/${record.id}/pdf`}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              background: '#0284c7',
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            ⬇ Download Room PDF
          </a>
          <a
            href={`/api/cleaning-records/daily-pdf?date=${encodeURIComponent(record.date)}`}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              background: '#16a34a',
              color: '#ffffff',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            ⬇ Daily Completion Report PDF ({record.date})
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              padding: '9px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#0f3460',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🖨️ Print
          </button>
        </div>
      </div>

      {/* Report Document Card */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
        }}
      >
        {/* Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0f3460, #0284c7)',
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
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#bae6fd' }}>
              MJ Hygiene Services &bull; {record.site || 'Nu-Pure Beverages — Stapylton'}
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: '4px 0' }}>
              Digital Room Cleaning Event Report
            </h1>
            <div style={{ fontSize: 13, color: '#e0f2fe' }}>
              Report Reference: <strong>{record.report_number}</strong> &bull; Shift Date: <strong>{record.date}</strong>
            </div>
          </div>

          <div
            style={{
              background: record.visual_inspection_passed ? '#16a34a' : '#dc2626',
              color: '#ffffff',
              padding: '10px 18px',
              borderRadius: 10,
              fontWeight: 800,
              fontSize: 14,
              textAlign: 'center',
            }}
          >
            {record.visual_inspection_passed ? 'INSPECTION PASSED ✓' : 'RECLEAN REQUIRED'}
          </div>
        </div>

        <div style={{ padding: 32 }}>
          {/* Meta Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: 14,
              padding: 18,
              background: '#f8fafc',
              borderRadius: 10,
              border: '1px solid #e2e8f0',
              marginBottom: 24,
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Facility Zone</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{record.zone}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Area / Room Cleaned</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0284c7', marginTop: 2 }}>{record.location}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Shift &amp; Duration</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                {record.shift_type} ({record.total_time_minutes} mins)
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>SSOP &amp; Microfibre</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#15803d', marginTop: 2 }}>
                {record.ssop_verified ? 'Verified ✓' : 'Not Verified'}
              </div>
            </div>
          </div>

          {/* Checklist Items */}
          <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', color: '#334155', marginBottom: 12 }}>
            Completed Scope Checklist ({record.location})
          </h3>
          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              overflow: 'hidden',
              marginBottom: 24,
            }}
          >
            {Array.isArray(record.checklist_items) && record.checklist_items.length > 0 ? (
              record.checklist_items.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '11px 16px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    fontSize: 14,
                  }}
                >
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{item.label}</span>
                  <span
                    style={{
                      padding: '2px 10px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 800,
                      background: item.completed ? '#dcfce7' : '#fee2e2',
                      color: item.completed ? '#15803d' : '#dc2626',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.completed ? 'COMPLETED ✓' : 'INCOMPLETE'}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: 16, fontSize: 14, color: '#334155' }}>{record.items_cleaned}</div>
            )}
          </div>

          {/* Chemicals Used */}
          {Array.isArray(record.chemicals_used) && record.chemicals_used.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', color: '#334155', marginBottom: 8 }}>
                Approved Chemicals Applied
              </h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {record.chemicals_used.map((chem, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 999,
                      background: '#e0f2fe',
                      color: '#0369a1',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {chem}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Photos */}
          {((record.before_photos && record.before_photos.length > 0) ||
            (record.after_photos && record.after_photos.length > 0)) && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase', color: '#334155', marginBottom: 10 }}>
                Photographic Verification Evidence
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                {record.before_photos?.map((u, idx) => (
                  <div key={`b-${idx}`} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>
                      PRE-CLEAN PHOTO #{idx + 1}
                    </div>
                    <img src={u} alt="Before" style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 6 }} />
                  </div>
                ))}
                {record.after_photos?.map((u, idx) => (
                  <div key={`a-${idx}`} style={{ border: '1px solid #bbf7d0', borderRadius: 10, padding: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d', marginBottom: 6 }}>
                      POST-CLEAN VERIFIED PHOTO #{idx + 1}
                    </div>
                    <img src={u} alt="After" style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 6 }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {record.comments && (
            <div
              style={{
                padding: '14px 18px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                marginBottom: 24,
                fontSize: 14,
                color: '#334155',
              }}
            >
              <strong>Comments / Notes:</strong> {record.comments}
            </div>
          )}

          {/* Sign-Off Footer */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 20,
              paddingTop: 20,
              borderTop: '1px solid #e2e8f0',
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Completed By (Cleaner / Operator)
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>{record.submitted_by}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Supervisor Verification Sign-Off
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f3460', marginTop: 4 }}>
                {record.supervisor_signoff} &bull; {new Date(record.created_at).toLocaleString('en-AU')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
