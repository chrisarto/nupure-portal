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

async function main() {
  const { data, error } = await supabase
    .from('gotzinger_form_submissions')
    .select('id, template_slug, template_name, submitted_at, notes, pdf_url, created_at, overall_score')
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Total submissions: ${data.length}`);

  // Group by template_slug
  const bySlug = {};
  data.forEach(r => {
    bySlug[r.template_slug] = (bySlug[r.template_slug] || 0) + 1;
  });
  console.log('By template_slug:', bySlug);

  // Group client-pre-op by notes / email subject
  const preOp = data.filter(r => r.template_slug === 'client-pre-op');
  const bySubject = {};
  preOp.forEach(r => {
    const key = r.notes || 'no-notes';
    if (!bySubject[key]) {
      bySubject[key] = {
        count: 0,
        ids: [],
        firstCreatedAt: r.created_at,
        lastCreatedAt: r.created_at,
        submitted_at: r.submitted_at,
        pdf_url: r.pdf_url,
        score: r.overall_score
      };
    }
    bySubject[key].count++;
    bySubject[key].ids.push(r.id);
    bySubject[key].firstCreatedAt = r.created_at; // since descending, this will end up as earliest
  });

  console.log('\n--- Duplicate Submissions (Count > 1) ---');
  let totalDuplicatesToDelete = 0;
  Object.keys(bySubject).forEach(k => {
    const info = bySubject[k];
    if (info.count > 1) {
      console.log(`\nSubject: ${k}`);
      console.log(`  Count: ${info.count}`);
      console.log(`  submitted_at: ${info.submitted_at}`);
      console.log(`  overall_score: ${info.score}`);
      console.log(`  Earliest created: ${info.firstCreatedAt}`);
      console.log(`  Latest created: ${info.lastCreatedAt}`);
      console.log(`  Sample ID to KEEP: ${info.ids[info.ids.length - 1]}`);
      console.log(`  IDs to DELETE: ${info.count - 1}`);
      totalDuplicatesToDelete += (info.count - 1);
    }
  });
  console.log(`\n>>> TOTAL DUPLICATES TO DELETE: ${totalDuplicatesToDelete} <<<`);
}

main().catch(console.error);
