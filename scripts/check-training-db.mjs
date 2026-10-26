import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: docs, error: docErr } = await supabase
    .from('gotzinger_training_documents')
    .select('airtable_id, data');

  console.log(`\n=== Gotzinger Training Documents (${docs?.length || 0}) ===`);
  if (docs && docs.length > 0) {
    console.log('Sample keys:', Object.keys(docs[0].data));
    docs.forEach((d, i) => {
      const fields = d.data;
      const code = fields['Document Code'] || fields['Code'] || '';
      const name = fields['Long Name'] || fields['Document Title'] || fields['Name'] || '';
      const status = fields['Status'] || '';
      const docType = fields['Document Type'] || '';
      console.log(`${i + 1}. [${code}] "${name}" | Type: ${docType} | Status: ${status} | id: ${d.airtable_id}`);
    });
  }

  const { data: recs, error: recErr } = await supabase
    .from('gotzinger_training_records')
    .select('airtable_id, data')
    .limit(5);

  console.log(`\n=== Sample Training Records ===`);
  if (recs && recs.length > 0) {
    console.log('Training record fields:', Object.keys(recs[0].data));
    console.log('Sample record 1:', JSON.stringify(recs[0].data, null, 2));
  }

  // Also check employees
  const { data: emps, error: empErr } = await supabase
    .from('gotzinger_employees')
    .select('airtable_id, data');

  console.log(`\n=== Gotzinger Employees (${emps?.length || 0}) ===`);
  if (emps && emps.length > 0) {
    console.log('Employee fields:', Object.keys(emps[0].data));
    emps.forEach((e) => {
      const name = e.data['Full Name'] || e.data['Name'] || `${e.data['First Name']} ${e.data['Last Name']}`;
      const status = e.data['Employment Status'] || e.data['Status'] || '';
      const site = e.data['Site Assigned'] || e.data['Site Name'] || e.data['Site'] || '';
      if (site.toLowerCase().includes('gotzinger') || site.toLowerCase().includes('gold coast') || !site) {
        console.log(`- ${name} (Status: ${status}, Site: ${site}, id: ${e.airtable_id})`);
      }
    });
  }
}

main().catch(console.error);
