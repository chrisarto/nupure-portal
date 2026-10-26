const fs = require('fs');
const env = require('dotenv').parse(fs.readFileSync('.env.local'));
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
  const { data } = await sb.from('gotzinger_training_records').select('airtable_id, data');
  console.log('Total training records:', (data||[]).length);
  const names = new Set();
  for (const r of (data||[])) {
    const n = Array.isArray(r.data['Full Name (from Notes)']) ? r.data['Full Name (from Notes)'][0] : '';
    names.add(n);
    console.log(' ', n, '|', r.airtable_id);
  }
  console.log('Unique employee names with training:', [...names]);
}
run();
