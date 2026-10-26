import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
  }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const dataPath = String.raw`C:\Users\chris\.gemini\antigravity\brain\b1635e90-7201-48ad-89f5-3830ebaaeb12\scratch\imap-scraper\historical_data.json`;
  const historicalData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  console.log(`Found ${historicalData.length} historical reports to import.`);

  console.log('Cleaning up old historical imports...');
  await supabase.from('rpf_form_submissions').delete().eq('notes', 'Imported from historical PDF archive');

  // 1. Fetch templates to map item text to item IDs
  const { data: templates } = await supabase.from('rpf_form_templates').select('id, slug, name, sections');
  
  if (!templates || templates.length === 0) {
    console.error("No templates found in database!");
    return;
  }

  const templateMap = {};
  for (const t of templates) {
    // build an item mapping: item text -> item.id
    const itemMapping = {};
    for (const sec of t.sections || []) {
      for (const item of sec.items || []) {
         // Normalize item label for matching (remove spaces, lowercase)
         const normalized = item.label.toLowerCase().replace(/[^a-z0-9]/g, '');
         itemMapping[normalized] = item.id;
      }
    }
    templateMap[t.slug] = { ...t, itemMapping };
  }

  let successCount = 0;
  let failCount = 0;

  for (const report of historicalData) {
    // 1. Determine template slug based on formType
    let slug = '';
    if (report.formType === 'Daily Pre-Op') slug = 'daily-pre-op-fresh-meat';
    else if (report.formType === 'Weekly Pre-Op') slug = 'weekly-pre-op-hygiene';
    else if (report.formType === 'Daily Swabs') slug = 'daily-swabs';
    else if (report.formType === 'Weekly Swabs') slug = 'weekly-swabs';
    else continue;

    let template = templateMap[slug];
    if (!template) {
       // Create synthetic legacy template
       const newId = crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-0000-0000-000000000000'.replace(/0/g, () => (Math.random()*16|0).toString(16));
       const { error: tErr } = await supabase.from('rpf_form_templates').insert({
         id: newId,
         slug,
         name: report.formType + ' (Legacy)',
         description: 'Legacy imported template',
         sections: [],
         is_active: false
       });
       if (tErr) {
         console.log(`Failed to create missing template ${slug}`);
         failCount++;
         continue;
       }
       templateMap[slug] = { id: newId, slug, name: report.formType + ' (Legacy)', itemMapping: {} };
       template = templateMap[slug];
    }

    // 2. Build responses object
    const responses = {};
    let score_pass = 0;
    let score_fail = 0;
    let score_reclean = 0;
    let score_total = 0;

    for (const sec of report.sections) {
      for (const item of sec.items) {
        const normalized = item.description.toLowerCase().replace(/[^a-z0-9]/g, '');
        const itemId = template.itemMapping[normalized];
        
        // Map Acceptable -> pass, Unacceptable -> fail
        let result = null;
        if (item.result === 'Acceptable') result = 'pass';
        if (item.result === 'Unacceptable') result = 'fail';
        // Note: Legacy PDFs might not clearly differentiate reclean, but let's stick to pass/fail
        
        if (itemId) {
          responses[itemId] = { result };
          if (result) score_total++;
          if (result === 'pass') score_pass++;
          if (result === 'fail') score_fail++;
        } else {
          // If we couldn't match the exact text, we could generate a random ID or store it anyway
          // We will store it with a synthetic key just to preserve historical data
          const syntheticId = `historical_${Math.random().toString(36).substr(2, 9)}`;
          responses[syntheticId] = { result, _legacyText: item.description };
          if (result) score_total++;
          if (result === 'pass') score_pass++;
          if (result === 'fail') score_fail++;
        }
      }
    }

    const overall_score = score_total > 0 ? Math.round((score_pass / score_total) * 100) : null;
    
    // Attempt to parse Date properly. report.date is "05-Sep-2025", report.time might be messy
    let submittedAt = new Date().toISOString();
    try {
      if (report.date) {
         const d = new Date(report.date);
         if (!isNaN(d.valueOf())) submittedAt = d.toISOString();
      }
    } catch(e) {}

    const payload = {
      template_id: template.id,
      template_slug: template.slug,
      template_name: template.name,
      submitted_by: report.auditor || 'Historical Ingestion',
      submitted_by_email: 'noreply@informationleader.net',
      site: '',
      area: '',
      responses,
      notes: 'Imported from historical PDF archive',
      status: 'submitted',
      pdf_url: null,
      submitted_at: submittedAt,
      created_at: submittedAt, // override created_at to match history
      score_total,
      score_pass,
      score_fail,
      score_reclean,
      overall_score
    };

    const { error } = await supabase
      .from('rpf_form_submissions')
      .insert(payload);

    if (error) {
       console.error(`Failed to insert ${report.filename}:`, error.message);
       failCount++;
    } else {
       successCount++;
    }
  }

  console.log(`\nImport complete: ${successCount} successful, ${failCount} failed.`);
}

main().catch(console.error);
