export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NUPURE_ROOMS } from '@/lib/nupure-scope';
import { generateDailyCompletionPdf, type CleaningRecordPdfRow } from '@/lib/nupure-pdf';

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('nupure_cleaning_records')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      before_photos?: string[];
      after_photos?: string[];
      checklist_items?: Array<{ label: string; completed: boolean }>;
      comments?: string | null;
      visual_inspection_passed?: boolean;
      corrective_action?: string | null;
    };

    const admin = createAdminClient();
    const { data: existing, error: fetchError } = await admin
      .from('nupure_cleaning_records')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: fetchError?.message || 'Report not found' }, { status: 404 });
    }

    const dateStr: string = (existing.date as string) || new Date().toISOString().slice(0, 10);
    const updatePatch: Record<string, unknown> = {};

    if (Array.isArray(body.before_photos)) {
      updatePatch.before_photos = await ensurePhotosUploadedToStorage(admin, body.before_photos, dateStr, 'pre');
    }
    if (Array.isArray(body.after_photos)) {
      updatePatch.after_photos = await ensurePhotosUploadedToStorage(admin, body.after_photos, dateStr, 'post');
    }
    if (Array.isArray(body.checklist_items)) {
      updatePatch.checklist_items = body.checklist_items;
      const completedLabels = body.checklist_items.filter(c => c.completed).map(c => c.label);
      updatePatch.items_cleaned =
        completedLabels.length > 0 ? completedLabels.join(' • ') : 'Scheduled room clean logged';
    }
    if (body.comments !== undefined) {
      updatePatch.comments = body.comments;
    }
    if (body.visual_inspection_passed !== undefined) {
      updatePatch.visual_inspection_passed = body.visual_inspection_passed;
    }
    if (body.corrective_action !== undefined) {
      updatePatch.corrective_action = body.corrective_action;
    }

    const { data: updated, error: updateError } = await admin
      .from('nupure_cleaning_records')
      .update(updatePatch)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: updateError?.message || 'Failed to update report' }, { status: 500 });
    }

    // Update active schedule event photos/notes if present
    try {
      const location = (updated.location as string) || '';
      const roomSpec = NUPURE_ROOMS.find(r => r.room === location);
      const masterEventId = roomSpec
        ? `ev_${roomSpec.id}`
        : `ev_${location.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
      const { data: schedRow } = await admin
        .from('nupure_schedule_events')
        .select('data')
        .eq('airtable_id', masterEventId)
        .maybeSingle();

      if (schedRow?.data && typeof schedRow.data === 'object') {
        const nextBefore = Array.isArray(updated.before_photos) ? (updated.before_photos as string[]) : [];
        const nextAfter = Array.isArray(updated.after_photos) ? (updated.after_photos as string[]) : [];
        const nextData = {
          ...(schedRow.data as Record<string, unknown>),
          'Pre-clean photo 1': nextBefore.map((u, idx) => ({
            id: `pre_${idx}`,
            url: u,
            filename: `before_${idx + 1}.jpg`,
            size: 0,
            type: 'image/jpeg',
          })),
          'Post Cleaning Photo 1': nextAfter.map((u, idx) => ({
            id: `post_${idx}`,
            url: u,
            filename: `after_${idx + 1}.jpg`,
            size: 0,
            type: 'image/jpeg',
          })),
        };
        await admin
          .from('nupure_schedule_events')
          .update({ data: nextData, synced_at: new Date().toISOString() })
          .eq('airtable_id', masterEventId);
      }
    } catch {
      // Non-fatal schedule event update
    }

    // Regenerate Daily Completion Report PDF for this date
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
      console.error('Non-fatal daily PDF generation error on PATCH:', pdfErr);
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
