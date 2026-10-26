import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const envPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach(line => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) {
      process.env[m[1].trim()] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  });
}

console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data, count, error } = await supabase
    .from('gotzinger_form_submissions')
    .select('id, template_slug, submitted_at, notes, created_at, pdf_url', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching submissions:', error);
    return;
  }

  console.log(`Total submissions in gotzinger_form_submissions: ${data.length} (exact count: ${count})`);

  // Count by date
  const byDate = {};
  data.forEach(row => {
    const d = (row.submitted_at || 'unknown').substring(0, 10);
    byDate[d] = (byDate[d] || 0) + 1;
  });

  console.log('\nSubmissions by submitted_at date:');
  Object.keys(byDate).sort().forEach(d => {
    console.log(`  ${d}: ${byDate[d]}`);
  });

  // Check Oct 19 and 21 specifically
  const oct19 = data.filter(r => (r.submitted_at || '').startsWith('2026-10-18') || (r.submitted_at || '').startsWith('2026-10-19'));
  const oct20_21 = data.filter(r => (r.submitted_at || '').startsWith('2026-10-20') || (r.submitted_at || '').startsWith('2026-10-21'));

  console.log(`\nOct 18/19 count: ${oct19.length}`);
  console.log(`Oct 20/21 count: ${oct20_21.length}`);

  if (oct20_21.length > 0) {
    console.log('\nSample Oct 20/21 submission:');
    console.log(oct20_21[0]);
  }
}

main().catch(console.error);
