'use client';

import { downloadCSV } from '@/lib/utils';
import styles from './CSVExportButton.module.css';

interface CSVExportButtonProps {
  filename: string;
  rows: Record<string, unknown>[];
  disabled?: boolean;
}

export function CSVExportButton({ filename, rows, disabled }: CSVExportButtonProps) {
  const handleClick = () => {
    if (rows.length === 0) return;
    downloadCSV(filename, rows);
  };

  return (
    <button
      className={styles.btn}
      onClick={handleClick}
      disabled={disabled || rows.length === 0}
      title={rows.length === 0 ? 'No data to export' : `Export ${rows.length} rows as CSV`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Export CSV
    </button>
  );
}
