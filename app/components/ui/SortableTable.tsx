'use client';

import { useState, useMemo } from 'react';
import shared from '@/app/(portal)/shared.module.css';
import styles from './SortableTable.module.css';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

interface SortableTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  expandedContent?: (row: T) => React.ReactNode;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyText?: string;
}

type SortDir = 'asc' | 'desc';

export function SortableTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  expandedContent,
  emptyIcon = '📋',
  emptyTitle = 'No records found',
  emptyText = 'Adjust your filters to see results.',
}: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  if (data.length === 0) {
    return (
      <div className={shared.emptyState}>
        <div className={shared.emptyIcon}>{emptyIcon}</div>
        <div className={shared.emptyTitle}>{emptyTitle}</div>
        <div className={shared.emptyText}>{emptyText}</div>
      </div>
    );
  }

  return (
    <div className={shared.tableWrapper}>
      <table className={shared.table}>
        <thead>
          <tr>
            {columns.map((col) => {
              const isActive = sortKey === String(col.key);
              return (
                <th
                  key={String(col.key)}
                  style={{ width: col.width, cursor: col.sortable ? 'pointer' : 'default', userSelect: 'none' }}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                >
                  <span className={styles.thInner}>
                    {col.label}
                    {col.sortable && (
                      <span className={`${styles.sortIcon} ${isActive ? styles.sortActive : ''}`}>
                        {isActive ? (sortDir === 'asc' ? '↑' : '↓') : '⇅'}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
            {expandedContent && <th style={{ width: '40px' }} />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const id = rowKey(row);
            const isExpanded = expandedId === id;
            return (
              <>
                <tr
                  key={id}
                  className={expandedContent ? shared.clickableRow : ''}
                  onClick={() => expandedContent && setExpandedId(isExpanded ? null : id)}
                >
                  {columns.map((col) => (
                    <td key={String(col.key)} data-label={col.label}>
                      {col.render ? col.render(row) : String(row[String(col.key)] ?? '—')}
                    </td>
                  ))}
                  {expandedContent && (
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {isExpanded ? '▲' : '▼'}
                    </td>
                  )}
                </tr>
                {expandedContent && isExpanded && (
                  <tr key={`${id}-expanded`} className={shared.detailRow}>
                    <td colSpan={columns.length + 1}>
                      <div className={shared.detailPanel}>
                        {expandedContent(row)}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
