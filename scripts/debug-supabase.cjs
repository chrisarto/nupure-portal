const fs = require('fs');
const lines = fs.readFileSync('/var/www/gotzinger-portal/.env.local','utf8').split('\n');
const env = {};
lines.forEach(l => { const m = l.match(/^([^#=]+)=(.*)$/); if(m) env[m[1].trim()] = m[2].replace(/^['"]|['"]$/g,'').trim(); });

async function run() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const skey = env.SUPABASE_SERVICE_ROLE_KEY;
  
  // Test with anon key
  const r1 = await fetch(url + '/rest/v1/gotzinger_training_records?select=airtable_id', {
    headers: { apikey: key, Authorization: 'Bearer ' + key }
  });
  const d1 = await r1.json();
  console.log('Anon key result:', r1.status, Array.isArray(d1) ? d1.length + ' records' : JSON.stringify(d1).slice(0,200));
  
  // Test with service key
  const r2 = await fetch(url + '/rest/v1/gotzinger_training_records?select=airtable_id', {
    headers: { apikey: skey, Authorization: 'Bearer ' + skey }
  });
  const d2 = await r2.json();
  console.log('Service key result:', r2.status, Array.isArray(d2) ? d2.length + ' records' : JSON.stringify(d2).slice(0,200));
}
run();
