'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  NUPURE_ROOMS,
  NUPURE_ZONES,
  NUPURE_SERVICE_MODEL,
  NUPURE_SANITARY_BINS,
  NUPURE_AIR_FRESHENERS,
} from '@/lib/nupure-scope';

interface ScheduleEventSummary {
  id: string;
  area2: string;
  status: string;
  lastCleaningDate: string | null;
}

const ZONE_META: Record<
  string,
  { sectionNum: number; title: string; subtitle: string; headerBg: string }
> = {
  'Head Office': {
    sectionNum: 5,
    title: 'Detailed Scope — Head Office',
    subtitle: 'Service Frequency: Monday to Friday (5 Days per Week)',
    headerBg: 'linear-gradient(135deg, #0f172a, #1e3a8a)',
  },
  'Production Areas': {
    sectionNum: 6,
    title: 'Detailed Scope — Production Areas',
    subtitle: 'Service Frequencies: 7 Days & 5 Days (As noted per area)',
    headerBg: 'linear-gradient(135deg, #0f3460, #0284c7)',
  },
  'Warehouse Areas': {
    sectionNum: 7,
    title: 'Detailed Scope — Warehouse Areas',
    subtitle: 'Service Frequencies: 7 Days & 5 Days (As noted per area)',
    headerBg: 'linear-gradient(135deg, #0f3460, #0369a1)',
  },
  'Mezzanine Floor': {
    sectionNum: 8,
    title: 'Detailed Scope — Mezzanine Floor',
    subtitle: 'Service Frequency: Monday to Friday (5 Days per Week)',
    headerBg: 'linear-gradient(135deg, #0f172a, #1e3a8a)',
  },
  "Gatehouse & Drivers' Toilet": {
    sectionNum: 9,
    title: "Detailed Scope — Gatehouse & Drivers' Toilet",
    subtitle: 'Service Frequencies: 7 Days & 5 Days (As noted per area)',
    headerBg: 'linear-gradient(135deg, #0f3460, #0284c7)',
  },
  'Hygiene Services & Consumables': {
    sectionNum: 10,
    title: 'Hygiene Services & Consumables',
    subtitle: 'Managed Weekly Sanitary Service (8–10 Bins) & 9 Automatic Air Fresheners',
    headerBg: 'linear-gradient(135deg, #14532d, #16a34a)',
  },
};

export default function SanitationScopePage() {
  const [selectedZone, setSelectedZone] = useState<string>('All Zones');
  const [selectedFreq, setSelectedFreq] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [scheduleMap, setScheduleMap] = useState<Record<string, ScheduleEventSummary>>({});

  useEffect(() => {
    fetch('/api/schedule')
      .then(r => r.json())
      .then((json: { data?: ScheduleEventSummary[] }) => {
        const map: Record<string, ScheduleEventSummary> = {};
        for (const ev of json.data ?? []) {
          if (ev.area2) {
            map[ev.area2] = ev;
          }
        }
        setScheduleMap(map);
      })
      .catch(() => {});
  }, []);

  const filteredRooms = useMemo(() => {
    return NUPURE_ROOMS.filter(room => {
      if (selectedZone !== 'All Zones' && room.zone !== selectedZone) return false;
      if (selectedFreq !== 'ALL' && room.frequencyBadge !== selectedFreq) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchRoom = room.room.toLowerCase().includes(q);
        const matchCode = room.code.toLowerCase().includes(q);
        const matchZone = room.zone.toLowerCase().includes(q);
        const matchNote = (room.workstationNote || '').toLowerCase().includes(q);
        const matchTasks = room.checklist.some(t => t.toLowerCase().includes(q));
        const matchLimit = (room.limitations || '').toLowerCase().includes(q);
        return matchRoom || matchCode || matchZone || matchNote || matchTasks || matchLimit;
      }
      return true;
    });
  }, [selectedZone, selectedFreq, search]);

  const zonesToRender = useMemo(() => {
    const activeZones = NUPURE_ZONES.filter(z => filteredRooms.some(r => r.zone === z));
    return activeZones;
  }, [filteredRooms]);

  const count7Days = NUPURE_ROOMS.filter(r => r.frequencyBadge === '7 DAYS').length;
  const count5Days = NUPURE_ROOMS.filter(r => r.frequencyBadge === '5 DAYS').length;
  const countWeekly = NUPURE_ROOMS.filter(r => r.frequencyBadge === 'WEEKLY').length;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1440, margin: '0 auto' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#0284c7',
            }}
          >
            MJ Hygiene Management Services &bull; Tender Proposal v1.1
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', margin: '4px 0 6px' }}>
            Nu-Pure Beverages — Master Cleaning &amp; Hygiene Scope
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Complete 7-day &amp; 5-day room-by-room cleaning specification, managed sanitary bin service (8–10 units), and automatic air fresheners (9 units) for the Stapylton facility.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link
            href="/cleaning-report"
            style={{
              background: '#0284c7',
              color: '#ffffff',
              textDecoration: 'none',
              padding: '11px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            + Log Room Clean →
          </Link>
          <Link
            href="/hygiene-services"
            style={{
              background: '#16a34a',
              color: '#ffffff',
              textDecoration: 'none',
              padding: '11px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            ♻️ Log Sanitary Bin &amp; Air Freshener Changes →
          </Link>
          <Link
            href="/sanitation/reports"
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
            📄 Daily Completion Report &amp; PDF →
          </Link>
        </div>
      </div>

      {/* Executive Summary 4-Pillar Banner (From Tender Page 2) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
          background: '#f8fafc',
          border: '1px solid #cbd5e1',
          borderRadius: 14,
          padding: 18,
          marginBottom: 24,
        }}
      >
        <div style={{ textAlign: 'center', padding: '8px 12px', borderRight: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#0284c7', lineHeight: 1.1 }}>
            {NUPURE_SERVICE_MODEL.daysPerWeek}
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginTop: 4 }}>
            DAYS / WEEK COVERAGE
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            5-Day Full Scope + 2-Day Operational Weekend
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '8px 12px', borderRight: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#0284c7', lineHeight: 1.1 }}>
            {NUPURE_SERVICE_MODEL.labourHoursPerWeek}
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginTop: 4 }}>
            LABOUR HRS / WEEK
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Mon–Fri: 7 hrs/day (35h) &bull; Sat: 5h &bull; Sun: 5h
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '8px 12px', borderRight: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: '#0f3460', lineHeight: 1.1 }}>
            {NUPURE_ROOMS.length}
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginTop: 4 }}>
            DESIGNATED SCOPE AREAS
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {count7Days} Seven-Day &bull; {count5Days} Five-Day &bull; {countWeekly} Weekly Services
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '8px 12px' }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#16a34a', lineHeight: 1.2 }}>
            Weekly Managed
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginTop: 4 }}>
            SANITARY &amp; AIR FRESHENERS
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            8–10 Sanitary Bins &bull; 9 Auto Air Fresheners
          </div>
        </div>
      </div>

      {/* Proposed Service Model & Weekend Arrangements (From Tender Page 3) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: 18,
          marginBottom: 28,
        }}
      >
        {/* Service Days & Labour Allocation Table */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 18px',
              background: '#0f172a',
              color: '#ffffff',
              fontSize: 13,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Section 4 — Service Days &amp; Labour Allocation
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>Days</th>
                <th style={{ padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>Daily Hours</th>
                <th style={{ padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>Weekly</th>
                <th style={{ padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>Focus Areas</th>
              </tr>
            </thead>
            <tbody>
              {NUPURE_SERVICE_MODEL.scheduleAllocation.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{row.days}</td>
                  <td style={{ padding: '10px 14px', color: '#334155' }}>{row.dailyHours}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0284c7' }}>{row.weeklyHours}</td>
                  <td style={{ padding: '10px 14px', color: '#475569' }}>{row.focusAreas}</td>
                </tr>
              ))}
              <tr style={{ background: '#e0f2fe' }}>
                <td colSpan={2} style={{ padding: '10px 14px', fontWeight: 800, color: '#0f3460' }}>
                  Total Weekly Allocation
                </td>
                <td colSpan={2} style={{ padding: '10px 14px', fontWeight: 900, color: '#0f3460' }}>
                  45 Hours / Week
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Targeted Weekend Operations Callout */}
        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderLeft: '5px solid #0284c7',
            borderRadius: 12,
            padding: '16px 20px',
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f3460', marginBottom: 6 }}>
            Targeted Weekend Operations (Saturday &amp; Sunday — 5 Hours / Day)
          </div>
          <p style={{ fontSize: 13, color: '#334155', margin: '0 0 12px' }}>
            The weekend cleaning allocation focuses strictly on high-use operational zones:
          </p>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#15803d', marginBottom: 4 }}>
              ✓ Included on Weekends (7 Days / Week):
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {NUPURE_SERVICE_MODEL.weekendIncluded7Days.map(item => (
                <span
                  key={item}
                  style={{
                    background: '#dcfce7',
                    color: '#15803d',
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 999,
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 4 }}>
              • Excluded on Weekends (Mon–Fri 5 Days Only):
            </div>
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
              Head Office, Mezzanine Floor, Gatehouse Offices/Kitchen, Warehouse Offices/Kitchen, and designated Production Offices &amp; Laboratory.
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Search, Frequency & Zone Filter Bar */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search any room, code (e.g. NP-PR-05), task, or exclusion..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              flex: '1 1 280px',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: 14,
            }}
          />

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { code: 'ALL', label: `All Frequencies (${NUPURE_ROOMS.length})` },
              { code: '7 DAYS', label: `7 DAYS (${count7Days})` },
              { code: '5 DAYS', label: `5 DAYS Mon–Fri (${count5Days})` },
              { code: 'WEEKLY', label: `WEEKLY Hygiene (${countWeekly})` },
            ].map(f => {
              const active = selectedFreq === f.code;
              return (
                <button
                  key={f.code}
                  type="button"
                  onClick={() => setSelectedFreq(f.code)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: active ? '1px solid #0284c7' : '1px solid #cbd5e1',
                    background: active ? '#0284c7' : '#f8fafc',
                    color: active ? '#ffffff' : '#334155',
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Zone Pills */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['All Zones', ...NUPURE_ZONES].map(zone => {
            const active = selectedZone === zone;
            const meta = ZONE_META[zone];
            return (
              <button
                key={zone}
                type="button"
                onClick={() => setSelectedZone(zone)}
                style={{
                  padding: '7px 14px',
                  borderRadius: 999,
                  border: active ? '1px solid #0f3460' : '1px solid #cbd5e1',
                  background: active ? '#0f3460' : '#ffffff',
                  color: active ? '#ffffff' : '#334155',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {meta ? `${meta.sectionNum}. ${zone}` : zone}
              </button>
            );
          })}
        </div>
      </div>

      {/* Zone-by-Zone Visual Scope Cards (Matching Tender Sections 5 to 10) */}
      {zonesToRender.length === 0 ? (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: 40,
            textAlign: 'center',
            color: '#64748b',
          }}
        >
          No rooms or tasks match your current filter.
        </div>
      ) : (
        zonesToRender.map(zone => {
          const meta = ZONE_META[zone] || {
            sectionNum: 5,
            title: zone,
            subtitle: 'Scheduled Cleaning Scope',
            headerBg: 'linear-gradient(135deg, #0f3460, #0284c7)',
          };
          const roomsInZone = filteredRooms.filter(r => r.zone === zone);

          return (
            <div key={zone} style={{ marginBottom: 32 }}>
              {/* Section Banner */}
              <div
                style={{
                  background: meta.headerBg,
                  color: '#ffffff',
                  borderRadius: 12,
                  padding: '18px 24px',
                  marginBottom: 16,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      background: '#0284c7',
                      border: '2px solid rgba(255,255,255,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 900,
                      fontSize: 15,
                    }}
                  >
                    {meta.sectionNum}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>{meta.title}</h2>
                    <div style={{ fontSize: 13, color: '#bae6fd', marginTop: 2 }}>{meta.subtitle}</div>
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    padding: '6px 14px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {roomsInZone.length} {roomsInZone.length === 1 ? 'Area' : 'Areas'} in Scope
                </div>
              </div>

              {/* 2-Column Room Scope Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
                  gap: 16,
                }}
              >
                {roomsInZone.map(room => {
                  const is7Day = room.frequencyBadge === '7 DAYS';
                  const isWeekly = room.frequencyBadge === 'WEEKLY';
                  const badgeBg = is7Day ? '#0284c7' : isWeekly ? '#16a34a' : '#6366f1';
                  const sched = scheduleMap[room.room];

                  return (
                    <div
                      key={room.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        overflow: 'hidden',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                      }}
                    >
                      <div>
                        {/* Room Card Header */}
                        <div
                          style={{
                            padding: '14px 18px',
                            borderBottom: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 10,
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: '#0f3460',
                                  background: '#e2e8f0',
                                  padding: '2px 8px',
                                  borderRadius: 5,
                                }}
                              >
                                {room.code}
                              </span>
                              {room.subGroup && (
                                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b' }}>
                                  {room.subGroup}
                                </span>
                              )}
                            </div>
                            <h3 style={{ fontSize: 16.5, fontWeight: 800, color: '#0f172a', margin: '4px 0 0' }}>
                              {room.room}
                            </h3>
                          </div>

                          <span
                            style={{
                              background: badgeBg,
                              color: '#ffffff',
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '4px 12px',
                              borderRadius: 999,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {room.frequencyBadge}
                          </span>
                        </div>

                        {/* Room Card Body */}
                        <div style={{ padding: '14px 18px' }}>
                          {room.workstationNote && (
                            <div
                              style={{
                                fontSize: 12.5,
                                fontStyle: 'italic',
                                color: '#475569',
                                marginBottom: 10,
                                fontWeight: 600,
                              }}
                            >
                              ({room.workstationNote})
                            </div>
                          )}

                          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
                            {room.checklist.map((item, idx) => (
                              <li
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'flex-start',
                                  gap: 8,
                                  fontSize: 13.5,
                                  color: '#1e293b',
                                  lineHeight: 1.45,
                                }}
                              >
                                <span style={{ color: '#0284c7', fontWeight: 900, marginTop: 1 }}>&bull;</span>
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>

                          {room.limitations && (
                            <div
                              style={{
                                marginTop: 12,
                                padding: '9px 12px',
                                background: '#fef2f2',
                                border: '1px solid #fecaca',
                                borderRadius: 8,
                                fontSize: 12.5,
                                color: '#b91c1c',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 6,
                              }}
                            >
                              <span style={{ fontWeight: 900 }}>✕</span>
                              <span>{room.limitations}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Room Card Footer */}
                      <div
                        style={{
                          padding: '10px 18px',
                          background: '#f8fafc',
                          borderTop: '1px solid #f1f5f9',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: 12,
                        }}
                      >
                        <div style={{ color: '#64748b' }}>
                          Est. <strong>{room.estimatedMinutes} mins</strong>
                          {sched?.lastCleaningDate && (
                            <span style={{ marginLeft: 8, color: '#15803d', fontWeight: 700 }}>
                              &bull; Last Cleaned: {sched.lastCleaningDate}
                            </span>
                          )}
                        </div>

                        {room.zone === 'Hygiene Services & Consumables' ? (
                          <Link
                            href="/hygiene-services"
                            style={{
                              color: '#16a34a',
                              fontWeight: 800,
                              textDecoration: 'none',
                            }}
                          >
                            Log Unit Changes →
                          </Link>
                        ) : (
                          <Link
                            href={`/cleaning-report?room=${encodeURIComponent(room.room)}`}
                            style={{
                              color: '#0284c7',
                              fontWeight: 800,
                              textDecoration: 'none',
                            }}
                          >
                            Log Room Clean →
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Section 10 Detailed Unit Register: Sanitary Bins & Automatic Air Fresheners */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
          gap: 20,
          marginBottom: 28,
        }}
      >
        {/* 10 Sanitary Bins Register */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              background: '#0f3460',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>
                Sanitary Waste Management (8–10 Allocated Units)
              </div>
              <div style={{ fontSize: 11.5, color: '#bae6fd' }}>
                Weekly liner exchange, sanitisation, collection &amp; disposal
              </div>
            </div>
            <Link
              href="/hygiene-services"
              style={{
                background: '#16a34a',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              Log Bin Change →
            </Link>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '8px 12px' }}>Unit</th>
                <th style={{ padding: '8px 12px' }}>Zone</th>
                <th style={{ padding: '8px 12px' }}>Allocated Amenity Location</th>
              </tr>
            </thead>
            <tbody>
              {NUPURE_SANITARY_BINS.map(bin => (
                <tr key={bin.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 800, color: '#0f3460' }}>{bin.code}</td>
                  <td style={{ padding: '8px 12px', color: '#475569' }}>{bin.zone}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>
                    {bin.location} — <span style={{ color: '#64748b', fontWeight: 500 }}>{bin.binNumber}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 9 Air Fresheners Register */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              background: '#0284c7',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>
                Automatic Air Fresheners (9 Allocated Dispensers)
              </div>
              <div style={{ fontSize: 11.5, color: '#e0f2fe' }}>
                Fragrance refills, battery changes, routine operation checks &amp; exterior clean
              </div>
            </div>
            <Link
              href="/hygiene-services"
              style={{
                background: '#0f3460',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '6px 12px',
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              Log Refill / Change →
            </Link>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '8px 12px' }}>Code</th>
                <th style={{ padding: '8px 12px' }}>Zone</th>
                <th style={{ padding: '8px 12px' }}>Allocated Dispenser Location</th>
              </tr>
            </thead>
            <tbody>
              {NUPURE_AIR_FRESHENERS.map(af => (
                <tr key={af.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 800, color: '#0284c7' }}>{af.code}</td>
                  <td style={{ padding: '8px 12px', color: '#475569' }}>{af.zone}</td>
                  <td style={{ padding: '8px 12px', fontWeight: 700, color: '#0f172a' }}>{af.dispenserName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 11 (Equipment & PPE) & Section 16 (Exclusions & Clarifications) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: 20,
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f3460', margin: '0 0 12px' }}>
            11. Provisioned Equipment &amp; PPE Supply (MJ Hygiene)
          </h3>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {NUPURE_SERVICE_MODEL.equipmentAndPpe.map((item, i) => (
              <li key={i} style={{ fontSize: 13, color: '#334155', display: 'flex', gap: 8 }}>
                <span style={{ color: '#0284c7', fontWeight: 900 }}>✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div
          style={{
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#9f1239', margin: '0 0 12px' }}>
            16. Contract Exclusions &amp; Clarifications
          </h3>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {NUPURE_SERVICE_MODEL.exclusions.map((item, i) => (
              <li key={i} style={{ fontSize: 13, color: '#881337', display: 'flex', gap: 8, fontWeight: 600 }}>
                <span style={{ color: '#e11d48', fontWeight: 900 }}>✕</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
