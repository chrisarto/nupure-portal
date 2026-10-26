export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const AIRTABLE_BASE = process.env.AIRTABLE_BASE_TRAINING!;
const AIRTABLE_KEY = process.env.AIRTABLE_API_KEY!;
const TABLE_ID = 'tblKDwLcNcbuaUdUQ';

function firstStr(v: unknown): string {
  if (Array.isArray(v) && v.length > 0) return String(v[0]);
  if (typeof v === 'string') return v;
  return '';
}

function firstNum(v: unknown): number | null {
  if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'number') return v[0];
  if (typeof v === 'number') return v;
  return null;
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

function mapFields(id: string, f: Record<string, unknown>) {
  return {
    id,
    name: typeof f['Name'] === 'string' ? f['Name'] : '',
    employeeName: firstStr(f['Full Name (from Notes)']) || firstStr(f['Employee Name']),
    employmentStatus: firstStr(f['Employement Status']) || firstStr(f['Employment Status']) || 'Current',
    longName: firstStr(f['Long Name']),
    documentCode: firstStr(f['Document Code (from Training Procedures 2)']) || firstStr(f['Document Code']),
    documentType: firstStr(f['Document Type (from Training Procedures 2)']) || firstStr(f['Document Type']),
    documentStatus: firstStr(f['Status (from Training Procedures 2)']) || 'Current',
    versionNumber: firstNum(f['Version Number (from Training Procedures 2)']) ?? 1,
    reTrainingFrequency: firstStr(f['Re-Training Frequency (from Training Procedures 2)']) || 'Annual',
    dateOfTraining: typeof f['Date of Traing Conducted'] === 'string' ? f['Date of Traing Conducted'] : '',
    refresherTrainingDate: typeof f['Refresher Training Date'] === 'string' ? f['Refresher Training Date'] : '',
    trainingStatus: typeof f['status'] === 'string' ? f['status'] : 'Current',
    certificate: Array.isArray(f['Attachments'])
      ? (f['Attachments'] as Array<{ id: string; url: string; filename: string; size: number; type: string }>)
      : [],
    siteAssigned: firstStr(f['Site Assigned']) || 'Nu Pure',
  };
}

async function resolveNuPureViewId(): Promise<string | null> {
  try {
    const res = await fetch(`https://api.airtable.com/v0/meta/bases/${AIRTABLE_BASE}/tables`, {
      headers: { Authorization: `Bearer ${AIRTABLE_KEY}` },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const tbl = (json.tables || []).find((t: { id: string }) => t.id === TABLE_ID);
    if (!tbl) return null;
    const view = (tbl.views || []).find((v: { name: string }) =>
      v.name.toLowerCase().includes('nu pure') || v.name.toLowerCase().includes('nupure') || v.name.toLowerCase().includes('nu-pure')
    );
    return view ? view.id : null;
  } catch {
    return null;
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const recordsMap = new Map<string, ReturnType<typeof mapFields>>();

    // 1. Read from Nu-Pure Supabase cache first
    const supabase = await createClient();
    const { data: sbRows } = await supabase
      .from('nupure_training_records')
      .select('airtable_id, data')
      .order('synced_at', { ascending: false });

    for (const row of sbRows ?? []) {
      const mapped = mapFields(row.airtable_id, (row.data as Record<string, unknown>) ?? {});
      recordsMap.set(row.airtable_id, mapped);
    }

    // 2. Also query Airtable live for Nu Pure training records (using Nu Pure view if created, or formula filter)
    if (AIRTABLE_BASE && AIRTABLE_KEY) {
      const viewId = await resolveNuPureViewId();
      let offset: string | undefined;
      do {
        const params = new URLSearchParams({ pageSize: '100' });
        if (viewId) {
          params.set('view', viewId);
        } else {
          params.set(
            'filterByFormula',
            'OR(FIND("Nu Pure", ARRAYJOIN({Site Assigned})), FIND("Nu-Pure", ARRAYJOIN({Site Assigned})), FIND("reckkI3UVCSarhLI2", ARRAYJOIN({Site Assigned})))'
          );
        }
        if (offset) params.set('offset', offset);

        const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${TABLE_ID}?${params}`, {
          headers: { Authorization: `Bearer ${AIRTABLE_KEY}` },
          cache: 'no-store',
        });
        if (!res.ok) break;
        const json = await res.json();
        for (const rec of (json.records || []) as AirtableRecord[]) {
          recordsMap.set(rec.id, mapFields(rec.id, rec.fields));
        }
        offset = json.offset;
      } while (offset);
    }

    const data = [...recordsMap.values()];
    return NextResponse.json({ data, count: data.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Training API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
