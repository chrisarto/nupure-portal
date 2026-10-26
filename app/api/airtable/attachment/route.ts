/**
 * GET /api/airtable/attachment
 *
 * Proxies Airtable attachment downloads by re-fetching a fresh signed URL
 * from the Airtable API on every request. This solves the ~2-hour URL
 * expiry problem with Airtable's pre-signed S3 links.
 *
 * Query params:
 *   type         - 'handover' | 'preop' | 'schedule' | 'document'
 *   record       - Airtable record ID (e.g. recXXXXXXXXXXXX)
 *   attachmentId - Airtable attachment ID (e.g. attXXXXXXXXXXXX)
 *   filename     - Desired download filename (optional)
 */

import { NextRequest, NextResponse } from 'next/server';

interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: string;
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

// Map of type → { baseId, tableId, attachmentField }
const TABLE_MAP: Record<string, { baseEnv: string; tableId: string; field: string }> = {
  handover:  { baseEnv: 'AIRTABLE_BASE_OPS',      tableId: 'tbltc3WlN061EXvbm', field: 'Report' },
  preop:     { baseEnv: 'AIRTABLE_BASE_OPS',       tableId: 'tbl4uB2uBBKgOYzfS', field: 'Report' },
  schedule:  { baseEnv: 'AIRTABLE_BASE_OPS',       tableId: 'tblos7krMNG16W4xc', field: 'Report' },
  document:  { baseEnv: 'AIRTABLE_BASE_TRAINING',  tableId: 'tblwtH46TSh45tpnD', field: 'Document Upload' },
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type         = searchParams.get('type') ?? '';
  const recordId     = searchParams.get('record') ?? '';
  const attachmentId = searchParams.get('attachmentId') ?? '';
  const filename     = searchParams.get('filename') ?? 'download';

  const tableConfig = TABLE_MAP[type];
  if (!tableConfig) {
    return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
  }
  if (!recordId || !attachmentId) {
    return NextResponse.json({ error: 'Missing record or attachmentId' }, { status: 400 });
  }

  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Airtable API key not configured' }, { status: 500 });
  }

  const baseId = process.env[tableConfig.baseEnv];
  if (!baseId) {
    return NextResponse.json({ error: `Missing env var ${tableConfig.baseEnv}` }, { status: 500 });
  }

  // Re-fetch the Airtable record to get a fresh signed URL
  const airtableUrl = `https://api.airtable.com/v0/${baseId}/${tableConfig.tableId}/${recordId}`;
  const airtableRes = await fetch(airtableUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
    // Disable Next.js caching so we always get a fresh URL
    cache: 'no-store',
  });

  if (!airtableRes.ok) {
    const text = await airtableRes.text();
    return NextResponse.json(
      { error: `Airtable error: ${airtableRes.status} ${text.slice(0, 200)}` },
      { status: 502 }
    );
  }

  const record = await airtableRes.json() as AirtableRecord;
  const attachments = record.fields[tableConfig.field] as AirtableAttachment[] | undefined;

  if (!attachments || attachments.length === 0) {
    return NextResponse.json({ error: 'No attachments found on this record' }, { status: 404 });
  }

  // Find the specific attachment by ID
  const attachment = attachments.find((a) => a.id === attachmentId) ?? attachments[0];

  // Stream the file through our server so the client never sees the expiring URL
  const fileRes = await fetch(attachment.url, { cache: 'no-store' });
  if (!fileRes.ok) {
    return NextResponse.json({ error: 'Failed to fetch attachment from Airtable storage' }, { status: 502 });
  }

  const contentType = attachment.type || fileRes.headers.get('content-type') || 'application/octet-stream';
  const safeFilename = encodeURIComponent(filename || attachment.filename);

  return new NextResponse(fileRes.body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${safeFilename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
