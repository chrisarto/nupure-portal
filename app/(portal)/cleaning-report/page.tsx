'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  NUPURE_ZONES,
  NUPURE_ROOMS,
  NUPURE_CHEMICALS,
  NUPURE_PROCEDURE_PDF_URL,
  NUPURE_MANUAL_CHECKLIST_PDF_URL,
  NUPURE_CHEMICAL_CHART_PDF_URL,
  getRoomSopInfo,
  type NuPureRoomSpec,
} from '@/lib/nupure-scope';
import {
  saveRoomDraft,
  getRoomDraft,
  deleteRoomDraft,
  enqueueOfflineCleaningReport,
  getPendingCleaningReports,
  syncPendingCleaningReports,
  resolvePhotoUrlsBeforeSync,
  saveCachedDailyRecords,
  getCachedDailyRecords,
  type QueuedCleaningReport,
  type CleaningReportPayload,
} from '@/lib/offline-cleaning-db';
import { PhotoCaptureControl } from '@/app/components/PhotoCaptureControl';

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
  before_photos?: string[] | null;
  after_photos?: string[] | null;
  created_at: string;
  isOfflineQueued?: boolean;
}

export default function CleaningReportPage() {
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [selectedZone, setSelectedZone] = useState<string>('All Zones');
  const [selectedRoom, setSelectedRoom] = useState<NuPureRoomSpec>(NUPURE_ROOMS[0]);
  const initialRoomSelectedRef = useRef<boolean>(false);

  // Checklist state for current room
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const [shiftType, setShiftType] = useState<string>('Weekday (Mon–Fri)');
  const [timeMinutes, setTimeMinutes] = useState<number>(NUPURE_ROOMS[0].estimatedMinutes);
  const [operatorName, setOperatorName] = useState<string>('MJ Hygiene Site Team');
  const [supervisorName, setSupervisorName] = useState<string>('MJ Hygiene Supervisor');
  const [selectedChemicals, setSelectedChemicals] = useState<string[]>([
    'Use All — Multi-Purpose Hard Surface & Floor Cleaner (USAL)',
    'Airlift Jelly Bean — General Purpose Disinfectant Deodoriser (CHRC-41015A)',
  ]);
  const [visualPassed, setVisualPassed] = useState<boolean>(true);
  const [ssopVerified, setSsopVerified] = useState<boolean>(true);
  const [sanitaryBinChanged, setSanitaryBinChanged] = useState<boolean>(false);
  const [airFreshenerChanged, setAirFreshenerChanged] = useState<boolean>(false);
  const [comments, setComments] = useState<string>('');
  const [correctiveAction, setCorrectiveAction] = useState<string>('');
  const [beforePhotos, setBeforePhotos] = useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);

  const [todayRecords, setTodayRecords] = useState<CleaningRecordRow[]>([]);
  const [pendingOfflineQueue, setPendingOfflineQueue] = useState<QueuedCleaningReport[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [syncingOffline, setSyncingOffline] = useState<boolean>(false);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [updatingExisting, setUpdatingExisting] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string; reportId?: string } | null>(null);
  const [draftHydrated, setDraftHydrated] = useState<boolean>(false);

  // Quick Complete All Rooms (Bulk Tick + Untick Exceptions) State
  const [showQuickCompleteModal, setShowQuickCompleteModal] = useState<boolean>(false);
  const [quickTickedRooms, setQuickTickedRooms] = useState<Record<string, boolean>>({});
  const [quickRoomTasks, setQuickRoomTasks] = useState<Record<string, Record<number, boolean>>>({});
  const [quickRoomBeforePhotos, setQuickRoomBeforePhotos] = useState<Record<string, string[]>>({});
  const [quickRoomAfterPhotos, setQuickRoomAfterPhotos] = useState<Record<string, string[]>>({});
  const [quickExpandedRoomId, setQuickExpandedRoomId] = useState<string | null>(null);
  const [submittingQuickAll, setSubmittingQuickAll] = useState<boolean>(false);

  const refreshPendingQueue = useCallback(async () => {
    const queued = await getPendingCleaningReports();
    setPendingOfflineQueue(queued);
    return queued;
  }, []);

  const loadRecordsForDate = useCallback(async (dateStr: string) => {
    setLoadingRecords(true);
    try {
      const res = await fetch(`/api/cleaning-records?date=${encodeURIComponent(dateStr)}`);
      if (!res.ok) throw new Error('Network error');
      const json = (await res.json()) as { data?: CleaningRecordRow[] };
      const rows = json.data ?? [];
      setTodayRecords(rows);
      await saveCachedDailyRecords(dateStr, rows);
    } catch {
      const cached = await getCachedDailyRecords(dateStr);
      setTodayRecords(cached);
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  const handleSyncOfflineQueue = useCallback(async (showFeedbackIfEmpty = false) => {
    setSyncingOffline(true);
    try {
      const { synced, remaining, errors } = await syncPendingCleaningReports();
      await refreshPendingQueue();
      await loadRecordsForDate(selectedDate);
      if (synced > 0) {
        setToast({
          type: 'success',
          text: `✓ Synced ${synced} offline room report${synced === 1 ? '' : 's'} to the Nu-Pure Portal${remaining > 0 ? ` (${remaining} remaining)` : '!'}`,
        });
      } else if (errors.length > 0 && showFeedbackIfEmpty) {
        setToast({
          type: 'error',
          text: `⚠️ Sync retry needed (${remaining} queued): ${errors[0]}`,
        });
      }
    } finally {
      setSyncingOffline(false);
    }
  }, [refreshPendingQueue, loadRecordsForDate, selectedDate]);

  useEffect(() => {
    const onlineNow = typeof navigator !== 'undefined' ? navigator.onLine : true;
    setIsOnline(onlineNow);
    void refreshPendingQueue().then(queued => {
      if (onlineNow && queued.length > 0) {
        void handleSyncOfflineQueue(false);
      }
    });

    const onOnline = () => {
      setIsOnline(true);
      void handleSyncOfflineQueue(false);
    };
    const onOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const intervalId = window.setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        void getPendingCleaningReports().then(q => {
          if (q.length > 0) {
            void handleSyncOfflineQueue(false);
          }
        });
      }
    }, 25000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(intervalId);
    };
  }, [refreshPendingQueue, handleSyncOfflineQueue]);

  useEffect(() => {
    void loadRecordsForDate(selectedDate);
  }, [selectedDate, loadRecordsForDate]);

  // Reset or restore draft from IndexedDB when room changes
  const handleSelectRoom = useCallback(async (room: NuPureRoomSpec, dateOverride?: string) => {
    const activeDate = dateOverride ?? selectedDate;
    setDraftHydrated(false);
    setSelectedRoom(room);
    setToast(null);
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem('nupure_selected_room_id', room.id);
      }
    } catch {
      // Ignore sessionStorage errors
    }

    const savedDraft = await getRoomDraft(activeDate, room.code);
    if (savedDraft) {
      setCheckedItems(savedDraft.checkedItems);
      setShiftType(savedDraft.shiftType);
      setTimeMinutes(savedDraft.timeMinutes);
      setOperatorName(savedDraft.operatorName);
      setSupervisorName(savedDraft.supervisorName);
      setSelectedChemicals(savedDraft.selectedChemicals);
      setVisualPassed(savedDraft.visualPassed);
      setSsopVerified(savedDraft.ssopVerified);
      setSanitaryBinChanged(savedDraft.sanitaryBinChanged);
      setAirFreshenerChanged(savedDraft.airFreshenerChanged);
      setComments(savedDraft.comments);
      setCorrectiveAction(savedDraft.correctiveAction);
      setBeforePhotos(savedDraft.beforePhotos);
      setAfterPhotos(savedDraft.afterPhotos);
    } else {
      const allChecked: Record<number, boolean> = {};
      room.checklist.forEach((_, idx) => {
        allChecked[idx] = true;
      });
      setCheckedItems(allChecked);
      setTimeMinutes(room.estimatedMinutes);
      setSanitaryBinChanged(false);
      setAirFreshenerChanged(false);
      setComments('');
      setCorrectiveAction('');
      setBeforePhotos([]);
      setAfterPhotos([]);
    }
    setDraftHydrated(true);
  }, [selectedDate]);

  useEffect(() => {
    if (initialRoomSelectedRef.current) return;
    initialRoomSelectedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    let matched = roomParam ? NUPURE_ROOMS.find(r => r.room === roomParam || r.id === roomParam) : undefined;
    if (!matched) {
      try {
        const storedId = window.sessionStorage?.getItem('nupure_selected_room_id');
        if (storedId) {
          matched = NUPURE_ROOMS.find(r => r.id === storedId);
        }
      } catch {
        // Ignore
      }
    }
    void handleSelectRoom(matched ?? NUPURE_ROOMS[0]);
  }, [handleSelectRoom]);

  // Auto-save room draft to IndexedDB whenever checklist or fields change
  useEffect(() => {
    if (!draftHydrated) return;
    void saveRoomDraft({
      draftKey: `${selectedDate}::${selectedRoom.code}`,
      date: selectedDate,
      roomCode: selectedRoom.code,
      checkedItems,
      shiftType,
      timeMinutes,
      operatorName,
      supervisorName,
      selectedChemicals,
      visualPassed,
      ssopVerified,
      sanitaryBinChanged,
      airFreshenerChanged,
      comments,
      correctiveAction,
      beforePhotos,
      afterPhotos,
      updatedAt: new Date().toISOString(),
    });
  }, [
    draftHydrated,
    selectedDate,
    selectedRoom.code,
    checkedItems,
    shiftType,
    timeMinutes,
    operatorName,
    supervisorName,
    selectedChemicals,
    visualPassed,
    ssopVerified,
    sanitaryBinChanged,
    airFreshenerChanged,
    comments,
    correctiveAction,
    beforePhotos,
    afterPhotos,
  ]);

  const toggleChemical = (chem: string) => {
    setSelectedChemicals(prev =>
      prev.includes(chem) ? prev.filter(c => c !== chem) : [...prev, chem]
    );
  };

  const existingRecordForSelectedRoom = todayRecords.find(r => r.location === selectedRoom.room);

  const handleUpdateExistingRoomReport = async () => {
    if (!existingRecordForSelectedRoom) return;
    setUpdatingExisting(true);
    setToast(null);
    try {
      const checklistPayload = selectedRoom.checklist.map((label, idx) => ({
        label,
        completed: !!checkedItems[idx],
      }));
      if (sanitaryBinChanged) {
        checklistPayload.push({
          label: 'Sanitary Bin Liner Replaced, Unit Sanitised & Waste Collected',
          completed: true,
        });
      }
      if (airFreshenerChanged) {
        checklistPayload.push({
          label: 'Automatic Air Freshener Refill / Battery Changed & Spray Checked',
          completed: true,
        });
      }

      const finalBefore = await resolvePhotoUrlsBeforeSync([
        ...(existingRecordForSelectedRoom.before_photos ?? []),
        ...beforePhotos,
      ]);
      const finalAfter = await resolvePhotoUrlsBeforeSync([
        ...(existingRecordForSelectedRoom.after_photos ?? []),
        ...afterPhotos,
      ]);

      const res = await fetch(`/api/cleaning-records/${existingRecordForSelectedRoom.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          before_photos: finalBefore,
          after_photos: finalAfter,
          checklist_items: checklistPayload,
          comments: comments || undefined,
          visual_inspection_passed: visualPassed,
        }),
      });
      const json = (await res.json()) as { data?: { id: string; report_number: string }; error?: string };
      if (!res.ok || !json.data) {
        throw new Error(json.error || 'Failed to update existing room report');
      }

      setBeforePhotos([]);
      setAfterPhotos([]);
      await deleteRoomDraft(selectedDate, selectedRoom.code);
      await loadRecordsForDate(selectedDate);
      setToast({
        type: 'success',
        text: `✓ Updated "${selectedRoom.room}" (${json.data.report_number}) with ${finalBefore.length + finalAfter.length} photo(s) & updated Daily Completion PDF!`,
        reportId: json.data.id,
      });
    } catch (err) {
      setToast({
        type: 'error',
        text: err instanceof Error ? err.message : 'Error updating existing report',
      });
    } finally {
      setUpdatingExisting(false);
    }
  };

  const handleSubmitRoomReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setToast(null);

    const checklistPayload = selectedRoom.checklist.map((label, idx) => ({
      label,
      completed: !!checkedItems[idx],
    }));
    if (sanitaryBinChanged) {
      checklistPayload.push({
        label: 'Sanitary Bin Liner Replaced, Unit Sanitised & Waste Collected',
        completed: true,
      });
    }
    if (airFreshenerChanged) {
      checklistPayload.push({
        label: 'Automatic Air Freshener Refill / Battery Changed & Spray Checked',
        completed: true,
      });
    }

    let finalBeforePhotos = beforePhotos;
    let finalAfterPhotos = afterPhotos;

    if (typeof navigator === 'undefined' || navigator.onLine) {
      finalBeforePhotos = await resolvePhotoUrlsBeforeSync(beforePhotos);
      finalAfterPhotos = await resolvePhotoUrlsBeforeSync(afterPhotos);
      setBeforePhotos(finalBeforePhotos);
      setAfterPhotos(finalAfterPhotos);
    }

    const reportPayload: CleaningReportPayload = {
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
      supervisor_signoff: supervisorName,
      visual_inspection_passed: visualPassed,
      ssop_verified: ssopVerified,
      sanitary_bin_changed: sanitaryBinChanged,
      air_freshener_changed: airFreshenerChanged,
      comments,
      corrective_actions: correctiveAction,
      before_photos: finalBeforePhotos,
      after_photos: finalAfterPhotos,
      submitted_by: operatorName,
      schedule_event_id: `ev_${selectedRoom.id}`,
    };

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('OFFLINE_MODE');
      }

      const res = await fetch('/api/cleaning-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...reportPayload,
          corrective_action: correctiveAction,
        }),
      });

      const json = (await res.json()) as { data?: { id: string; report_number: string }; error?: string };
      if (!res.ok || !json.data) {
        throw new Error(json.error || 'Failed to save room cleaning report');
      }

      await deleteRoomDraft(selectedDate, selectedRoom.code);
      await loadRecordsForDate(selectedDate);
      const photoSummary =
        finalBeforePhotos.length + finalAfterPhotos.length > 0
          ? ` with ${finalBeforePhotos.length + finalAfterPhotos.length} photo(s)`
          : '';
      setToast({
        type: 'success',
        text: `✓ Room "${selectedRoom.room}" logged (${json.data.report_number})${photoSummary} & Active Schedule updated!`,
        reportId: json.data.id,
      });
    } catch {
      // Save to IndexedDB offline queue so the checklist works seamlessly offline
      await enqueueOfflineCleaningReport(selectedRoom.code, reportPayload);
      await deleteRoomDraft(selectedDate, selectedRoom.code);
      await refreshPendingQueue();
      setToast({
        type: 'success',
        text: `⚡ Saved "${selectedRoom.room}" to Device Offline Queue! It will automatically sync to the Portal as soon as internet returns.`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const pendingForSelectedDate = pendingOfflineQueue.filter(q => q.payload.date === selectedDate);
  const completedRoomNames = new Set([
    ...todayRecords.map(r => r.location),
    ...pendingForSelectedDate.map(q => q.payload.location),
  ]);
  const offlineQueuedRoomNames = new Set(pendingForSelectedDate.map(q => q.payload.location));

  const openQuickCompleteModal = () => {
    const dObj = new Date(`${selectedDate}T00:00:00`);
    const isWeekendDate = dObj.getDay() === 0 || dObj.getDay() === 6;
    const nextTicked: Record<string, boolean> = {};
    const nextTasks: Record<string, Record<number, boolean>> = {};

    for (const r of NUPURE_ROOMS) {
      const isDueToday = r.frequencyBadge === '7 DAYS' || (r.frequencyBadge === '5 DAYS' && !isWeekendDate);
      const isAlreadyDone = completedRoomNames.has(r.room);
      nextTicked[r.id] = isDueToday && !isAlreadyDone;

      const tMap: Record<number, boolean> = {};
      r.checklist.forEach((_, idx) => {
        tMap[idx] = true;
      });
      nextTasks[r.id] = tMap;
    }

    // If all scheduled rooms were already done, pre-tick all remaining uncompleted rooms
    if (Object.values(nextTicked).filter(Boolean).length === 0) {
      for (const r of NUPURE_ROOMS) {
        if (!completedRoomNames.has(r.room)) {
          nextTicked[r.id] = true;
        }
      }
    }

    setQuickTickedRooms(nextTicked);
    setQuickRoomTasks(nextTasks);
    setQuickRoomBeforePhotos({});
    setQuickRoomAfterPhotos({});
    setQuickExpandedRoomId(null);
    setShowQuickCompleteModal(true);
  };

  const handleSubmitQuickCompleteAll = async () => {
    const selectedRoomsList = NUPURE_ROOMS.filter(r => quickTickedRooms[r.id]);
    if (selectedRoomsList.length === 0) {
      setToast({
        type: 'error',
        text: 'Please keep at least one completed room ticked before submitting.',
      });
      return;
    }

    setSubmittingQuickAll(true);
    setToast(null);

    const payloads: CleaningReportPayload[] = [];
    for (const room of selectedRoomsList) {
      const taskMap = quickRoomTasks[room.id] || {};
      const checklistPayload = room.checklist.map((label, idx) => ({
        label,
        completed: taskMap[idx] !== false,
      }));
      const rawBefore = quickRoomBeforePhotos[room.id] || [];
      const rawAfter = quickRoomAfterPhotos[room.id] || [];

      const resolvedBefore =
        typeof navigator === 'undefined' || navigator.onLine
          ? await resolvePhotoUrlsBeforeSync(rawBefore)
          : rawBefore;
      const resolvedAfter =
        typeof navigator === 'undefined' || navigator.onLine
          ? await resolvePhotoUrlsBeforeSync(rawAfter)
          : rawAfter;

      payloads.push({
        date: selectedDate,
        zone: room.zone,
        location: room.room,
        frequency_badge: room.frequencyBadge,
        checklist_items: checklistPayload,
        total_time_minutes: room.estimatedMinutes,
        shift_type: shiftType,
        cleaning_type:
          room.frequencyBadge === 'WEEKLY'
            ? 'Weekly Hygiene Service'
            : 'Scheduled Daily Hygiene Clean',
        chemicals_used: selectedChemicals,
        operators_involved: operatorName
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        supervisor_signoff: supervisorName,
        visual_inspection_passed: true,
        ssop_verified: true,
        sanitary_bin_changed: false,
        air_freshener_changed: false,
        comments: '',
        corrective_actions: '',
        before_photos: resolvedBefore,
        after_photos: resolvedAfter,
        submitted_by: operatorName,
        schedule_event_id: `ev_${room.id}`,
      });
    }

    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error('OFFLINE_MODE');
      }

      const res = await fetch('/api/cleaning-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_reports: payloads,
        }),
      });

      const json = (await res.json()) as { count?: number; error?: string };
      if (!res.ok) {
        throw new Error(json.error || 'Failed to save batch room reports');
      }

      for (const room of selectedRoomsList) {
        await deleteRoomDraft(selectedDate, room.code);
      }
      setShowQuickCompleteModal(false);
      await loadRecordsForDate(selectedDate);
      setToast({
        type: 'success',
        text: `✓ Quick Completed ${selectedRoomsList.length} room${selectedRoomsList.length === 1 ? '' : 's'} for ${selectedDate} & updated the Daily Completion Report PDF!`,
      });
    } catch {
      // Offline queue fallback for all ticked rooms
      for (let i = 0; i < selectedRoomsList.length; i++) {
        const room = selectedRoomsList[i];
        await enqueueOfflineCleaningReport(room.code, payloads[i]);
        await deleteRoomDraft(selectedDate, room.code);
      }
      setShowQuickCompleteModal(false);
      await refreshPendingQueue();
      setToast({
        type: 'success',
        text: `⚡ Saved ${selectedRoomsList.length} completed room${selectedRoomsList.length === 1 ? '' : 's'} to Device Offline Queue! They will auto-sync as soon as internet returns.`,
      });
    } finally {
      setSubmittingQuickAll(false);
    }
  };

  const quickTickedCount = Object.values(quickTickedRooms).filter(Boolean).length;

  const filteredRooms =
    selectedZone === 'All Zones'
      ? NUPURE_ROOMS
      : NUPURE_ROOMS.filter(r => r.zone === selectedZone);

  const completedCount = NUPURE_ROOMS.filter(r => completedRoomNames.has(r.room)).length;
  const progressPct = Math.round((completedCount / NUPURE_ROOMS.length) * 100);

  return (
    <div className="np-page">
      {/* Live Online / Offline Sync Status Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          padding: '10px 16px',
          borderRadius: 10,
          marginBottom: 16,
          background: isOnline ? '#f0fdf4' : '#fffbeb',
          border: isOnline ? '1px solid #bbf7d0' : '1px solid #fde68a',
          color: isOnline ? '#166534' : '#92400e',
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span>{isOnline ? '🟢 Online — Live Portal Sync Active' : '🟠 Offline Mode — Checklists & Photos Saved on Device (IndexedDB)'}</span>
          <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.85 }}>
            • Auto-saving draft for {selectedRoom.code}
          </span>
        </div>

        {pendingOfflineQueue.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                background: '#fef3c7',
                color: '#b45309',
                border: '1px solid #fcd34d',
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              ⚡ {pendingOfflineQueue.length} Offline Report{pendingOfflineQueue.length === 1 ? '' : 's'} Queued
            </span>
            <button
              type="button"
              disabled={!isOnline || syncingOffline}
              onClick={() => void handleSyncOfflineQueue(true)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: 'none',
                background: isOnline ? '#0284c7' : '#94a3b8',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 800,
                cursor: isOnline && !syncingOffline ? 'pointer' : 'not-allowed',
              }}
            >
              {syncingOffline ? '⏳ Syncing...' : '🔄 Sync to Portal Now'}
            </button>
          </div>
        )}
      </div>
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
              onChange={e => {
                const nextDate = e.target.value;
                setSelectedDate(nextDate);
                void handleSelectRoom(selectedRoom, nextDate);
              }}
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

          <a
            href={NUPURE_CHEMICAL_CHART_PDF_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#0f766e',
              color: '#ffffff',
              textDecoration: 'none',
              padding: '10px 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            🧪 Chemical Chart &amp; SDS QR (PDF) ↗
          </a>

          <a
            href={NUPURE_MANUAL_CHECKLIST_PDF_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#b45309',
              color: '#ffffff',
              textDecoration: 'none',
              padding: '10px 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            🖨️ Printable Manual Checklist (PDF) ↗
          </a>

          <a
            href={NUPURE_PROCEDURE_PDF_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#1e293b',
              color: '#ffffff',
              textDecoration: 'none',
              padding: '10px 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            📘 Cleaning Procedures Manual (PDF) ↗
          </a>

          <a
            href={`/api/cleaning-records/daily-pdf?date=${encodeURIComponent(selectedDate)}`}
            style={{
              background: '#16a34a',
              color: '#ffffff',
              textDecoration: 'none',
              padding: '10px 18px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            ⬇ Daily Completion Report PDF
          </a>

          <Link
            href="/hygiene-services"
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
            ♻️ Sanitary &amp; Air Freshener Changes →
          </Link>

          <Link
            href="/sanitation/reports"
            style={{
              background: '#0f3460',
              color: '#ffffff',
              textDecoration: 'none',
              padding: '10px 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Daily Completion Summary →
          </Link>

          <Link
            href="/reports/cleaning-events"
            style={{
              background: '#0f3460',
              color: '#ffffff',
              textDecoration: 'none',
              padding: '10px 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            All Room Reports ({todayRecords.length} today) →
          </Link>
        </div>
      </div>

      {/* Site Progress Bar + Quick Complete All Trigger */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a' }}>
              Daily Room Completion Progress ({selectedDate}) — {completedCount} of {NUPURE_ROOMS.length} Rooms Completed ({progressPct}%)
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Tip: Press <strong>&ldquo;⚡ Quick Complete All Rooms&rdquo;</strong> to tick all scheduled rooms at once, then simply untick any room or task that wasn&apos;t completed.
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (showQuickCompleteModal) setShowQuickCompleteModal(false);
              else openQuickCompleteModal();
            }}
            style={{
              background: 'linear-gradient(135deg, #15803d, #16a34a)',
              color: '#ffffff',
              border: 'none',
              padding: '11px 20px',
              borderRadius: 10,
              fontSize: 13.5,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(22, 163, 74, 0.28)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span>⚡ Quick Complete All Rooms (Then Untick Exceptions)</span>
          </button>
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

      {/* Interactive Quick Complete All Rooms Panel */}
      {showQuickCompleteModal && (
        <div
          style={{
            background: '#f0fdf4',
            border: '2px solid #16a34a',
            borderRadius: 14,
            padding: 22,
            marginBottom: 24,
            boxShadow: '0 6px 18px rgba(22, 163, 74, 0.14)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                ⚡ Fast Team Sign-Off Mode &bull; Shift Date: {selectedDate}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', margin: '4px 0' }}>
                Quick Complete All Rooms — Untick Anything That Wasn&apos;t Completed
              </h2>
              <p style={{ fontSize: 13.5, color: '#334155', margin: 0 }}>
                All scheduled rooms are pre-ticked (<strong style={{ color: '#15803d' }}>✓</strong>). Simply{' '}
                <strong>untick any room</strong> that wasn&apos;t completed — or tap{' '}
                <strong>&ldquo;Tasks / + Photos&rdquo;</strong> on any room to untick specific tasks or attach photos — then press{' '}
                <strong>Complete &amp; Sign Off Ticked Rooms</strong>.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  const next: Record<string, boolean> = {};
                  NUPURE_ROOMS.forEach(r => {
                    if (!completedRoomNames.has(r.room)) next[r.id] = true;
                  });
                  setQuickTickedRooms(next);
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
                ✓ Tick All Remaining Rooms
              </button>
              <button
                type="button"
                onClick={() => {
                  const next: Record<string, boolean> = {};
                  NUPURE_ROOMS.forEach(r => {
                    next[r.id] = true;
                  });
                  setQuickTickedRooms(next);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid #0284c7',
                  background: '#ffffff',
                  color: '#0284c7',
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                ✓ Tick All 30 Scope Rooms
              </button>
              <button
                type="button"
                onClick={() => setQuickTickedRooms({})}
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
                onClick={() => setShowQuickCompleteModal(false)}
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

          {/* Cleaner & Supervisor Sign-off Bar for Batch */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
              background: '#ffffff',
              padding: 14,
              borderRadius: 10,
              border: '1px solid #bbf7d0',
              marginBottom: 14,
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: '#334155', marginBottom: 4 }}>
                Cleaner(s) / Team Member(s)
              </label>
              <input
                type="text"
                value={operatorName}
                onChange={e => setOperatorName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
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
                value={supervisorName}
                onChange={e => setSupervisorName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13.5,
                  fontWeight: 700,
                }}
              />
            </div>
          </div>

          {/* Room Grid with Tick / Untick + Expandable Tasks & Photo Loader */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: 10,
              maxHeight: 480,
              overflowY: 'auto',
              padding: 4,
              marginBottom: 16,
            }}
          >
            {NUPURE_ROOMS.map(room => {
              const isAlreadyDone = completedRoomNames.has(room.room);
              const isTicked = !!quickTickedRooms[room.id];
              const isExpanded = quickExpandedRoomId === room.id;
              const taskMap = quickRoomTasks[room.id] || {};
              const completedTasksCount = room.checklist.filter((_, idx) => taskMap[idx] !== false).length;
              const roomPhotoCount =
                (quickRoomBeforePhotos[room.id]?.length || 0) + (quickRoomAfterPhotos[room.id]?.length || 0);

              return (
                <div
                  key={room.id}
                  style={{
                    background: isTicked ? '#ffffff' : isAlreadyDone ? '#f8fafc' : '#fff1f2',
                    border: isTicked
                      ? '2px solid #16a34a'
                      : isAlreadyDone
                        ? '1px solid #cbd5e1'
                        : '1px solid #fecaca',
                    borderRadius: 10,
                    padding: '11px 13px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: 'pointer',
                        flex: 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isTicked}
                        onChange={e =>
                          setQuickTickedRooms(prev => ({
                            ...prev,
                            [room.id]: e.target.checked,
                          }))
                        }
                        style={{ width: 20, height: 20, accentColor: '#16a34a', cursor: 'pointer' }}
                      />
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b' }}>
                          {room.code} &bull; {room.zone} ({room.frequencyBadge})
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a' }}>
                          {room.room}
                          {isAlreadyDone && (
                            <span style={{ marginLeft: 6, fontSize: 11, color: '#15803d', fontWeight: 800 }}>
                              (Logged ✓)
                            </span>
                          )}
                        </div>
                      </div>
                    </label>

                    <button
                      type="button"
                      onClick={() => setQuickExpandedRoomId(isExpanded ? null : room.id)}
                      style={{
                        padding: '5px 9px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        background: isExpanded ? '#e0f2fe' : '#f8fafc',
                        color: '#0284c7',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isExpanded
                        ? 'Hide'
                        : `Tasks (${completedTasksCount}/${room.checklist.length})${roomPhotoCount > 0 ? ` • 📷${roomPhotoCount}` : ' / +📷'}`}
                    </button>
                  </div>

                  {isExpanded && (
                    <div
                      style={{
                        marginTop: 10,
                        paddingTop: 10,
                        borderTop: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                        Untick Any Task Not Completed:
                      </div>
                      {room.checklist.map((taskLabel, tIdx) => {
                        const tChecked = taskMap[tIdx] !== false;
                        return (
                          <label
                            key={tIdx}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 8,
                              fontSize: 12.5,
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
                              style={{ width: 16, height: 16, marginTop: 2, accentColor: '#16a34a' }}
                            />
                            <span>{taskLabel}</span>
                          </label>
                        );
                      })}

                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <PhotoCaptureControl
                          label="Pre-Clean Photos"
                          photos={quickRoomBeforePhotos[room.id] || []}
                          onChange={next =>
                            setQuickRoomBeforePhotos(prev => ({
                              ...prev,
                              [room.id]: next,
                            }))
                          }
                          uploadEndpoint="/api/cleaning-records/upload"
                          disabled={submittingQuickAll}
                        />
                        <PhotoCaptureControl
                          label="Post-Clean Photos"
                          photos={quickRoomAfterPhotos[room.id] || []}
                          onChange={next =>
                            setQuickRoomAfterPhotos(prev => ({
                              ...prev,
                              [room.id]: next,
                            }))
                          }
                          uploadEndpoint="/api/cleaning-records/upload"
                          disabled={submittingQuickAll}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d' }}>
              {quickTickedCount} Room{quickTickedCount === 1 ? '' : 's'} Ticked as Completed &bull;{' '}
              {NUPURE_ROOMS.length - quickTickedCount} Unticked / Skipped
            </div>
            <button
              type="button"
              disabled={submittingQuickAll || quickTickedCount === 0}
              onClick={() => void handleSubmitQuickCompleteAll()}
              style={{
                background:
                  quickTickedCount === 0 ? '#94a3b8' : 'linear-gradient(135deg, #15803d, #16a34a)',
                color: '#ffffff',
                border: 'none',
                padding: '14px 28px',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 800,
                cursor: submittingQuickAll || quickTickedCount === 0 ? 'not-allowed' : 'pointer',
                boxShadow: '0 3px 10px rgba(22, 163, 74, 0.25)',
              }}
            >
              {submittingQuickAll
                ? `Saving ${quickTickedCount} Completed Room Reports...`
                : `✓ Complete & Sign Off Ticked Rooms (${quickTickedCount} Room${quickTickedCount === 1 ? '' : 's'}) →`}
            </button>
          </div>
        </div>
      )}

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

      {/* Quick Room Selector Dropdown for iPad & Mobile Phones */}
      <div
        className="np-mobile-room-bar"
        style={{
          background: '#ffffff',
          border: '2px solid #0284c7',
          borderRadius: 12,
          padding: '12px 16px',
          boxShadow: '0 2px 6px rgba(2, 132, 199, 0.08)',
        }}
      >
        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', marginBottom: 6 }}>
          📱 Quick Jump — Select Room / Area ({filteredRooms.length} in view)
        </label>
        <select
          value={selectedRoom.id}
          onChange={e => {
            const found = NUPURE_ROOMS.find(r => r.id === e.target.value);
            if (found) void handleSelectRoom(found);
          }}
          style={{
            width: '100%',
            padding: '11px 12px',
            borderRadius: 8,
            border: '1px solid #cbd5e1',
            fontSize: 15,
            fontWeight: 700,
            color: '#0f172a',
            background: '#f8fafc',
          }}
        >
          {filteredRooms.map(r => {
            const done = completedRoomNames.has(r.room);
            const queued = offlineQueuedRoomNames.has(r.room);
            return (
              <option key={r.id} value={r.id}>
                {done ? (queued ? '⚡ [Queued] ' : '✓ [Done] ') : ''}
                {r.code} — {r.room} ({r.frequencyBadge})
              </option>
            );
          })}
        </select>
      </div>

      {/* Main Two-Column Layout: Left = Room Selector, Right = Active Room Digital Report Form */}
      <div className="np-cleaning-grid">
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
              const isOfflineQueued = offlineQueuedRoomNames.has(r.room);
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
                  onClick={() => void handleSelectRoom(r)}
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
                          color: isOfflineQueued ? '#b45309' : '#15803d',
                          background: isOfflineQueued ? '#fef3c7' : '#dcfce7',
                          padding: '2px 8px',
                          borderRadius: 6,
                        }}
                      >
                        {isOfflineQueued ? '⚡ Queued' : '✓ Done'}
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
                  padding: '10px 14px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div>
                  ✓ Completed for {selectedDate}
                  {existingRecordForSelectedRoom ? ` (${existingRecordForSelectedRoom.report_number})` : ''}
                </div>
                {existingRecordForSelectedRoom && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button
                      type="button"
                      disabled={updatingExisting}
                      onClick={() => void handleUpdateExistingRoomReport()}
                      style={{
                        background: '#0284c7',
                        color: '#ffffff',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: updatingExisting ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {updatingExisting
                        ? '⏳ Updating Report...'
                        : `📷 Save Loaded Photos / Tasks to ${existingRecordForSelectedRoom.report_number}`}
                    </button>
                    <Link
                      href={`/reports/cleaning-events/${existingRecordForSelectedRoom.id}`}
                      style={{
                        background: '#ffffff',
                        color: '#0f3460',
                        border: '1px solid #cbd5e1',
                        padding: '5px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 800,
                        textDecoration: 'none',
                      }}
                    >
                      View Report →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Controlling SOP & Colour Segregation Callout */}
          {(() => {
            const sop = getRoomSopInfo(selectedRoom.code);
            return (
              <div
                style={{
                  background: sop.colourBg,
                  border: `1px solid ${sop.colourHex}33`,
                  borderLeft: `4px solid ${sop.colourHex}`,
                  borderRadius: 10,
                  padding: '12px 16px',
                  marginBottom: 18,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ flex: '1 1 320px' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: sop.colourHex, textTransform: 'uppercase' }}>
                    Controlling Work Procedure: {sop.shortCode} ({sop.code}) &bull; {sop.colourZone}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#1e293b', marginTop: 3, lineHeight: 1.45 }}>
                    {sop.summary}
                  </div>
                </div>
                <a
                  href={NUPURE_PROCEDURE_PDF_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: '#ffffff',
                    color: sop.colourHex,
                    border: `1px solid ${sop.colourHex}44`,
                    padding: '7px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 800,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  📄 View {sop.shortCode} in Manual ({sop.pageRef}) ↗
                </a>
              </div>
            );
          })()}

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
                <div style={{ display: 'flex', gap: 8 }}>
                  <a
                    href={`/api/cleaning-records/daily-pdf?date=${encodeURIComponent(selectedDate)}`}
                    style={{
                      background: '#0f3460',
                      color: '#ffffff',
                      padding: '6px 14px',
                      borderRadius: 6,
                      textDecoration: 'none',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    ⬇ Daily Completion PDF
                  </a>
                  <a
                    href={`/api/cleaning-records/${toast.reportId}/pdf`}
                    style={{
                      background: '#0284c7',
                      color: '#ffffff',
                      padding: '6px 14px',
                      borderRadius: 6,
                      textDecoration: 'none',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    ⬇ Room PDF
                  </a>
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
                    View Report →
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Room Task Checklist */}
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
                marginBottom: 10,
              }}
            >
              <div>
                <label style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', color: '#334155', display: 'block' }}>
                  Room Task Checklist ({Object.values(checkedItems).filter(Boolean).length}/{selectedRoom.checklist.length} Completed)
                </label>
                <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>
                  Press &ldquo;Quick Complete All Tasks&rdquo; below, then simply untick any item that wasn&apos;t completed.
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
                    background: '#16a34a',
                    border: '1px solid #15803d',
                    borderRadius: 8,
                    padding: '7px 14px',
                    fontSize: 12.5,
                    fontWeight: 800,
                    color: '#ffffff',
                    cursor: 'pointer',
                  }}
                >
                  ⚡ Quick Complete All Tasks
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next: Record<number, boolean> = {};
                    selectedRoom.checklist.forEach((_, idx) => {
                      next[idx] = false;
                    });
                    setCheckedItems(next);
                  }}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: '7px 12px',
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: '#475569',
                    cursor: 'pointer',
                  }}
                >
                  ☐ Untick All Tasks
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedRoom.checklist.map((taskLabel, idx) => {
                const checked = !!checkedItems[idx];
                return (
                  <label
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: checked ? '1px solid #bbf7d0' : '1px solid #fecaca',
                      background: checked ? '#f0fdf4' : '#fff1f2',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 600,
                      color: '#0f172a',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => setCheckedItems(prev => ({ ...prev, [idx]: e.target.checked }))}
                        style={{ width: 19, height: 19, marginTop: 1, accentColor: '#16a34a', cursor: 'pointer' }}
                      />
                      <span>{taskLabel}</span>
                    </div>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: checked ? '#dcfce7' : '#fee2e2',
                        color: checked ? '#15803d' : '#dc2626',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {checked ? 'COMPLETED ✓' : 'UNTICKED'}
                    </span>
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

            <div
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                border: sanitaryBinChanged ? '1px solid #16a34a' : '1px solid #e2e8f0',
                background: sanitaryBinChanged ? '#f0fdf4' : '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Sanitary Bin Liner Changed</span>
              <button
                type="button"
                onClick={() => setSanitaryBinChanged(!sanitaryBinChanged)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: sanitaryBinChanged ? '#16a34a' : '#cbd5e1',
                  color: sanitaryBinChanged ? '#ffffff' : '#334155',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {sanitaryBinChanged ? 'CHANGED ✓' : 'NO'}
              </button>
            </div>

            <div
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                border: airFreshenerChanged ? '1px solid #0284c7' : '1px solid #e2e8f0',
                background: airFreshenerChanged ? '#f0f9ff' : '#f8fafc',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Air Freshener Refill / Battery Changed</span>
              <button
                type="button"
                onClick={() => setAirFreshenerChanged(!airFreshenerChanged)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: airFreshenerChanged ? '#0284c7' : '#cbd5e1',
                  color: airFreshenerChanged ? '#ffffff' : '#334155',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                {airFreshenerChanged ? 'CHANGED ✓' : 'NO'}
              </button>
            </div>
          </div>

          {/* Photo Uploads (Before & After — Direct Camera OR Saved Photos) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 20 }}>
            <PhotoCaptureControl
              label="Pre-Clean / Before Photos"
              photos={beforePhotos}
              onChange={setBeforePhotos}
              uploadEndpoint="/api/cleaning-records/upload"
              disabled={submitting}
            />
            <PhotoCaptureControl
              label="Post-Clean / Verification Photos"
              photos={afterPhotos}
              onChange={setAfterPhotos}
              uploadEndpoint="/api/cleaning-records/upload"
              disabled={submitting}
            />
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            {existingRecordForSelectedRoom && (
              <button
                type="button"
                disabled={updatingExisting || submitting}
                onClick={() => void handleUpdateExistingRoomReport()}
                style={{
                  flex: '1 1 280px',
                  maxWidth: 460,
                  background: 'linear-gradient(135deg, #15803d, #16a34a)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '15px 22px',
                  borderRadius: 10,
                  fontSize: 14.5,
                  fontWeight: 800,
                  cursor: updatingExisting || submitting ? 'not-allowed' : 'pointer',
                  opacity: updatingExisting ? 0.7 : 1,
                }}
              >
                {updatingExisting
                  ? 'Saving Photos & Updates...'
                  : `📷 Save Photos & Checklist to Existing Report (${existingRecordForSelectedRoom.report_number})`}
              </button>
            )}
            <button
              type="submit"
              disabled={submitting || updatingExisting}
              style={{
                flex: '1 1 280px',
                maxWidth: 460,
                background: 'linear-gradient(135deg, #0f3460, #0284c7)',
                color: '#ffffff',
                border: 'none',
                padding: '15px 28px',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 800,
                cursor: submitting || updatingExisting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting
                ? 'Saving Room Report...'
                : isOnline
                  ? existingRecordForSelectedRoom
                    ? `+ Log Additional Clean for "${selectedRoom.room}" →`
                    : `Complete & Sign Off "${selectedRoom.room}" →`
                  : `⚡ Save "${selectedRoom.room}" Offline (Auto-Sync Later) →`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
