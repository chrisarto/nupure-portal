#!/usr/bin/env node
/**
 * RPF Airtable → Supabase Sync Script
 * Runs every 30 minutes via PM2 cron.
 * Uses plain fetch for both Airtable and Supabase REST API (no SDK dependencies).
 *
 * Attachment fields are downloaded from Airtable and uploaded to Supabase Storage
 * so that the portal never serves expiring Airtable URLs.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Load .env.local
const envPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const val = match[2].replace(/^["']|["']$/g, '').trim();
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

import WebSocket from 'ws';
if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket;

import { createClient } from '@supabase/supabase-js';

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!AIRTABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('   AIRTABLE_API_KEY:', !!AIRTABLE_API_KEY);
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!SUPABASE_URL);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!SUPABASE_SERVICE_KEY);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const BUCKET = 'rpf-attachments';

const SUPABASE_HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SUPABASE_SERVICE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
  'Prefer': 'resolution=merge-duplicates',
};

/** Fetch all records from an Airtable table, handling pagination */
async function fetchAllAirtableRecords(baseId, tableId, viewId) {
  const records = [];
  let offset = null;

  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (viewId) params.set('view', viewId);
    if (offset) params.set('offset', offset);

    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${tableId}?${params}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Airtable error ${res.status}: ${err}`);
    }

    const json = await res.json();
    records.push(...(json.records || []));
    offset = json.offset || null;

    if (offset) await new Promise(r => setTimeout(r, 200));
  } while (offset);

  return records;
}

// ---------- Attachment mirroring ----------

/** List files already in a storage folder (to avoid re-uploading) */
async function listExistingFiles(folder) {
  const { data } = await supabase.storage.from(BUCKET).list(folder, { limit: 1000 });
  return new Set((data || []).map(f => f.name));
}

/** Download a file from a URL into a Buffer */
async function downloadFile(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url.slice(0, 80)}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Upload a buffer to Supabase Storage */
async function uploadToStorage(storagePath, buffer, contentType) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: false, // skip if already exists
    });

  // Ignore duplicate errors (already uploaded previously)
  if (error && !error.message?.includes('already exists') && !error.message?.includes('Duplicate')) {
    throw error;
  }
}

/**
 * Process a single attachment: download from Airtable, upload to Supabase Storage,
 * and mutate the attachment object in-place with a storagePath + supabase-storage URL.
 */
async function mirrorAttachment(att, folder, existingFiles) {
  const safeName = `${att.id}-${att.filename}`.replace(/[^a-zA-Z0-9._-]/g, '_');
  
  // Skip if already uploaded
  if (existingFiles.has(safeName)) {
    // Still rewrite the URL so the data blob is correct
    att.storagePath = `${folder}/${safeName}`;
    att.url = `supabase-storage://${att.storagePath}`;
    return false; // not newly uploaded
  }

  try {
    const buffer = await downloadFile(att.url);
    const storagePath = `${folder}/${safeName}`;
    await uploadToStorage(storagePath, buffer, att.type || 'application/octet-stream');
    att.storagePath = storagePath;
    att.url = `supabase-storage://${storagePath}`;
    return true; // newly uploaded
  } catch (err) {
    console.error(`      ⚠ Failed to mirror ${att.filename}: ${err.message}`);
    // Leave the original Airtable URL in place as fallback
    return false;
  }
}

/**
 * Process all attachment fields on all records for a given table.
 * Mutates records in place so the data blob saved to Supabase contains storagePaths.
 */
async function mirrorAttachments(records, tableLabel, attachmentFields) {
  if (!attachmentFields || attachmentFields.length === 0) return 0;

  let uploaded = 0;
  let skipped = 0;
  const concurrency = 5;

  for (const fieldName of attachmentFields) {
    // Collect all (record, attachment) pairs for this field
    const tasks = [];
    for (const rec of records) {
      const attachments = rec.fields[fieldName];
      if (!Array.isArray(attachments) || attachments.length === 0) continue;
      const folder = `${tableLabel.toLowerCase().replace(/\s+/g, '-')}/${rec.id}`;
      tasks.push({ rec, attachments, folder });
    }

    // Get existing files for each unique folder
    const folderCache = new Map();
    for (const { folder } of tasks) {
      if (!folderCache.has(folder)) {
        folderCache.set(folder, await listExistingFiles(folder));
      }
    }

    // Process attachments with concurrency control
    const allJobs = [];
    for (const { attachments, folder } of tasks) {
      const existing = folderCache.get(folder);
      for (const att of attachments) {
        if (!att.url || !att.id) continue;
        // Skip if already migrated
        if (att.url.startsWith('supabase-storage://')) {
          skipped++;
          continue;
        }
        allJobs.push({ att, folder, existing });
      }
    }

    // Run in batches of `concurrency`
    for (let i = 0; i < allJobs.length; i += concurrency) {
      const batch = allJobs.slice(i, i + concurrency);
      const results = await Promise.all(
        batch.map(({ att, folder, existing }) => mirrorAttachment(att, folder, existing))
      );
      uploaded += results.filter(Boolean).length;
      skipped += results.filter(r => !r).length;
    }
  }

  if (uploaded > 0 || skipped > 0) {
    console.log(`      📎 Attachments: ${uploaded} uploaded, ${skipped} skipped`);
  }
  return uploaded;
}

// ---------- Table sync ----------

/** Upsert records into Supabase via REST API */
async function syncTable(airtableRecords, supabaseTable) {
  const now = new Date().toISOString();
  const rows = airtableRecords.map(rec => ({
    airtable_id: rec.id,
    data: rec.fields,
    synced_at: now,
  }));

  // Upsert in batches of 500
  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${supabaseTable}`, {
      method: 'POST',
      headers: { ...SUPABASE_HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(batch),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Supabase upsert error on ${supabaseTable}: ${err}`);
    }
  }

  // Delete stale records: fetch current IDs from Supabase, delete ones not in Airtable
  const liveIds = new Set(airtableRecords.map(r => r.id));
  const existingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/${supabaseTable}?select=airtable_id`,
    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
  );
  if (existingRes.ok) {
    const existing = await existingRes.json();
    const stale = existing.filter(r => !liveIds.has(r.airtable_id)).map(r => r.airtable_id);
    if (stale.length > 0) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/${supabaseTable}?airtable_id=in.(${stale.map(id => `"${id}"`).join(',')})`,
        { method: 'DELETE', headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
      );
    }
  }

  return rows.length;
}

const TABLES = [
  {
    label: 'Sanitation Tasks',
    baseId: 'appriigSj4aBNjYI6',
    tableId: 'tblzqrBX6JqqHpG5E',
    viewId: 'viwBK93fBrt9iiNiy',
    supabaseTable: 'gotzinger_sanitation_tasks',
    attachmentFields: [],
  },
  {
    label: 'Schedule Events',
    baseId: 'appriigSj4aBNjYI6',
    tableId: 'tblos7krMNG16W4xc',
    viewId: 'viw6x8rAskQFcuwmP',
    supabaseTable: 'gotzinger_schedule_events',
    attachmentFields: ['Report', 'Pre-clean photo 1', 'Post Cleaning Photo 1'],
  },
  {
    label: 'Training Documents',
    baseId: 'appPTtErtzoAx7NAb',
    tableId: 'tblwtH46TSh45tpnD',
    viewId: 'viwyxQLL6vVbydraK',
    supabaseTable: 'gotzinger_training_documents',
    attachmentFields: ['Document Upload', 'Document Link'],
  },
  {
    label: 'Training Records',
    baseId: 'appPTtErtzoAx7NAb',
    tableId: 'tblKDwLcNcbuaUdUQ',
    viewId: 'viwfSdgg8kPV6uHpq',
    supabaseTable: 'gotzinger_training_records',
    attachmentFields: ['Attachments'],
  },
  {
    label: 'Employees',
    baseId: 'appPTtErtzoAx7NAb',
    tableId: 'tblgNsUGNVoNLOhb6',
    viewId: null,
    supabaseTable: 'gotzinger_employees',
    attachmentFields: [],
  },
];

async function main() {
  console.log(`\n🔄 Gotzinger Airtable Sync started at ${new Date().toISOString()}`);
  const startTime = Date.now();
  let totalRecords = 0;
  let totalUploads = 0;
  let errors = 0;

  for (const table of TABLES) {
    try {
      process.stdout.write(`   Syncing ${table.label}... `);
      const records = await fetchAllAirtableRecords(table.baseId, table.tableId, table.viewId);

      // Mirror attachments BEFORE saving to Supabase so the data blob has storagePaths
      if (table.attachmentFields.length > 0) {
        console.log(`(${records.length} records, mirroring attachments...)`);
        const uploads = await mirrorAttachments(records, table.label, table.attachmentFields);
        totalUploads += uploads;
      }

      const count = await syncTable(records, table.supabaseTable);
      totalRecords += count;
      console.log(`   ✅ ${table.label}: ${count} records`);
    } catch (err) {
      console.log(`   ❌ ${table.label} FAILED`);
      console.error(`   Error: ${err.message}`);
      errors++;
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✨ Sync complete in ${elapsed}s — ${totalRecords} records, ${totalUploads} new attachments, ${errors} errors`);
  if (errors > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal sync error:', err);
  process.exit(1);
});
