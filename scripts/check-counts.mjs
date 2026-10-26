import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const envContent = fs.readFileSync(path.join(rootDir, '.env.local'), 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data } = await supabase.from('rpf_form_submissions').select('template_slug, template_name');
  const c = {};
  data.forEach(d => {
     if(!c[d.template_slug]) c[d.template_slug] = 0;
     c[d.template_slug]++;
  });
  console.log(c);
  
  // also print some of the ones that are swabs to see their slug
  const swabs = data.filter(d => d.template_name.toLowerCase().includes('swab'));
  console.log("Swab samples:");
  swabs.slice(0, 5).forEach(s => console.log(s));
}

check().catch(console.error);
