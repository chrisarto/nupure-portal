'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import styles from './Dashboard.module.css';
import type {
  TrainingDocument,
  ScheduleEvent,
  Employee,
} from '@/lib/types';

interface ApiResponse<T> {
  data: T[];
  count: number;
}

interface CleaningRecordSummary {
  id: string;
  report_number: string;
  date: string;
  zone: string;
  location: string;
  total_time_minutes: number;
  visual_inspection_passed: boolean;
  submitted_by: string;
  created_at: string;
}

interface KpiData {
  totalDocuments: number;
  controlDocuments: number;
  reviewDueDocuments: number;
  totalStaff: number;
  scheduleTotal: number;
  scheduleCompleted: number;
  scheduleOverdue: number;
  scheduleInProgress: number;
  sanitationTasks: number;
  roomCleansCount: number;
  hygieneServicesCount: number;
  openQrIssues: number;
  closedQrIssues: number;
  stocktakeOrdersCount: number;
}

export default function DashboardPage() {
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [recentRoomReports, setRecentRoomReports] = useState<CleaningRecordSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [docs, staff, schedule, sanitation, cleaningRecs, qrIssues, stocktake] =
        await Promise.all([
          fetch('/api/documents').then((r) => r.json() as Promise<ApiResponse<TrainingDocument>>),
          fetch('/api/staff').then((r) => r.json() as Promise<ApiResponse<Employee>>),
          fetch('/api/schedule').then((r) => r.json() as Promise<ApiResponse<ScheduleEvent>>),
          fetch('/api/sanitation').then((r) => r.json() as Promise<ApiResponse<{ id: string }>>),
          fetch('/api/cleaning-records').then((r) => r.json() as Promise<ApiResponse<CleaningRecordSummary>>),
          fetch('/api/qr-issues').then((r) => r.json() as Promise<ApiResponse<{ id: string; status: string }>>),
          fetch('/api/stocktake').then((r) => r.json() as Promise<{ logs?: Array<{ id: string }> }>),
        ]);

      const controlDocs = (docs.data ?? []).filter((d) => d.status.includes('Control Document') || d.status === 'Current').length;
      const reviewDue = (docs.data ?? []).filter((d) => {
        if (!d.nextReviewDate) return false;
        const daysLeft = Math.ceil((new Date(d.nextReviewDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return daysLeft <= 30;
      }).length;

      const completed = (schedule.data ?? []).filter((e) => e.status === 'Completed').length;
      const overdue = (schedule.data ?? []).filter((e) => e.status === 'OverDue').length;
      const inProgress = (schedule.data ?? []).filter((e) => e.status === 'In progress').length;

      const openIssues = (qrIssues.data ?? []).filter((i) => i.status !== 'completed').length;
      const closedIssues = (qrIssues.data ?? []).filter((i) => i.status === 'completed').length;

      const allCleanRecs = cleaningRecs.data ?? [];
      const hygieneCount = allCleanRecs.filter(
        r =>
          r.location.toLowerCase().includes('sanitary') ||
          r.location.toLowerCase().includes('air freshener') ||
          r.zone.toLowerCase().includes('hygiene services')
      ).length;

      setRecentRoomReports(allCleanRecs.slice(0, 8));

      setKpi({
        totalDocuments: docs.count ?? 0,
        controlDocuments: controlDocs,
        reviewDueDocuments: reviewDue,
        totalStaff: staff.count ?? 0,
        scheduleTotal: schedule.count ?? 0,
        scheduleCompleted: completed,
        scheduleOverdue: overdue,
        scheduleInProgress: inProgress,
        sanitationTasks: sanitation.count ?? 0,
        roomCleansCount: cleaningRecs.count ?? 0,
        hygieneServicesCount: hygieneCount,
        openQrIssues: openIssues,
        closedQrIssues: closedIssues,
        stocktakeOrdersCount: (stocktake.logs ?? []).length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboard();
    const onSync = () => void fetchDashboard();
    window.addEventListener('nupure-sync-complete', onSync);
    return () => window.removeEventListener('nupure-sync-complete', onSync);
  }, [fetchDashboard]);

  const adherenceRate = kpi && kpi.scheduleTotal > 0
    ? Math.round(((kpi.scheduleCompleted) / kpi.scheduleTotal) * 100)
    : 100;

  const docComplianceRate = kpi && kpi.totalDocuments > 0
    ? Math.round((kpi.controlDocuments / kpi.totalDocuments) * 100)
    : 100;

  const todayIso = new Date().toISOString().slice(0, 10);

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <h1 className={styles.title}>Dashboard</h1>
          <p className={styles.subtitle}>Nu-Pure Beverages Compliance Overview</p>
        </div>
        <div className={styles.errorCard}>
          <span>⚠️</span>
          <p>{error}</p>
          <button onClick={() => void fetchDashboard()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Nu-Pure Beverages — Compliance &amp; Operations Hub</h1>
        <p className={styles.subtitle}>Stapylton Facility (1/76 Quinns Hill Rd E, Stapylton QLD 4207) — 7-Day Hygiene &amp; Compliance Portal</p>
      </div>

      {/* Quick Action Bar for Core Nu-Pure Workflows */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
          marginBottom: 24,
        }}
      >
        <Link
          href="/cleaning-report"
          style={{
            background: 'linear-gradient(135deg, #0f3460, #0284c7)',
            color: '#ffffff',
            textDecoration: 'none',
            padding: '18px 20px',
            borderRadius: 12,
            boxShadow: '0 4px 12px rgba(2,132,199,0.2)',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#bae6fd' }}>
            Room-by-Room Digital Report
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 4 }}>Log Room Clean →</div>
          <div style={{ fontSize: 12, color: '#e0f2fe', marginTop: 4 }}>
            Complete 1 room at a time &amp; update schedule ({kpi?.roomCleansCount ?? 0} logged)
          </div>
        </Link>

        <Link
          href="/hygiene-services"
          style={{
            background: 'linear-gradient(135deg, #14532d, #16a34a)',
            color: '#ffffff',
            textDecoration: 'none',
            padding: '18px 20px',
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#dcfce7' }}>
            Sanitary &amp; Air Care
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 4 }}>
            Sanitary Bins &amp; Air Fresheners →
          </div>
          <div style={{ fontSize: 12, color: '#f0fdf4', marginTop: 4 }}>
            10 Sanitary Bins &amp; 9 Auto Dispensers ({kpi?.hygieneServicesCount ?? 0} logs)
          </div>
        </Link>

        <Link
          href="/sanitation/reports"
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            color: '#0f172a',
            textDecoration: 'none',
            padding: '18px 20px',
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0f3460' }}>
            Daily PDF Rollup
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 4 }}>
            Daily Completion Report PDF →
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Download or email formatted daily A4 PDF report
          </div>
        </Link>

        <Link
          href="/actions"
          style={{
            background: kpi && kpi.openQrIssues > 0 ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : '#ffffff',
            color: kpi && kpi.openQrIssues > 0 ? '#ffffff' : '#0f172a',
            border: kpi && kpi.openQrIssues > 0 ? 'none' : '1px solid #e2e8f0',
            textDecoration: 'none',
            padding: '18px 20px',
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: kpi && kpi.openQrIssues > 0 ? '#fee2e2' : '#dc2626',
            }}
          >
            QR Issue Reporting
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 4 }}>
            Required Actions ({kpi?.openQrIssues ?? 0} Open) →
          </div>
          <div
            style={{
              fontSize: 12,
              color: kpi && kpi.openQrIssues > 0 ? '#fecaca' : '#64748b',
              marginTop: 4,
            }}
          >
            {kpi?.closedQrIssues ?? 0} closed out with Completion Reports
          </div>
        </Link>

        <Link
          href="/stocktake"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            color: '#0f172a',
            textDecoration: 'none',
            padding: '18px 20px',
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#0284c7' }}>
            Consumables Requisition
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 4 }}>Stocktake &amp; Email Order →</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Weekly check &amp; auto-email order to Nu-Pure ({kpi?.stocktakeOrdersCount ?? 0} sent)
          </div>
        </Link>
      </div>

      {/* KPI Cards Row */}
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiTeal}`}>
          <div className={styles.kpiIcon}>📋</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiValue}>{loading ? '—' : kpi?.totalDocuments}</div>
            <div className={styles.kpiLabel}>Corporate &amp; Training Docs</div>
            {!loading && kpi && (
              <div className={styles.kpiMeta}>
                <span className={styles.kpiGood}>{kpi.controlDocuments} current</span>
              </div>
            )}
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiBlue}`}>
          <div className={styles.kpiIcon}>👥</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiValue}>{loading ? '—' : kpi?.totalStaff}</div>
            <div className={styles.kpiLabel}>Nu-Pure Staff Members</div>
            {!loading && kpi && (
              <div className={styles.kpiMeta}>
                <span className={styles.kpiGood}>Nu-Pure Stapylton</span>
              </div>
            )}
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiGreen}`}>
          <div className={styles.kpiIcon}>✅</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiValue}>{loading ? '—' : `${adherenceRate}%`}</div>
            <div className={styles.kpiLabel}>Schedule Adherence</div>
            {!loading && kpi && (
              <div className={styles.kpiMeta}>
                <span className={styles.kpiGood}>{kpi.scheduleCompleted} completed</span>
                {kpi.scheduleOverdue > 0 && (
                  <span className={styles.kpiDanger}>{kpi.scheduleOverdue} overdue</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiAmber}`}>
          <div className={styles.kpiIcon}>🧹</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiValue}>26</div>
            <div className={styles.kpiLabel}>Designated Scope Areas</div>
            <div className={styles.kpiMeta}>
              <span>45 hrs/wk • 7-Day Service</span>
            </div>
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiGreen}`}>
          <div className={styles.kpiIcon}>📄</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiValue}>{loading ? '—' : kpi?.roomCleansCount}</div>
            <div className={styles.kpiLabel}>Room Clean Reports</div>
            <div className={styles.kpiMeta}>
              <span>Digital Room-by-Room Sign-Offs</span>
            </div>
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiBlue}`}>
          <div className={styles.kpiIcon}>♻️</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiValue}>19</div>
            <div className={styles.kpiLabel}>Managed Hygiene Units</div>
            <div className={styles.kpiMeta}>
              <span>10 Sanitary Bins • 9 Air Fresheners</span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statIcon}>📊</span>
            <span className={styles.statTitle}>Document Compliance</span>
          </div>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: loading ? '0%' : `${docComplianceRate}%` }}
            />
          </div>
          <div className={styles.progressLabel}>
            <span>{loading ? '—' : `${docComplianceRate}%`} current</span>
            <span>{loading ? '—' : kpi?.totalDocuments} total</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statIcon}>📅</span>
            <span className={styles.statTitle}>Active Schedule</span>
          </div>
          <div className={styles.scheduleBreakdown}>
            <div className={styles.breakdownItem}>
              <span className={`${styles.dot} ${styles.dotGreen}`} />
              <span>Completed</span>
              <strong>{loading ? '—' : kpi?.scheduleCompleted}</strong>
            </div>
            <div className={styles.breakdownItem}>
              <span className={`${styles.dot} ${styles.dotAmber}`} />
              <span>In Progress</span>
              <strong>{loading ? '—' : kpi?.scheduleInProgress}</strong>
            </div>
            <div className={styles.breakdownItem}>
              <span className={`${styles.dot} ${styles.dotRed}`} />
              <span>Overdue</span>
              <strong>{loading ? '—' : kpi?.scheduleOverdue}</strong>
            </div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statIcon}>📝</span>
            <span className={styles.statTitle}>Site Reports &amp; Orders</span>
          </div>
          <div className={styles.scheduleBreakdown}>
            <div className={styles.breakdownItem}>
              <span className={`${styles.dot} ${styles.dotTeal}`} />
              <span>Room Clean Reports</span>
              <strong>{loading ? '—' : kpi?.roomCleansCount}</strong>
            </div>
            <div className={styles.breakdownItem}>
              <span className={`${styles.dot} ${styles.dotBlue}`} />
              <span>Stocktake Orders</span>
              <strong>{loading ? '—' : kpi?.stocktakeOrdersCount}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Room Clean & Hygiene Service Reports */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Recent Room Clean &amp; Hygiene Service Reports</h2>
          <div style={{ display: 'flex', gap: 12 }}>
            <a
              href={`/api/cleaning-records/daily-pdf?date=${todayIso}`}
              style={{
                color: '#16a34a',
                fontWeight: 800,
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              ⬇ Download Daily Completion PDF →
            </a>
            <Link href="/reports/cleaning-events" className={styles.sectionLink}>
              View all reports →
            </Link>
          </div>
        </div>
        {recentRoomReports.length === 0 ? (
          <div className={styles.emptyCard}>
            <p>
              No room cleaning reports logged yet.{' '}
              <Link href="/cleaning-report">Log a room clean</Link> or{' '}
              <Link href="/hygiene-services">record sanitary bin &amp; air freshener changes</Link>.
            </p>
          </div>
        ) : (
          <div className={styles.recentList}>
            {recentRoomReports.map((r) => (
              <Link key={r.id} href={`/reports/cleaning-events/${r.id}`} className={styles.recentItem}>
                <div className={styles.recentItemLeft}>
                  <span className={styles.recentItemForm}>
                    {r.location} <span style={{ color: '#64748b', fontWeight: 500 }}>({r.zone})</span>
                  </span>
                  <span className={styles.recentItemMeta}>
                    {r.report_number} &bull; {r.submitted_by || 'MJ Hygiene'} &bull; {r.date} ({r.total_time_minutes} mins)
                  </span>
                </div>
                <span
                  className={styles.recentItemScore}
                  style={{
                    color: r.visual_inspection_passed !== false ? '#10b981' : '#ef4444',
                    background:
                      r.visual_inspection_passed !== false
                        ? 'rgba(16,185,129,0.1)'
                        : 'rgba(239,68,68,0.1)',
                  }}
                >
                  {r.visual_inspection_passed !== false ? 'PASSED ✓' : 'RECLEAN'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
