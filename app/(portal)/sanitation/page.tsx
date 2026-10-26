'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import shared from '../shared.module.css';
import type { SanitationTask } from '@/lib/types';
import { CSVExportButton } from '@/app/components/ui/CSVExportButton';


export default function SanitationPage() {
  const [tasks, setTasks] = useState<SanitationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sanitation');
      if (!res.ok) throw new Error('Failed to fetch sanitation schedule');
      const json: { data: SanitationTask[] } = await res.json();
      setTasks(json.data);
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

  // Derived filter options
  const areas = useMemo(() => Array.from(new Set(tasks.map((t) => t.area).filter(Boolean))).sort(), [tasks]);
  const depts = useMemo(() => Array.from(new Set(tasks.map((t) => t.department).filter(Boolean))).sort(), [tasks]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch = t.cleaningTask?.toLowerCase().includes(search.toLowerCase()) || 
                          t.assetElement?.toLowerCase().includes(search.toLowerCase());
      const matchArea = areaFilter ? t.area === areaFilter : true;
      const matchDept = deptFilter ? t.department === deptFilter : true;
      return matchSearch && matchArea && matchDept;
    });
  }, [tasks, search, areaFilter, deptFilter]);

  const getPermitBadge = (permitStr: string) => {
    const s = permitStr?.toLowerCase() || '';
    if (s.includes('heights') || s.includes('confined')) return shared.badgeRed;
    if (s.includes('general')) return shared.badgeGreen;
    return shared.badgeGray;
  };

  if (error) {
    return (
      <>
        <div className={shared.pageHeader}>
          <div className={shared.pageHeaderTop}>
            <div>
              <h1 className={shared.pageTitle}>Master Sanitation Schedule</h1>
              <p className={shared.pageDescription}>Master schedule of all required cleaning tasks and frequencies</p>
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
            <h1 className={shared.pageTitle}>Master Sanitation Schedule</h1>
            <p className={shared.pageDescription}>Master schedule of all required cleaning tasks and frequencies</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {!loading && <span className={shared.recordCount}>{filtered.length} {filtered.length === 1 ? 'task' : 'tasks'}</span>}
            <CSVExportButton
              filename={`sanitation-schedule-${new Date().toISOString().split('T')[0]}.csv`}
              rows={filtered.map(t => ({ Task: t.cleaningTask, Area: t.area, 'Area 2': t.area2, Department: t.department, Asset: t.assetElement, Frequency: t.cleaningFrequency, 'Permit Required': t.permitRequirement }))}
              disabled={loading}
            />
          </div>
        </div>
      </div>

      <div className={shared.filterBar}>
        <input
          className={shared.searchInput}
          type="text"
          placeholder="Search tasks or assets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className={shared.filterSelect}
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
        >
          <option value="">All Departments</option>
          {depts.map((d) => (
            <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          className={shared.filterSelect}
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
        >
          <option value="">All Areas</option>
          {areas.map((a) => (
            <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className={shared.tableWrapper}>
          <div className={shared.skeleton} style={{ height: '400px' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className={shared.emptyState}>
          <div className={shared.emptyIcon}>🧹</div>
          <div className={shared.emptyTitle}>No tasks found</div>
          <div className={shared.emptyText}>Adjust your filters to see results.</div>
        </div>
      ) : (
        <div className={shared.tableWrapper}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Cleaning Task</th>
                <th>Area</th>
                <th>Sub-Area</th>
                <th>Department</th>
                <th>Scope of Work</th>
                <th>Frequency</th>
                <th>Permit Required</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => {
                const isExpanded = expandedId === task.id;
                const fmt = (s: string) => (s || '—').replace(/_/g, ' ');
                
                return (
                  <Fragment key={task.id}>
                    <tr 
                      className={shared.clickableRow}
                      onClick={() => setExpandedId(isExpanded ? null : task.id)}
                    >
                      <td data-label="Task"><strong>{fmt(task.cleaningTask)}</strong></td>
                      <td data-label="Area">{fmt(task.area)}</td>
                      <td data-label="Sub-Area">{fmt(task.area2)}</td>
                      <td data-label="Department">{fmt(task.department)}</td>
                      <td data-label="Scope">{fmt(task.assetElement)}</td>
                      <td data-label="Frequency">{task.cleaningFrequency || '—'}</td>
                      <td data-label="Permit">
                        <span className={`${shared.badge} ${getPermitBadge(task.permitRequirement)}`}>
                          {task.permitRequirement || '✗ No'}
                        </span>
                      </td>
                    </tr>
                    
                    {isExpanded && (
                      <tr className={shared.detailRow}>
                        <td colSpan={7}>
                          <div className={shared.detailPanel}>
                            <div className={shared.detailGrid}>
                              <div className={shared.detailSection}>
                                <div className={shared.detailLabel}>Frequency in Days</div>
                                <div className={shared.detailValue}>{task.frequencyInDays !== null ? `${task.frequencyInDays} days` : '—'}</div>
                              </div>
                              
                              <div className={shared.detailSection}>
                                <div className={shared.detailLabel}>Area Group</div>
                                <div className={shared.detailValue}>{task.areaGroup || '—'}</div>
                              </div>

                              <div className={shared.detailSection}>
                                <div className={shared.detailLabel}>Procedure Sign-off</div>
                                <div className={shared.detailValue}>
                                  {task.procedureSignOffUrl ? (
                                    <a href={task.procedureSignOffUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>
                                      Go to Sign-off Form
                                    </a>
                                  ) : '—'}
                                </div>
                              </div>

                              <div className={shared.detailSection}>
                                <div className={shared.detailLabel}>Nu-Pure Document Reference</div>
                                <div className={shared.detailValue}><strong>{task.docGotzinger || '—'}</strong></div>
                              </div>
                            </div>
                            
                            {task.procedureDocument && task.procedureDocument.length > 0 && task.procedureDocument[0].url && (
                              <div style={{ marginTop: '1.5rem' }}>
                                <a href={task.procedureDocument[0].url} target="_blank" rel="noopener noreferrer" className={shared.downloadBtn}>
                                  📄 View/Download Procedure Document
                                </a>
                              </div>
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
  );
}
