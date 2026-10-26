'use client';

import { useEffect, useState, useCallback, useMemo, useRef, Fragment } from 'react';
import shared from '@/app/(portal)/shared.module.css';
import tabStyles from '../TabBar.module.css';
import type { SubmissionRecord, SwabRollupReport } from '@/lib/types';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

function scoreChipClass(score: number | null): string {
  if (score === null) return '';
  if (score >= 95) return tabStyles.scoreExcellent;
  if (score >= 85) return tabStyles.scoreGood;
  if (score >= 70) return tabStyles.scoreWarning;
  return tabStyles.scorePoor;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const localised = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00` : iso;
  const d = new Date(localised);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return iso;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type SwabSubmission = SubmissionRecord & { responses?: Record<string, unknown>; pdf_url?: string | null };
type Tab = 'swabs' | 'rollups';

export default function SwabReportsPage() {
  const { user } = useCurrentUser();
  const canEdit = user?.canEdit ?? false;

  // Active top-level tab
  const [activeTab, setActiveTab] = useState<Tab>('swabs');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Swab test submissions state
  const [submissions, setSubmissions] = useState<SwabSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(true);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'internal' | 'client'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Roll-up reports state
  const [rollups, setRollups] = useState<SwabRollupReport[]>([]);
  const [rollupsLoading, setRollupsLoading] = useState(false);
  const [hasLoadedRollups, setHasLoadedRollups] = useState(false);
  const [rollupsError, setRollupsError] = useState<string | null>(null);
  const [rollupFilter, setRollupFilter] = useState<'all' | 'weekly' | 'monthly'>('all');
  const [rollupSearch, setRollupSearch] = useState('');

  // Roll-up upload modal state
  const [showRollupModal, setShowRollupModal] = useState(false);
  const [rollupUploading, setRollupUploading] = useState(false);
  const [rollupUploadError, setRollupUploadError] = useState<string | null>(null);
  const [rollupType, setRollupType] = useState<'weekly' | 'monthly'>('weekly');
  const [periodDate, setPeriodDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [rollupTitle, setRollupTitle] = useState('');
  const [rollupNotes, setRollupNotes] = useState('');
  const [rollupFile, setRollupFile] = useState<File | null>(null);
  const rollupFileInputRef = useRef<HTMLInputElement>(null);

  // Load swab submissions
  const loadSubmissions = useCallback(async () => {
    setSubmissionsLoading(true);
    setSubmissionsError(null);
    try {
      const res = await fetch('/api/submissions?slug=daily-swabs,weekly-swabs&limit=200');
      if (!res.ok) throw new Error('Failed to load swab submissions');
      const j = (await res.json()) as { data?: SwabSubmission[] };
      const sorted = (j.data ?? []).sort(
        (a, b) =>
          new Date(a.submitted_at ?? a.created_at).getTime() -
          new Date(b.submitted_at ?? b.created_at).getTime()
      );
      setSubmissions(sorted);
    } catch (e) {
      setSubmissionsError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSubmissionsLoading(false);
    }
  }, []);

  // Load roll-up reports
  const loadRollups = useCallback(async () => {
    setRollupsLoading(true);
    setRollupsError(null);
    try {
      const res = await fetch('/api/reports/swabs/rollups');
      if (!res.ok) throw new Error('Failed to load roll-up reports');
      const j = (await res.json()) as { data?: SwabRollupReport[] };
      setRollups(j.data ?? []);
    } catch (e) {
      setRollupsError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setRollupsLoading(false);
      setHasLoadedRollups(true);
    }
  }, []);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  useEffect(() => {
    if (activeTab === 'rollups' && !hasLoadedRollups) {
      void loadRollups();
    }
  }, [activeTab, hasLoadedRollups, loadRollups]);

  // Re-fetch after a sync completes
  useEffect(() => {
    const onSync = () => {
      void loadSubmissions();
      if (activeTab === 'rollups') {
        void loadRollups();
      }
    };
    window.addEventListener('gotzinger-sync-complete', onSync);
    return () => window.removeEventListener('gotzinger-sync-complete', onSync);
  }, [activeTab, loadSubmissions, loadRollups]);

  // Swab filtering
  const filteredSubmissions = useMemo(() => {
    return submissions.filter((s) => {
      const isClient = s.submitted_by_email?.includes('informationleader.net') || s.submitted_by_email?.includes('gotzinger.com');
      if (sourceFilter === 'internal') return !isClient;
      if (sourceFilter === 'client') return isClient;
      return true;
    });
  }, [submissions, sourceFilter]);

  const graphData = useMemo(() => {
    return filteredSubmissions
      .map((s) => ({
        date: formatDate(s.submitted_at ?? s.created_at),
        overall_score: s.overall_score,
      }))
      .filter((s) => s.overall_score !== null);
  }, [filteredSubmissions]);

  const displayList = useMemo(() => {
    return [...filteredSubmissions].reverse();
  }, [filteredSubmissions]);

  // Roll-up filtering
  const filteredRollups = useMemo(() => {
    const q = rollupSearch.trim().toLowerCase();
    return rollups.filter((r) => {
      if (rollupFilter !== 'all' && r.report_type !== rollupFilter) return false;
      if (!q) return true;
      const matchTitle = (r.title ?? '').toLowerCase().includes(q);
      const matchLabel = (r.period_label ?? '').toLowerCase().includes(q);
      const matchFile = (r.file_name ?? '').toLowerCase().includes(q);
      const matchNotes = (r.notes ?? '').toLowerCase().includes(q);
      const matchAuthor = (r.uploaded_by ?? '').toLowerCase().includes(q);
      return matchTitle || matchLabel || matchFile || matchNotes || matchAuthor;
    });
  }, [rollups, rollupFilter, rollupSearch]);

  // Swab submission delete handler
  async function handleDeleteSubmission(submissionId: string) {
    if (!confirm('Delete this report? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/forms/submissions/${submissionId}`, { method: 'DELETE' });
      if (res.ok) {
        setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
      }
    } catch {
      alert('Delete failed');
    }
  }

  // Roll-up suggested title generator
  const getSuggestedRollupTitle = (type: 'weekly' | 'monthly', dateStr: string): string => {
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return type === 'monthly' ? 'Monthly Swab Roll-Up' : 'Weekly Swab Roll-Up';
    if (type === 'monthly') {
      const monthYear = d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
      return `Monthly Swab Roll-Up — ${monthYear}`;
    }
    const weekEnding = d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
    return `Weekly Swab Roll-Up — Week Ending ${weekEnding}`;
  };

  const handleOpenRollupModal = () => {
    setRollupUploadError(null);
    setRollupFile(null);
    setRollupNotes('');
    const today = new Date().toISOString().split('T')[0];
    setPeriodDate(today);
    setRollupType('weekly');
    setRollupTitle(getSuggestedRollupTitle('weekly', today));
    setShowRollupModal(true);
  };

  const handleRollupTypeChange = (type: 'weekly' | 'monthly') => {
    setRollupType(type);
    setRollupTitle(getSuggestedRollupTitle(type, periodDate));
  };

  const handlePeriodDateChange = (dateStr: string) => {
    setPeriodDate(dateStr);
    setRollupTitle(getSuggestedRollupTitle(rollupType, dateStr));
  };

  const handleSubmitRollupUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollupFile) {
      setRollupUploadError('Please select a report file to upload.');
      return;
    }

    setRollupUploading(true);
    setRollupUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', rollupFile);
      formData.append('report_type', rollupType);
      formData.append('period_end', periodDate);
      formData.append('title', rollupTitle.trim() || getSuggestedRollupTitle(rollupType, periodDate));
      if (rollupNotes.trim()) {
        formData.append('notes', rollupNotes.trim());
      }

      const res = await fetch('/api/reports/swabs/rollups', {
        method: 'POST',
        body: formData,
      });

      const json = (await res.json()) as { data?: SwabRollupReport; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? 'Upload failed');
      }

      setShowRollupModal(false);
      setRollupFile(null);
      void loadRollups();
    } catch (err) {
      setRollupUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setRollupUploading(false);
    }
  };

  const handleDeleteRollup = async (id: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/reports/swabs/rollups/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? 'Failed to delete');
      }
      setRollups((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  return (
    <div className={shared.pageContainer}>
      {/* Header */}
      <div className={shared.pageHeader}>
        <div className={shared.pageHeaderTop}>
          <div>
            <h1 className={shared.pageTitle}>Swab Results</h1>
            <p className={shared.pageSubtitle}>
              Microbiological swab test records, compliance trends, and weekly/monthly roll-up reports
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="MJ Hygiene Compliance Portal"
            style={{ height: '90px', objectFit: 'contain', background: '#fff', borderRadius: '10px', padding: '6px 12px' }}
          />
        </div>
      </div>

      {/* Top Tab Bar */}
      <div className={tabStyles.tabBar}>
        <button
          className={`${tabStyles.tab} ${activeTab === 'swabs' ? tabStyles.tabActive : ''}`}
          onClick={() => setActiveTab('swabs')}
        >
          🧪 Daily & Weekly Swabs
        </button>
        <button
          className={`${tabStyles.tab} ${activeTab === 'rollups' ? tabStyles.tabActive : ''}`}
          onClick={() => setActiveTab('rollups')}
        >
          📊 Roll-Up Reports (Weekly & Monthly)
        </button>
      </div>

      {/* TAB 1: SWAB SUBMISSIONS & TRENDS */}
      {activeTab === 'swabs' && (
        <>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            <button
              onClick={() => setSourceFilter('all')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: sourceFilter === 'all' ? '#0f3460' : '#fff',
                color: sourceFilter === 'all' ? '#fff' : '#475569',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              All
            </button>
            <button
              onClick={() => setSourceFilter('internal')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: sourceFilter === 'internal' ? '#0f3460' : '#fff',
                color: sourceFilter === 'internal' ? '#fff' : '#475569',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              Internal Team
            </button>
            <button
              onClick={() => setSourceFilter('client')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                background: sourceFilter === 'client' ? '#0f3460' : '#fff',
                color: sourceFilter === 'client' ? '#fff' : '#475569',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              Client (Nu-Pure)
            </button>
          </div>

          {!submissionsLoading && !submissionsError && graphData.length > 0 && (
            <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b', marginBottom: '16px' }}>Compliance Trend Over Time</h2>
              <div style={{ height: '300px', width: '100%', minWidth: 0, position: 'relative' }}>
                {isMounted && (
                  <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={0}>
                    <LineChart data={graphData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={30} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(val: number) => `${val}%`} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        formatter={(value) => [`${value}%`, 'Score']}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="overall_score" name="Pass Score (%)" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {submissionsLoading && <div className={shared.loadingState}>Loading submissions…</div>}
          {submissionsError && (
            <div className={shared.errorState}>
              <div className={shared.errorIcon}>⚠️</div>
              <div className={shared.errorTitle}>Error</div>
              <div className={shared.errorText}>{submissionsError}</div>
            </div>
          )}

          {!submissionsLoading && !submissionsError && displayList.length === 0 && (
            <div className={shared.emptyState}>
              <div className={shared.emptyIcon}>🔬</div>
              <div className={shared.emptyTitle}>No swab records found</div>
              <div className={shared.emptyText}>Swab records ingested from emails will appear here.</div>
            </div>
          )}

          {!submissionsLoading && displayList.length > 0 && (
            <div className={shared.tableWrapper}>
              <table className={shared.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Inspector</th>
                    <th>Score</th>
                    <th>Pass</th>
                    <th>Fail</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayList.map((s) => {
                    const isExpanded = expandedId === s.id;
                    const swabTests: { location: string; result: string; notes: string }[] = [];
                    if (s.responses && typeof s.responses === 'object') {
                      const resp = s.responses as Record<string, unknown>;
                      for (const [key, val] of Object.entries(resp)) {
                        if (key.startsWith('swab_') && val && typeof val === 'object') {
                          const item = val as Record<string, unknown>;
                          swabTests.push({
                            location: (item.location as string) || (item._label as string) || key,
                            result: (item.result as string) || 'pass',
                            notes: (item.notes as string) || '',
                          });
                        }
                      }
                    }
                    swabTests.sort((a, b) => a.location.localeCompare(b.location));

                    return (
                      <Fragment key={s.id}>
                        <tr
                          className={shared.clickableRow}
                          onClick={() => setExpandedId(isExpanded ? null : s.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>{formatDate(s.submitted_at ?? s.created_at)}</td>
                          <td>{s.template_name}</td>
                          <td>{s.submitted_by ?? '—'}</td>
                          <td>
                            {s.overall_score !== null ? (
                              <span className={`${tabStyles.scoreChip} ${scoreChipClass(s.overall_score)}`}>
                                {s.overall_score}%
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>{s.score_pass ?? '—'}</td>
                          <td style={{ color: (s.score_fail ?? 0) > 0 ? '#dc2626' : 'inherit', fontWeight: (s.score_fail ?? 0) > 0 ? 700 : 400 }}>
                            {s.score_fail ?? '—'}
                          </td>
                          <td>
                            <span className={`${tabStyles.statusBadge} ${s.status === 'submitted' ? tabStyles.statusSubmitted : tabStyles.statusDraft}`}>
                              {s.status}
                            </span>
                          </td>
                          <td style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <a href={`/reports/submissions/${s.id}`} className={shared.actionLink} onClick={(e) => e.stopPropagation()}>
                              View
                            </a>
                            {canEdit && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDeleteSubmission(s.id);
                                }}
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
                        {isExpanded && swabTests.length > 0 && (
                          <tr className={shared.detailRow}>
                            <td colSpan={8}>
                              <div className={shared.detailPanel} style={{ padding: '1rem 1.5rem' }}>
                                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: 600, color: '#1e293b' }}>
                                  Swab Test Results — {swabTests.length} Locations
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.5rem' }}>
                                  {swabTests.map((test, idx) => (
                                    <div
                                      key={idx}
                                      style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '0.5rem 0.75rem',
                                        borderRadius: '6px',
                                        background: test.result === 'fail' ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.06)',
                                        border: `1px solid ${test.result === 'fail' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.15)'}`,
                                      }}
                                    >
                                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#334155' }}>
                                        {test.location}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: '0.75rem',
                                          fontWeight: 700,
                                          padding: '2px 8px',
                                          borderRadius: '4px',
                                          background: test.result === 'fail' ? '#fecaca' : '#d1fae5',
                                          color: test.result === 'fail' ? '#991b1b' : '#065f46',
                                        }}
                                      >
                                        {test.result === 'fail' ? 'FAIL' : 'PASS'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                {s.pdf_url && (
                                  <a
                                    href={s.pdf_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'inline-block',
                                      marginTop: '1rem',
                                      padding: '0.4rem 1rem',
                                      background: '#0f3460',
                                      color: '#fff',
                                      borderRadius: '6px',
                                      fontSize: '0.85rem',
                                      fontWeight: 600,
                                      textDecoration: 'none',
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    📄 View Original PDF
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* TAB 2: ROLL-UP REPORTS (WEEKLY & MONTHLY) */}
      {activeTab === 'rollups' && (
        <>
          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1.5rem',
            }}
          >
            {/* Filter Buttons */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setRollupFilter('all')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: rollupFilter === 'all' ? '#0f3460' : '#fff',
                  color: rollupFilter === 'all' ? '#fff' : '#475569',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                All Roll-Ups ({rollups.length})
              </button>
              <button
                onClick={() => setRollupFilter('weekly')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: rollupFilter === 'weekly' ? '#0f3460' : '#fff',
                  color: rollupFilter === 'weekly' ? '#fff' : '#475569',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                📅 Weekly Roll-Ups ({rollups.filter((r) => r.report_type === 'weekly').length})
              </button>
              <button
                onClick={() => setRollupFilter('monthly')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: rollupFilter === 'monthly' ? '#0f3460' : '#fff',
                  color: rollupFilter === 'monthly' ? '#fff' : '#475569',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                }}
              >
                📆 Monthly Roll-Ups ({rollups.filter((r) => r.report_type === 'monthly').length})
              </button>
            </div>

            {/* Upload Button */}
            {canEdit && (
              <button
                onClick={handleOpenRollupModal}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 1.25rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  backgroundColor: '#0f3460',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(15,52,96,0.15)',
                }}
              >
                <span>📤</span> Upload Roll-Up Report
              </button>
            )}
          </div>

          {/* Search Bar */}
          <div style={{ marginBottom: '1.5rem' }}>
            <input
              type="text"
              placeholder="🔍 Search roll-up reports by title, period, file name, or notes..."
              value={rollupSearch}
              onChange={(e) => setRollupSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 1rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                background: '#fff',
                outline: 'none',
              }}
            />
          </div>

          {/* Loading & Error States */}
          {rollupsLoading && <div className={shared.loadingState}>Loading roll-up reports…</div>}
          {rollupsError && !rollupsLoading && (
            <div className={shared.errorState}>
              <div className={shared.errorIcon}>⚠️</div>
              <div className={shared.errorTitle}>Error Loading Roll-Ups</div>
              <div className={shared.errorText}>{rollupsError}</div>
              <button
                onClick={() => void loadRollups()}
                style={{
                  marginTop: '1rem',
                  padding: '0.4rem 1rem',
                  borderRadius: '6px',
                  background: '#0f3460',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty State */}
          {!rollupsLoading && !rollupsError && filteredRollups.length === 0 && (
            <div className={shared.emptyState}>
              <div className={shared.emptyIcon}>📊</div>
              <div className={shared.emptyTitle}>
                {rollupSearch || rollupFilter !== 'all' ? 'No matching roll-up reports' : 'No roll-up reports loaded yet'}
              </div>
              <div className={shared.emptyText}>
                {rollupSearch || rollupFilter !== 'all'
                  ? 'Try changing your search term or filter tab.'
                  : 'Upload weekly and monthly swab roll-up summary reports to make them available here.'}
              </div>
              {canEdit && !rollupSearch && rollupFilter === 'all' && (
                <button
                  onClick={handleOpenRollupModal}
                  style={{
                    marginTop: '1rem',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '6px',
                    background: '#0f3460',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Upload Roll-Up Report
                </button>
              )}
            </div>
          )}

          {/* Roll-Ups Table */}
          {!rollupsLoading && !rollupsError && filteredRollups.length > 0 && (
            <div className={shared.tableWrapper}>
              <table className={shared.table}>
                <thead>
                  <tr>
                    <th style={{ minWidth: '110px' }}>Type</th>
                    <th style={{ minWidth: '140px' }}>Period</th>
                    <th>Report Title / Notes</th>
                    <th>File Document</th>
                    <th>Uploaded By</th>
                    <th>Uploaded Date</th>
                    <th style={{ textAlign: 'right', minWidth: '140px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRollups.map((r) => {
                    const isWeekly = r.report_type === 'weekly';
                    return (
                      <tr key={r.id}>
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.3rem',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              background: isWeekly ? '#dbeafe' : '#fef3c7',
                              color: isWeekly ? '#1e40af' : '#92400e',
                              border: `1px solid ${isWeekly ? '#bfdbfe' : '#fde68a'}`,
                            }}
                          >
                            {isWeekly ? '📅 Weekly' : '📆 Monthly'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: '#334155' }}>
                          {r.period_label || (r.period_end ? formatDate(r.period_end) : '—')}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.95rem' }}>
                            {r.title}
                          </div>
                          {r.notes && (
                            <div
                              style={{
                                fontSize: '0.85rem',
                                color: '#64748b',
                                marginTop: '0.2rem',
                                maxWidth: '400px',
                                lineHeight: '1.4',
                              }}
                            >
                              {r.notes}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span>📄</span>
                            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#334155' }}>
                              {r.file_name}
                            </span>
                          </div>
                          {r.file_size && (
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.15rem' }}>
                              {formatFileSize(r.file_size)}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: '0.85rem', color: '#475569' }}>
                          {r.uploaded_by || '—'}
                        </td>
                        <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                          {formatDate(r.created_at)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                            <a
                              href={r.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={shared.actionLink}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                              <span>📥</span> View PDF
                            </a>
                            {canEdit && (
                              <button
                                onClick={() => void handleDeleteRollup(r.id, r.file_name)}
                                style={{
                                  padding: '0.25rem 0.6rem',
                                  background: 'rgba(239,68,68,0.1)',
                                  color: '#dc2626',
                                  border: '1px solid rgba(239,68,68,0.25)',
                                  borderRadius: '4px',
                                  fontSize: '0.78rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                                title="Delete roll-up report"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Roll-Up Upload Modal */}
          {showRollupModal && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.65)',
                backdropFilter: 'blur(3px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '1rem',
              }}
              onClick={() => {
                if (!rollupUploading) setShowRollupModal(false);
              }}
            >
              <div
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '14px',
                  maxWidth: '560px',
                  width: '100%',
                  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2), 0 10px 10px -5px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div
                  style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f3460' }}>
                      Upload Swab Roll-Up Report
                    </h3>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                      Add a weekly or monthly summary roll-up document
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (!rollupUploading) setShowRollupModal(false);
                    }}
                    disabled={rollupUploading}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '1.5rem',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '0.2rem',
                    }}
                  >
                    &times;
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={(e) => void handleSubmitRollupUpload(e)} style={{ padding: '1.5rem' }}>
                  {rollupUploadError && (
                    <div
                      style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        backgroundColor: '#fee2e2',
                        border: '1px solid #fecaca',
                        color: '#991b1b',
                        fontSize: '0.875rem',
                        marginBottom: '1rem',
                      }}
                    >
                      ⚠️ {rollupUploadError}
                    </div>
                  )}

                  {/* Report Type Selector */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: '#334155',
                        marginBottom: '0.4rem',
                      }}
                    >
                      Report Frequency <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <label
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.65rem 1rem',
                          borderRadius: '8px',
                          border: `1.5px solid ${rollupType === 'weekly' ? '#0f3460' : '#cbd5e1'}`,
                          backgroundColor: rollupType === 'weekly' ? 'rgba(15, 52, 96, 0.04)' : '#fff',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.9rem',
                        }}
                      >
                        <input
                          type="radio"
                          name="report_type"
                          value="weekly"
                          checked={rollupType === 'weekly'}
                          onChange={() => handleRollupTypeChange('weekly')}
                          disabled={rollupUploading}
                        />
                        📅 Weekly Roll-Up
                      </label>
                      <label
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.65rem 1rem',
                          borderRadius: '8px',
                          border: `1.5px solid ${rollupType === 'monthly' ? '#0f3460' : '#cbd5e1'}`,
                          backgroundColor: rollupType === 'monthly' ? 'rgba(15, 52, 96, 0.04)' : '#fff',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: '0.9rem',
                        }}
                      >
                        <input
                          type="radio"
                          name="report_type"
                          value="monthly"
                          checked={rollupType === 'monthly'}
                          onChange={() => handleRollupTypeChange('monthly')}
                          disabled={rollupUploading}
                        />
                        📆 Monthly Roll-Up
                      </label>
                    </div>
                  </div>

                  {/* Period Date */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: '#334155',
                        marginBottom: '0.4rem',
                      }}
                    >
                      {rollupType === 'weekly' ? 'Week Ending Date' : 'Month / Period Date'}{' '}
                      <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={periodDate}
                      onChange={(e) => handlePeriodDateChange(e.target.value)}
                      disabled={rollupUploading}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.9rem',
                      }}
                    />
                  </div>

                  {/* Title */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: '#334155',
                        marginBottom: '0.4rem',
                      }}
                    >
                      Report Title
                    </label>
                    <input
                      type="text"
                      placeholder={getSuggestedRollupTitle(rollupType, periodDate)}
                      value={rollupTitle}
                      onChange={(e) => setRollupTitle(e.target.value)}
                      disabled={rollupUploading}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.9rem',
                      }}
                    />
                  </div>

                  {/* Notes */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: '#334155',
                        marginBottom: '0.4rem',
                      }}
                    >
                      Summary / Notes (Optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. 100% compliance across production lines. Zone 1 clean confirmed."
                      value={rollupNotes}
                      onChange={(e) => setRollupNotes(e.target.value)}
                      disabled={rollupUploading}
                      style={{
                        width: '100%',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.875rem',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  {/* File Upload */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: '#334155',
                        marginBottom: '0.4rem',
                      }}
                    >
                      Roll-Up File (PDF, Excel, Word) <span style={{ color: '#dc2626' }}>*</span>
                    </label>
                    <input
                      type="file"
                      ref={rollupFileInputRef}
                      required
                      accept=".pdf,.xlsx,.xls,.doc,.docx,application/pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        setRollupFile(f ?? null);
                      }}
                      disabled={rollupUploading}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        border: '1px dashed #94a3b8',
                        backgroundColor: '#f8fafc',
                        fontSize: '0.875rem',
                      }}
                    />
                    {rollupFile && (
                      <div
                        style={{
                          marginTop: '0.5rem',
                          fontSize: '0.8rem',
                          color: '#059669',
                          fontWeight: 600,
                        }}
                      >
                        ✓ Selected: {rollupFile.name} ({formatFileSize(rollupFile.size)})
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '0.75rem',
                      borderTop: '1px solid #e2e8f0',
                      paddingTop: '1.25rem',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setShowRollupModal(false)}
                      disabled={rollupUploading}
                      style={{
                        padding: '0.65rem 1.25rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#fff',
                        color: '#475569',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={rollupUploading || !rollupFile}
                      style={{
                        padding: '0.65rem 1.5rem',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: rollupUploading ? '#94a3b8' : '#0f3460',
                        color: '#fff',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: rollupUploading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}
                    >
                      {rollupUploading ? 'Uploading...' : '📤 Upload Report'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
