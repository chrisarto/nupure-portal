export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AirtableAttachment, ScheduleEvent } from '@/lib/airtable';

type Row = { airtable_id: string; data: Record<string, unknown> };

function str(v: unknown): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length > 0) return String(v[0]);
  return '';
}

function strArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function mapRow(row: Row): ScheduleEvent {
  const f = row.data ?? {};
  return {
    id: row.airtable_id,
    eventId: str(f['Event ID']),
    notes: str(f['Notes']),
    assignee: str(f['Assignee']),
    status: str(f['Status']) || 'Completed',
    cleaningTask: str(f['Cleaning Task (from Cleaning Task)']),
    area: str(f['Area (from Cleaning Task)']),
    area2: str(f['Area 2 (from Cleaning Task)']),
    department: str(f['Department (from Cleaning Task)']),
    assetElement: str(f['Asset / Element (from Cleaning Task)']),
    cleaningFrequency: str(f['Cleaning Frequency (from Cleaning Task)']),
    lastCleaningDate: str(f['Last Cleaning Date']),
    actualCompletionDate: str(f['Actual Completion Date']),
    nextCleanDate: str(f['Next Clean Date']),
    daysUntilDue:
      typeof f['Days Until Due'] === 'number' ? f['Days Until Due'] : 1,
    weekNumber:
      typeof f['Week Number'] === 'number' ? f['Week Number'] : null,
    employees: strArr(f['Full Name (from Employees)']),
    comments: str(f['Comments']),
    report: Array.isArray(f['Report'])
      ? (f['Report'] as AirtableAttachment[])
      : [],
    preCleanPhoto1: Array.isArray(f['Pre-clean photo 1'])
      ? (f['Pre-clean photo 1'] as AirtableAttachment[])
      : [],
    postCleanPhoto1: Array.isArray(f['Post Cleaning Photo 1'])
      ? (f['Post Cleaning Photo 1'] as AirtableAttachment[])
      : [],
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from('nupure_schedule_events')
      .select('airtable_id, data')
      .order('synced_at', { ascending: false });

    if (error) {
      console.error('Schedule API Supabase error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let data = (rows ?? []).map(mapRow);
    if (statusFilter) {
      data = data.filter(evt => evt.status === statusFilter);
    }

    return NextResponse.json({ data, count: data.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Schedule API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
