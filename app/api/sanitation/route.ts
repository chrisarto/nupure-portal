export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AirtableAttachment, SanitationTask } from '@/lib/airtable';

type Row = { airtable_id: string; data: Record<string, unknown> };

function str(v: unknown): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length > 0) return String(v[0]);
  return '';
}

function mapRow(row: Row): SanitationTask {
  const f = row.data ?? {};
  return {
    id: row.airtable_id,
    cleaningTask: str(f['Cleaning Task']),
    area: str(f['Area']),
    area2: str(f['Area 2']),
    department: str(f['Department']),
    assetElement: str(f['Asset / Element'] ?? f['SCOPE OF WORK']),
    cleaningFrequency: str(f['Cleaning Frequency'] ?? f['Frequency']),
    frequencyInDays:
      typeof f['Frequency in days'] === 'number' ? f['Frequency in days'] : 1,
    permitRequirement: str(f['Permit Requirement']),
    docGotzinger: str(f['DOC_Gotzinger'] ?? f['Doc-Nu-Pure']),
    areaGroup: str(f['Area Group'] ?? f['Area (1 of 3)']),
    procedureDocument: Array.isArray(f['Procedure Document'])
      ? (f['Procedure Document'] as AirtableAttachment[])
      : [],
    procedureSignOffUrl: str(f['Procedure Sign Off'] ?? f['Procedure Sign off URL']),
  };
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from('nupure_sanitation_tasks')
      .select('airtable_id, data')
      .order('airtable_id', { ascending: true });

    if (error) {
      console.error('Sanitation API Supabase error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tasks = (rows ?? []).map(mapRow);
    return NextResponse.json({ data: tasks, count: tasks.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Sanitation API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
