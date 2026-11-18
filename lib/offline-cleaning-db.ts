/* ═══════════════════════════════════════════════════════════════
   Nu-Pure Compliance Portal — IndexedDB Offline-First Engine
   Supports:
   1. Auto-saving room checklist drafts in IndexedDB (room_drafts)
   2. Offline submission queue for daily room checklists & photos (pending_cleaning_reports)
   3. Caching completed daily records for offline viewing (cached_daily_records)
   4. Automatic background sync when internet connectivity returns
   ═══════════════════════════════════════════════════════════════ */

export interface RoomChecklistItemPayload {
  label: string;
  completed: boolean;
}

export interface CleaningReportPayload {
  date: string;
  zone: string;
  location: string;
  frequency_badge: string;
  checklist_items: RoomChecklistItemPayload[];
  total_time_minutes: number;
  shift_type: string;
  cleaning_type: string;
  chemicals_used: string[];
  operators_involved: string[];
  supervisor_signoff: string;
  visual_inspection_passed: boolean;
  ssop_verified: boolean;
  sanitary_bin_changed: boolean;
  air_freshener_changed: boolean;
  comments: string;
  corrective_actions: string;
  before_photos: string[];
  after_photos: string[];
  submitted_by: string;
  schedule_event_id: string;
}

export interface QueuedCleaningReport {
  clientId: string;
  createdAt: string;
  roomCode: string;
  payload: CleaningReportPayload;
}

export interface RoomDraftRecord {
  draftKey: string; // `${date}::${roomCode}`
  date: string;
  roomCode: string;
  checkedItems: Record<number, boolean>;
  shiftType: string;
  timeMinutes: number;
  operatorName: string;
  supervisorName: string;
  selectedChemicals: string[];
  visualPassed: boolean;
  ssopVerified: boolean;
  sanitaryBinChanged: boolean;
  airFreshenerChanged: boolean;
  comments: string;
  correctiveAction: string;
  beforePhotos: string[];
  afterPhotos: string[];
  updatedAt: string;
}

export interface CachedDailyRecordItem {
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
  isOfflineQueued?: boolean;
}

interface CachedDailyRecordStoreEntry {
  date: string;
  records: CachedDailyRecordItem[];
  updatedAt: string;
}

const DB_NAME = 'nupure_offline_db';
const DB_VERSION = 1;

const STORE_DRAFTS = 'room_drafts';
const STORE_PENDING = 'pending_cleaning_reports';
const STORE_CACHED_DAILY = 'cached_daily_records';

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        db.createObjectStore(STORE_DRAFTS, { keyPath: 'draftKey' });
      }
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        db.createObjectStore(STORE_PENDING, { keyPath: 'clientId' });
      }
      if (!db.objectStoreNames.contains(STORE_CACHED_DAILY)) {
        db.createObjectStore(STORE_CACHED_DAILY, { keyPath: 'date' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

/* ── Room Draft Persistence ──────────────────────────────────── */

export async function saveRoomDraft(draft: RoomDraftRecord): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_DRAFTS, 'readwrite');
      tx.objectStore(STORE_DRAFTS).put(draft);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore IndexedDB quota/private mode errors gracefully
  }
}

export async function getRoomDraft(date: string, roomCode: string): Promise<RoomDraftRecord | null> {
  try {
    const db = await openOfflineDb();
    const key = `${date}::${roomCode}`;
    const result = await new Promise<RoomDraftRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_DRAFTS, 'readonly');
      const req = tx.objectStore(STORE_DRAFTS).get(key);
      req.onsuccess = () => resolve((req.result as RoomDraftRecord | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

export async function deleteRoomDraft(date: string, roomCode: string): Promise<void> {
  try {
    const db = await openOfflineDb();
    const key = `${date}::${roomCode}`;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_DRAFTS, 'readwrite');
      tx.objectStore(STORE_DRAFTS).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore
  }
}

/* ── Offline Queue for Completed Room Checklists ─────────────── */

export async function enqueueOfflineCleaningReport(
  roomCode: string,
  payload: CleaningReportPayload
): Promise<QueuedCleaningReport> {
  const item: QueuedCleaningReport = {
    clientId: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    roomCode,
    payload,
  };
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readwrite');
    tx.objectStore(STORE_PENDING).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return item;
}

export async function getPendingCleaningReports(): Promise<QueuedCleaningReport[]> {
  try {
    const db = await openOfflineDb();
    const items = await new Promise<QueuedCleaningReport[]>((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING, 'readonly');
      const req = tx.objectStore(STORE_PENDING).getAll();
      req.onsuccess = () => resolve((req.result as QueuedCleaningReport[] | undefined) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } catch {
    return [];
  }
}

export async function removePendingCleaningReport(clientId: string): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING, 'readwrite');
      tx.objectStore(STORE_PENDING).delete(clientId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore
  }
}

export async function clearAllPendingCleaningReports(): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING, 'readwrite');
      tx.objectStore(STORE_PENDING).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore
  }
}

/* ── Cached Daily Server Records for Offline Viewing ─────────── */

export async function saveCachedDailyRecords(
  date: string,
  records: CachedDailyRecordItem[]
): Promise<void> {
  try {
    const db = await openOfflineDb();
    const entry: CachedDailyRecordStoreEntry = {
      date,
      records,
      updatedAt: new Date().toISOString(),
    };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CACHED_DAILY, 'readwrite');
      tx.objectStore(STORE_CACHED_DAILY).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore
  }
}

export async function getCachedDailyRecords(date: string): Promise<CachedDailyRecordItem[]> {
  try {
    const db = await openOfflineDb();
    const entry = await new Promise<CachedDailyRecordStoreEntry | null>((resolve, reject) => {
      const tx = db.transaction(STORE_CACHED_DAILY, 'readonly');
      const req = tx.objectStore(STORE_CACHED_DAILY).get(date);
      req.onsuccess = () => resolve((req.result as CachedDailyRecordStoreEntry | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return entry?.records ?? [];
  } catch {
    return [];
  }
}

/* ── Camera & Gallery Photo Compression + Offline-Ready Upload ── */

export async function compressImageToDataUrl(
  file: File,
  maxDimension = 1280,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : '';
    const img = new Image();

    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      // Fallback to FileReader if object URL fails
      const reader = new FileReader();
      reader.onload = () => {
        const res = typeof reader.result === 'string' ? reader.result : '';
        if (res) resolve(res);
        else reject(new Error('Failed to decode photo'));
      };
      reader.onerror = () => reject(new Error('Failed to read photo file'));
      reader.readAsDataURL(file);
    };

    if (objectUrl) {
      img.src = objectUrl;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        img.src = typeof reader.result === 'string' ? reader.result : '';
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    }
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binary = atob(parts[1] ?? '');
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

export async function uploadOrStagePhoto(
  file: File,
  uploadEndpoint = '/api/cleaning-records/upload'
): Promise<{ url: string; storedOffline: boolean }> {
  const compressedDataUrl = await compressImageToDataUrl(file);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { url: compressedDataUrl, storedOffline: true };
  }

  try {
    const blob = dataUrlToBlob(compressedDataUrl);
    const safeName = (file.name || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
    const fd = new FormData();
    fd.append('file', blob, safeName.endsWith('.jpg') ? safeName : `${safeName}.jpg`);
    const res = await fetch(uploadEndpoint, { method: 'POST', body: fd });
    if (res.ok) {
      const json = (await res.json()) as { url?: string };
      if (json.url) {
        return { url: json.url, storedOffline: false };
      }
    }
    return { url: compressedDataUrl, storedOffline: true };
  } catch {
    return { url: compressedDataUrl, storedOffline: true };
  }
}

export async function resolvePhotoUrlsBeforeSync(
  photos: string[],
  uploadEndpoint = '/api/cleaning-records/upload'
): Promise<string[]> {
  const resolved: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    if (!p) continue;
    if (p.startsWith('data:image/')) {
      try {
        const blob = dataUrlToBlob(p);
        const fd = new FormData();
        fd.append('file', blob, `offline_sync_${Date.now()}_${i}.jpg`);
        const res = await fetch(uploadEndpoint, { method: 'POST', body: fd });
        if (res.ok) {
          const json = (await res.json()) as { url?: string };
          if (json.url) {
            resolved.push(json.url);
            continue;
          }
        }
      } catch {
        // Keep data URL fallback; server POST /api/cleaning-records also converts data:image/ to storage URL
      }
    }
    resolved.push(p);
  }
  return resolved;
}

/* ── Sync All Queued Offline Reports to Server ───────────────── */

export async function syncPendingCleaningReports(): Promise<{
  synced: number;
  remaining: number;
  errors: string[];
}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const pending = await getPendingCleaningReports();
    return { synced: 0, remaining: pending.length, errors: ['Device is currently offline'] };
  }

  const queue = await getPendingCleaningReports();
  if (queue.length === 0) {
    return { synced: 0, remaining: 0, errors: [] };
  }

  let synced = 0;
  const errors: string[] = [];

  for (const item of queue) {
    try {
      const beforeUrls = await resolvePhotoUrlsBeforeSync(item.payload.before_photos || []);
      const afterUrls = await resolvePhotoUrlsBeforeSync(item.payload.after_photos || []);

      const finalPayload = {
        ...item.payload,
        corrective_action: item.payload.corrective_actions || '',
        before_photos: beforeUrls,
        after_photos: afterUrls,
      };

      const res = await fetch('/api/cleaning-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload),
      });

      if (res.ok) {
        await removePendingCleaningReport(item.clientId);
        await deleteRoomDraft(item.payload.date, item.roomCode);
        synced++;
      } else {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        errors.push(`${item.payload.location}: ${errJson.error || `HTTP ${res.status}`}`);
      }
    } catch (err) {
      errors.push(`${item.payload.location}: ${err instanceof Error ? err.message : 'Network error'}`);
      // Stop on network error; remaining items stay in IndexedDB for next reconnect
      break;
    }
  }

  const remainingQueue = await getPendingCleaningReports();
  return { synced, remaining: remainingQueue.length, errors };
}
