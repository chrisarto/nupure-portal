export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const AIRTABLE_BASE = process.env.AIRTABLE_BASE_TRAINING!;
const AIRTABLE_KEY = process.env.AIRTABLE_API_KEY!;
const TRAINING_TABLE = 'tblKDwLcNcbuaUdUQ';
const EMPLOYEES_TABLE = 'tblgNsUGNVoNLOhb6';

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

function firstStr(v: unknown): string {
  if (Array.isArray(v) && v.length > 0) return String(v[0]);
  if (typeof v === 'string') return v;
  return '';
}

async function fetchAirtable(tableId: string, filter?: string): Promise<AirtableRecord[]> {
  if (!AIRTABLE_BASE || !AIRTABLE_KEY) return [];
  const all: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (filter) params.set('filterByFormula', filter);
    if (offset) params.set('offset', offset);

    const res = await fetch(
      `https://api.airtable.com/v0/${AIRTABLE_BASE}/${tableId}?${params}`,
      {
        headers: { Authorization: `Bearer ${AIRTABLE_KEY}` },
        cache: 'no-store',
      },
    );

    if (!res.ok) break;
    const json = await res.json();
    all.push(...(json.records || []));
    offset = json.offset;
  } while (offset);

  return all;
}

function mapEmployeeFields(id: string, f: Record<string, unknown>) {
  return {
    id,
    firstName: typeof f['First Name'] === 'string' ? f['First Name'] : '',
    lastName: typeof f['Last Nmae'] === 'string' ? f['Last Nmae'] : typeof f['Last Name'] === 'string' ? f['Last Name'] : '',
    fullName: typeof f['Full Name'] === 'string' ? f['Full Name'] : '',
    status: typeof f['Status '] === 'string' ? f['Status '] : typeof f['Status'] === 'string' ? f['Status'] : 'Current',
    siteName: firstStr(f['Site Name (from Sites Assigned)']) || firstStr(f['Sites Assigned']) || 'Nu-Pure Beverages',
    email: typeof f['Email'] === 'string' ? f['Email'] : '',
    phone: typeof f['Phone Number'] === 'string' ? f['Phone Number'] : '',
    suburb: typeof f['Suburb'] === 'string' ? f['Suburb'] : '',
    state: typeof f['State'] === 'string' ? f['State'] : 'QLD',
  };
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const staffMap = new Map<string, ReturnType<typeof mapEmployeeFields>>();
    const trainingMap = new Map<string, Record<string, unknown>>();

    // 1. Load Nu-Pure employees & training records from Supabase
    const [{ data: sbEmp }, { data: sbTr }] = await Promise.all([
      supabase.from('nupure_employees').select('airtable_id, data'),
      supabase.from('nupure_training_records').select('airtable_id, data'),
    ]);

    for (const row of sbEmp ?? []) {
      staffMap.set(row.airtable_id, mapEmployeeFields(row.airtable_id, (row.data as Record<string, unknown>) ?? {}));
    }
    for (const row of sbTr ?? []) {
      trainingMap.set(row.airtable_id, (row.data as Record<string, unknown>) ?? {});
    }

    // 2. Also query Airtable live for Nu Pure employees and training records
    const [atEmployees, atTraining] = await Promise.all([
      fetchAirtable(
        EMPLOYEES_TABLE,
        'OR(FIND("Nu Pure", ARRAYJOIN({Sites Assigned})), FIND("Nu Pure", ARRAYJOIN({Site Name (from Sites Assigned)})), FIND("reckkI3UVCSarhLI2", ARRAYJOIN({Sites Assigned})))'
      ),
      fetchAirtable(
        TRAINING_TABLE,
        'OR(FIND("Nu Pure", ARRAYJOIN({Site Assigned})), FIND("reckkI3UVCSarhLI2", ARRAYJOIN({Site Assigned})))'
      ),
    ]);

    for (const rec of atEmployees) {
      staffMap.set(rec.id, mapEmployeeFields(rec.id, rec.fields));
    }
    for (const rec of atTraining) {
      trainingMap.set(rec.id, rec.fields);
    }

    const mappedTraining = [...trainingMap.entries()].map(([id, f]) => ({
      id,
      name: typeof f['Name'] === 'string' ? f['Name'] : '',
      employeeName: firstStr(f['Full Name (from Notes)']) || firstStr(f['Employee Name']),
      employmentStatus: firstStr(f['Employement Status']) || 'Current',
      longName: firstStr(f['Long Name']),
      documentCode: firstStr(f['Document Code (from Training Procedures 2)']) || firstStr(f['Document Code']),
      documentType: firstStr(f['Document Type (from Training Procedures 2)']) || firstStr(f['Document Type']),
      documentStatus: firstStr(f['Status (from Training Procedures 2)']) || 'Current',
      versionNumber: Array.isArray(f['Version Number (from Training Procedures 2)'])
        ? f['Version Number (from Training Procedures 2)'][0]
        : f['Version Number (from Training Procedures 2)'] ?? 1,
      reTrainingFrequency: firstStr(f['Re-Training Frequency (from Training Procedures 2)']) || 'Annual',
      dateOfTraining: typeof f['Date of Traing Conducted'] === 'string' ? f['Date of Traing Conducted'] : '',
      refresherTrainingDate: typeof f['Refresher Training Date'] === 'string' ? f['Refresher Training Date'] : '',
      trainingStatus: typeof f['status'] === 'string' ? f['status'] : 'Current',
      certificate: Array.isArray(f['Attachments']) ? f['Attachments'] : [],
      siteAssigned: firstStr(f['Site Assigned']) || 'Nu Pure',
    }));

    const data = [...staffMap.values()];
    return NextResponse.json({ data, count: data.length, trainingRecords: mappedTraining });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Staff API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
