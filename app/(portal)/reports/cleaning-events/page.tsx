'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { NUPURE_ZONES } from '@/lib/nupure-scope';

interface CleaningRecord {
  id: string;
  report_number: string;
  date: string;
  zone: string;
  location: string;
  frequency_badge: string;
  items_cleaned: string;
  total_time_minutes: number;
  shift_type: string;
  visual_inspection_passed: boolean;
  ssop_verified: boolean;
  submitted_by: string;
  supervisor_signoff: string;
  created_at: string;
}

export default function CleaningEventsListPage() {
  const [records, setRecords] = useState<CleaningRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (zoneFilter !== 'all') params.set('zone', zoneFilter);
        if (dateFilter) params.set('date', dateFilter);
        const res = await fetch(`/api/cleaning-records?${params}`);
        const json = await res.json();
        setRecords(json.data ?? []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [zoneFilter, dateFilter]);

  const filtered = records.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.location.toLowerCase().includes(q) ||
      r.zone.toLowerCase().includes(q) ||
      r.report_number.toLowerCase().includes(q) ||
      (r.submitted_by || '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1360, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0284c7' }}>
            Nu-Pure Beverages — Audit Register
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
            Room-by-Room Cleaning Event Reports
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Complete log of all digital room cleaning event reports signed off across the Stapylton facility.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a
            href={`/api/cleaning-records/daily-pdf?date=${encodeURIComponent(dateFilter || new Date().toISOString().slice(0, 10))}`}
            style={{
              background: '#0f3460',
              color: '#ffffff',
              textDecoration: 'none',
              padding: '11px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            ⬇ Download Daily Completion PDF ({dateFilter || new Date().toISOString().slice(0, 10)})
          </a>
          <Link
            href="/sanitation/reports"
            style={{
              background: '#16a34a',
              color: '#ffffff',
              textDecoration: 'none',
              padding: '11px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Daily Completion Summary →
          </Link>
          <Link
            href="/cleaning-report"
            style={{
              background: '#0284c7',
              color: '#ffffff',
              textDecoration: 'none',
              padding: '11px 20px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            + Log New Room Clean
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          background: '#ffffff',
          padding: 16,
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          marginBottom: 20,
        }}
      >
        <input
          type="text"
          placeholder="Search room, zone, report #, cleaner..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: '1 1 240px',
            padding: '9px 14px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            fontSize: 14,
          }}
        />
        <select
          value={zoneFilter}
          onChange={e => setZoneFilter(e.target.value)}
          style={{
            padding: '9px 14px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            fontSize: 14,
          }}
        >
          <option value="all">All Zones</option>
          {NUPURE_ZONES.map(z => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          style={{
            padding: '9px 14px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            fontSize: 14,
          }}
        />
        {dateFilter && (
          <button
            type="button"
            onClick={() => setDateFilter('')}
            style={{
              padding: '9px 14px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            Clear Date
          </button>
        )}
      </div>

      {/* Table */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          border: '1px solid #e2e8f0',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
              <th style={{ padding: '12px 16px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>Report #</th>
              <th style={{ padding: '12px 16px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>Date</th>
              <th style={{ padding: '12px 16px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>Zone</th>
              <th style={{ padding: '12px 16px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>Area / Room</th>
              <th style={{ padding: '12px 16px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>Shift / Duration</th>
              <th style={{ padding: '12px 16px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>Completed By</th>
              <th style={{ padding: '12px 16px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>Inspection</th>
              <th style={{ padding: '12px 16px', fontSize: 11, textTransform: 'uppercase', color: '#475569', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                  Loading room cleaning event reports...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                  No room cleaning event reports found for the selected filter.
                </td>
              </tr>
            ) : (
              filtered.map(rec => (
                <tr key={rec.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f3460' }}>{rec.report_number}</td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>{rec.date}</td>
                  <td style={{ padding: '12px 16px', color: '#475569', fontWeight: 600 }}>{rec.zone}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>{rec.location}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>
                    {rec.shift_type} ({rec.total_time_minutes} mins)
                  </td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>{rec.submitted_by}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 800,
                        background: rec.visual_inspection_passed ? '#dcfce7' : '#fee2e2',
                        color: rec.visual_inspection_passed ? '#15803d' : '#dc2626',
                      }}
                    >
                      {rec.visual_inspection_passed ? 'PASSED ✓' : 'RECLEAN REQ'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
                      <a
                        href={`/api/cleaning-records/${rec.id}/pdf`}
                        style={{
                          background: '#0f3460',
                          color: '#ffffff',
                          padding: '5px 10px',
                          borderRadius: 6,
                          textDecoration: 'none',
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        ⬇ PDF
                      </a>
                      <Link
                        href={`/reports/cleaning-events/${rec.id}`}
                        style={{
                          color: '#0284c7',
                          fontWeight: 700,
                          textDecoration: 'none',
                          fontSize: 13,
                        }}
                      >
                        View →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
