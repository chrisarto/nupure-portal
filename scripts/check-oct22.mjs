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
  const { data } = await supabase
    .from('gotzinger_form_submissions')
    .select('id, template_slug, notes, submitted_at, created_at, pdf_url')
    .gte('submitted_at', '2026-10-21T14:00:00Z');
  console.log('Submissions >= 2026-10-22:');
  console.log(data);
}

main().catch(console.error);
