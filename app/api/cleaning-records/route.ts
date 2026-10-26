export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NUPURE_ROOMS } from '@/lib/nupure-scope';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = request.nextUrl;
    const date = searchParams.get('date');
    const zone = searchParams.get('zone');
    const location = searchParams.get('location');

    let query = supabase
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();
    const dateStr: string = body.date || new Date().toISOString().slice(0, 10);
    const zone: string = body.zone || 'Head Office';
    const location: string = body.location || '';
    if (!location) {
      return NextResponse.json({ error: 'Room / Area is required' }, { status: 400 });
    }

    const roomSpec = NUPURE_ROOMS.find(r => r.room === location);
    const frequencyBadge = body.frequency_badge || roomSpec?.frequencyBadge || '5 DAYS';
    const reportNumber = `CLR-${dateStr.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const checklistItems: Array<{ label: string; completed: boolean }> = Array.isArray(body.checklist_items)
      ? body.checklist_items
      : [];
    const itemsCleaned =
      body.items_cleaned ||
      checklistItems.filter(c => c.completed).map(c => c.label).join(' • ') ||
      'Full scheduled room clean completed';

    const beforePhotos: string[] = Array.isArray(body.before_photos) ? body.before_photos : [];
    const afterPhotos: string[] = Array.isArray(body.after_photos) ? body.after_photos : [];
    const operators: string[] = Array.isArray(body.operators_involved) ? body.operators_involved : [];
    const chemicals: string[] = Array.isArray(body.chemicals_used) ? body.chemicals_used : [];
    const submittedBy: string = body.submitted_by || user.email || 'MJ Hygiene Team';
    const supervisorSignoff: string = body.supervisor_signoff || submittedBy;

    const admin = createAdminClient();

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
        total_time_minutes: Number(body.total_time_minutes) || roomSpec?.estimatedMinutes || 20,
        shift_type: body.shift_type || 'Weekday (Mon–Fri)',
        cleaning_type: body.cleaning_type || 'Scheduled Daily Hygiene Clean',
        chemicals_used: chemicals,
        operators_involved: operators,
        ssop_verified: body.ssop_verified !== false,
        visual_inspection_passed: body.visual_inspection_passed !== false,
        corrective_action: body.corrective_action || null,
        before_photos: beforePhotos,
        after_photos: afterPhotos,
        comments: body.comments || null,
        submitted_by: submittedBy,
        supervisor_signoff: supervisorSignoff,
        signature_data: body.signature_data || null,
        schedule_event_id: roomSpec ? `ev_${roomSpec.id}` : null,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Automatically record & update the cleaning event in nupure_schedule_events
    const nextCleanDate = computeNextCleanDate(dateStr, frequencyBadge);
    const schedulePayload = {
      'Event ID': reportNumber,
      'Notes': body.comments || `${location} cleaned & verified (${checklistItems.filter(i => i.completed).length}/${checklistItems.length} tasks)`,
      'Assignee': operators.length > 0 ? operators.join(', ') : submittedBy,
      'Status': body.visual_inspection_passed === false ? 'Requires Reclean' : 'Completed',
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
      'Comments': body.comments || `Digital Cleaning Event Report ${reportNumber} signed off by ${supervisorSignoff}`,
      'Report': [
        {
          id: `rep_${record.id}`,
          url: `/reports/cleaning-events/${record.id}`,
          filename: `${reportNumber}.pdf`,
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

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Cleaning records POST error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
