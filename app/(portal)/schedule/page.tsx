'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import shared from '../shared.module.css';
import type { ScheduleEvent } from '@/lib/types';
import { CSVExportButton } from '@/app/components/ui/CSVExportButton';


export default function SchedulePage() {
  const [schedule, setSchedule] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/schedule');
      if (!res.ok) throw new Error('Failed to fetch schedule');
      const json: { data: ScheduleEvent[] } = await res.json();
      setSchedule(json.data);
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

  const filtered = useMemo(() => {
    return schedule.filter((evt) => {
      const matchSearch = evt.area?.toLowerCase().includes(search.toLowerCase()) ||
                          evt.cleaningTask?.toLowerCase().includes(search.toLowerCase()) ||
                          evt.assignee?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter ? evt.status === statusFilter : true;
      return matchSearch && matchStatus;
    });
  }, [schedule, search, statusFilter]);

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (dept: string) => {
    setCollapsedGroups(prev => ({ ...prev, [dept]: !prev[dept] }));
  };

  const grouped = useMemo(() => {
    const groups: Record<string, ScheduleEvent[]> = {};
    filtered.forEach(evt => {
      const dept = evt.department || 'Unassigned Department';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(evt);
    });
    return Object.keys(groups).sort().map(dept => ({
      department: dept,
      events: groups[dept]
    }));
  }, [filtered]);

  // ... (keep getStatusBadge, getDaysColor, formatDate as they are)
  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || '';
    if (s.includes('completed')) return shared.badgeGreen;
    if (s.includes('progress')) return shared.badgeAmber;
    if (s.includes('overdue')) return shared.badgeRed;
    if (s.includes('scheduled')) return shared.badgeBlue;
    return shared.badgeGray;
  };

  const getDaysColor = (days: number | null) => {
    if (days === null) return 'inherit';
    if (days < 0) return 'var(--status-red-text)';
    if (days <= 7) return 'var(--status-amber-text)';
    return 'var(--status-green-text)';
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  if (error) {
    return (
      <>
        <div className={shared.pageHeader}>
          <div className={shared.pageHeaderTop}>
            <div>
              <h1 className={shared.pageTitle}>Active Schedule</h1>
              <p className={shared.pageDescription}>Live tracking of all cleaning and sanitation tasks</p>
            </div>
          </div>
        </div>
        <div className={shared.errorState}>
          <div className={shared.errorIcon}>⚠️</div>
          <div className={shared.errorTitle}>Failed to load schedule</div>
          <div className={shared.errorText}>{error}</div>
          <button className={shared.retryButton} onClick={() => void fetchData()}>Retry</button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={shared.pageHeader}>
        <div className={shared.pageHeaderTop}>
          <div>
            <h1 className={shared.pageTitle}>Active Schedule</h1>
            <p className={shared.pageDescription}>Live tracking of all cleaning and sanitation tasks</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {!loading && (
              <span className={shared.recordCount}>
                {filtered.length} {filtered.length === 1 ? 'event' : 'events'}
              </span>
            )}
            <CSVExportButton
              filename={`schedule-${new Date().toISOString().split('T')[0]}.csv`}
              rows={filtered.map(e => ({ 'Event ID': e.eventId, Area: e.area, Task: e.cleaningTask, Status: e.status, Assignee: e.assignee, 'Next Clean': e.nextCleanDate, 'Days Until Due': e.daysUntilDue }))}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <div className={shared.filterBar}>
        <input
          className={shared.searchInput}
          type="text"
          placeholder="Search area, task, or assignee..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '300px' }}
        />
        <select
          className={shared.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="Scheduled">Scheduled</option>
          <option value="In progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="OverDue">Overdue</option>
        </select>
      </div>

      {loading ? (
        <div className={shared.tableWrapper}>
          <div className={shared.skeleton} style={{ height: '400px' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className={shared.emptyState}>
          <div className={shared.emptyIcon}>📅</div>
          <div className={shared.emptyTitle}>No events found</div>
          <div className={shared.emptyText}>Adjust your filters to see results.</div>
        </div>
      ) : (
        <div className={shared.tableWrapper}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Area</th>
                <th>Area 2</th>
                <th>Task</th>
                <th>Status</th>
                <th>Assignee</th>
                <th>Next Clean</th>
                <th>Days Due</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((group) => {
                const isCollapsed = collapsedGroups[group.department];
                return (
                  <Fragment key={group.department}>
                    <tr 
                      onClick={() => toggleGroup(group.department)}
                      style={{ backgroundColor: 'var(--bg-elevated)', cursor: 'pointer', borderBottom: '2px solid var(--border-default)' }}
                    >
                      <td colSpan={8} style={{ padding: '0.75rem 1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        <span style={{ display: 'inline-block', width: '20px' }}>{isCollapsed ? '▶' : '▼'}</span>
                        {(group.department || '').replace(/_/g, ' ')}
                        <span style={{ marginLeft: '1rem', fontWeight: 'normal', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                          ({group.events.length} {group.events.length === 1 ? 'event' : 'events'})
                        </span>
                      </td>
                    </tr>
                    {!isCollapsed && group.events.map((evt) => {
                      const isExpanded = expandedId === evt.id;
                      const shortId = (evt.eventId || '').replace(/^Cleaning_Event_(\d+).*$/, 'EV-$1') || evt.eventId || '—';
                      const fmt = (s: string) => (s || '—').replace(/_/g, ' ');
                      return (
                        <Fragment key={evt.id}>
                          <tr 
                            className={shared.clickableRow}
                            onClick={() => setExpandedId(isExpanded ? null : evt.id)}
                          >
                            <td data-label="Event ID" title={evt.eventId || undefined}><strong>{shortId}</strong></td>
                            <td data-label="Area">{fmt(evt.area)}</td>
                            <td data-label="Area 2">{fmt(evt.area2)}</td>
                            <td data-label="Task">{fmt(evt.cleaningTask)}</td>
                            <td data-label="Status">
                              <span className={`${shared.badge} ${getStatusBadge(evt.status)}`}>
                                {evt.status || 'Unknown'}
                              </span>
                            </td>
                            <td data-label="Assignee">{evt.assignee || '—'}</td>
                            <td data-label="Next Clean">{formatDate(evt.nextCleanDate)}</td>
                            <td data-label="Days Due" style={{ color: getDaysColor(evt.daysUntilDue), fontWeight: 700 }}>
                              {evt.daysUntilDue !== null ? evt.daysUntilDue : '—'}
                            </td>
                          </tr>
                          
                          {isExpanded && (
                            <tr className={shared.detailRow}>
                              <td colSpan={8}>
                                <div className={shared.detailPanel}>
                                  <div className={shared.detailGrid}>
                                    <div className={shared.detailSection}>
                                      <div className={shared.detailLabel}>Last Cleaning Date</div>
                                      <div className={shared.detailValue}>{formatDate(evt.lastCleaningDate)}</div>
                                    </div>
                                    
                                    <div className={shared.detailSection}>
                                      <div className={shared.detailLabel}>Actual Completion Date</div>
                                      <div className={shared.detailValue}>{formatDate(evt.actualCompletionDate)}</div>
                                    </div>
      
                                    <div className={shared.detailSection}>
                                      <div className={shared.detailLabel}>Employees Assigned</div>
                                      <div className={shared.detailValue}>
                                        {evt.employees?.length > 0 ? evt.employees.join(', ') : '—'}
                                      </div>
                                    </div>
      
                                    <div className={shared.detailSection}>
                                      <div className={shared.detailLabel}>Notes</div>
                                      <div className={shared.detailValue}>{evt.notes || '—'}</div>
                                    </div>
      
                                    <div className={shared.detailSection} style={{ gridColumn: '1 / -1' }}>
                                      <div className={shared.detailLabel}>Comments</div>
                                      <div className={shared.detailValue}>{evt.comments || '—'}</div>
                                    </div>
                                  </div>
                                  
                                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                                    {evt.report && evt.report.length > 0 && evt.report[0].url && (
                                      <a href={evt.report[0].url} target="_blank" rel="noopener noreferrer" className={shared.downloadBtn}>
                                        📄 View Report
                                      </a>
                                    )}
                                    {evt.preCleanPhoto1 && evt.preCleanPhoto1.length > 0 && evt.preCleanPhoto1[0].url && (
                                      <a href={evt.preCleanPhoto1[0].url} target="_blank" rel="noopener noreferrer" className={shared.downloadBtn} style={{ background: '#334155' }}>
                                        📷 Pre-clean Photo
                                      </a>
                                    )}
                                    {evt.postCleanPhoto1 && evt.postCleanPhoto1.length > 0 && evt.postCleanPhoto1[0].url && (
                                      <a href={evt.postCleanPhoto1[0].url} target="_blank" rel="noopener noreferrer" className={shared.downloadBtn} style={{ background: '#334155' }}>
                                        📷 Post-clean Photo
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
