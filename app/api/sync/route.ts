export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const STORAGE_BUCKET = 'nupure-attachments';

const SUPABASE_HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
};

const TABLES = [
  {
    label: 'Training Documents (Nu-Pure)',
    baseId: 'appPTtErtzoAx7NAb',
    tableId: 'tblwtH46TSh45tpnD',
    filterByFormula: 'OR(FIND("Nu Pure", ARRAYJOIN({Site Name (from Grid view)})), FIND("Nu-Pure", ARRAYJOIN({Site Name (from Grid view)})), FIND("reckkI3UVCSarhLI2", ARRAYJOIN({Site Assigned})))',
    supabaseTable: 'nupure_training_documents',
    attachmentFields: [
      { field: 'Document Upload', folder: 'documents' },
      { field: 'Document Link', folder: 'training-documents' },
    ],
  },
  {
    label: 'Training Records (Nu-Pure)',
    baseId: 'appPTtErtzoAx7NAb',
    tableId: 'tblKDwLcNcbuaUdUQ',
    filterByFormula: 'OR(FIND("Nu Pure", ARRAYJOIN({Site Assigned})), FIND("Nu-Pure", ARRAYJOIN({Site Assigned})), FIND("reckkI3UVCSarhLI2", ARRAYJOIN({Site Assigned})))',
    supabaseTable: 'nupure_training_records',
    attachmentFields: [{ field: 'Attachments', folder: 'training-certs' }],
  },
  {
    label: 'Employees (Nu-Pure)',
    baseId: 'appPTtErtzoAx7NAb',
    tableId: 'tblgNsUGNVoNLOhb6',
    filterByFormula: 'OR(FIND("Nu Pure", ARRAYJOIN({Sites Assigned})), FIND("Nu Pure", ARRAYJOIN({Site Name (from Sites Assigned)})), FIND("reckkI3UVCSarhLI2", ARRAYJOIN({Sites Assigned})))',
    supabaseTable: 'nupure_employees',
    attachmentFields: [],
  },
];

interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: string;
}

async function resolveNuPureViewId(baseId: string, tableId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const tbl = (json.tables || []).find((t: { id: string }) => t.id === tableId);
    if (!tbl) return null;
    const view = (tbl.views || []).find((v: { name: string }) =>
      v.name.toLowerCase().includes('nu pure') || v.name.toLowerCase().includes('nupure') || v.name.toLowerCase().includes('nu-pure')
    );
    return view ? view.id : null;
  } catch {
    return null;
  }
}

async function fetchAllAirtableRecords(baseId: string, tableId: string, filterByFormula: string) {
  const viewId = await resolveNuPureViewId(baseId, tableId);
  const records: Array<{ id: string; createdTime: string; fields: Record<string, unknown> }> = [];
  let offset: string | null = null;

  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (viewId) {
      params.set('view', viewId);
    } else if (filterByFormula) {
      params.set('filterByFormula', filterByFormula);
    }
    if (offset) params.set('offset', offset);

    const res = await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}?${params}`, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Airtable ${res.status}: ${err}`);
    }

    const json = await res.json() as { records: typeof records; offset?: string };
    records.push(...json.records);
    offset = json.offset ?? null;

    if (offset) await new Promise(r => setTimeout(r, 200));
  } while (offset);

  return records;
}

async function uploadAttachment(
  folder: string,
  recordId: string,
  attachment: AirtableAttachment,
): Promise<string> {
  const safeFilename = attachment.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${folder}/${recordId}/${attachment.id}-${safeFilename}`;

  const checkRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/info/${STORAGE_BUCKET}/${storagePath}`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
  );

  if (checkRes.ok) {
    return storagePath;
  }

  const fileRes = await fetch(attachment.url);
  if (!fileRes.ok) {
    throw new Error(`Failed to download attachment ${attachment.id}: ${fileRes.status}`);
  }
  const fileBuffer = await fileRes.arrayBuffer();

  const uploadRes = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${STORAGE_BUCKET}/${storagePath}`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': attachment.type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: fileBuffer,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    throw new Error(`Storage upload failed for ${storagePath}: ${err}`);
  }

  return storagePath;
}

async function processAttachments(
  records: Array<{ id: string; createdTime: string; fields: Record<string, unknown> }>,
  attachmentFields: Array<{ field: string; folder: string }>,
): Promise<Array<{ id: string; createdTime: string; fields: Record<string, unknown> }>> {
  if (attachmentFields.length === 0) return records;

  return Promise.all(records.map(async (record) => {
    const fields = { ...record.fields };

    for (const { field, folder } of attachmentFields) {
      const attachments = fields[field];
      if (!Array.isArray(attachments) || attachments.length === 0) continue;

      const updatedAttachments = await Promise.all(
        (attachments as AirtableAttachment[]).map(async (att) => {
          try {
            const storagePath = await uploadAttachment(folder, record.id, att);
            return { ...att, url: `supabase-storage://${storagePath}`, storagePath };
          } catch (err) {
            console.error(`Attachment upload failed for ${att.id}:`, err);
            return att;
          }
        })
      );

      fields[field] = updatedAttachments;
    }

    return { ...record, fields };
  }));
}

async function syncTable(records: Array<{ id: string; createdTime: string; fields: Record<string, unknown> }>, table: string) {
  if (records.length === 0) return 0;
  const now = new Date().toISOString();
  const rows = records.map(r => ({ airtable_id: r.id, data: r.fields, synced_at: now }));

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...SUPABASE_HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(batch),
    });
    if (!res.ok) throw new Error(`Supabase upsert on ${table}: ${await res.text()}`);
  }

  return rows.length;
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const startTime = Date.now();
  const results: Array<{ label: string; count: number; attachments?: number; error?: string }> = [];
  let totalRecords = 0;

  for (const t of TABLES) {
    try {
      let records = await fetchAllAirtableRecords(t.baseId, t.tableId, t.filterByFormula);

      let attachmentCount = 0;
      if (t.attachmentFields.length > 0) {
        records = await processAttachments(records, t.attachmentFields);
        for (const { field } of t.attachmentFields) {
          attachmentCount += records.reduce((sum, r) => {
            const atts = r.fields[field];
            return sum + (Array.isArray(atts) ? atts.length : 0);
          }, 0);
        }
      }

      const count = await syncTable(records, t.supabaseTable);
      results.push({ label: t.label, count, ...(attachmentCount > 0 ? { attachments: attachmentCount } : {}) });
      totalRecords += count;
    } catch (err) {
      results.push({ label: t.label, count: 0, error: String(err) });
    }
  }

  return NextResponse.json({
    success: true,
    totalRecords,
    elapsed: ((Date.now() - startTime) / 1000).toFixed(1),
    syncedAt: new Date().toISOString(),
    tables: results,
  });
}
