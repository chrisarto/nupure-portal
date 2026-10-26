export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface RawDoc { airtable_id: string; data: Record<string, unknown> }
interface RawTraining { airtable_id: string; data: Record<string, unknown> }
interface RawEmployee { airtable_id: string; data: Record<string, unknown> }

function firstStr(v: unknown): string {
  if (Array.isArray(v) && v.length > 0) return String(v[0]);
  if (typeof v === 'string') return v;
  return '';
}

function getCertUrl(data: Record<string, unknown>): string {
  const raw = data['Attachments'];
  if (Array.isArray(raw) && raw.length > 0) {
    const first = raw[0] as Record<string, unknown>;
    return String(first?.url ?? first?.storagePath ?? '');
  }
  return '';
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const role = (user.user_metadata?.role as string) ?? '';
  const allowed = ['admin', 'mj_admin', 'mj-supervisor', 'mj_supervisor'];
  if (!allowed.includes(role)) {
    return NextResponse.json({ error: 'Forbidden — admin or mj-supervisor only' }, { status: 403 });
  }

  const { data: allDocs } = await supabase
    .from('nupure_training_documents')
    .select('airtable_id, data') as { data: RawDoc[] | null };

  const nuPureDocs = (allDocs ?? [])
    .map(row => ({
      id: row.airtable_id,
      code: String(row.data['Document Code'] ?? '').trim(),
      name: String(row.data['Long Name'] ?? '').trim().replace(/\n/g, '').trim(),
    }))
    .filter(d => d.code && d.name)
    .reduce((acc: Array<{ id: string; code: string; name: string }>, doc) => {
      if (!acc.find(d => d.code === doc.code)) acc.push(doc);
      return acc;
    }, [])
    .sort((a, b) => a.code.localeCompare(b.code));

  const docCode = request.nextUrl.searchParams.get('doc');
  if (!docCode) {
    return NextResponse.json({
      procedures: nuPureDocs.map(d => ({ code: d.code, name: d.name })),
    });
  }

  const selectedDoc = nuPureDocs.find(d => d.code === docCode);
  if (!selectedDoc) {
    return NextResponse.json({ error: 'Procedure not found' }, { status: 404 });
  }

  const { data: empRows } = await supabase
    .from('nupure_employees')
    .select('airtable_id, data') as { data: RawEmployee[] | null };

  const staffByName = new Map<string, { id: string; fullName: string; sites: string }>();
  (empRows ?? []).forEach(row => {
    const fullName = String(row.data['Full Name'] ?? '').trim();
    const status = String(row.data['Status '] ?? row.data['Status'] ?? 'Current').trim();
    const sites = String(row.data['Site Name (from Sites Assigned)'] ?? row.data['Sites Assigned'] ?? 'Nu-Pure').trim();

    if (fullName && status.toLowerCase() === 'current') {
      if (!staffByName.has(fullName)) {
        staffByName.set(fullName, { id: row.airtable_id, fullName, sites });
      }
    }
  });
  const uniqueStaff = [...staffByName.values()].sort((a, b) =>
    a.fullName.localeCompare(b.fullName)
  );

  const { data: trainingRows } = await supabase
    .from('nupure_training_records')
    .select('airtable_id, data') as { data: RawTraining[] | null };

  const recordMap = new Map<string, {
    status: string; date: string; certUrl: string; recordId: string;
  }>();

  (trainingRows ?? []).forEach(row => {
    const empName = (firstStr(row.data['Full Name (from Notes)']) || firstStr(row.data['Employee Name'])).trim();
    const recCode = (firstStr(row.data['Document Code (from Training Procedures 2)']) || firstStr(row.data['Document Code'])).trim();
    const recName = String(row.data['Long Name'] ?? '').trim().replace(/\n/g, '').trim();
    const trainingStatus = String(row.data['status'] ?? 'Current').trim();
    const date = String(row.data['Date of Traing Conducted'] ?? '').trim();
    const certUrl = getCertUrl(row.data);

    const codeMatch = recCode.toUpperCase() === docCode.toUpperCase();
    const nameMatch = recName.toLowerCase() === selectedDoc.name.toLowerCase();
    if (!empName || (!codeMatch && !nameMatch)) return;

    const existing = recordMap.get(empName);
    if (!existing || trainingStatus.toLowerCase() === 'current') {
      recordMap.set(empName, { status: trainingStatus, date, certUrl, recordId: row.airtable_id });
    }
  });

  const staffResults = uniqueStaff.map(member => {
    const rec = recordMap.get(member.fullName);
    return {
      name: member.fullName,
      sites: member.sites,
      trainingStatus: rec?.status ?? '',
      dateOfTraining: rec?.date ?? '',
      certUrl: rec?.certUrl ?? '',
      hasRecord: !!rec,
    };
  });

  const trained = staffResults.filter(s => s.trainingStatus.toLowerCase() === 'current').length;

  return NextResponse.json({
    doc: selectedDoc,
    staffResults,
    trainedCount: trained,
    totalCount: staffResults.length,
    coveragePct: staffResults.length ? Math.round((trained / staffResults.length) * 100) : 0,
  });
}
