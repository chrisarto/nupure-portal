'use client';

import { useState, useEffect, useCallback } from 'react';
import shared from '../../shared.module.css';
import styles from './AreaLookup.module.css';
import LoadingSpinner from '@/app/components/LoadingSpinner';

type TrainingStatus = 'current' | 'refresh' | 'requires' | 'outofdate' | 'notrequired' | 'none';

interface ProcedureOption { code: string; name: string }

interface StaffResult {
  name: string;
  sites: string;
  trainingStatus: string;
  dateOfTraining: string;
  certUrl: string;
  hasRecord: boolean;
}

interface LookupResult {
  doc: { code: string; name: string };
  staffResults: StaffResult[];
  trainedCount: number;
  totalCount: number;
  coveragePct: number;
}

function getStatusKey(status: string): TrainingStatus {
  const s = status?.toLowerCase() || '';
  if (!s) return 'none';
  if (s === 'current') return 'current';
  if (s.includes('refresh') || s.includes('30 days')) return 'refresh';
  if (s.includes('requires')) return 'requires';
  if (s.includes('out of date')) return 'outofdate';
  if (s.includes('not required')) return 'notrequired';
  return 'none';
}

const STATUS_CONFIG: Record<TrainingStatus, { label: string; color: string; bg: string; icon: string }> = {
  current:     { label: 'Current',          color: '#065f46', bg: '#d1fae5', icon: '✅' },
  refresh:     { label: 'Refresh Due',       color: '#78350f', bg: '#fef3c7', icon: '⚠️' },
  requires:    { label: 'Requires Training', color: '#7f1d1d', bg: '#fee2e2', icon: '❌' },
  outofdate:   { label: 'Out of Date',       color: '#7f1d1d', bg: '#fee2e2', icon: '❌' },
  notrequired: { label: 'Not Required',      color: '#6b7280', bg: '#f3f4f6', icon: '—' },
  none:        { label: 'No Record',         color: '#9ca3af', bg: 'transparent', icon: '—' },
};

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AreaLookupPage() {
  const [procedures, setProcedures] = useState<ProcedureOption[]>([]);
  const [selectedCode, setSelectedCode] = useState('');
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TrainingStatus | ''>('');

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/training/area-lookup');
        if (!res.ok) throw new Error(res.status === 403 ? 'Access denied — admin or supervisor only' : 'Failed to load procedures');
        const json = await res.json() as { procedures: ProcedureOption[] };
        setProcedures(json.procedures);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load procedures');
      } finally {
        setListLoading(false);
      }
    })();
  }, []);

  const handleLookup = useCallback(async (code: string) => {
    if (!code) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setStatusFilter('');
    try {
      const res = await fetch(`/api/training/area-lookup?doc=${encodeURIComponent(code)}`);
      if (!res.ok) throw new Error('Lookup failed');
      const json = await res.json() as LookupResult;
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const pctColor = result
    ? result.coveragePct >= 80 ? '#10b981' : result.coveragePct >= 50 ? '#f59e0b' : '#ef4444'
    : 'var(--text-secondary)';

  const filteredStaff = result
    ? (statusFilter
        ? result.staffResults.filter(s => getStatusKey(s.trainingStatus) === statusFilter)
        : result.staffResults)
    : [];

  return (
    <>
      {loading && <LoadingSpinner message="Looking up training coverage..." />}

      <div className={shared.pageHeader}>
        <div className={shared.pageHeaderTop}>
          <div>
            <h1 className={shared.pageTitle}>WMS Training Lookup</h1>
            <p className={shared.pageDescription}>
              Select a procedure to see which Nu-Pure staff are trained and qualified
            </p>
          </div>
          {result && (
            <div className={styles.overallBadge}>
              <span className={styles.overallPct} style={{ color: pctColor }}>
                {result.coveragePct}%
              </span>
              <span className={styles.overallLabel}>trained</span>
            </div>
          )}
        </div>
      </div>

      {/* Procedure selector */}
      <div className={styles.selectorCard}>
        <div className={styles.selectorIcon}>📋</div>
        <div className={styles.selectorBody}>
          <label className={styles.selectorLabel}>Select WMS / Procedure</label>
          <div className={styles.selectorRow}>
            <select
              className={styles.areaSelect}
              value={selectedCode}
              disabled={listLoading}
              onChange={e => {
                setSelectedCode(e.target.value);
                void handleLookup(e.target.value);
              }}
            >
              <option value="">{listLoading ? 'Loading procedures...' : '— Choose a procedure —'}</option>
              {procedures.map(p => (
                <option key={p.code} value={p.code}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
            {selectedCode && (
              <button className={styles.refreshBtn} onClick={() => void handleLookup(selectedCode)} disabled={loading}>
                🔄 Refresh
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className={shared.errorState}>
          <div className={shared.errorIcon}>⚠️</div>
          <div className={shared.errorTitle}>Error</div>
          <div className={shared.errorText}>{error}</div>
        </div>
      )}

      {result && (
        <>
          {/* Summary cards */}
          <div className={styles.summaryRow}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryNum} style={{ color: '#10b981' }}>{result.trainedCount}</div>
              <div className={styles.summaryLabel}>Trained (Current)</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryNum} style={{ color: '#ef4444' }}>{result.totalCount - result.trainedCount}</div>
              <div className={styles.summaryLabel}>Not Trained / No Record</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryNum}>{result.totalCount}</div>
              <div className={styles.summaryLabel}>Current Nu-Pure Staff</div>
            </div>
            <div className={styles.summaryCard}>
              <div className={styles.summaryNum} style={{ color: pctColor }}>{result.coveragePct}%</div>
              <div className={styles.summaryLabel}>Coverage</div>
            </div>
          </div>

          {/* Coverage bar */}
          <div className={styles.coverageBar}>
            <div className={styles.coverageFill} style={{ width: `${result.coveragePct}%`, background: pctColor }} />
          </div>

          {/* Status filter pills */}
          <div className={shared.filterPills}>
            {(['', 'current', 'requires', 'outofdate', 'refresh', 'none'] as const).map(key => {
              const cfg = key ? STATUS_CONFIG[key as TrainingStatus] : null;
              return (
                <button
                  key={key}
                  className={`${shared.filterPill} ${statusFilter === key ? shared.filterPillActive : ''}`}
                  onClick={() => setStatusFilter(prev => prev === key ? '' : key)}
                >
                  {cfg ? `${cfg.icon} ${cfg.label}` : 'All Staff'}
                </button>
              );
            })}
          </div>

          {/* Staff list */}
          <div className={styles.staffGrid}>
            {filteredStaff.length === 0 ? (
              <p className={styles.noStaff}>No staff match this filter.</p>
            ) : filteredStaff.map(member => {
              const statusKey = getStatusKey(member.trainingStatus);
              const cfg = STATUS_CONFIG[statusKey];
              return (
                <div key={member.name} className={styles.staffRow}>
                  <div className={styles.staffRowLeft}>
                    <span className={styles.staffIcon}>{cfg.icon}</span>
                    <div>
                      <div className={styles.staffRowName}>{member.name}</div>
                      {member.sites && <div className={styles.staffRowSite}>{member.sites}</div>}
                    </div>
                  </div>
                  <div className={styles.staffRowRight}>
                    <span className={styles.staffStatus}
                      style={{ color: cfg.color, background: cfg.bg, padding: '2px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                      {member.trainingStatus || 'No Record'}
                    </span>
                    {member.dateOfTraining && (
                      <span className={styles.staffDate}>{formatDate(member.dateOfTraining)}</span>
                    )}
                    {member.certUrl && (
                      <a href={member.certUrl} target="_blank" rel="noopener noreferrer"
                        className={styles.certLink}>
                        📄 Cert
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
