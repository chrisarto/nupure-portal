'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import shared from '../shared.module.css';
import styles from './Staff.module.css';
import LoadingSpinner from '@/app/components/LoadingSpinner';
import AttachmentLink from '@/app/components/AttachmentLink';
import type { Employee, TrainingRecord } from '@/lib/types';

const STATUS_PILLS = [
  { label: 'All Staff', value: '' },
  { label: 'Current', value: 'Current' },
  { label: 'Terminated', value: 'Terminated' },
];

function getInitials(name: string) {
  return (name || '?').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function getAvatarColor(name: string) {
  const colors = [
    '#0099cc', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
    '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
  ];
  const idx = (name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length;
  return colors[idx];
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Employee[]>([]);
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Current');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const staffRes = await fetch('/api/staff?status=all');
      if (!staffRes.ok) throw new Error('Failed to fetch staff');
      const staffJson: { data: Employee[]; trainingRecords: TrainingRecord[] } = await staffRes.json();
      setStaff(staffJson.data);
      setTrainingRecords(staffJson.trainingRecords || []);
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

  const trainingByEmployee = useMemo(() => {
    // Key by employeeName (string) — matched against staff fullName
    const map = new Map<string, TrainingRecord[]>();
    trainingRecords.forEach(record => {
      const name = record.employeeName?.trim();
      if (!name) return;
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(record);
    });
    return map;
  }, [trainingRecords]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return staff.filter(s => {
      const matchSearch = !search ||
        s.fullName?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.siteName?.toLowerCase().includes(q);
      const matchStatus = !statusFilter || s.status?.toLowerCase().includes(statusFilter.toLowerCase());
      return matchSearch && matchStatus;
    });
  }, [staff, search, statusFilter]);

  const getStatusBadgeClass = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('current')) return shared.badgeGreen;
    if (s.includes('terminated') || s.includes('past')) return shared.badgeRed;
    return shared.badgeGray;
  };

  const getTrainingBadgeClass = (trainingStatus: string) => {
    const s = trainingStatus?.toLowerCase() || '';
    if (s.includes('not required')) return shared.badgeGray;
    if (s === 'current') return shared.badgeGreen;
    if (s.includes('refresh') || s.includes('30 days')) return shared.badgeAmber;
    if (s.includes('requires') || s.includes('out of date')) return shared.badgeRed;
    return shared.badgeGray;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getCompliancePercent = (fullName: string) => {
    const records = trainingByEmployee.get(fullName?.trim() ?? '') || [];
    const required = records.filter(r => {
      const s = r.trainingStatus?.toLowerCase() || '';
      return s !== 'not required';
    });
    if (!required.length) return null;
    const current = required.filter(r => {
      const s = r.trainingStatus?.toLowerCase() || '';
      return s === 'current';
    }).length;
    return Math.round((current / required.length) * 100);
  };

  return (
    <>
      {loading && <LoadingSpinner message="Loading staff & training..." />}

      <div className={shared.pageHeader}>
        <div className={shared.pageHeaderTop}>
          <div>
            <h1 className={shared.pageTitle}>Staff & Training</h1>
            <p className={shared.pageDescription}>Nu-Pure team members and their training compliance</p>
          </div>
          <span className={shared.recordCount}>{filtered.length} staff members</span>
        </div>
      </div>

      <div className={shared.filterBar}>
        <input
          className={shared.searchInput}
          type="text"
          placeholder="🔍  Search by name or site..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={shared.filterPills}>
        {STATUS_PILLS.map(pill => (
          <button
            key={pill.value}
            className={`${shared.filterPill} ${statusFilter === pill.value ? shared.filterPillActive : ''}`}
            onClick={() => setStatusFilter(pill.value)}
          >
            {pill.label}
          </button>
        ))}
      </div>

      {error && (
        <div className={shared.errorState}>
          <div className={shared.errorIcon}>⚠️</div>
          <div className={shared.errorTitle}>Failed to load staff</div>
          <div className={shared.errorText}>{error}</div>
          <button className={shared.retryButton} onClick={() => void fetchData()}>Retry</button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className={shared.emptyState}>
          <div className={shared.emptyIcon}>👥</div>
          <div className={shared.emptyTitle}>No staff found</div>
          <div className={shared.emptyText}>Try adjusting your search or filters.</div>
        </div>
      )}

      {!error && (
        <div className={shared.cardGrid}>
          {filtered.map((member) => {
            const isExpanded = expandedId === member.id;
            const records = trainingByEmployee.get(member.fullName?.trim() ?? '') || [];
            const compliance = getCompliancePercent(member.fullName ?? '');
            const avatarColor = getAvatarColor(member.fullName || '');

            return (
              <div
                key={member.id}
                className={`${shared.card} ${styles.staffCard}`}
                onClick={() => setExpandedId(isExpanded ? null : member.id)}
              >
                <div className={styles.cardTop}>
                  <div
                    className={styles.avatar}
                    style={{ background: avatarColor }}
                  >
                    {getInitials(member.fullName || '')}
                  </div>
                  <div className={styles.staffInfo}>
                    <div className={styles.staffName}>{member.fullName || '—'}</div>
                    <div className={styles.staffEmail}>{member.email || '—'}</div>
                  </div>
                  <span className={`${shared.badge} ${getStatusBadgeClass(member.status)}`}>
                    {member.status || 'Unknown'}
                  </span>
                </div>

                {compliance !== null && (
                  <div className={styles.complianceSection}>
                    <div className={styles.complianceLabel}>
                      <span>Training Compliance</span>
                      <span style={{ fontWeight: 700, color: compliance >= 80 ? 'var(--status-green-text)' : compliance >= 50 ? 'var(--status-amber-text)' : 'var(--status-red-text)' }}>
                        {compliance}%
                      </span>
                    </div>
                    <div className={shared.progressBar}>
                      <div
                        className={shared.progressFill}
                        style={{ width: `${compliance}%`, background: compliance >= 80 ? 'linear-gradient(90deg,#10b981,#34d399)' : compliance >= 50 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : 'linear-gradient(90deg,#ef4444,#f87171)' }}
                      />
                    </div>
                  </div>
                )}

                {isExpanded && records.length > 0 && (
                  <div className={styles.trainingList}>
                    <hr className={styles.divider} />
                    <div className={styles.trainingTitle}>Training Records ({records.length})</div>
                    {records.map((rec, i) => {
                      return (
                        <div key={i} className={styles.trainingItem}>
                          <div className={styles.trainingName}>
                            {rec.longName || rec.documentCode || 'Unknown Procedure'}
                          </div>
                          <div className={styles.trainingMeta}>
                            <span className={`${shared.badge} ${getTrainingBadgeClass(rec.trainingStatus)}`}>
                              {rec.trainingStatus || '—'}
                            </span>
                            <span className={styles.trainingDate}>{formatDate(rec.dateOfTraining)}</span>
                          </div>
                          {rec.certificate && rec.certificate.length > 0 && (
                            <AttachmentLink
                              attachment={rec.certificate[0]}
                              label="📎 View Certificate"
                              className={shared.downloadBtn}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {isExpanded && records.length === 0 && (
                  <div className={styles.noTraining}>No training records found.</div>
                )}

                <div className={styles.expandHint}>{isExpanded ? '▲ Less' : '▼ View Training'}</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
