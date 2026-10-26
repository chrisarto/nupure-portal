'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import shared from '../shared.module.css';
import styles from './TrainingMatrix.module.css';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import type { Employee, TrainingRecord } from '@/lib/types';

type StatusKey = 'current' | 'refresh' | 'requires' | 'outofdate' | 'notrequired' | 'none';

function getStatusKey(status: string): StatusKey {
  const s = status?.toLowerCase() || '';
  if (!s) return 'none';
  if (s === 'current') return 'current';
  if (s.includes('refresh') || s.includes('30 days')) return 'refresh';
  if (s.includes('requires')) return 'requires';
  if (s.includes('out of date')) return 'outofdate';
  if (s.includes('not required')) return 'notrequired';
  return 'none';
}

const STATUS_META: Record<StatusKey, { label: string; color: string; bg: string }> = {
  current:     { label: 'Current',           color: '#fff',     bg: '#10b981' },
  refresh:     { label: 'Refresh Due',        color: '#1a1a1a',  bg: '#fbbf24' },
  requires:    { label: 'Requires Training',  color: '#fff',     bg: '#ef4444' },
  outofdate:   { label: 'Out of Date',        color: '#fff',     bg: '#dc2626' },
  notrequired: { label: 'Not Required',       color: '#6b7280',  bg: '#f3f4f6' },
  none:        { label: 'No Record',          color: '#9ca3af',  bg: 'transparent' },
};

export default function TrainingMatrixPage() {
  const [staff, setStaff] = useState<Employee[]>([]);
  const [records, setRecords] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [staffRes, trainingRes] = await Promise.all([
        fetch('/api/staff?status=all'),
        fetch('/api/training'),
      ]);
      if (!staffRes.ok) throw new Error('Failed to fetch staff');
      if (!trainingRes.ok) throw new Error('Failed to fetch training');
      const staffJson: { data: Employee[] } = await staffRes.json();
      const trainingJson: { data: TrainingRecord[] } = await trainingRes.json();
      // Only current staff
      setStaff(staffJson.data.filter(s => s.status?.toLowerCase().includes('current')));
      setRecords(trainingJson.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const onSync = () => void fetchData();
    window.addEventListener('gotzinger-sync-complete', onSync);
    return () => window.removeEventListener('gotzinger-sync-complete', onSync);
  }, [fetchData]);

  const sites = useMemo(() =>
    [...new Set(staff.map(s => s.siteName).filter(Boolean))].sort()
  , [staff]);

  const filteredStaff = useMemo(() => {
    return staff.filter(s => {
      const matchSite = !siteFilter || s.siteName === siteFilter;
      const matchSearch = !search || s.fullName?.toLowerCase().includes(search.toLowerCase());
      return matchSite && matchSearch;
    });
  }, [staff, siteFilter, search]);

  // Build matrix data
  const { procedures, matrix } = useMemo(() => {
    // All unique procedures from training records
    const procMap = new Map<string, string>(); // key → display label
    records.forEach(r => {
      const key = r.documentCode || r.longName || r.id;
      if (key && !procMap.has(key)) {
        procMap.set(key, r.longName || r.documentCode || key);
      }
    });
    const procedures = Array.from(procMap.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.code.localeCompare(b.code));

    // Build lookup: employeeName → { procedureCode → record }
    const lookup = new Map<string, Map<string, TrainingRecord>>();
    records.forEach(r => {
      const emp = r.employeeName?.trim();
      const proc = r.documentCode || r.longName || r.id;
      if (!emp || !proc) return;
      if (!lookup.has(emp)) lookup.set(emp, new Map());
      lookup.get(emp)!.set(proc, r);
    });

    return { procedures, matrix: lookup };
  }, [records]);

  const filteredProcedures = useMemo(() => {
    if (!statusFilter) return procedures;
    return procedures.filter(proc => {
      // Include procedure if ANY staff member has the filtered status
      return filteredStaff.some(member => {
        const rec = matrix.get(member.fullName?.trim() ?? '')?.get(proc.code);
        return getStatusKey(rec?.trainingStatus ?? '') === statusFilter;
      });
    });
  }, [procedures, statusFilter, filteredStaff, matrix]);

  // Compliance summary per staff member
  const getStaffCompliance = (fullName: string) => {
    const emp = matrix.get(fullName?.trim() ?? '');
    if (!emp) return { pct: 0, current: 0, total: 0 };
    const required = [...emp.values()].filter(r => getStatusKey(r.trainingStatus) !== 'notrequired');
    const current = required.filter(r => getStatusKey(r.trainingStatus) === 'current').length;
    return { pct: required.length ? Math.round((current / required.length) * 100) : 100, current, total: required.length };
  };

  return (
    <>
      {loading && <LoadingSpinner message="Building training matrix..." />}

      <div className={shared.pageHeader}>
        <div className={shared.pageHeaderTop}>
          <div>
            <h1 className={shared.pageTitle}>Training Matrix</h1>
            <p className={shared.pageDescription}>
              Visual overview of training compliance across all staff and procedures
            </p>
          </div>
          <span className={shared.recordCount}>
            {filteredStaff.length} staff · {filteredProcedures.length} procedures
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        {(Object.entries(STATUS_META) as [StatusKey, typeof STATUS_META[StatusKey]][]).map(([key, meta]) => (
          <button
            key={key}
            className={`${styles.legendItem} ${statusFilter === key ? styles.legendActive : ''}`}
            onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
            style={{ '--cell-bg': meta.bg, '--cell-color': meta.color } as React.CSSProperties}
          >
            <span className={styles.legendDot} style={{ background: meta.bg, border: meta.bg === 'transparent' ? '1px dashed #9ca3af' : 'none' }} />
            {meta.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className={shared.filterBar}>
        <input
          className={shared.searchInput}
          type="text"
          placeholder="🔍 Search staff..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className={shared.filterSelect}
          value={siteFilter}
          onChange={e => setSiteFilter(e.target.value)}
        >
          <option value="">All Sites</option>
          {sites.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && (
        <div className={shared.errorState}>
          <div className={shared.errorIcon}>⚠️</div>
          <div className={shared.errorTitle}>Failed to load data</div>
          <div className={shared.errorText}>{error}</div>
          <button className={shared.retryButton} onClick={() => void fetchData()}>Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className={styles.matrixWrapper}>
          <div className={styles.matrixScroll}>
            <table className={styles.matrix}>
              <thead>
                <tr>
                  {/* Sticky staff name + compliance column */}
                  <th className={`${styles.th} ${styles.stickyCol} ${styles.staffHeader}`}>
                    Staff Member
                  </th>
                  <th className={`${styles.th} ${styles.stickyCol2} ${styles.pctHeader}`}>
                    %
                  </th>
                  {filteredProcedures.map(proc => (
                    <th
                      key={proc.code}
                      className={styles.th}
                      title={proc.name}
                    >
                      <div className={styles.colLabel}>{proc.code || proc.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map(member => {
                  const empMap = matrix.get(member.fullName?.trim() ?? '');
                  const compliance = getStaffCompliance(member.fullName ?? '');
                  const pctColor = compliance.pct >= 80
                    ? '#10b981' : compliance.pct >= 50
                    ? '#f59e0b' : '#ef4444';

                  return (
                    <tr key={member.id} className={styles.row}>
                      <td className={`${styles.td} ${styles.stickyCol} ${styles.staffCell}`}>
                        <span className={styles.staffName}>{member.fullName}</span>
                        {member.siteName && (
                          <span className={styles.staffSite}>{member.siteName}</span>
                        )}
                      </td>
                      <td className={`${styles.td} ${styles.stickyCol2} ${styles.pctCell}`}>
                        <span style={{ color: pctColor, fontWeight: 700, fontSize: '0.8rem' }}>
                          {compliance.pct}%
                        </span>
                      </td>
                      {filteredProcedures.map(proc => {
                        const rec = empMap?.get(proc.code);
                        const statusKey = getStatusKey(rec?.trainingStatus ?? '');
                        const meta = STATUS_META[statusKey];
                        const tooltipText = rec
                          ? `${proc.name}\nStatus: ${rec.trainingStatus || 'Unknown'}\nTrained: ${rec.dateOfTraining || '—'}`
                          : `${proc.name}\nNo record`;

                        return (
                          <td
                            key={proc.code}
                            className={styles.td}
                            onMouseEnter={e => {
                              const r = (e.target as HTMLElement).getBoundingClientRect();
                              setTooltip({ text: tooltipText, x: r.left + r.width / 2, y: r.top - 8 });
                            }}
                            onMouseLeave={() => setTooltip(null)}
                          >
                            <div
                              className={styles.cell}
                              style={{
                                background: meta.bg,
                                border: statusKey === 'none' ? '1px dashed #374151' : 'none',
                              }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text.split('\n').map((line, i) => (
            <div key={i} className={i === 0 ? styles.tooltipTitle : styles.tooltipLine}>{line}</div>
          ))}
        </div>
      )}
    </>
  );
}
