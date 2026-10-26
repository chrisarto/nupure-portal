import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('Copying RPF form templates to Gotzinger...');
  
  // Fetch from RPF
  const { data: templates, error: fetchError } = await supabase
    .from('rpf_form_templates')
    .select('*')
    .in('slug', ['post-production-handover', 'daily-pre-op-fresh-meat', 'weekly-pre-op-hygiene']);
    
  if (fetchError) {
    console.error('Error fetching templates:', fetchError);
    return;
  }
  
  if (!templates || templates.length === 0) {
    console.log('No templates found to copy.');
    return;
  }

  // Insert to Gotzinger
  for (const t of templates) {
    // Generate new UUID or keep same? Let's just generate new UUIDs by omitting 'id'
    const { id, ...rest } = t;
    const { data: inserted, error: insertError } = await supabase
      .from('gotzinger_form_templates')
      .upsert(rest, { onConflict: 'slug' })
      .select();
      
    if (insertError) {
      console.error(`Error inserting template ${t.slug}:`, insertError);
    } else {
      console.log(`Successfully copied template: ${t.slug}`);
    }
  }
}

run();
