'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { NUPURE_ZONES, NUPURE_ROOMS, NUPURE_CHEMICALS, type NuPureRoomSpec } from '@/lib/nupure-scope';

interface CleaningRecordRow {
  id: string;
  report_number: string;
  date: string;
  zone: string;
  location: string;
  frequency_badge: string;
  total_time_minutes: number;
  visual_inspection_passed: boolean;
  submitted_by: string;
  created_at: string;
}

export default function CleaningReportPage() {
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [selectedZone, setSelectedZone] = useState<string>('All Zones');
  const [selectedRoom, setSelectedRoom] = useState<NuPureRoomSpec>(NUPURE_ROOMS[0]);

  // Checklist state for current room
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [shiftType, setShiftType] = useState<string>('Weekday (Mon–Fri)');
  const [timeMinutes, setTimeMinutes] = useState<number>(NUPURE_ROOMS[0].estimatedMinutes);
  const [operatorName, setOperatorName] = useState<string>('MJ Hygiene Site Team');
  const [supervisorName, setSupervisorName] = useState<string>('MJ Hygiene Supervisor');
  const [selectedChemicals, setSelectedChemicals] = useState<string[]>([
    'Hospital-Grade Disinfectant / Surface Sanitiser',
    'Neutral pH Hard Floor Cleaner',
  ]);
  const [visualPassed, setVisualPassed] = useState<boolean>(true);
  const [ssopVerified, setSsopVerified] = useState<boolean>(true);
  const [comments, setComments] = useState<string>('');
  const [correctiveAction, setCorrectiveAction] = useState<string>('');
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);

  const [todayRecords, setTodayRecords] = useState<CleaningRecordRow[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string; reportId?: string } | null>(null);

  const loadRecordsForDate = useCallback(async (dateStr: string) => {
    setLoadingRecords(true);
    try {
      const res = await fetch(`/api/cleaning-records?date=${encodeURIComponent(dateStr)}`);
      const json = await res.json();
      setTodayRecords(json.data ?? []);
    } catch {
      setTodayRecords([]);
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    loadRecordsForDate(selectedDate);
  }, [selectedDate, loadRecordsForDate]);

  // Reset checklist when room changes
  const handleSelectRoom = (room: NuPureRoomSpec) => {
    setSelectedRoom(room);
    const allChecked: Record<number, boolean> = {};
    room.checklist.forEach((_, idx) => {
      allChecked[idx] = true;
    });
    setCheckedItems(allChecked);
    setTimeMinutes(room.estimatedMinutes);
    setComments('');
    setCorrectiveAction('');
    setBeforePhotos([]);
    setAfterPhotos([]);
    setToast(null);
  };

  useEffect(() => {
    handleSelectRoom(NUPURE_ROOMS[0]);
  }, []);

  const toggleChemical = (chem: string) => {
    setSelectedChemicals(prev =>
      prev.includes(chem) ? prev.filter(c => c !== chem) : [...prev, chem]
    );
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingPhoto(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/cleaning-records/upload', { method: 'POST', body: fd });
        const json = await res.json();
        if (res.ok && json.url) {
          if (type === 'before') setBeforePhotos(prev => [...prev, json.url]);
          else setAfterPhotos(prev => [...prev, json.url]);
        }
      }
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSubmitRoomReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setToast(null);
    try {
      const checklistPayload = selectedRoom.checklist.map((label, idx) => ({
        label,
        completed: !!checkedItems[idx],
      }));

      const res = await fetch('/api/cleaning-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          zone: selectedRoom.zone,
          location: selectedRoom.room,
          frequency_badge: selectedRoom.frequencyBadge,
          checklist_items: checklistPayload,
          total_time_minutes: timeMinutes,
          shift_type: shiftType,
          cleaning_type:
            selectedRoom.frequencyBadge === 'WEEKLY'
              ? 'Weekly Hygiene Service'
              : 'Scheduled Daily Hygiene Clean',
          chemicals_used: selectedChemicals,
          operators_involved: operatorName
            .split(',')
            .map(s => s.trim())
            .filter(Boolean),
          ssop_verified: ssopVerified,
          visual_inspection_passed: visualPassed,
          corrective_action: correctiveAction,
          before_photos: beforePhotos,
          after_photos: afterPhotos,
          comments,
          submitted_by: operatorName,
          supervisor_signoff: supervisorName,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to save room cleaning report');
      }

      await loadRecordsForDate(selectedDate);
      setToast({
        type: 'success',
        text: `Room "${selectedRoom.room}" logged (${json.data.report_number}) & Active Schedule updated!`,
        reportId: json.data.id,
      });
    } catch (err) {
      setToast({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error saving report',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const completedRoomNames = new Set(todayRecords.map(r => r.location));
  const filteredRooms =
    selectedZone === 'All Zones'
      ? NUPURE_ROOMS
      : NUPURE_ROOMS.filter(r => r.zone === selectedZone);

  const completedCount = NUPURE_ROOMS.filter(r => completedRoomNames.has(r.room)).length;
  const progressPct = Math.round((completedCount / NUPURE_ROOMS.length) * 100);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1440, margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0284c7' }}>
            Nu-Pure Beverages — Stapylton Facility
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '4px 0 6px' }}>
            Room-by-Room Digital Cleaning Event Report
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Complete one room/area at a time against the Tender Specification. Submitting automatically records the event in the Portal &amp; Active Schedule.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: 10,
              padding: '8px 14px',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Shift Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              style={{
                border: 'none',
                fontSize: 14,
                fontWeight: 700,
                color: '#0f172a',
                outline: 'none',
                background: 'transparent',
              }}
            />
          </div>

          <Link
            href="/reports/cleaning-events"
            style={{
              background: '#0f3460',
              color: '#ffffff',
              textDecoration: 'none',
              padding: '10px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            View All Cleaning Event Reports ({todayRecords.length} today) →
          </Link>
        </div>
      </div>

      {/* Site Progress Bar */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 24,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
            Daily Room Completion Progress ({selectedDate})
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#0284c7' }}>
            {completedCount} of {NUPURE_ROOMS.length} Rooms / Areas Completed ({progressPct}%)
          </span>
        </div>
        <div style={{ width: '100%', height: 10, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
          <div
            style={{
              width: `${progressPct}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #0284c7, #16a34a)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Zone Filter Pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {['All Zones', ...NUPURE_ZONES].map(zone => {
          const active = selectedZone === zone;
          return (
            <button
              key={zone}
              type="button"
              onClick={() => setSelectedZone(zone)}
              style={{
                padding: '8px 16px',
                borderRadius: 999,
                border: active ? '1px solid #0f3460' : '1px solid #cbd5e1',
                background: active ? '#0f3460' : '#ffffff',
                color: active ? '#ffffff' : '#334155',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {zone}
            </button>
          );
        })}
      </div>

      {/* Main Two-Column Layout: Left = Room Selector, Right = Active Room Digital Report Form */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 24, alignItems: 'start' }}>
        {/* Left Column: Room List */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              padding: '14px 18px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              fontSize: 12,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#475569',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Select Area / Room ({filteredRooms.length})</span>
            <span>{loadingRecords ? 'Checking...' : 'Status'}</span>
          </div>

          <div style={{ maxHeight: 720, overflowY: 'auto' }}>
            {filteredRooms.map(r => {
              const isSelected = selectedRoom.id === r.id;
              const isDone = completedRoomNames.has(r.room);
              const badgeBg =
                r.frequencyBadge === '7 DAYS'
                  ? '#dcfce7'
                  : r.frequencyBadge === 'WEEKLY'
                    ? '#fef3c7'
                    : '#e0f2fe';
              const badgeColor =
                r.frequencyBadge === '7 DAYS'
                  ? '#15803d'
                  : r.frequencyBadge === 'WEEKLY'
                    ? '#b45309'
                    : '#0369a1';

              return (
                <div
                  key={r.id}
                  onClick={() => handleSelectRoom(r)}
                  style={{
                    padding: '14px 18px',
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    background: isSelected ? '#eff6ff' : isDone ? '#f0fdf4' : '#ffffff',
                    borderLeft: isSelected ? '4px solid #0284c7' : isDone ? '4px solid #16a34a' : '4px solid transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                      {r.code} &bull; {r.zone}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: badgeBg,
                        color: badgeColor,
                      }}
                    >
                      {r.frequencyBadge}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: '#0f172a',
                      marginTop: 4,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>{r.room}</span>
                    {isDone && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#15803d',
                          background: '#dcfce7',
                          padding: '2px 8px',
                          borderRadius: 6,
                        }}
                      >
                        ✓ Done
                      </span>
                    )}
                  </div>
                  {r.workstationNote && (
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{r.workstationNote}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Room Digital Report Form */}
        <form
          onSubmit={handleSubmitRoomReport}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: 28,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          {/* Active Room Banner */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 12,
              paddingBottom: 20,
              marginBottom: 20,
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    background: '#0f3460',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: 6,
                  }}
                >
                  {selectedRoom.code}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#0284c7' }}>{selectedRoom.zone}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: '#e0f2fe',
                    color: '#0369a1',
                  }}
                >
                  {selectedRoom.frequencyLabel}
                </span>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '8px 0 4px' }}>
                {selectedRoom.room}
              </h2>
              {selectedRoom.workstationNote && (
                <div style={{ fontSize: 13, color: '#64748b' }}>{selectedRoom.workstationNote}</div>
              )}
            </div>

            {completedRoomNames.has(selectedRoom.room) && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  color: '#15803d',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                ✓ Completed for {selectedDate} (Submitting again logs an additional clean)
              </div>
            )}
          </div>

          {/* Scope Limitation Alert if applicable */}
          {selectedRoom.limitations && (
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 20,
                color: '#92400e',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              ⚠️ <strong>Scope Note / Exclusion:</strong> {selectedRoom.limitations}
            </div>
          )}

          {/* Toast Feedback */}
          {toast && (
            <div
              style={{
                background: toast.type === 'success' ? '#f0fdf4' : '#fef2f2',
                border: `1px solid ${toast.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                color: toast.type === 'success' ? '#15803d' : '#dc2626',
                padding: '14px 18px',
                borderRadius: 10,
                marginBottom: 20,
                fontSize: 14,
                fontWeight: 700,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <span>{toast.text}</span>
              {toast.reportId && (
                <Link
                  href={`/reports/cleaning-events/${toast.reportId}`}
                  style={{
                    background: '#15803d',
                    color: '#ffffff',
                    padding: '6px 14px',
                    borderRadius: 6,
                    textDecoration: 'none',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  View / Print Report →
                </Link>
              )}
            </div>
          )}

          {/* Room Task Checklist */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#334155' }}>
                Room Task Checklist ({Object.values(checkedItems).filter(Boolean).length}/{selectedRoom.checklist.length} Completed)
              </label>
              <button
                type="button"
                onClick={() => {
                  const next: Record<number, boolean> = {};
                  selectedRoom.checklist.forEach((_, idx) => {
                    next[idx] = true;
                  });
                  setCheckedItems(next);
                }}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#0f3460',
                  cursor: 'pointer',
                }}
              >
                ✓ Tick All Tasks
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedRoom.checklist.map((taskLabel, idx) => {
                const checked = !!checkedItems[idx];
                return (
                  <label
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: checked ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                      background: checked ? '#f0fdf4' : '#f8fafc',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#0f172a',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => setCheckedItems(prev => ({ ...prev, [idx]: e.target.checked }))}
                      style={{ width: 18, height: 18, marginTop: 2, accentColor: '#16a34a' }}
                    />
                    <span>{taskLabel}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Shift, Duration & Personnel */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Shift Pattern
              </label>
              <select
                value={shiftType}
                onChange={e => setShiftType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 14,
                }}
              >
                <option value="Weekday (Mon–Fri)">Weekday (Mon–Fri — 7 hr Scope)</option>
                <option value="Saturday (5 hr Shift)">Saturday (5 hr Operational Scope)</option>
                <option value="Sunday (5 hr Shift)">Sunday (5 hr Operational Scope)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Time Taken (Minutes)
              </label>
              <input
                type="number"
                min={5}
                max={300}
                value={timeMinutes}
                onChange={e => setTimeMinutes(Number(e.target.value))}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 14,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Cleaner(s) / Operator(s)
              </label>
              <input
                type="text"
                value={operatorName}
                onChange={e => setOperatorName(e.target.value)}
                placeholder="e.g. Maria S., David K."
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 14,
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
                Supervisor Sign-Off
              </label>
              <input
                type="text"
                value={supervisorName}
                onChange={e => setSupervisorName(e.target.value)}
                placeholder="Supervisor Name"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 14,
                }}
              />
            </div>
          </div>

          {/* Chemicals Used */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
              Approved Cleaning Chemicals Used
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {NUPURE_CHEMICALS.map(chem => {
                const active = selectedChemicals.includes(chem);
                return (
                  <button
                    key={chem}
                    type="button"
                    onClick={() => toggleChemical(chem)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: active ? '1px solid #0284c7' : '1px solid #cbd5e1',
                      background: active ? '#e0f2fe' : '#f8fafc',
                      color: active ? '#0369a1' : '#475569',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {active ? '✓ ' : '+ '}
                    {chem}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Verification Toggles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Visual Hygiene Inspection</span>
              <button
                type="button"
                onClick={() => setVisualPassed(!visualPassed)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: visualPassed ? '#16a34a' : '#dc2626',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {visualPassed ? 'PASSED ✓' : 'RECLEAN REQ'}
              </button>
            </div>

            <div
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Colour-Coded Microfibre &amp; SSOP Verified</span>
              <button
                type="button"
                onClick={() => setSsopVerified(!ssopVerified)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: ssopVerified ? '#0284c7' : '#64748b',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {ssopVerified ? 'VERIFIED ✓' : 'NO'}
              </button>
            </div>
          </div>

          {/* Photo Uploads (Before & After) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 20 }}>
            <div style={{ padding: 14, borderRadius: 10, border: '1px dashed #cbd5e1', background: '#f8fafc' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
                Pre-Clean / Before Photos ({beforePhotos.length})
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={e => handlePhotoUpload(e, 'before')}
                disabled={uploadingPhoto}
                style={{ fontSize: 12 }}
              />
              {beforePhotos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {beforePhotos.map((u, i) => (
                    <img
                      key={i}
                      src={u}
                      alt="Before"
                      style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: 14, borderRadius: 10, border: '1px dashed #cbd5e1', background: '#f8fafc' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
                Post-Clean / Verification Photos ({afterPhotos.length})
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={e => handlePhotoUpload(e, 'after')}
                disabled={uploadingPhoto}
                style={{ fontSize: 12 }}
              />
              {afterPhotos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {afterPhotos.map((u, i) => (
                    <img
                      key={i}
                      src={u}
                      alt="After"
                      style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6, border: '1px solid #cbd5e1' }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Comments & Corrective Action */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 6 }}>
              Comments / Room Notes / Consumables Replenished
            </label>
            <textarea
              rows={2}
              value={comments}
              onChange={e => setComments(e.target.value)}
              placeholder="Optional notes on room condition, restocked consumables, or maintenance observations..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                fontSize: 14,
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button
              type="submit"
              disabled={submitting || uploadingPhoto}
              style={{
                background: 'linear-gradient(135deg, #0f3460, #0284c7)',
                color: '#ffffff',
                border: 'none',
                padding: '14px 28px',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 800,
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Saving Room Report & Updating Schedule...' : `Complete & Sign Off "${selectedRoom.room}" →`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
