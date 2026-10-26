'use client';

import { useEffect, useState } from 'react';
import shared from '@/app/(portal)/shared.module.css';
import tabStyles from '../TabBar.module.css';
import type { PreOpReport, SubmissionRecord } from '@/lib/types';
import { useCurrentUser } from '@/lib/useCurrentUser';

type Tab = 'portal' | 'airtable';

function scoreChipClass(score: number | null): string {
  if (score === null) return '';
  if (score >= 95) return tabStyles.scoreExcellent;
  if (score >= 85) return tabStyles.scoreGood;
  if (score >= 70) return tabStyles.scoreWarning;
  return tabStyles.scorePoor;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';

  // Airtable stores dates as D/M/YYYY (Australian format) — parse explicitly
  const dmyMatch = iso.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  }

  // Handle YYYY-MM-DD (standard ISO) — force local time
  const localised = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso;
  const d = new Date(localised);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  return iso; // Last resort: show raw value
}

export default function PreOpReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('portal');
  const { user } = useCurrentUser();
  const canEdit = user?.canEdit ?? false;

  // Portal submissions state
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);

  // Airtable state
  const [airtableData, setAirtableData] = useState<PreOpReport[]>([]);
  const [airtableLoading, setAirtableLoading] = useState(false);
  const [airtableError, setAirtableError] = useState<string | null>(null);

  const [sourceFilter, setSourceFilter] = useState<'all' | 'internal' | 'client'>('all');

  const filteredSubmissions = submissions.filter((s) => {
    const email = s.submitted_by_email ?? '';
    const isClient = s.template_slug === 'client-pre-op' ||
      email.includes('informationleader.net') ||
      email.includes('gotzinger.com');
    if (sourceFilter === 'internal') return !isClient;
    if (sourceFilter === 'client') return isClient;
    return true;
  });

  async function handleDeleteSubmission(submissionId: string) {
    if (!confirm('Delete this report? This cannot be undone.')) return;
    const res = await fetch(`/api/forms/submissions/${submissionId}`, { method: 'DELETE' });
    if (res.ok) {
      setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
    }
  }

  useEffect(() => {
    if (activeTab === 'portal' && submissions.length === 0 && !submissionsLoading) {
      setSubmissionsLoading(true);
      fetch('/api/submissions?slug=daily-pre-op-fresh-meat,weekly-pre-op-hygiene,client-pre-op,internal-pre-op-low-risk,internal-pre-op-high-risk&limit=200')
        .then((r) => r.json())
        .then((j: { data?: SubmissionRecord[] }) => setSubmissions(j.data ?? []))
        .catch((e: Error) => setSubmissionsError(e.message))
        .finally(() => setSubmissionsLoading(false));
    }
    if (activeTab === 'airtable' && airtableData.length === 0 && !airtableLoading) {
      setAirtableLoading(true);
      fetch('/api/reports/pre-op')
        .then((r) => r.json())
        .then((j: { data?: PreOpReport[] }) => setAirtableData(j.data ?? []))
        .catch((e: Error) => setAirtableError(e.message))
        .finally(() => setAirtableLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Re-fetch after a sync completes
  useEffect(() => {
    const onSync = () => {
      setSubmissions([]);
      setAirtableData([]);
    };
    window.addEventListener('gotzinger-sync-complete', onSync);
    return () => window.removeEventListener('gotzinger-sync-complete', onSync);
  }, []);


  const clientSubmissions = submissions.filter(s => s.template_slug === 'client-pre-op');
  const clientScores = clientSubmissions.map((s) => s.overall_score).filter((s): s is number => s !== null);
  const avgDailyScore = clientScores.length > 0 ? Math.round(clientScores.reduce((a, b) => a + b, 0) / clientScores.length * 10) / 10 : null;

  return (

    <div className={shared.pageContainer}>
      <div className={shared.pageHeader}>
        <div className={shared.pageHeaderTop}>
          <div>
            <h1 className={shared.pageTitle}>Pre-Op Reports</h1>
            <p className={shared.pageSubtitle}>Daily and weekly pre-operational hygiene inspection records</p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="MJ Hygiene Compliance Portal"
            style={{ height: '90px', objectFit: 'contain', background: '#fff', borderRadius: '10px', padding: '6px 12px' }}
          />
        </div>
      </div>


      {/* KPI Card */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', marginTop: '1.5rem' }}>
        <div style={{ padding: '1.25rem', borderRadius: '12px', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderTop: '4px solid #10b981', minWidth: '240px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ fontSize: '1.5rem' }}>📋</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: avgDailyScore !== null ? (avgDailyScore >= 95 ? '#10b981' : avgDailyScore >= 85 ? '#ca8a04' : '#ef4444') : '#94a3b8' }}>
              {avgDailyScore !== null ? `${avgDailyScore}%` : '—'}
            </div>
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
            Avg Daily Pre-Op Score
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            {clientSubmissions.length} submissions (last 30 days)
          </div>
        </div>
      </div>

      {/* Tab bar */}

      <div className={tabStyles.tabBar}>
        <button
          className={`${tabStyles.tab} ${activeTab === 'portal' ? tabStyles.tabActive : ''}`}
          onClick={() => setActiveTab('portal')}
        >
          📋 Portal Forms
        </button>
        <button
          className={`${tabStyles.tab} ${activeTab === 'airtable' ? tabStyles.tabActive : ''}`}
          onClick={() => setActiveTab('airtable')}
        >
          📊 Airtable Records
        </button>
      </div>

      {/* Portal tab */}
      {activeTab === 'portal' && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              onClick={() => setSourceFilter('all')}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: sourceFilter === 'all' ? '#0f3460' : '#fff', color: sourceFilter === 'all' ? '#fff' : '#475569', cursor: 'pointer' }}
            >
              All
            </button>
            <button
              onClick={() => setSourceFilter('internal')}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: sourceFilter === 'internal' ? '#0f3460' : '#fff', color: sourceFilter === 'internal' ? '#fff' : '#475569', cursor: 'pointer' }}
            >
              Internal Team
            </button>
            <button
              onClick={() => setSourceFilter('client')}
              style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: sourceFilter === 'client' ? '#0f3460' : '#fff', color: sourceFilter === 'client' ? '#fff' : '#475569', cursor: 'pointer' }}
            >
              Client (Nu-Pure)
            </button>
          </div>

          {submissionsLoading && <div className={shared.loadingState}>Loading submissions…</div>}
          {submissionsError && <div className={shared.errorState}><div className={shared.errorIcon}>⚠️</div><div className={shared.errorTitle}>Error</div><div className={shared.errorText}>{submissionsError}</div></div>}
          {!submissionsLoading && !submissionsError && filteredSubmissions.length === 0 && (
            <div className={shared.emptyState}>
              <div className={shared.emptyIcon}>📋</div>
              <div className={shared.emptyTitle}>No portal submissions found</div>
              <div className={shared.emptyText}>Fill in a pre-op form to get started.</div>
            </div>
          )}
          {!submissionsLoading && filteredSubmissions.length > 0 && (
            <div className={shared.tableWrapper}>
              <table className={shared.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Form</th>
                    <th>Inspector</th>
                    <th>Score</th>
                    <th>Pass</th>
                    <th>Fail</th>
                    <th>Re-Clean</th>
                    <th>Sign-Off</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.map((s) => (
                    <tr key={s.id}>
                      <td>{formatDate(s.submitted_at ?? s.created_at)}</td>
                      <td>{s.template_name}</td>
                      <td>{s.submitted_by ?? '—'}</td>
                      <td>
                        {s.overall_score !== null ? (
                          <span className={`${tabStyles.scoreChip} ${scoreChipClass(s.overall_score)}`}>
                            {s.overall_score}%
                          </span>
                        ) : '—'}
                      </td>
                      <td>{s.score_pass ?? '—'}</td>
                      <td>{s.score_fail ?? '—'}</td>
                      <td>{s.score_reclean ?? '—'}</td>
                      <td>
                        {s.template_slug === 'client-pre-op' && s.score_reclean !== null && s.score_reclean > 0 ? (
                          s.reclean_signed_off_by ? (
                            <span style={{ color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>✓ Signed</span>
                          ) : (
                            <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.85rem' }}>⚠ Pending</span>
                          )
                        ) : '—'}
                      </td>
                      <td>
                        <span className={`${tabStyles.statusBadge} ${s.status === 'submitted' ? tabStyles.statusSubmitted : tabStyles.statusDraft}`}>
                          {s.status}
                        </span>
                      </td>
                      <td style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {s.status === 'draft' ? (
                          <a href={`/forms/${s.template_slug}?draftId=${s.id}`} className={shared.actionLink}>Resume</a>
                        ) : (
                          <a href={`/reports/submissions/${s.id}`} className={shared.actionLink}>View</a>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => { void handleDeleteSubmission(s.id); }}
                            style={{
                              padding: '0.2rem 0.55rem',
                              background: 'rgba(239,68,68,0.1)',
                              color: '#dc2626',
                              border: '1px solid rgba(239,68,68,0.3)',
                              borderRadius: '4px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Airtable tab */}
      {activeTab === 'airtable' && (
        <>
          {airtableLoading && <div className={shared.loadingState}>Loading records…</div>}
          {airtableError && <div className={shared.errorState}><div className={shared.errorIcon}>⚠️</div><div className={shared.errorTitle}>Error</div><div className={shared.errorText}>{airtableError}</div></div>}
          {!airtableLoading && !airtableError && airtableData.length === 0 && (
            <div className={shared.emptyState}>
              <div className={shared.emptyIcon}>📊</div>
              <div className={shared.emptyTitle}>No Airtable records found</div>
              <div className={shared.emptyText}>Check your Airtable connection and base configuration.</div>
            </div>
          )}
          {!airtableLoading && airtableData.length > 0 && (
            <div className={shared.tableWrapper}>
              <table className={shared.table}>
                <thead>
                  <tr>
                    <th>Report #</th>
                    <th>Date</th>
                    <th>Comments</th>
                    <th>Attachments</th>
                  </tr>
                </thead>
                <tbody>
                  {airtableData.map((r) => (
                    <tr key={r.id}>
                      <td>{r.reportNumber}</td>
                      <td>{formatDate(r.date)}</td>
                      <td>{r.comments ? r.comments.slice(0, 80) + (r.comments.length > 80 ? '…' : '') : '—'}</td>
                      <td>
                        {r.report && r.report.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            {r.report.map((att) => (
                              <a
                                key={att.id}
                                href={`/api/airtable/attachment?type=preop&record=${r.id}&attachmentId=${att.id}&filename=${encodeURIComponent(att.filename)}`}
                                className={shared.actionLink}
                                style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                              >
                                📄 {att.filename}
                              </a>
                            ))}
                          </div>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
