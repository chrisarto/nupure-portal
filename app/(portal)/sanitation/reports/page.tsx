'use client';

import { useState, useEffect, useCallback } from 'react';
import shared from '../../shared.module.css';
import styles from '../Sanitation.module.css';

interface ReportResponse {
  date: string;
  summary: Array<{
    code: string;
    name: string;
    total: number;
    completed: number;
    unable: number;
    deferred: number;
    not_started: number;
  }>;
  tasks: Array<{
    id: string;
    scheduled_date: string;
    status: string;
    completed_by: string | null;
    completed_at: string | null;
    notes: string;
    exception_reason: string | null;
    nupure_cp_task_templates: {
      name: string;
      frequency_type: string;
      scheduling_constraint: string;
      cleaning_level: string;
      nupure_cp_areas: { name: string } | null;
      nupure_cp_workstreams: { code: string; display_name: string };
    };
    nupure_cp_task_photos: Array<{
      id: string;
      photo_type: 'before' | 'after';
      url: string | null;
      uploaded_at: string;
      caption: string | null;
    }>;
  }>;
}

export default function DailyPositionReportPage() {
  const [currentDate, setCurrentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [workstreams, setWorkstreams] = useState<Array<{ id: string; code: string; display_name: string }>>([]);
  const [selectedWorkstream, setSelectedWorkstream] = useState('');
  const [reportData, setReportData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkstreams = async () => {
      try {
        const res = await fetch('/api/sanitation/workstreams');
        if (res.ok) {
          const json = await res.json() as { data: Array<{ id: string; code: string; display_name: string }> };
          setWorkstreams(json.data || []);
          if (json.data && json.data.length > 0 && !selectedWorkstream) {
            setSelectedWorkstream(json.data[0].code);
          }
        }
      } catch (err) {
        console.error('Failed to load workstreams:', err);
      }
    };
    void fetchWorkstreams();
  }, [selectedWorkstream]);

  const fetchReport = useCallback(async () => {
    if (!selectedWorkstream) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sanitation/reports/daily?date=${currentDate}&workstream=${selectedWorkstream}`);
      if (!res.ok) throw new Error('Failed to load report');
      const json = await res.json() as ReportResponse;
      setReportData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [currentDate, selectedWorkstream]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const handlePrint = () => {
    window.print();
  };

  const dayName = new Date(currentDate + 'T00:00:00').toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const summary = reportData?.summary[0];
  const completionPercent = summary?.total ? Math.round((summary.completed / summary.total) * 100) : 0;

  return (
    <div className={shared.pageContainer}>
      <div className={shared.pageHeader}>
        <div className={shared.pageHeaderTop}>
          <div>
            <h1 className={shared.pageTitle}>Cleaning Completion Report</h1>
            <p className={shared.pageDescription}>Printable report for task completion (Master Sanitation Schedule)</p>
          </div>
          <button className={shared.downloadBtn} onClick={handlePrint}>
            🖨 Print Report
          </button>
        </div>
      </div>

      <div className={styles.dayPlannerControls || shared.filterBar} style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className={styles.dateNav}>
          <input 
            type="date" 
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            className={styles.wsSelect || shared.filterSelect}
            style={{ width: 'auto' }}
          />
        </div>
        <select
          className={styles.wsSelect || shared.filterSelect}
          value={selectedWorkstream}
          onChange={e => setSelectedWorkstream(e.target.value)}
        >
          {workstreams.map(ws => (
            <option key={ws.id} value={ws.code}>{ws.display_name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className={shared.tableWrapper}>
          <div className={shared.skeleton} style={{ height: '400px' }} />
        </div>
      ) : error ? (
        <div className={shared.errorState}>
          <div className={shared.errorIcon}>⚠️</div>
          <div className={shared.errorTitle}>Error</div>
          <div className={shared.errorText}>{error}</div>
          <button className={shared.retryButton} onClick={() => void fetchReport()}>Retry</button>
        </div>
      ) : !reportData || reportData.tasks.length === 0 ? (
        <div className={shared.emptyState}>
          <div className={shared.emptyIcon}>📋</div>
          <div className={shared.emptyTitle}>No Tasks Found</div>
          <div className={shared.emptyText}>
            No tasks found for {dayName} in this workstream.
          </div>
        </div>
      ) : (
        <div>
          {summary && (
            <div className={styles.reportSummary} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', background: 'var(--surface-color)', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--border-color)' }}>
              <div className={styles.reportSummaryItem}>
                <span className={styles.reportSummaryLabel} style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Position</span>
                <span className={styles.reportSummaryValue} style={{ fontWeight: 600 }}>{summary.name}</span>
              </div>
              <div className={styles.reportSummaryItem}>
                <span className={styles.reportSummaryLabel} style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Date</span>
                <span className={styles.reportSummaryValue} style={{ fontWeight: 600 }}>{dayName}</span>
              </div>
              <div className={styles.reportSummaryItem}>
                <span className={styles.reportSummaryLabel} style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Completion</span>
                <span className={styles.reportSummaryValue} style={{ fontWeight: 600 }}>{summary.completed}/{summary.total} ({completionPercent}%)</span>
              </div>
              <div className={styles.reportSummaryItem}>
                <span className={styles.reportSummaryLabel} style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Unable / Deferred</span>
                <span className={styles.reportSummaryValue} style={{ fontWeight: 600, color: summary.unable > 0 ? '#ef4444' : 'inherit' }}>
                  {summary.unable} / {summary.deferred}
                </span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reportData.tasks.map(task => {
              const beforePhotos = task.nupure_cp_task_photos?.filter(p => p.photo_type === 'before') || [];
              const afterPhotos = task.nupure_cp_task_photos?.filter(p => p.photo_type === 'after') || [];
              
              let statusClass = shared.badgeGray;
              if (task.status === 'completed') statusClass = shared.badgeGreen;
              else if (task.status === 'unable') statusClass = shared.badgeRed;
              else if (task.status === 'deferred') statusClass = shared.badgeAmber;

              return (
                <div key={task.id} className={styles.reportTaskCard} style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1.25rem' }}>
                  <div className={styles.reportTaskHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <h3 className={styles.reportTaskTitle} style={{ margin: 0, fontSize: '1.1rem' }}>{task.nupure_cp_task_templates.name}</h3>
                      <div className={styles.reportTaskMeta} style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        <span>📍 {task.nupure_cp_task_templates.nupure_cp_areas?.name || 'General'}</span>
                        {task.completed_at && <span>🕒 {new Date(task.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                      </div>
                    </div>
                    <span className={`${shared.badge} ${statusClass}`}>
                      {task.status.toUpperCase()}
                    </span>
                  </div>

                  {task.exception_reason && (
                    <div className={styles.exceptionReason} style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '4px', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#b91c1c' }}>
                      <strong>Exception Reason:</strong> {task.exception_reason}
                    </div>
                  )}
                  {task.notes && (
                    <div className={styles.exceptionReason} style={{ background: 'rgba(243, 244, 246, 1)', padding: '0.75rem', borderRadius: '4px', fontSize: '0.9rem', marginBottom: '0.5rem', color: '#374151' }}>
                      <strong>Notes:</strong> {task.notes}
                    </div>
                  )}

                  {(beforePhotos.length > 0 || afterPhotos.length > 0) && (
                    <div className={styles.photoRow} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                      {beforePhotos.length > 0 && (
                        <div className={styles.photoGroup}>
                          <span className={styles.photoGroupTitle} style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>Before Photos</span>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {beforePhotos.map(p => (
                              p.url && <img key={p.id} src={p.url} alt="Before" className={styles.photoThumb} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e5e7eb' }} />
                            ))}
                          </div>
                        </div>
                      )}
                      {afterPhotos.length > 0 && (
                        <div className={styles.photoGroup}>
                          <span className={styles.photoGroupTitle} style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>After Photos</span>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {afterPhotos.map(p => (
                              p.url && <img key={p.id} src={p.url} alt="After" className={styles.photoThumb} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e5e7eb' }} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
