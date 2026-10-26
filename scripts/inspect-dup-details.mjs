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

async function inspectDuplicates() {
  const { data: rows } = await supabase
    .from('gotzinger_form_submissions')
    .select('id, template_slug, submitted_at, notes, created_at, pdf_url, overall_score, responses')
    .order('created_at', { ascending: true });

  const duplicateGroups = {};

  rows.forEach(r => {
    if (!r.notes) return;
    if (!duplicateGroups[r.notes]) {
      duplicateGroups[r.notes] = [];
    }
    duplicateGroups[r.notes].push(r);
  });

  for (const [notes, list] of Object.entries(duplicateGroups)) {
    if (list.length > 1) {
      console.log(`\n========================================`);
      console.log(`Subject / Notes: ${notes}`);
      console.log(`Total occurrences: ${list.length}`);
      
      const first = list[0];
      const last = list[list.length - 1];

      console.log(`First created_at: ${first.created_at} (ID: ${first.id})`);
      console.log(`  submitted_at: ${first.submitted_at}`);
      console.log(`  overall_score: ${first.overall_score}`);
      console.log(`  pdf_url: ${first.pdf_url}`);
      console.log(`  response keys count: ${Object.keys(first.responses || {}).length}`);
      if (first.responses?._pdf_urls) {
        console.log(`  _pdf_urls:`, first.responses._pdf_urls.map(p => p.filename));
      }

      console.log(`Last created_at: ${last.created_at} (ID: ${last.id})`);
      console.log(`  submitted_at: ${last.submitted_at}`);
      console.log(`  overall_score: ${last.overall_score}`);
      console.log(`  pdf_url: ${last.pdf_url}`);
      console.log(`  response keys count: ${Object.keys(last.responses || {}).length}`);
      if (last.responses?._pdf_urls) {
        console.log(`  _pdf_urls:`, last.responses._pdf_urls.map(p => p.filename));
      }
    }
  }
}

inspectDuplicates().catch(console.error);
