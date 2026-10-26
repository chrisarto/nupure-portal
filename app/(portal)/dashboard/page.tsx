'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import styles from './Dashboard.module.css';
import type {
  TrainingDocument,
  ScheduleEvent,
  HandoverReport,
  PreOpReport,
  Employee,
  SubmissionRecord,
} from '@/lib/types';

interface ApiResponse<T> {
  data: T[];
  count: number;
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
  handoverReports: number;
  preOpReports: number;
  sanitationTasks: number;
  roomCleansCount: number;
  openQrIssues: number;
  closedQrIssues: number;
  stocktakeOrdersCount: number;
}

export default function DashboardPage() {
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dailySubmissions, setDailySubmissions] = useState<SubmissionRecord[]>([]);
  const [weeklySubmissions, setWeeklySubmissions] = useState<SubmissionRecord[]>([]);
  const [recentSubmissions, setRecentSubmissions] = useState<SubmissionRecord[]>([]);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [docs, staff, schedule, handover, preop, sanitation, cleaningRecs, qrIssues, stocktake] =
        await Promise.all([
          fetch('/api/documents').then((r) => r.json() as Promise<ApiResponse<TrainingDocument>>),
          fetch('/api/staff').then((r) => r.json() as Promise<ApiResponse<Employee>>),
          fetch('/api/schedule').then((r) => r.json() as Promise<ApiResponse<ScheduleEvent>>),
          fetch('/api/reports/handover').then((r) => r.json() as Promise<ApiResponse<HandoverReport>>),
          fetch('/api/reports/pre-op').then((r) => r.json() as Promise<ApiResponse<PreOpReport>>),
          fetch('/api/sanitation').then((r) => r.json() as Promise<ApiResponse<{ id: string }>>),
          fetch('/api/cleaning-records').then((r) => r.json() as Promise<ApiResponse<{ id: string }>>),
          fetch('/api/qr-issues').then((r) => r.json() as Promise<ApiResponse<{ id: string; status: string }>>),
          fetch('/api/stocktake').then((r) => r.json() as Promise<{ logs?: Array<{ id: string }> }>),
        ]);

      void fetch('/api/submissions?slug=daily-facility-inspection&limit=30')
        .then((r) => r.json() as Promise<ApiResponse<SubmissionRecord>>)
        .then((j) => { setDailySubmissions(j.data ?? []); })
        .catch(() => {});
      void fetch('/api/submissions?slug=weekly-hygiene-audit&limit=10')
        .then((r) => r.json() as Promise<ApiResponse<SubmissionRecord>>)
        .then((j) => { setWeeklySubmissions(j.data ?? []); })
        .catch(() => {});
      void fetch('/api/submissions?limit=5')
        .then((r) => r.json() as Promise<ApiResponse<SubmissionRecord>>)
        .then((j) => { setRecentSubmissions(j.data ?? []); })
        .catch(() => {});

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

      setKpi({
        totalDocuments: docs.count ?? 0,
        controlDocuments: controlDocs,
        reviewDueDocuments: reviewDue,
        totalStaff: staff.count ?? 0,
        scheduleTotal: schedule.count ?? 0,
        scheduleCompleted: completed,
        scheduleOverdue: overdue,
        scheduleInProgress: inProgress,
        handoverReports: handover.count ?? 0,
        preOpReports: preop.count ?? 0,
        sanitationTasks: sanitation.count ?? 0,
        roomCleansCount: cleaningRecs.count ?? 0,
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

  const dailyWithScore = dailySubmissions.filter((s) => s.overall_score !== null);
  const avgDailyScore = dailyWithScore.length > 0
    ? Math.round(dailyWithScore.reduce((sum, s) => sum + (s.overall_score ?? 0), 0) / dailyWithScore.length * 10) / 10
    : null;

  const weeklyWithScore = weeklySubmissions.filter((s) => s.overall_score !== null);
  const avgWeeklyScore = weeklyWithScore.length > 0
    ? Math.round(weeklyWithScore.reduce((sum, s) => sum + (s.overall_score ?? 0), 0) / weeklyWithScore.length * 10) / 10
    : null;

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
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
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

        <Link
          href="/qr-codes"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            color: '#0f172a',
            textDecoration: 'none',
            padding: '18px 20px',
            borderRadius: 12,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#16a34a' }}>
            Scan-to-Report Signs
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, marginTop: 4 }}>Print Site QR Posters →</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            26 room-specific QR code posters for Stapylton
          </div>
        </Link>
      </div>

      {/* KPI Cards Row */}
      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiTeal}`}>
          <div className={styles.kpiIcon}>📋</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiValue}>{loading ? '—' : kpi?.totalDocuments}</div>
            <div className={styles.kpiLabel}>Training Documents</div>
            {!loading && kpi && (
              <div className={styles.kpiMeta}>
                <span className={styles.kpiGood}>{kpi.controlDocuments} current</span>
                {kpi.reviewDueDocuments > 0 && (
                  <span className={styles.kpiWarn}>{kpi.reviewDueDocuments} due for review</span>
                )}
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
            <div className={styles.kpiValue}>{loading ? '—' : kpi?.sanitationTasks}</div>
            <div className={styles.kpiLabel}>Sanitation Scope Areas</div>
            {!loading && kpi && (
              <div className={styles.kpiMeta}>
                <span>5 Zones + Hygiene Services</span>
              </div>
            )}
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiGreen}`}>
          <div className={styles.kpiIcon}>📋</div>
          <div className={styles.kpiContent}>
            <div
              className={styles.kpiValue}
              style={{
                color: avgDailyScore !== null
                  ? (avgDailyScore >= 95 ? '#10b981' : avgDailyScore >= 85 ? '#ca8a04' : '#ef4444')
                  : undefined,
              }}
            >
              {avgDailyScore !== null ? `${avgDailyScore}%` : '100%'}
            </div>
            <div className={styles.kpiLabel}>Avg Daily Inspection Score</div>
            <div className={styles.kpiMeta}>
              <span>{dailySubmissions.length} facility inspections</span>
            </div>
          </div>
        </div>

        <div className={`${styles.kpiCard} ${styles.kpiBlue}`}>
          <div className={styles.kpiIcon}>📆</div>
          <div className={styles.kpiContent}>
            <div
              className={styles.kpiValue}
              style={{
                color: avgWeeklyScore !== null
                  ? (avgWeeklyScore >= 95 ? '#10b981' : avgWeeklyScore >= 85 ? '#ca8a04' : '#ef4444')
                  : undefined,
              }}
            >
              {avgWeeklyScore !== null ? `${avgWeeklyScore}%` : '100%'}
            </div>
            <div className={styles.kpiLabel}>Avg Weekly Hygiene Score</div>
            <div className={styles.kpiMeta}>
              <span>{weeklySubmissions.length} weekly QA audits</span>
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
            <span className={styles.statTitle}>Site Reports &amp; Actions</span>
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

      {/* Recent Inspections */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Recent Inspections</h2>
          <a href="/forms" className={styles.sectionLink}>View all →</a>
        </div>
        {recentSubmissions.length === 0 ? (
          <div className={styles.emptyCard}>
            <p>No inspection submissions yet. <a href="/forms">Start a facility inspection</a> or <a href="/cleaning-report">log a room clean</a>.</p>
          </div>
        ) : (
          <div className={styles.recentList}>
            {recentSubmissions.map((s) => (
              <a key={s.id} href={`/reports/submissions/${s.id}`} className={styles.recentItem}>
                <div className={styles.recentItemLeft}>
                  <span className={styles.recentItemForm}>{s.template_name}</span>
                  <span className={styles.recentItemMeta}>
                    {s.submitted_by || 'Unknown'}
                    {' · '}
                    {new Date(s.submitted_at ?? s.created_at).toLocaleDateString('en-AU', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </span>
                </div>
                {s.overall_score !== null && (
                  <span
                    className={styles.recentItemScore}
                    style={{
                      color: s.overall_score >= 95 ? '#10b981' : s.overall_score >= 85 ? '#ca8a04' : '#ef4444',
                      background:
                        s.overall_score >= 95
                          ? 'rgba(16,185,129,0.1)'
                          : s.overall_score >= 85
                          ? 'rgba(202,138,4,0.1)'
                          : 'rgba(239,68,68,0.1)',
                    }}
                  >
                    {s.overall_score}%
                  </span>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
