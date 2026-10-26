export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AirtableAttachment, PreOpReport } from '@/lib/airtable';

type Row = { airtable_id: string; data: Record<string, unknown> };

function mapRow(row: Row): PreOpReport {
  const f = row.data;
  return {
    id: row.airtable_id,
    reportNumber: typeof f['Report Number'] === 'string' ? f['Report Number'] : '',
    date: typeof f['Date'] === 'string' ? f['Date'] : '',
    report: Array.isArray(f['Report']) ? (f['Report'] as AirtableAttachment[]) : [],
    comments: typeof f['Comments'] === 'string' ? f['Comments'] : '',
  };
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from('nupure_pre_op_reports')
      .select('airtable_id, data')
      .order('synced_at', { ascending: false });

    if (error) {
      console.error('Pre-Op Reports API Supabase error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const data = (rows ?? []).map(mapRow);
    return NextResponse.json({ data, count: data.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Pre-Op Reports API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
