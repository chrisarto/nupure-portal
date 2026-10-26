import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'child_process';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');
const brainDir = String.raw`C:\Users\chris\.gemini\antigravity\brain\b1635e90-7201-48ad-89f5-3830ebaaeb12\scratch\imap-scraper`;

// Load env
const envContent = fs.readFileSync(path.join(rootDir, '.env.local'), 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '').trim();
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runPythonParser(pdfPath) {
  return new Promise((resolve, reject) => {
    const pyScript = path.join(__dirname, 'parse_pdf_live.py');
    const child = spawn('python', [pyScript, pdfPath]);
    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => output += data.toString());
    child.stderr.on('data', (data) => errorOutput += data.toString());

    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`Python script failed: ${errorOutput}`));
      try {
        resolve(JSON.parse(output));
      } catch (e) {
        reject(new Error(`Failed to parse Python JSON output: ${output}`));
      }
    });
  });
}

async function uploadImage(imagePath) {
  const ext = path.extname(imagePath);
  const filename = `${crypto.randomUUID()}${ext}`;
  const fileData = fs.readFileSync(imagePath);
  
  const { data, error } = await supabase.storage
    .from('documents')
    .upload(`ingested_photos/${filename}`, fileData, {
      contentType: ext === '.png' ? 'image/png' : 'image/jpeg',
      upsert: true
    });
    
  if (error) {
    console.error(`Upload error for ${imagePath}:`, error.message);
    return null;
  }
  
  const { data: publicData } = supabase.storage.from('documents').getPublicUrl(`ingested_photos/${filename}`);
  return publicData.publicUrl;
}

async function main() {
  console.log('Cleaning up old historical imports...');
  await supabase.from('rpf_form_submissions').delete().eq('notes', 'Imported from historical PDF archive');

  const pdfsDir = path.join(brainDir, 'historical_pdfs');
  if (!fs.existsSync(pdfsDir)) {
     console.error(`PDFs directory not found: ${pdfsDir}`);
     return;
  }
  const files = fs.readdirSync(pdfsDir).filter(f => f.endsWith('.pdf'));
  console.log(`Found ${files.length} PDFs to process locally.`);

  const { data: templates } = await supabase.from('rpf_form_templates').select('id, slug, name, sections');
  const templateMap = {};
  for (const t of (templates || [])) {
    const itemMapping = {};
    for (const sec of (t.sections || [])) {
      for (const item of (sec.items || [])) {
         const normalized = item.label.toLowerCase().replace(/[^a-z0-9]/g, '');
         itemMapping[normalized] = item.id;
      }
    }
    templateMap[t.slug] = { ...t, itemMapping };
  }

  // To save time during this test run, just process the first 5 PDFs that have "Swab" or "Pre-Op" in them
  const filesToProcess = files;

  let success = 0;
  for (const file of filesToProcess) {
    console.log(`Processing ${file}...`);
    const pdfPath = path.join(pdfsDir, file);
    try {
      const parsed = await runPythonParser(pdfPath);
      if (parsed.error || parsed.formType === 'Unknown') {
        continue;
      }

      // Upload extracted images
      const uploadedUrls = [];
      for (const imgPath of (parsed.images || [])) {
         console.log(` Uploading extracted photo: ${imgPath}`);
         const url = await uploadImage(imgPath);
         if (url) uploadedUrls.push(url);
         try { fs.unlinkSync(imgPath); } catch(e){}
      }

      let slug = '';
      if (parsed.formType === 'Daily Pre-Op') slug = 'daily-pre-op-fresh-meat';
      else if (parsed.formType === 'Weekly Pre-Op') slug = 'weekly-pre-op-hygiene';
      else if (parsed.formType === 'Daily Swabs') slug = 'daily-swabs';
      else if (parsed.formType === 'Weekly Swabs') slug = 'weekly-swabs';
      
      let template = templateMap[slug];
      if (!template && slug) {
         const newId = crypto.randomUUID();
         template = templateMap[slug] = { id: newId, slug, name: parsed.formType, itemMapping: {} };
         // Insert missing template to avoid foreign key errors!
         await supabase.from('rpf_form_templates').insert({
             id: newId,
             slug,
             name: parsed.formType,
             sections: []
         });
      }
      
      if (!template) continue;

      const responses = { global_photos: uploadedUrls };
      let score_total = 0, score_pass = 0, score_fail = 0, score_reclean = 0;

      for (const sec of parsed.sections) {
        for (const item of sec.items) {
          const normalized = item.description.toLowerCase().replace(/[^a-z0-9]/g, '');
          const itemId = template.itemMapping[normalized] || `live_${crypto.randomUUID().substr(0,8)}`;
          let result = null;
          if (item.result === 'Acceptable' || item.result === 'Pass') result = 'pass';
          if (item.result === 'Unacceptable' || item.result === 'Fail') result = 'fail';
          
          responses[itemId] = { result, _legacyText: item.description };
          if (result) score_total++;
          if (result === 'pass') score_pass++;
          if (result === 'fail') score_fail++;
        }
      }

      const overall_score = score_total > 0 ? Math.round((score_pass / score_total) * 100) : null;
      let submittedAt = new Date().toISOString();
      if (parsed.date) {
         const d = new Date(parsed.date);
         if (!isNaN(d.valueOf())) submittedAt = d.toISOString();
      }

      const { error: dbErr } = await supabase.from('rpf_form_submissions').insert({
        template_id: template.id,
        template_slug: template.slug,
        template_name: template.name,
        submitted_by: parsed.auditor || 'Client Reporter',
        submitted_by_email: 'noreply@informationleader.net',
        site: '',
        area: '',
        responses,
        notes: 'Imported from historical PDF archive',
        status: 'submitted',
        pdf_url: null,
        submitted_at: submittedAt,
        score_total,
        score_pass,
        score_fail,
        score_reclean,
        overall_score
      });

      if (!dbErr) success++;
    } catch (e) {
      console.error(`Error processing ${file}:`, e.message);
    }
  }

  console.log(`Finished processing local PDFs. Successfully ingested: ${success}`);
}

main().catch(console.error);
