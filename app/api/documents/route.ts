export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { AirtableAttachment, TrainingDocument } from '@/lib/airtable';

type Row = { airtable_id: string; data: Record<string, unknown> };

function strArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string').map(s => s.trim());
  if (typeof v === 'string') {
    try { const parsed = JSON.parse(v); if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string').map(s => s.trim()); } catch { /* not JSON */ }
  }
  return [];
}

function mapRow(row: Row): TrainingDocument {
  const f = row.data;
  return {
    id: row.airtable_id,
    longName: typeof f['Long Name'] === 'string' ? f['Long Name'] : '',
    documentCode: typeof f['Document Code'] === 'string' ? f['Document Code'] : '',
    versionNumber: typeof f['Version Number'] === 'number' ? f['Version Number'] : null,
    status: typeof f['Status'] === 'string' ? f['Status'] : '',
    documentType: typeof f['Document Type'] === 'string' ? f['Document Type'] : '',
    roomArea: strArr(f['Room/Area']),
    reTrainingFrequency: String(f['Re-Training Frequency'] ?? ''),
    reviewedDate: typeof f['Reviewed Date'] === 'string' ? f['Reviewed Date'] : '',
    nextReviewDate: typeof f['Next Review Date'] === 'string' ? f['Next Review Date'] : '',
    daysUntilReview:
      typeof f['days until review'] === 'number' ? f['days until review'] : null,
    documentUpload: Array.isArray(f['Document Link'])
      ? (f['Document Link'] as AirtableAttachment[])
      : Array.isArray(f['Document Upload'])
        ? (f['Document Upload'] as AirtableAttachment[])
        : [],
  };
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from('nupure_training_documents')
      .select('airtable_id, data')
      .order('synced_at', { ascending: false });

    if (error) {
      console.error('Documents API Supabase error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const data = (rows ?? [])
      .filter(row => {
        const sites = strArr(row.data['Site Name (from Grid view)']);
        const assignedIds = strArr(row.data['Site Assigned']);
        return (
          sites.length === 0 ||
          sites.some(s => s.toLowerCase().includes('nu pure') || s.toLowerCase().includes('nupure') || s.toLowerCase().includes('nu-pure')) ||
          assignedIds.includes('reckkI3UVCSarhLI2')
        );
      })
      .map(mapRow);
      
    return NextResponse.json({ data, count: data.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Documents API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
