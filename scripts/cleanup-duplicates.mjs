import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const envPath = path.join(rootDir, '.env.local');
const content = fs.readFileSync(envPath, 'utf8');
content.split(/\r?\n/).forEach(line => {
  const m = line.match(/^([^#=][^=]*)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].replace(/^["']|["']$/g, '').trim();
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const isExecute = process.argv.includes('--execute');

async function main() {
  console.log(`=== Duplicate Cleanup Tool (${isExecute ? 'EXECUTE MODE' : 'DRY-RUN MODE'}) ===\n`);

  const { data: rows, error } = await supabase
    .from('gotzinger_form_submissions')
    .select('id, template_slug, submitted_at, notes, created_at, pdf_url, overall_score, responses')
    .eq('template_slug', 'client-pre-op')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch submissions:', error);
    return;
  }

  // Target the 3 duplicate auto-ingested subjects
  const targetSubjects = [
    'Auto-ingested from email: "Gotzinger Smallgoods Pre-Op - 21/10/16"',
    'Auto-ingested from email: "Gotzinger Smallgoods Pre-Op - 17+191026"',
    'Auto-ingested from email: "Gotzinger Smallgoods Pre-Op - 10/10/26"'
  ];

  let totalToDelete = 0;
  const idsToDelete = [];

  for (const subj of targetSubjects) {
    const matching = rows.filter(r => r.notes === subj);
    if (matching.length <= 1) {
      console.log(`[OK] Subject "${subj}" has ${matching.length} records. No duplicates.`);
      continue;
    }

    // Pick the best record to keep: the one with the most response keys / photos
    let best = matching[0];
    for (const r of matching) {
      const keysBest = Object.keys(best.responses || {}).length;
      const keysR = Object.keys(r.responses || {}).length;
      if (keysR > keysBest) {
        best = r;
      }
    }

    const duplicates = matching.filter(r => r.id !== best.id);
    console.log(`\nSubject: "${subj}"`);
    console.log(`  Total found: ${matching.length}`);
    console.log(`  KEEPING ID: ${best.id} (created: ${best.created_at}, responses: ${Object.keys(best.responses || {}).length} items, score: ${best.overall_score}%)`);
    console.log(`  Duplicates to remove: ${duplicates.length}`);

    duplicates.forEach(d => idsToDelete.push(d.id));
    totalToDelete += duplicates.length;
  }

  console.log(`\n--------------------------------------------------`);
  console.log(`Total duplicate records identified for removal: ${totalToDelete}`);
  console.log(`Total records in table before cleanup: ${rows.length}`);
  console.log(`Total client pre-op records remaining after cleanup: ${rows.length - totalToDelete}`);
  console.log(`--------------------------------------------------\n`);

  if (!isExecute) {
    console.log(`DRY-RUN completed. No data was modified.`);
    console.log(`Run with --execute to perform deletion after confirmation.`);
    return;
  }

  // Safety confirmation
  console.log(`Executing deletion of ${idsToDelete.length} duplicate records in batches of 50...`);
  const batchSize = 50;
  for (let i = 0; i < idsToDelete.length; i += batchSize) {
    const chunk = idsToDelete.slice(i, i + batchSize);
    const { error: delErr } = await supabase
      .from('gotzinger_form_submissions')
      .delete()
      .in('id', chunk);

    if (delErr) {
      console.error(`Error deleting batch ${i / batchSize + 1}:`, delErr);
      return;
    }
    console.log(`  Deleted ${i + chunk.length} / ${idsToDelete.length}...`);
  }

  console.log(`\n✓ Successfully removed all ${idsToDelete.length} duplicate records!`);
}

main().catch(console.error);
