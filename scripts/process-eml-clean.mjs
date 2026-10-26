import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { ImapFlow } from 'imapflow';
import WebSocket from 'ws';
if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket;
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// â”€â”€ Load .env.local â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const envPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].replace(/^["']|["']$/g, '').trim();
  });
}

// â”€â”€ Clients â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const IMAP_HOST = process.env.IMAP_HOST || 'imap.hostinger.com';
const IMAP_PORT = Number(process.env.IMAP_PORT || 993);
const IMAP_USER = process.env.IMAP_USER || 'reportlink@mj-gotzinger-hygiene.com';
const IMAP_PASS = process.env.IMAP_PASS || 'Shelly!49';

const TEMPLATE_SLUG = 'daily-pre-op-fresh-meat';
const STORAGE_BUCKET = 'documents';

// â”€â”€ Gemini Vision: extract structured data from a PDF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function extractPreOpWithVision(pdfBuffer) {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

  const prompt = `You are analysing a scanned Gotzinger Smallgoods PRE-OPERATIONAL MONITORING FORM (Form #14).

The form has multiple AREAS (sections). Each area has checklist items. Each item is marked with a compliance rating:
- A = Acceptable
- M = Marginal  
- U = Unacceptable

Some items may also have handwritten "Defect description, Comments" and "Corrective and/or preventive actions" and "Verification" notes.

The form header includes:
- DATE (handwritten, format DD/MM/YY)
- Time started / Time completed
- Whether it is LOW RISK AREA or HIGH RISK AREA

Please extract ALL data from ALL pages of this PDF and return a single JSON object with this exact structure:

{
  "date": "YYYY-MM-DD",
  "timeStarted": "HH:MM",
  "timeCompleted": "HH:MM",
  "riskLevel": "LOW" or "HIGH",
  "overallScore": 98.03,
  "areas": [
    {
      "name": "Entry Area to Production",
      "items": [
        {
          "label": "Walls, floors, doors and ceiling",
          "compliance": "A",
          "defect": "",
          "correctiveAction": "",
          "verification": ""
        }
      ]
    }
  ]
}

IMPORTANT RULES:
- Return ONLY valid JSON, no markdown fences, no explanation text
- For compliance, use exactly "A", "M", or "U". If blank/unclear use "A"
- Include EVERY area and EVERY item from ALL pages
- The areas in order are typically: Entry Area to Production, Production Areas (cont.), Production Office, Spice Room, Ham Production (Batching Area), Raw Material Receival (& Ham Production), Raw Staging, Cook Room (Raw), Raw Wash Room, Clean Storage, then HIGH RISK sections
- Preserve the exact area names and item labels as printed on the form
- For the date, convert from DD/MM/YY to YYYY-MM-DD format (assume 2020s)
- For overallScore: extract the EXACT percentage score printed on the PDF summary/footer (e.g. 98.03). This is the official compliance percentage. Return it as a number with up to 2 decimal places. If not found, return null.`;

  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: pdfBuffer.toString('base64')
      }
    }
  ]);

  const text = result.response.text().trim();
  
  // Strip markdown fences if present
  const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Failed to parse Gemini response as JSON:', text.substring(0, 500));
    throw new Error('Gemini returned invalid JSON');
  }
}


// â”€â”€ Gemini Vision: extract swab/surface monitoring data from a PDF â”€â”€
async function extractSwabWithVision(pdfBuffer) {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

  const prompt = `You are analysing a Gotzinger Smallgoods SURFACE MONITORING RECORDS document.

This document contains swab test results for various locations/surfaces in the facility.
Each test has a location/surface name and a result (PASS or FAIL).

Please extract ALL data from ALL pages of this PDF and return a single JSON object with this exact structure:

{
  "date": "YYYY-MM-DD",
  "weekStarting": "YYYY-MM-DD",
  "overallScore": 95.5,
  "totalTests": 20,
  "totalPass": 19,
  "totalFail": 1,
  "tests": [
    {
      "location": "Mincer blade",
      "result": "PASS",
      "count": 1,
      "notes": ""
    }
  ]
}

IMPORTANT RULES:
- Return ONLY valid JSON, no markdown fences, no explanation text
- For result, use exactly "PASS" or "FAIL"
- Include EVERY test from ALL pages
- For overallScore: extract the EXACT percentage if printed, or calculate as (totalPass / totalTests * 100) with 2 decimal places
- For the date, convert from DD/MM/YY to YYYY-MM-DD format (assume 2020s)
- weekStarting is the week starting date if mentioned in the header
- If a test has a count/number of samples, include it. Otherwise set count to 1
- Preserve the exact location names as printed on the form`;

  const result = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: pdfBuffer.toString('base64')
      }
    }
  ]);

  const text = result.response.text().trim();
  const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('Failed to parse Gemini swab response as JSON:', text.substring(0, 500));
    throw new Error('Gemini returned invalid JSON for swab data');
  }
}

// â”€â”€ Parse date from swab subject line â”€â”€
// Handles: "Surface monitoring records WS 14/09/26" (WS = Week Starting)
function parseDateFromSwabSubject(subject) {
  const match = subject?.match(/(?:WS|ws)\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})/i);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3].length === 2 ? '20' + match[3] : match[3];
    const d = new Date(`${year}-${month}-${day}T00:00:00+10:00`);
    return isNaN(d.valueOf()) ? null : d.toISOString();
  }
  return null;
}

// â”€â”€ Upload a buffer to Supabase Storage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function uploadToStorage(buffer, storagePath, contentType) {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, { contentType, upsert: true });

  if (error) {
    console.error(`Storage upload error (${storagePath}):`, error.message);
    return null;
  }

  const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return pub.publicUrl;
}

// â”€â”€ Map extracted AI data to template items & compute scores â”€â”€â”€â”€â”€â”€
function mapToSubmission(parsed, template) {
  const responses = {};
  let scoreTotal = 0;
  let scorePass = 0;
  let scoreFail = 0;
  let scoreReclean = 0;

  // Build a lookup from template sections
  const templateLookup = {};
  for (const sec of (template.sections || [])) {
    for (const item of (sec.items || [])) {
      const key = (sec.title + '||' + item.label).toLowerCase().replace(/[^a-z0-9|]/g, '');
      templateLookup[key] = item.id;
    }
  }

  const sectionScores = {};

  for (const area of (parsed.areas || [])) {
    let secPass = 0;
    let secTotal = 0;

    for (const item of (area.items || [])) {
      // Try to find matching template item
      const lookupKey = (area.name + '||' + item.label).toLowerCase().replace(/[^a-z0-9|]/g, '');
      const itemId = templateLookup[lookupKey] || `auto_${crypto.randomUUID().substring(0, 8)}`;

      let result = 'pass';
      if (item.compliance === 'U') result = 'fail';
      else if (item.compliance === 'M') result = 'marginal';

      responses[itemId] = {
        result,
        compliance: item.compliance,
        defect: item.defect || '',
        correctiveAction: item.correctiveAction || '',
        verification: item.verification || '',
        _label: item.label,
        _area: area.name
      };

      scoreTotal++;
      if (result === 'pass') scorePass++;
      else if (result === 'fail') scoreFail++;
      else if (result === 'marginal') scoreReclean++;

      secTotal++;
      if (result === 'pass') secPass++;
    }

    if (secTotal > 0) {
      sectionScores[area.name] = {
        total: secTotal,
        pass: secPass,
        fail: secTotal - secPass,
        score: Math.round((secPass / secTotal) * 100)
      };
    }
  }

  // Use the official score extracted directly from the PDF by Gemini.
  // Only fall back to calculation if Gemini couldn't find it.
  const pdfScore = typeof parsed.overallScore === 'number' ? parsed.overallScore : null;
  const calculatedScore = scoreTotal > 0
    ? Math.round(((scoreTotal - scoreFail) / scoreTotal) * 10000) / 100
    : null;
  const overallScore = pdfScore !== null ? pdfScore : calculatedScore;

  if (pdfScore !== null) {
    console.log(`  Score from PDF: ${pdfScore}% (calculated would be ${calculatedScore}%)`);
  } else {
    console.log(`  Score calculated: ${calculatedScore}% (PDF score not found)`);
  }

  return { responses, scoreTotal, scorePass, scoreFail, scoreReclean, overallScore, sectionScores };
}

// â”€â”€ Parse date from subject line â”€â”€
// Handles: "Gotzinger Smallgoods - 140926 Pre-Op" (DDMMYY)
//      and: "Gotzinger Smallgoods Pre-Op - 15/09/26" (DD/MM/YY)
function parseDateFromSubject(subject) {
  // Format 1: 6-digit run-together (e.g. "140926")
  const match1 = subject?.match(/(\d{6})\s*Pre-?Op/i);
  if (match1) {
    const digits = match1[1];
    const day = digits.substring(0, 2);
    const month = digits.substring(2, 4);
    const year = '20' + digits.substring(4, 6);
    const d = new Date(`${year}-${month}-${day}T00:00:00+10:00`);
    return isNaN(d.valueOf()) ? null : d.toISOString();
  }

  // Format 2: DD/MM/YY (e.g. "15/09/26")
  const match2 = subject?.match(/Pre-?Op\s*[-â€“â€”]\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})/i);
  if (match2) {
    const day = match2[1].padStart(2, '0');
    const month = match2[2].padStart(2, '0');
    const year = match2[3].length === 2 ? '20' + match2[3] : match2[3];
    const d = new Date(`${year}-${month}-${day}T00:00:00+10:00`);
    return isNaN(d.valueOf()) ? null : d.toISOString();
  }

  return null;
}

// â”€â”€ MAIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function main() {
  console.log(`[${new Date().toISOString()}] Starting Gotzinger pre-op email ingestion...`);

  // â”€â”€ Phase 1: Download emails from IMAP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const emlPath = 'C:\\Users\\chris\\Downloads\\Post - Op Inspection 17_09.eml';
  const source = fs.readFileSync(emlPath, 'utf8');

  const downloaded = [{
    uid: 1,
    sender: 'qa@gotzinger.com',
    subject: 'Gotzinger Smallgoods Pre-Op - 18/09/26',
    source: source,
    type: 'pre-op'
  }];

  // â”€â”€ Phase 2: Process offline (Gemini Vision + Supabase) â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Split by type
  const preOpEmails = downloaded.filter(e => e.type === 'pre-op');
  const swabEmails = downloaded.filter(e => e.type === 'swab');

  const processedUids = []; // UIDs to mark as read after processing

  // â”€â”€ Process Pre-Op Emails â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (preOpEmails.length > 0) {
  const { data: templates } = await supabase
    .from('gotzinger_form_templates')
    .select('id, slug, name, sections')
    .eq('slug', TEMPLATE_SLUG)
    .limit(1);

  const template = templates?.[0];
  if (!template) {
    console.error(`Template "${TEMPLATE_SLUG}" not found!`);
  } else {

  for (const email of preOpEmails) {
    console.log(`\nProcessing: "${email.subject}" from ${email.sender}`);

    // Check for duplicate
    const submittedAt = parseDateFromSubject(email.subject) || new Date().toISOString();
    const dateOnly = submittedAt.split('T')[0];

    const { data: existing } = await supabase
      .from('gotzinger_form_submissions')
      .select('id')
      .eq('template_slug', 'client-pre-op')
      .gte('submitted_at', dateOnly + 'T00:00:00Z')
      .lte('submitted_at', dateOnly + 'T23:59:59Z')
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`Already ingested for ${dateOnly}. Skipping.`);
      processedUids.push(email.uid);
      continue;
    }

    // Extract PDF attachments from raw MIME
    const boundaries = [];
    const boundaryRegex = /boundary="?([^";\s]+)"?/gi;
    let bMatch;
    while ((bMatch = boundaryRegex.exec(email.source)) !== null) {
      boundaries.push(bMatch[1]);
    }

    const pdfAttachments = [];
    for (const boundary of boundaries) {
      const parts = email.source.split(`--${boundary}`);
      for (const part of parts) {
        if (!part.includes('application/pdf')) continue;

        const filenameMatch = part.match(/filename="?([^";\r\n]+)"?/i);
        const filename = filenameMatch ? filenameMatch[1].trim() : `attachment_${pdfAttachments.length}.pdf`;

        const bodySplit = part.split('\r\n\r\n');
        if (bodySplit.length < 2) continue;

        const rawBody = bodySplit.slice(1).join('\r\n\r\n').replace(/[\r\n\s]/g, '');
        const cleanBody = rawBody.replace(/--[A-Za-z0-9_]+--?.*$/s, '');

        try {
          const pdfBuffer = Buffer.from(cleanBody, 'base64');
          if (pdfBuffer.length > 100 && pdfBuffer.slice(0, 5).toString().includes('%PDF')) {
            pdfAttachments.push({ filename, buffer: pdfBuffer });
            console.log(`  Extracted: ${filename} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);
          }
        } catch (e) {
          console.error(`  Failed to decode ${filename}:`, e.message);
        }
      }
    }

    if (pdfAttachments.length === 0) {
      console.log('  No PDF attachments found. Skipping.');
      processedUids.push(email.uid);
      continue;
    }

    // Upload original PDFs to Supabase Storage
    const storageDateDir = `client-preop/${dateOnly}`;
    const pdfUrls = [];

    for (const att of pdfAttachments) {
      const safeName = att.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${storageDateDir}/${safeName}`;
      const url = await uploadToStorage(att.buffer, storagePath, 'application/pdf');
      if (url) {
        pdfUrls.push({ filename: att.filename, url });
        console.log(`  Uploaded: ${storagePath}`);
      }
    }

    // Find the main pre-op form PDF (not the photos one)
    const mainPdf = pdfAttachments.find(a => !a.filename.toLowerCase().includes('photo'))
      || pdfAttachments[0];

    // Send to Gemini Vision for extraction
    console.log(`  Sending ${mainPdf.filename} to Gemini Vision for analysis...`);
    let parsed;
    try {
      parsed = await extractPreOpWithVision(mainPdf.buffer);
      console.log(`  Gemini extracted ${parsed.areas?.length || 0} areas.`);
    } catch (err) {
      console.error(`  Gemini Vision failed:`, err.message);
      parsed = { date: dateOnly, areas: [], riskLevel: 'UNKNOWN' };
    }

    const finalDate = parsed.date
      ? new Date(parsed.date + 'T00:00:00+10:00').toISOString()
      : submittedAt;

    // Map to template and compute scores
    const {
      responses, scoreTotal, scorePass, scoreFail,
      scoreReclean, overallScore, sectionScores
    } = mapToSubmission(parsed, template);

    responses._pdf_urls = pdfUrls;
    responses._meta = {
      riskLevel: parsed.riskLevel,
      timeStarted: parsed.timeStarted,
      timeCompleted: parsed.timeCompleted,
      extractedBy: 'gemini-vision',
      ingestedAt: new Date().toISOString()
    };

    // Extract photos from the Photos PDF (if present)
    const photosPdf = pdfAttachments.find(a => a.filename.toLowerCase().includes('photo'));
    const photoUrls = [];

    if (photosPdf) {
      console.log(`  Extracting photos from ${photosPdf.filename}...`);
      const tmpDir = `/tmp/preop-photos-${Date.now()}`;
      const tmpPdf = `${tmpDir}/photos.pdf`;
      const tmpOut = `${tmpDir}/out`;

      try {
        fs.mkdirSync(tmpOut, { recursive: true });
        fs.writeFileSync(tmpPdf, photosPdf.buffer);

        const extractScript = path.join(__dirname, 'extract_photos.py');
        const output = execSync(`python3 "${extractScript}" "${tmpPdf}" "${tmpOut}"`, {
          timeout: 30000,
          encoding: 'utf-8'
        }).trim();

        const imageFiles = output.split('\n').filter(f => f.trim() && !f.startsWith('TOTAL:'));
        console.log(`  Found ${imageFiles.length} photos to extract.`);

        for (const imgFile of imageFiles) {
          const imgPath = path.join(tmpOut, imgFile.trim());
          if (!fs.existsSync(imgPath)) continue;

          const imgBuffer = fs.readFileSync(imgPath);
          const ext = path.extname(imgFile).substring(1) || 'png';
          const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
          const storagePath = `${storageDateDir}/photos/${imgFile.trim()}`;

          const url = await uploadToStorage(imgBuffer, storagePath, contentType);
          if (url) {
            photoUrls.push(url);
            console.log(`  Uploaded photo: ${storagePath}`);
          }
        }

        // Cleanup temp files
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (err) {
        console.error(`  Photo extraction failed:`, err.message);
        // Cleanup on error
        try { fs.rmSync(`/tmp/preop-photos-*`, { recursive: true, force: true }); } catch (_) {}
      }
    }

    if (photoUrls.length > 0) {
      responses.global_photos = photoUrls;
      console.log(`  ${photoUrls.length} photos embedded in report.`);
    }

    // Insert into gotzinger_form_submissions
    const { error: dbErr } = await supabase.from('gotzinger_form_submissions').insert({
      template_id: template.id,
      template_slug: 'client-pre-op',
      template_name: 'Client Pre-Op (Gotzinger Internal)',
      submitted_by: email.sender.split('@')[0] || 'Gotzinger QA',
      submitted_by_email: email.sender,
      site: 'Gotzinger Smallgoods',
      area: parsed.riskLevel === 'HIGH' ? 'High Risk' : 'Low Risk',
      responses,
      notes: `Auto-ingested from email: "${email.subject}"`,
      status: 'submitted',
      pdf_url: pdfUrls[0]?.url || null,
      submitted_at: finalDate,
      score_total: scoreTotal,
      score_pass: scorePass,
      score_fail: scoreFail,
      score_reclean: scoreReclean,
      overall_score: overallScore,
      section_scores: sectionScores
    });

    if (dbErr) {
      console.error(`  DB insert error: ${dbErr.message}`);
    } else {
      console.log(`  âœ“ Ingested: ${dateOnly} | Score: ${overallScore}% (${scorePass}/${scoreTotal} pass)`);
      processedUids.push(email.uid);
    }
  }
  } // end else (template found)
  } // end if (preOpEmails.length > 0)

  // â”€â”€ Process Swab Emails â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  for (const email of swabEmails) {
    console.log(`\nProcessing swab: "${email.subject}" from ${email.sender}`);

    const submittedAt = parseDateFromSwabSubject(email.subject) || new Date().toISOString();
    const dateOnly = submittedAt.split('T')[0];

    // Check for duplicate
    const { data: existing } = await supabase
      .from('gotzinger_form_submissions')
      .select('id')
      .eq('template_slug', 'daily-swabs')
      .gte('submitted_at', dateOnly + 'T00:00:00Z')
      .lte('submitted_at', dateOnly + 'T23:59:59Z')
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`  Already ingested swab for ${dateOnly}. Skipping.`);
      processedUids.push(email.uid);
      continue;
    }

    // Extract PDF attachments from raw MIME
    const boundaries = [];
    const boundaryRegex = /boundary="?([^";\s]+)"?/gi;
    let bMatch;
    while ((bMatch = boundaryRegex.exec(email.source)) !== null) {
      boundaries.push(bMatch[1]);
    }

    const pdfAttachments = [];
    for (const boundary of boundaries) {
      const parts = email.source.split(`--${boundary}`);
      for (const part of parts) {
        if (!part.includes('application/pdf') && !part.includes('application/octet-stream')) continue;

        const filenameMatch = part.match(/filename="?([^";\r\n]+)"?/i);
        const filename = filenameMatch ? filenameMatch[1].trim() : `swab_${pdfAttachments.length}.pdf`;

        const bodySplit = part.split('\r\n\r\n');
        if (bodySplit.length < 2) continue;

        const rawBody = bodySplit.slice(1).join('\r\n\r\n').replace(/[\r\n\s]/g, '');
        const cleanBody = rawBody.replace(/--[A-Za-z0-9_]+--?.*$/s, '');

        try {
          const pdfBuffer = Buffer.from(cleanBody, 'base64');
          if (pdfBuffer.length > 100 && pdfBuffer.slice(0, 5).toString().includes('%PDF')) {
            pdfAttachments.push({ filename, buffer: pdfBuffer });
            console.log(`  Extracted: ${filename} (${(pdfBuffer.length / 1024).toFixed(1)} KB)`);
          }
        } catch (e) {
          console.error(`  Failed to decode ${filename}:`, e.message);
        }
      }
    }

    if (pdfAttachments.length === 0) {
      console.log('  No PDF attachments found for swab. Skipping.');
      processedUids.push(email.uid);
      continue;
    }

    // Upload original PDF to storage
    const storageDateDir = `swab-results/${dateOnly}`;
    const pdfUrls = [];

    for (const att of pdfAttachments) {
      const safeName = att.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${storageDateDir}/${safeName}`;
      const url = await uploadToStorage(att.buffer, storagePath, 'application/pdf');
      if (url) {
        pdfUrls.push({ filename: att.filename, url });
        console.log(`  Uploaded: ${storagePath}`);
      }
    }

    // Send to Gemini Vision for swab extraction
    const mainPdf = pdfAttachments[0];
    console.log(`  Sending ${mainPdf.filename} to Gemini Vision for swab analysis...`);
    let parsed;
    try {
      parsed = await extractSwabWithVision(mainPdf.buffer);
      console.log(`  Gemini extracted ${parsed.tests?.length || 0} swab tests.`);
    } catch (err) {
      console.error(`  Gemini Vision failed for swab:`, err.message);
      parsed = { date: dateOnly, tests: [], totalTests: 0, totalPass: 0, totalFail: 0 };
    }

    const finalDate = parsed.date
      ? new Date(parsed.date + 'T00:00:00+10:00').toISOString()
      : submittedAt;

    // Map swab tests to responses
    const responses = {};
    let scoreTotal = parsed.totalTests || 0;
    let scorePass = parsed.totalPass || 0;
    let scoreFail = parsed.totalFail || 0;

    for (const test of (parsed.tests || [])) {
      const itemId = `swab_${crypto.randomUUID().substring(0, 8)}`;
      responses[itemId] = {
        result: test.result === 'FAIL' ? 'fail' : 'pass',
        location: test.location,
        count: test.count || 1,
        notes: test.notes || '',
        _label: test.location,
        _area: 'Surface Monitoring'
      };
    }

    responses._pdf_urls = pdfUrls;
    responses._meta = {
      weekStarting: parsed.weekStarting || '',
      extractedBy: 'gemini-vision',
      ingestedAt: new Date().toISOString()
    };

    const overallScore = typeof parsed.overallScore === 'number'
      ? parsed.overallScore
      : (scoreTotal > 0 ? Math.round((scorePass / scoreTotal) * 10000) / 100 : null);

    // Insert into gotzinger_form_submissions
    const { error: dbErr } = await supabase.from('gotzinger_form_submissions').insert({
      template_id: 'b8c9d0e1-f2a3-4b5c-6d7e-8f9a0b1c2d3e',
      template_slug: 'daily-swabs',
      template_name: 'Surface Monitoring Records',
      submitted_by: email.sender.split('@')[0] || 'Gotzinger QA',
      submitted_by_email: email.sender,
      site: 'Gotzinger Smallgoods',
      area: 'Surface Monitoring',
      responses,
      notes: `Auto-ingested from email: "${email.subject}"`,
      status: 'submitted',
      pdf_url: pdfUrls[0]?.url || null,
      submitted_at: finalDate,
      score_total: scoreTotal,
      score_pass: scorePass,
      score_fail: scoreFail,
      score_reclean: 0,
      overall_score: overallScore,
      section_scores: {}
    });

    if (dbErr) {
      console.error(`  DB insert error (swab): ${dbErr.message}`);
    } else {
      console.log(`  âœ“ Swab ingested: ${dateOnly} | Score: ${overallScore}% (${scorePass}/${scoreTotal} pass)`);
      processedUids.push(email.uid);
    }
  }

  console.log(`[${new Date().toISOString()}] Ingestion complete.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

