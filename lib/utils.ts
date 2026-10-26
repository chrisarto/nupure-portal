/**
 * Shared helpers for Supabase JSONB data extraction.
 * All Nu-Pure tables store Airtable data in a JSONB `data` column.
 * These utilities keep API routes DRY and type-safe.
 */

import type { AirtableAttachment } from './types';

/** Safely extract a string from a JSONB field */
export function str(val: unknown): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return '';
}

/** Safely extract first string from an array field */
export function firstStr(val: unknown): string {
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  if (typeof val === 'string') return val;
  return '';
}

/** Safely extract a number */
export function num(val: unknown): number | null {
  if (typeof val === 'number') return val;
  if (typeof val === 'string' && val !== '') {
    const n = Number(val);
    return isNaN(n) ? null : n;
  }
  return null;
}

/** Safely extract an array of strings */
export function strArr(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val.filter((v): v is string => typeof v === 'string');
}

/** Map raw Airtable attachment objects to typed AirtableAttachment[] */
export function attachArr(val: unknown): AirtableAttachment[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((a): a is Record<string, unknown> => typeof a === 'object' && a !== null)
    .map((a) => ({
      id: str(a['id']),
      url: str(a['url']),
      filename: str(a['filename']),
      size: num(a['size']) ?? 0,
      type: str(a['type']),
    }));
}

/**
 * Generate a CSV string from an array of objects.
 * Keys of the first object become the header row.
 */
export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ].join('\n');
}

/**
 * Trigger a CSV download in the browser.
 * Use this in 'use client' components only.
 */
export function downloadCSV(filename: string, rows: Record<string, unknown>[]): void {
  const csv = toCSV(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
