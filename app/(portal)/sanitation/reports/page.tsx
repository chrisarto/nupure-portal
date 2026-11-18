'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { NUPURE_ROOMS, NUPURE_ZONES, NUPURE_CHEMICALS } from '@/lib/nupure-scope';
import { PhotoCaptureControl } from '@/app/components/PhotoCaptureControl';

interface CleaningChecklistItem {
  label: string;
  completed: boolean;
}

interface CleaningRecord {
  id: string;
  report_number: string;
  date: string;
  zone: string;
  location: string;
  frequency_badge: string;
  checklist_items: CleaningChecklistItem[] | null;
  items_cleaned: string | null;
  total_time_minutes: number | null;
  shift_type: string | null;
  cleaning_type: string | null;
  chemicals_used: string[] | null;
  operators_involved: string[] | null;
  ssop_verified: boolean | null;
  visual_inspection_passed: boolean | null;
  corrective_action: string | null;
  before_photos: string[] | null;
  after_photos: string[] | null;
  comments: string | null;
  submitted_by: string | null;
  supervisor_signoff: string | null;
  created_at: string;
}

export default function DailyCleaningCompletionReportPage() {
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [selectedZone, setSelectedZone] = useState<string>('All Zones');
  const [records, setRecords] = useState<CleaningRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Email PDF state
  const [showEmailBox, setShowEmailBox] = useState<boolean>(false);
  const [emailRecipients, setEmailRecipients] = useState<string>('chris@mjhygiene.com.au');
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Inline Photo Upload / Task Edit state per completed record ID
  const [openPhotoRecordId, setOpenPhotoRecordId] = useState<string | null>(null);
  const [savingRecordId, setSavingRecordId] = useState<string | null>(null);

  // Quick Complete All Rooms modal/panel state
  const [showQuickCompletePanel, setShowQuickCompletePanel] = useState<boolean>(false);
  const [quickTickedRoomIds, setQuickTickedRoomIds] = useState<Record<string, boolean>>({});
  const [quickExpandedRoomId, setQuickExpandedRoomId] = useState<string | null>(null);
  const [quickRoomTasks, setQuickRoomTasks] = useState<Record<string, Record<number, boolean>>>({});
  const [quickOperatorName, setQuickOperatorName] = useState<string>('MJ Hygiene Site Team');
  const [quickSupervisorName, setQuickSupervisorName] = useState<string>('MJ Hygiene Supervisor');
  const [submittingBatch, setSubmittingBatch] = useState<boolean>(false);

  const fetchRecords = useCallback(async (dateStr: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cleaning-records?date=${encodeURIComponent(dateStr)}`);
      const json = (await res.json()) as { data?: CleaningRecord[] };
      setRecords(json.data ?? []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRecords(selectedDate);
  }, [selectedDate, fetchRecords]);

  const d = new Date(`${selectedDate}T00:00:00`);
  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  const formattedDay = isNaN(d.getTime())
    ? selectedDate
    : d.toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

  const recordsByRoom = new Map<string, CleaningRecord>();
  for (const r of records) {
    if (!recordsByRoom.has(r.location)) {
      recordsByRoom.set(r.location, r);
    }
  }

  const openQuickCompleteAll = () => {
    const ticked: Record<string, boolean> = {};
    const tasksMap: Record<string, Record<number, boolean>> = {};
    for (const r of NUPURE_ROOMS) {
      const isDue = r.frequencyBadge === '7 DAYS' || (r.frequencyBadge === '5 DAYS' && !isWeekend);
      const alreadyLogged = recordsByRoom.has(r.room);
      ticked[r.id] = isDue && !alreadyLogged;
      const t: Record<number, boolean> = {};
      r.checklist.forEach((_, idx) => {
        t[idx] = true;
      });
      tasksMap[r.id] = t;
    }
    // If all due rooms are already logged, pre-tick all unlogged rooms so they can still use it
    if (Object.values(ticked).filter(Boolean).length === 0) {
      for (const r of NUPURE_ROOMS) {
        if (!recordsByRoom.has(r.room)) ticked[r.id] = true;
      }
    }
    setQuickTickedRoomIds(ticked);
    setQuickRoomTasks(tasksMap);
    setQuickExpandedRoomId(null);
    setShowQuickCompletePanel(true);
  };

  const handleBatchSubmitQuickComplete = async () => {
    const roomsToSubmit = NUPURE_ROOMS.filter(r => quickTickedRoomIds[r.id]);
    if (roomsToSubmit.length === 0) {
      setToast({ type: 'error', text: 'Please leave at least one completed room ticked before submitting.' });
      return;
    }
    setSubmittingBatch(true);
    setToast(null);
    try {
      const batchPayloads = roomsToSubmit.map(room => {
        const roomTaskState = quickRoomTasks[room.id] || {};
        const checklistItems = room.checklist.map((label, idx) => ({
          label,
          completed: roomTaskState[idx] !== false,
        }));
        return {
          date: selectedDate,
          zone: room.zone,
          location: room.room,
          frequency_badge: room.frequencyBadge,
          checklist_items: checklistItems,
          total_time_minutes: room.estimatedMinutes,
          shift_type: isWeekend ? 'Weekend (5 hr Operational Scope)' : 'Weekday (Mon–Fri)',
          cleaning_type:
            room.frequencyBadge === 'WEEKLY'
              ? 'Weekly Hygiene Service'
              : 'Scheduled Daily Hygiene Clean',
          chemicals_used: [NUPURE_CHEMICALS[0], NUPURE_CHEMICALS[1]],
          operators_involved: quickOperatorName
            .split(',')
            .map(s => s.trim())
            .filter(Boolean),
          supervisor_signoff: quickSupervisorName,
          submitted_by: quickOperatorName,
          visual_inspection_passed: true,
          ssop_verified: true,
        };
      });

      const res = await fetch('/api/cleaning-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_reports: batchPayloads }),
      });
      const json = (await res.json()) as { count?: number; error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'Failed to batch complete rooms');
      }

      setShowQuickCompletePanel(false);
      await fetchRecords(selectedDate);
      setToast({
        type: 'success',
        text: `✓ Quick Completed ${roomsToSubmit.length} room report${roomsToSubmit.length === 1 ? '' : 's'} for ${selectedDate} & updated Daily Completion PDF!`,
      });
    } catch (err) {
      setToast({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error completing rooms',
      });
    } finally {
      setSubmittingBatch(false);
    }
  };

  const handlePatchRecordPhotosOrTasks = async (
    recordId: string,
    patch: {
      before_photos?: string[];
      after_photos?: string[];
      checklist_items?: CleaningChecklistItem[];
    }
  ) => {
    setSavingRecordId(recordId);
    setToast(null);
    try {
      const res = await fetch(`/api/cleaning-records/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = (await res.json()) as { data?: CleaningRecord; error?: string };
      if (!res.ok || !json.data) {
        throw new Error(json.error || 'Failed to save update');
      }
      const updated = json.data;
      setRecords(prev => prev.map(r => (r.id === recordId ? updated : r)));
      setToast({
        type: 'success',
        text: `✓ Updated Report ${updated.report_number} (${updated.location}) & regenerated Daily Completion PDF!`,
      });
    } catch (err) {
      setToast({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error saving photos to report',
      });
    } finally {
      setSavingRecordId(null);
    }
  };

  const handleSendDailyPdfEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingEmail(true);
    setToast(null);
    try {
      const res = await fetch('/api/cleaning-records/daily-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          recipients: emailRecipients,
        }),
      });
      const json = (await res.json()) as { filename?: string; recipients?: string[]; error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'Failed to email Daily Completion PDF');
      }
      setToast({
        type: 'success',
        text: `Daily Cleaning Completion Report PDF (${json.filename}) emailed to ${(json.recipients || []).join(', ')}!`,
      });
      setShowEmailBox(false);
    } catch (err) {
      setToast({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error sending PDF email',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const scheduledRooms = NUPURE_ROOMS.filter(r => {
    if (r.frequencyBadge === '7 DAYS') return true;
    if (r.frequencyBadge === '5 DAYS') return !isWeekend;
    return recordsByRoom.has(r.room);
  });

  const completedUniqueCount = recordsByRoom.size;
  const completionPct =
    scheduledRooms.length > 0 ? Math.min(100, Math.round((completedUniqueCount / scheduledRooms.length) * 100)) : 0;
  const totalMinutes = records.reduce((s, r) => s + (Number(r.total_time_minutes) || 0), 0);
  const passedCount = records.filter(r => r.visual_inspection_passed !== false).length;
  const passRatePct = records.length > 0 ? Math.round((passedCount / records.length) * 100) : 100;
  const totalTasksVerified = records.reduce((s, r) => {
    if (Array.isArray(r.checklist_items) && r.checklist_items.length > 0) {
      return s + r.checklist_items.filter(i => i.completed).length;
    }
    return s + 4;
  }, 0);

  const filteredRecords =
    selectedZone === 'All Zones' ? records : records.filter(r => r.zone === selectedZone);

  const filteredScopeRooms =
    selectedZone === 'All Zones' ? NUPURE_ROOMS : NUPURE_ROOMS.filter(r => r.zone === selectedZone);

  const quickTickedCount = Object.values(quickTickedRoomIds).filter(Boolean).length;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1420, margin: '0 auto' }}>
      {/* Header & PDF Actions */}
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
            MJ Hygiene Services &bull; Nu-Pure Beverages (Stapylton)
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', margin: '4px 0 6px' }}>
            Daily Cleaning Completion Report &amp; PDF Generator
          </h1>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
            Automatically aggregates all completed Room-by-Room Cleaning Event Reports for{' '}
            <strong>{formattedDay}</strong> into a formatted A4 PDF compliance report.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
            <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
              Report Date:
            </span>
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

          <button
            type="button"
            onClick={() => {
              if (showQuickCompletePanel) setShowQuickCompletePanel(false);
              else openQuickCompleteAll();
            }}
            style={{
              background: 'linear-gradient(135deg, #15803d, #16a34a)',
              color: '#ffffff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
            }}
          >
            ⚡ Quick Complete All Rooms
          </button>

          <a
            href={`/api/cleaning-records/daily-pdf?date=${encodeURIComponent(selectedDate)}`}
            style={{
              background: '#0f3460',
              color: '#ffffff',
              textDecoration: 'none',
              padding: '10px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ⬇ Download Daily Completion PDF
          </a>

          <a
            href={`/api/cleaning-records/daily-pdf?date=${encodeURIComponent(selectedDate)}&inline=1`}
            target="_blank"
            rel="noreferrer"
            style={{
              background: '#0284c7',
              color: '#ffffff',
              textDecoration: 'none',
              padding: '10px 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            👁️ Preview PDF
          </a>

          <button
            type="button"
            onClick={() => setShowEmailBox(prev => !prev)}
            style={{
              background: '#16a34a',
              color: '#ffffff',
              border: 'none',
              padding: '10px 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ✉️ Email Daily PDF
          </button>

          <Link
            href="/cleaning-report"
            style={{
              background: '#ffffff',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
              textDecoration: 'none',
              padding: '10px 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            + Log Room Clean
          </Link>
        </div>
      </div>

      {/* Toast Notification */}
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
          }}
        >
          {toast.text}
        </div>
      )}

      {/* Quick Complete All Rooms Panel */}
      {showQuickCompletePanel && (
        <div
          style={{
            background: '#f0fdf4',
            border: '2px solid #16a34a',
            borderRadius: 14,
            padding: 22,
            marginBottom: 24,
            boxShadow: '0 4px 14px rgba(22, 163, 74, 0.12)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>
                ⚡ Fast Team Sign-Off Mode — {selectedDate}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
                Quick Complete All Rooms — Untick Anything Not Completed
              </h2>
              <p style={{ fontSize: 13.5, color: '#334155', margin: 0 }}>
                All due rooms are pre-ticked below. Simply <strong>untick any room</strong> (or click{' '}
                <em>&ldquo;Untick Tasks&rdquo;</em> on a room to untick individual tasks) that wasn&apos;t completed, then press{' '}
                <strong>Submit Ticked Rooms</strong>.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  const next: Record<string, boolean> = {};
                  NUPURE_ROOMS.forEach(r => {
                    if (!recordsByRoom.has(r.room)) next[r.id] = true;
                  });
                  setQuickTickedRoomIds(next);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid #16a34a',
                  background: '#ffffff',
                  color: '#15803d',
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ✓ Tick All Unlogged Rooms
              </button>
              <button
                type="button"
                onClick={() => setQuickTickedRoomIds({})}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ☐ Untick All
              </button>
              <button
                type="button"
                onClick={() => setShowQuickCompletePanel(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ✕ Close
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
              marginBottom: 14,
              background: '#ffffff',
              padding: 14,
              borderRadius: 10,
              border: '1px solid #bbf7d0',
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: '#334155', marginBottom: 4 }}>
                Cleaner(s) / Team Member(s)
              </label>
              <input
                type="text"
                value={quickOperatorName}
                onChange={e => setQuickOperatorName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13.5,
                  fontWeight: 700,
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: '#334155', marginBottom: 4 }}>
                Supervisor Sign-Off
              </label>
              <input
                type="text"
                value={quickSupervisorName}
                onChange={e => setQuickSupervisorName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13.5,
                  fontWeight: 700,
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
              gap: 10,
              maxHeight: 420,
              overflowY: 'auto',
              padding: 4,
              marginBottom: 16,
            }}
          >
            {NUPURE_ROOMS.map(room => {
              const alreadyLogged = recordsByRoom.has(room.room);
              const isTicked = !!quickTickedRoomIds[room.id];
              const isExpanded = quickExpandedRoomId === room.id;
              const taskMap = quickRoomTasks[room.id] || {};
              const completedTasksCount = room.checklist.filter((_, idx) => taskMap[idx] !== false).length;

              return (
                <div
                  key={room.id}
                  style={{
                    background: alreadyLogged ? '#f8fafc' : isTicked ? '#ffffff' : '#fef2f2',
                    border: alreadyLogged
                      ? '1px solid #cbd5e1'
                      : isTicked
                        ? '2px solid #16a34a'
                        : '1px solid #fecaca',
                    borderRadius: 10,
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: cursorForRoom(alreadyLogged),
                        flex: 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isTicked}
                        onChange={e =>
                          setQuickTickedRoomIds(prev => ({
                            ...prev,
                            [room.id]: e.target.checked,
                          }))
                        }
                        style={{ width: 19, height: 19, accentColor: '#16a34a', cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b' }}>
                          {room.code} &bull; {room.zone} ({room.frequencyBadge})
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a' }}>{room.room}</div>
                      </div>
                    </label>

                    {alreadyLogged ? (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          background: '#dcfce7',
                          color: '#15803d',
                          padding: '2px 8px',
                          borderRadius: 999,
                        }}
                      >
                        Already Done ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setQuickExpandedRoomId(isExpanded ? null : room.id)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          background: '#f8fafc',
                          color: '#0284c7',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {isExpanded ? 'Hide Tasks' : `Tasks (${completedTasksCount}/${room.checklist.length})`}
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        marginTop: 10,
                        paddingTop: 8,
                        borderTop: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      {room.checklist.map((taskLabel, tIdx) => {
                        const tChecked = taskMap[tIdx] !== false;
                        return (
                          <label
                            key={tIdx}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 8,
                              fontSize: 12,
                              color: tChecked ? '#0f172a' : '#dc2626',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={tChecked}
                              onChange={e =>
                                setQuickRoomTasks(prev => ({
                                  ...prev,
                                  [room.id]: {
                                    ...(prev[room.id] || {}),
                                    [tIdx]: e.target.checked,
                                  },
                                }))
                              }
                              style={{ width: 15, height: 15, marginTop: 2, accentColor: '#16a34a' }}
                            />
                            <span>{taskLabel}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              disabled={submittingBatch || quickTickedCount === 0}
              onClick={() => void handleBatchSubmitQuickComplete()}
              style={{
                background: quickTickedCount === 0 ? '#94a3b8' : 'linear-gradient(135deg, #15803d, #16a34a)',
                color: '#ffffff',
                border: 'none',
                padding: '13px 26px',
                borderRadius: 10,
                fontSize: 14.5,
                fontWeight: 800,
                cursor: submittingBatch || quickTickedCount === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {submittingBatch
                ? `Saving ${quickTickedCount} Room Reports...`
                : `✓ Submit All Ticked Rooms (${quickTickedCount} Room${quickTickedCount === 1 ? '' : 's'}) →`}
            </button>
          </div>
        </div>
      )}

      {/* Email Daily Completion PDF Box */}
      {showEmailBox && (
        <form
          onSubmit={handleSendDailyPdfEmail}
          style={{
            background: '#f0fdf4',
            border: '2px solid #16a34a',
            borderRadius: 12,
            padding: '18px 22px',
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 320px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#15803d', textTransform: 'uppercase', marginBottom: 4 }}>
              Email Daily Cleaning Completion Report PDF ({selectedDate})
            </div>
            <input
              type="text"
              required
              value={emailRecipients}
              onChange={e => setEmailRecipients(e.target.value)}
              placeholder="Recipient emails (comma-separated)..."
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid #bbf7d0',
                fontSize: 14,
              }}
            />
          </div>
          <button
            type="submit"
            disabled={sendingEmail}
            style={{
              background: '#16a34a',
              color: '#ffffff',
              border: 'none',
              padding: '11px 22px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 800,
              cursor: sendingEmail ? 'not-allowed' : 'pointer',
              marginTop: 18,
            }}
          >
            {sendingEmail ? 'Generating & Sending PDF...' : 'Send PDF Attachment Now →'}
          </button>
        </form>
      )}

      {/* Executive KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '18px 20px',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Rooms Logged ({selectedDate})
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#0f3460', marginTop: 4 }}>
            {completedUniqueCount} <span style={{ fontSize: 16, color: '#64748b' }}>/ {scheduledRooms.length}</span>
          </div>
          <div style={{ fontSize: 12, color: '#0284c7', fontWeight: 700, marginTop: 2 }}>
            {completionPct}% of Scheduled Scope ({records.length} event{records.length === 1 ? '' : 's'})
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '18px 20px',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Total Cleaning Duration
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#0284c7', marginTop: 4 }}>
            {totalMinutes} <span style={{ fontSize: 16, color: '#64748b' }}>mins</span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {(totalMinutes / 60).toFixed(1)} hours logged across facility
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '18px 20px',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Checklist Tasks Verified
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#16a34a', marginTop: 4 }}>
            {totalTasksVerified}
          </div>
          <div style={{ fontSize: 12, color: '#15803d', fontWeight: 700, marginTop: 2 }}>
            SSOP &amp; Microfibre Colour-Coding Verified ✓
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 12,
            padding: '18px 20px',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Visual Hygiene Pass Rate
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#16a34a', marginTop: 4 }}>
            {passRatePct}%
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Ref: DCR-{selectedDate.replace(/-/g, '')}
          </div>
        </div>
      </div>

      {/* Section 1: Facility Zone Completion Summary Table */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 24,
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#0f3460' }}>
            1. Executive Facility Zone Completion Summary
          </span>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
            {isWeekend ? 'Weekend 7-Day Operational Scope' : 'Weekday Full Facility Scope (Mon–Fri)'}
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '10px 16px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>
                Facility Zone
              </th>
              <th style={{ padding: '10px 16px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>
                Total Scope
              </th>
              <th style={{ padding: '10px 16px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>
                Scheduled Today
              </th>
              <th style={{ padding: '10px 16px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>
                Completed Rooms
              </th>
              <th style={{ padding: '10px 16px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>
                Total Duration
              </th>
              <th style={{ padding: '10px 16px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>
                Zone Status
              </th>
            </tr>
          </thead>
          <tbody>
            {NUPURE_ZONES.map(zone => {
              const roomsInZone = NUPURE_ROOMS.filter(r => r.zone === zone);
              const scheduledInZone = roomsInZone.filter(
                r =>
                  r.frequencyBadge === '7 DAYS' ||
                  (r.frequencyBadge === '5 DAYS' && !isWeekend) ||
                  recordsByRoom.has(r.room)
              );
              const completedInZone = roomsInZone.filter(r => recordsByRoom.has(r.room));
              const zoneMins = records
                .filter(r => r.zone === zone)
                .reduce((s, r) => s + (Number(r.total_time_minutes) || 0), 0);
              const isAllDone =
                completedInZone.length >= scheduledInZone.length && scheduledInZone.length > 0;

              return (
                <tr key={zone} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>{zone}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{roomsInZone.length} Areas</td>
                  <td style={{ padding: '12px 16px', color: '#334155', fontWeight: 600 }}>
                    {scheduledInZone.length} Scheduled
                  </td>
                  <td style={{ padding: '12px 16px', fontWeight: 800, color: '#0284c7' }}>
                    {completedInZone.length} / {scheduledInZone.length} Completed
                  </td>
                  <td style={{ padding: '12px 16px', color: '#475569' }}>{zoneMins} mins</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '3px 10px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 800,
                        background: isAllDone
                          ? '#dcfce7'
                          : completedInZone.length > 0
                            ? '#e0f2fe'
                            : '#f1f5f9',
                        color: isAllDone
                          ? '#15803d'
                          : completedInZone.length > 0
                            ? '#0369a1'
                            : '#64748b',
                      }}
                    >
                      {isAllDone
                        ? 'COMPLETED ✓'
                        : completedInZone.length > 0
                          ? `IN PROGRESS (${completedInZone.length}/${scheduledInZone.length})`
                          : scheduledInZone.length === 0
                            ? 'OFF-SCHEDULE'
                            : 'PENDING'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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

      {/* Section 2: Completed Room Event Reports for Selected Date */}
      <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 12px' }}>
        2. Completed Room Cleaning Event Logs ({filteredRecords.length} Logged for {selectedDate})
      </h2>

      {loading ? (
        <div
          style={{
            padding: 36,
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            color: '#64748b',
            marginBottom: 28,
          }}
        >
          Loading Daily Cleaning Completion Report for {selectedDate}...
        </div>
      ) : filteredRecords.length === 0 ? (
        <div
          style={{
            padding: 36,
            textAlign: 'center',
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            color: '#64748b',
            marginBottom: 28,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
            No Room Cleaning Reports Logged Yet for {selectedDate}
          </div>
          <p style={{ fontSize: 14, margin: '0 0 16px' }}>
            Complete room cleans in the Digital Room Cleaning Report module or use{' '}
            <strong>Quick Complete All Rooms</strong> to populate this date&apos;s Daily Completion Report.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={openQuickCompleteAll}
              style={{
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              ⚡ Quick Complete All Rooms Now
            </button>
            <Link
              href="/cleaning-report"
              style={{
                display: 'inline-block',
                background: '#0284c7',
                color: '#ffffff',
                textDecoration: 'none',
                padding: '10px 20px',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              + Log Single Room Clean →
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
          {filteredRecords.map(rec => {
            const isPhotoPanelOpen = openPhotoRecordId === rec.id;
            const isSavingThis = savingRecordId === rec.id;
            const photoCount = (rec.before_photos?.length || 0) + (rec.after_photos?.length || 0);

            return (
              <div
                key={rec.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderLeft: `5px solid ${rec.visual_inspection_passed !== false ? '#16a34a' : '#dc2626'}`,
                  borderRadius: 12,
                  padding: '18px 22px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                        {rec.report_number}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0284c7' }}>{rec.zone}</span>
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        &bull; {rec.shift_type || 'Standard Shift'} ({rec.total_time_minutes || 20} mins)
                      </span>
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '6px 0 2px' }}>
                      {rec.location}
                    </h3>
                    <div style={{ fontSize: 12.5, color: '#475569' }}>
                      Completed by <strong>{rec.submitted_by || 'MJ Hygiene Team'}</strong> &bull; Supervisor Sign-Off:{' '}
                      <strong>{rec.supervisor_signoff || 'Verified'}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        padding: '4px 12px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 800,
                        background: rec.visual_inspection_passed !== false ? '#dcfce7' : '#fee2e2',
                        color: rec.visual_inspection_passed !== false ? '#15803d' : '#dc2626',
                      }}
                    >
                      {rec.visual_inspection_passed !== false ? 'PASSED ✓' : 'RECLEAN REQ'}
                    </span>

                    <button
                      type="button"
                      onClick={() => setOpenPhotoRecordId(isPhotoPanelOpen ? null : rec.id)}
                      style={{
                        background: isPhotoPanelOpen ? '#e0f2fe' : '#0284c7',
                        color: isPhotoPanelOpen ? '#0369a1' : '#ffffff',
                        border: '1px solid #0284c7',
                        padding: '7px 14px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      📷 {isPhotoPanelOpen ? 'Close Photo Loader' : `+ Load Photos (${photoCount})`}
                    </button>

                    <a
                      href={`/api/cleaning-records/${rec.id}/pdf`}
                      style={{
                        background: '#0f3460',
                        color: '#ffffff',
                        textDecoration: 'none',
                        padding: '7px 14px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      ⬇ Room PDF
                    </a>
                    <Link
                      href={`/reports/cleaning-events/${rec.id}`}
                      style={{
                        background: '#f8fafc',
                        color: '#0284c7',
                        border: '1px solid #cbd5e1',
                        textDecoration: 'none',
                        padding: '7px 14px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      View / Edit Report →
                    </Link>
                  </div>
                </div>

                {/* Checklist items (Tap any task to tick/untick directly!) */}
                {Array.isArray(rec.checklist_items) && rec.checklist_items.length > 0 ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: 8,
                      background: '#f8fafc',
                      padding: 12,
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    {rec.checklist_items.map((item, idx) => (
                      <label
                        key={idx}
                        style={{
                          fontSize: 13,
                          color: item.completed ? '#1e293b' : '#dc2626',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={item.completed}
                          disabled={isSavingThis}
                          onChange={e => {
                            const nextList = (rec.checklist_items || []).map((it, i) =>
                              i === idx ? { ...it, completed: e.target.checked } : it
                            );
                            void handlePatchRecordPhotosOrTasks(rec.id, { checklist_items: nextList });
                          }}
                          style={{ width: 16, height: 16, marginTop: 2, accentColor: '#16a34a', cursor: 'pointer' }}
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: '#334155', background: '#f8fafc', padding: 12, borderRadius: 8 }}>
                    {rec.items_cleaned}
                  </div>
                )}

                {/* Inline Photo Loader for this Completed Room Report */}
                {isPhotoPanelOpen && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 14,
                      borderRadius: 10,
                      background: '#f0f9ff',
                      border: '1px solid #bae6fd',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0369a1', marginBottom: 10 }}>
                      📷 Load / Attach Photos for {rec.location} ({rec.report_number}) — Automatically updates Room PDF &amp; Daily Completion PDF
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
                      <PhotoCaptureControl
                        label="Pre-Clean / Before Photos"
                        photos={rec.before_photos ?? []}
                        onChange={nextBefore => {
                          void handlePatchRecordPhotosOrTasks(rec.id, {
                            before_photos: nextBefore,
                            after_photos: rec.after_photos ?? [],
                          });
                        }}
                        uploadEndpoint="/api/cleaning-records/upload"
                        disabled={isSavingThis}
                      />
                      <PhotoCaptureControl
                        label="Post-Clean / Verification Photos"
                        photos={rec.after_photos ?? []}
                        onChange={nextAfter => {
                          void handlePatchRecordPhotosOrTasks(rec.id, {
                            before_photos: rec.before_photos ?? [],
                            after_photos: nextAfter,
                          });
                        }}
                        uploadEndpoint="/api/cleaning-records/upload"
                        disabled={isSavingThis}
                      />
                    </div>
                  </div>
                )}

                {/* Uploaded Pre-Clean & Post-Clean Photos */}
                {photoCount > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 800, color: '#334155', textTransform: 'uppercase', marginBottom: 8 }}>
                      📷 Uploaded Photo Verification Evidence ({photoCount} Photo{photoCount === 1 ? '' : 's'})
                    </div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {(rec.before_photos ?? []).map((u, idx) => (
                        <a
                          key={`pre-${idx}`}
                          href={u}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'block',
                            width: 96,
                            borderRadius: 8,
                            overflow: 'hidden',
                            border: '1px solid #cbd5e1',
                            background: '#f8fafc',
                            textDecoration: 'none',
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={u}
                            alt={`Pre-Clean ${idx + 1}`}
                            style={{ width: '100%', height: 68, objectFit: 'cover', display: 'block' }}
                          />
                          <div
                            style={{
                              fontSize: 9.5,
                              fontWeight: 800,
                              color: '#475569',
                              textAlign: 'center',
                              padding: '2px 4px',
                              background: '#f1f5f9',
                            }}
                          >
                            BEFORE #{idx + 1}
                          </div>
                        </a>
                      ))}
                      {(rec.after_photos ?? []).map((u, idx) => (
                        <a
                          key={`post-${idx}`}
                          href={u}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: 'block',
                            width: 96,
                            borderRadius: 8,
                            overflow: 'hidden',
                            border: '1px solid #86efac',
                            background: '#f0fdf4',
                            textDecoration: 'none',
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={u}
                            alt={`Post-Clean ${idx + 1}`}
                            style={{ width: '100%', height: 68, objectFit: 'cover', display: 'block' }}
                          />
                          <div
                            style={{
                              fontSize: 9.5,
                              fontWeight: 800,
                              color: '#15803d',
                              textAlign: 'center',
                              padding: '2px 4px',
                              background: '#dcfce7',
                            }}
                          >
                            AFTER #{idx + 1}
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Section 3: Master Facility Room-by-Room Coverage Matrix */}
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
            padding: '14px 20px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#0f3460' }}>
            3. Master Facility Room-by-Room Coverage Matrix ({filteredScopeRooms.length} Areas)
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>Code</th>
              <th style={{ padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>Zone</th>
              <th style={{ padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>Room / Area</th>
              <th style={{ padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>Frequency</th>
              <th style={{ padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>Report Ref</th>
              <th style={{ padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>Completed By</th>
              <th style={{ padding: '10px 14px', fontSize: 11, textTransform: 'uppercase', color: '#475569' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredScopeRooms.map(room => {
              const rec = recordsByRoom.get(room.room);
              const isScheduled =
                room.frequencyBadge === '7 DAYS' || (room.frequencyBadge === '5 DAYS' && !isWeekend);

              return (
                <tr key={room.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f3460' }}>{room.code}</td>
                  <td style={{ padding: '10px 14px', color: '#475569', fontWeight: 600 }}>{room.zone}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{room.room}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b', fontSize: 12 }}>{room.frequencyBadge}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0284c7' }}>
                    {rec ? rec.report_number : '—'}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#334155' }}>
                    {rec ? rec.submitted_by : '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {rec ? (
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 800,
                          background: '#dcfce7',
                          color: '#15803d',
                        }}
                      >
                        COMPLETED ✓
                      </span>
                    ) : (
                      <span
                        style={{
                          padding: '3px 10px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background: '#f1f5f9',
                          color: '#64748b',
                        }}
                      >
                        {isScheduled ? 'PENDING' : 'OFF-SCHEDULE'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function cursorForRoom(alreadyLogged: boolean): string {
  return alreadyLogged ? 'pointer' : 'pointer';
}
