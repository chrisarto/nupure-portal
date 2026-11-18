export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NUPURE_ROOMS } from '@/lib/nupure-scope';
import { generateDailyCompletionPdf, type CleaningRecordPdfRow } from '@/lib/nupure-pdf';

export async function GET(request: NextRequest) {
  try {
    const admin = createAdminClient();
    const { searchParams } = request.nextUrl;
    const date = searchParams.get('date');
    const zone = searchParams.get('zone');
    const location = searchParams.get('location');

    let query = admin
      .from('nupure_cleaning_records')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300);

    if (date) query = query.eq('date', date);
    if (zone && zone !== 'all') query = query.eq('zone', zone);
    if (location && location !== 'all') query = query.eq('location', location);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [], count: (data ?? []).length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function computeNextCleanDate(dateStr: string, frequencyBadge: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  if (frequencyBadge === 'WEEKLY') {
    d.setDate(d.getDate() + 7);
  } else if (frequencyBadge === '5 DAYS') {
    const day = d.getDay();
    if (day === 5) d.setDate(d.getDate() + 3); // Friday -> Monday
    else if (day === 6) d.setDate(d.getDate() + 2); // Saturday -> Monday
    else d.setDate(d.getDate() + 1);
  } else {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

async function ensurePhotosUploadedToStorage(
  admin: ReturnType<typeof createAdminClient>,
  rawPhotos: string[],
  dateStr: string,
  prefix: string
): Promise<string[]> {
  const uploadedUrls: string[] = [];
  for (let i = 0; i < rawPhotos.length; i++) {
    const item = rawPhotos[i];
    if (!item || typeof item !== 'string') continue;
    if (item.startsWith('data:image/')) {
      try {
        const parts = item.split(',');
        const mimeMatch = parts[0]?.match(/:(.*?);/);
        const mimeType = mimeMatch?.[1] || 'image/jpeg';
        const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
        const buffer = Buffer.from(parts[1] || '', 'base64');
        const filename = `room-clean/${dateStr}/${prefix}_${crypto.randomUUID()}.${ext}`;
        const { error } = await admin.storage
          .from('cleaning-photos')
          .upload(filename, buffer, {
            contentType: mimeType,
            upsert: false,
          });
        if (!error) {
          const { data: { publicUrl } } = admin.storage
            .from('cleaning-photos')
            .getPublicUrl(filename);
          uploadedUrls.push(publicUrl);
          continue;
        }
      } catch (uploadErr) {
        console.error('Fallback base64 photo upload error:', uploadErr);
      }
    }
    uploadedUrls.push(item);
  }
  return uploadedUrls;
}

interface IncomingRoomReportBody {
  date?: string;
  zone?: string;
  location?: string;
  frequency_badge?: string;
  checklist_items?: Array<{ label: string; completed: boolean }>;
  items_cleaned?: string;
  total_time_minutes?: number;
  shift_type?: string;
  cleaning_type?: string;
  chemicals_used?: string[];
  operators_involved?: string[];
  ssop_verified?: boolean;
  visual_inspection_passed?: boolean;
  corrective_action?: string | null;
  corrective_actions?: string | null;
  before_photos?: string[];
  after_photos?: string[];
  comments?: string | null;
  submitted_by?: string;
  supervisor_signoff?: string;
  signature_data?: string | null;
}

async function insertOneRoomReport(
  admin: ReturnType<typeof createAdminClient>,
  itemBody: IncomingRoomReportBody,
  sessionEmail?: string
) {
  const dateStr: string = itemBody.date || new Date().toISOString().slice(0, 10);
  const zone: string = itemBody.zone || 'Head Office';
  const location: string = itemBody.location || '';
  if (!location) {
    throw new Error('Room / Area is required');
  }

  const roomSpec = NUPURE_ROOMS.find(r => r.room === location);
  const frequencyBadge = itemBody.frequency_badge || roomSpec?.frequencyBadge || '5 DAYS';
  const reportNumber = `CLR-${dateStr.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  const checklistItems: Array<{ label: string; completed: boolean }> = Array.isArray(itemBody.checklist_items)
    ? itemBody.checklist_items
    : roomSpec
      ? roomSpec.checklist.map(label => ({ label, completed: true }))
      : [];
  const itemsCleaned =
    itemBody.items_cleaned ||
    checklistItems.filter(c => c.completed).map(c => c.label).join(' • ') ||
    'Full scheduled room clean completed';

  const rawBeforePhotos: string[] = Array.isArray(itemBody.before_photos) ? itemBody.before_photos : [];
  const rawAfterPhotos: string[] = Array.isArray(itemBody.after_photos) ? itemBody.after_photos : [];
  const operators: string[] = Array.isArray(itemBody.operators_involved) ? itemBody.operators_involved : [];
  const chemicals: string[] = Array.isArray(itemBody.chemicals_used) ? itemBody.chemicals_used : [];
  const submittedBy: string = itemBody.submitted_by || sessionEmail || 'MJ Hygiene Team';
  const supervisorSignoff: string = itemBody.supervisor_signoff || submittedBy;

  const beforePhotos = await ensurePhotosUploadedToStorage(admin, rawBeforePhotos, dateStr, 'pre');
  const afterPhotos = await ensurePhotosUploadedToStorage(admin, rawAfterPhotos, dateStr, 'post');

  const { data: record, error: insertError } = await admin
    .from('nupure_cleaning_records')
    .insert({
      report_number: reportNumber,
      date: dateStr,
      zone,
      location,
      frequency_badge: frequencyBadge,
      checklist_items: checklistItems,
      items_cleaned: itemsCleaned,
      total_time_minutes: Number(itemBody.total_time_minutes) || roomSpec?.estimatedMinutes || 20,
      shift_type: itemBody.shift_type || 'Weekday (Mon–Fri)',
      cleaning_type: itemBody.cleaning_type || 'Scheduled Daily Hygiene Clean',
      chemicals_used: chemicals,
      operators_involved: operators,
      ssop_verified: itemBody.ssop_verified !== false,
      visual_inspection_passed: itemBody.visual_inspection_passed !== false,
      corrective_action: itemBody.corrective_action || itemBody.corrective_actions || null,
      before_photos: beforePhotos,
      after_photos: afterPhotos,
      comments: itemBody.comments || null,
      submitted_by: submittedBy,
      supervisor_signoff: supervisorSignoff,
      signature_data: itemBody.signature_data || null,
      schedule_event_id: roomSpec ? `ev_${roomSpec.id}` : null,
    })
    .select()
    .single();

  if (insertError || !record) {
    throw new Error(insertError?.message || `Failed to insert record for ${location}`);
  }

  const nextCleanDate = computeNextCleanDate(dateStr, frequencyBadge);
  const schedulePayload = {
    'Event ID': reportNumber,
    'Notes':
      itemBody.comments ||
      `${location} cleaned & verified (${checklistItems.filter(i => i.completed).length}/${checklistItems.length} tasks)`,
    'Assignee': operators.length > 0 ? operators.join(', ') : submittedBy,
    'Status': itemBody.visual_inspection_passed === false ? 'Requires Reclean' : 'Completed',
    'Cleaning Task (from Cleaning Task)': [itemsCleaned],
    'Area (from Cleaning Task)': [zone],
    'Area 2 (from Cleaning Task)': [location],
    'Department (from Cleaning Task)': [zone],
    'Asset / Element (from Cleaning Task)': [location],
    'Cleaning Frequency (from Cleaning Task)': [roomSpec?.frequencyLabel || frequencyBadge],
    'Last Cleaning Date': dateStr,
    'Actual Completion Date': dateStr,
    'Next Clean Date': nextCleanDate,
    'Days Until Due': frequencyBadge === 'WEEKLY' ? 7 : 1,
    'Full Name (from Employees)': operators.length > 0 ? operators : [submittedBy],
    'Comments': itemBody.comments || `Digital Cleaning Event Report ${reportNumber} signed off by ${supervisorSignoff}`,
    'Report': [
      {
        id: `rep_${record.id}`,
        url: `/api/cleaning-records/${record.id}/pdf`,
        filename: `${reportNumber}.pdf`,
        size: 0,
        type: 'application/pdf',
      },
      {
        id: `dcr_${dateStr}`,
        url: `/api/cleaning-records/daily-pdf?date=${dateStr}`,
        filename: `Daily-Completion-${dateStr}.pdf`,
        size: 0,
        type: 'application/pdf',
      },
    ],
    'Pre-clean photo 1': beforePhotos.map((u, idx) => ({
      id: `pre_${idx}`,
      url: u,
      filename: `before_${idx + 1}.jpg`,
      size: 0,
      type: 'image/jpeg',
    })),
    'Post Cleaning Photo 1': afterPhotos.map((u, idx) => ({
      id: `post_${idx}`,
      url: u,
      filename: `after_${idx + 1}.jpg`,
      size: 0,
      type: 'image/jpeg',
    })),
  };

  const masterEventId = roomSpec ? `ev_${roomSpec.id}` : `ev_${location.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
  await admin.from('nupure_schedule_events').upsert(
    [
      {
        airtable_id: masterEventId,
        data: schedulePayload,
        synced_at: new Date().toISOString(),
      },
    ],
    { onConflict: 'airtable_id' }
  );

  return { record, dateStr };
}

async function regenerateDailyPdfForDate(
  admin: ReturnType<typeof createAdminClient>,
  dateStr: string
) {
  try {
    const { data: dayRecords } = await admin
      .from('nupure_cleaning_records')
      .select('*')
      .eq('date', dateStr)
      .order('created_at', { ascending: true });

    const pdfBuffer = generateDailyCompletionPdf(dateStr, (dayRecords ?? []) as CleaningRecordPdfRow[]);
    await admin.storage
      .from('documents')
      .upload(`daily-completion/Nu-Pure-Daily-Completion-Report-${dateStr}.pdf`, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });
  } catch (pdfErr) {
    console.error('Non-fatal daily PDF generation error:', pdfErr);
  }
}

export async function POST(request: NextRequest) {
  try {
    let sessionEmail: string | undefined;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      sessionEmail = user?.email ?? undefined;
    } catch {
      // Do not fail tablet submissions if the 1-hour JWT cookie expired mid-shift
    }

    const body = (await request.json()) as IncomingRoomReportBody & {
      batch_reports?: IncomingRoomReportBody[];
    };
    const admin = createAdminClient();

    // Batch mode for "Quick Complete All Rooms"
    if (Array.isArray(body.batch_reports)) {
      if (body.batch_reports.length === 0) {
        return NextResponse.json({ error: 'No rooms selected for batch completion' }, { status: 400 });
      }
      const insertedRecords: unknown[] = [];
      const affectedDates = new Set<string>();

      for (const item of body.batch_reports) {
        const { record, dateStr } = await insertOneRoomReport(admin, item, sessionEmail);
        insertedRecords.push(record);
        affectedDates.add(dateStr);
      }

      for (const dStr of affectedDates) {
        await regenerateDailyPdfForDate(admin, dStr);
      }

      return NextResponse.json(
        {
          data: insertedRecords[0],
          records: insertedRecords,
          count: insertedRecords.length,
        },
        { status: 201 }
      );
    }

    // Single room submission
    if (!body.location) {
      return NextResponse.json({ error: 'Room / Area is required' }, { status: 400 });
    }

    const { record, dateStr } = await insertOneRoomReport(admin, body, sessionEmail);
    await regenerateDailyPdfForDate(admin, dateStr);

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Cleaning records POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
