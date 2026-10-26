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

// ── Load .env.local ───────────────────────────────────────────────
const envPath = path.join(rootDir, '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].replace(/^["']|["']$/g, '').trim();
  });
}

// ── Clients ───────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ── Config ────────────────────────────────────────────────────────
const IMAP_HOST = process.env.IMAP_HOST || 'imap.hostinger.com';
const IMAP_PORT = Number(process.env.IMAP_PORT || 993);
const IMAP_USER = process.env.IMAP_USER || 'reportlink@mj-gotzinger-hygiene.com';
const IMAP_PASS = process.env.IMAP_PASS || 'Shelly!49';

const TEMPLATE_SLUG = 'daily-pre-op-fresh-meat';
const STORAGE_BUCKET = 'documents';

// ── Gemini Vision: extract structured data from a PDF ─────────────
async function extractPreOpWithVision(pdfBuffer) {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

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

// ── Gemini: extract from email text ─────────────
async function extractPreOpFromText(emailText) {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

  const prompt = `You are extracting data from an email containing a post-op / pre-op hygiene inspection report.
The email contains a list of areas (like Production, Packing) and bullet points of defects.
Convert this into our standard JSON format.
The defects should be marked as "fail" (compliance "U") or "reclean" (compliance "M"). The sender says they were "re-cleaned and sanitised unless otherwise noted", so mark them as "reclean" ("M"), except if they say they will "address it tonight" or "continue working on this", mark as "fail" ("U").
Format:
{
  "date": "YYYY-MM-DD",
  "timeStarted": "05:00",
  "timeCompleted": "06:00",
  "riskLevel": "LOW",
  "overallScore": null,
  "areas": [
    {
      "name": "Production Areas",
      "items": [
        {
          "label": "Mincer",
          "compliance": "M",
          "defect": "Meat residue found",
          "correctiveAction": "Cleaned and Sanitised"
        }
      ]
    }
  ]
}
Return ONLY valid JSON. Map the areas to typical factory areas if possible (e.g., "Production" -> "Production Areas"). Make up a concise label for the item based on the defect (e.g. "Vemag 1 Underside").`;

  const result = await model.generateContent([
    { text: prompt },
    { text: "EMAIL CONTENT:\n" + emailText }
  ]);
  
  let text = result.response.text().trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  return JSON.parse(text);
}



// ── Gemini Vision: extract swab/surface monitoring data from a PDF ──
async function extractSwabWithVision(pdfBuffer) {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

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

// ── Parse date from swab subject line ──
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

// ── Upload a buffer to Supabase Storage ───────────────────────────
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

// ── Map extracted AI data to template items & compute scores ──────
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

// ── Timezone Helper (AEST / Brisbane: UTC+10) ────────────────────────
function getAestDayUtcRange(isoStringOrYmd) {
  if (!isoStringOrYmd) return null;
  let ymd = isoStringOrYmd;
  if (isoStringOrYmd.includes('T')) {
    const d = new Date(isoStringOrYmd);
    const aestTime = new Date(d.getTime() + 10 * 3600000);
    ymd = aestTime.toISOString().split('T')[0];
  }
  return {
    startUtc: new Date(`${ymd}T00:00:00+10:00`).toISOString(),
    endUtc: new Date(`${ymd}T23:59:59.999+10:00`).toISOString(),
    ymd
  };
}

// ── Parse date from subject line ──
// Handles: "Gotzinger Smallgoods - 140926 Pre-Op" (DDMMYY)
//          "Gotzinger Smallgoods Pre-Op - 15/09/26" (DD/MM/YY)
//          "Gotzinger Smallgoods Pre-Op - 17+191026" (Multiple dates, takes latest)
//          "Gotzinger Smallgoods Pre-Op - 21/10/16" (Typo year 16 -> 26)
function parseDateFromSubject(subject) {
  if (!subject) return null;

  // Format 1: DD/MM/YY or DD-MM-YY or DD.MM.YY (e.g. "15/09/26", "21/10/16")
  const matchSlash = subject.match(/(?:Pre-?Op|monitoring)[^0-9]*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i);
  if (matchSlash) {
    const day = matchSlash[1].padStart(2, '0');
    const month = matchSlash[2].padStart(2, '0');
    let year = matchSlash[3];
    if (year.length === 2) {
      if (year === '16') year = '26'; // Fix typo in email subject (2016 -> 2026)
      year = '20' + year;
    }
    const d = new Date(`${year}-${month}-${day}T00:00:00+10:00`);
    return isNaN(d.valueOf()) ? null : d.toISOString();
  }

  // Format 2: 6-digit run-together DDMMYY (e.g. "140926 Pre-Op" or "Pre-Op - 17+191026")
  const matchDigits = subject.match(/(\d{2})(\d{2})(\d{2})(?!\d)/g);
  if (matchDigits && matchDigits.length > 0) {
    const lastDigits = matchDigits[matchDigits.length - 1];
    const day = lastDigits.substring(0, 2);
    const month = lastDigits.substring(2, 4);
    let yearPart = lastDigits.substring(4, 6);
    if (yearPart === '16') yearPart = '26';
    const year = '20' + yearPart;

    const dNum = parseInt(day, 10);
    const mNum = parseInt(month, 10);
    if (dNum >= 1 && dNum <= 31 && mNum >= 1 && mNum <= 12) {
      const d = new Date(`${year}-${month}-${day}T00:00:00+10:00`);
      return isNaN(d.valueOf()) ? null : d.toISOString();
    }
  }

  return null;
}

// ── MAIN ──────────────────────────────────────────────────────────
async function main() {
  console.log(`[${new Date().toISOString()}] Starting Gotzinger pre-op email ingestion...`);

  // ── Phase 1: Download emails from IMAP ──────────────────────────
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: IMAP_USER, pass: IMAP_PASS },
    logger: false
  });

  await client.connect();
  console.log('Connected to IMAP.');

  const downloaded = []; // { uid, sender, subject, source, type }

  const lock = await client.getMailboxLock('INBOX');
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const sinceDate = since.toISOString().split('T')[0];

    const uids = await client.search({ since: sinceDate });
    console.log(`Found ${uids.length} unread emails to check.`);

    if (uids.length === 0) {
      console.log('No new emails. Done.');
      lock.release();
      await client.logout();
      return;
    }

    const envMessages = client.fetch(uids, { uid: true, envelope: true });
    const envelopes = [];
    for await (const msg of envMessages) {
      envelopes.push({
        uid: msg.uid,
        envelope: msg.envelope
      });
    }

    const uidsToDownload = [];
    const envelopeMap = new Map();

    for (const msg of envelopes) {
      const sender = msg.envelope?.from?.[0]?.address || '';
      const subject = msg.envelope?.subject || '';
      const subjectLower = subject.toLowerCase();

      // Determine email type
      let emailType = null;
      if (sender.toLowerCase().includes('gotzinger.com')) {
        if (subjectLower.includes('pre-op')) emailType = 'pre-op';
        else if (subjectLower.includes('surface monitoring')) emailType = 'swab';
      }

      if (!emailType) {
        console.log(`Skipping: "${subject}" from ${sender}`);
        await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });
        continue;
      }

      envelopeMap.set(msg.uid, { sender, subject, emailType });

      // Check for duplicate in DB
      const templateSlug = emailType === 'pre-op' ? 'client-pre-op' : 'daily-swabs';

      // 1. Check if email subject already recorded in notes
      const { data: existingBySubj } = await supabase
        .from('gotzinger_form_submissions')
        .select('id')
        .eq('template_slug', templateSlug)
        .ilike('notes', `%${subject}%`)
        .limit(1);

      if (existingBySubj && existingBySubj.length > 0) {
        console.log(`Already ingested ${emailType} (subject matched: "${subject}"). Skipping download.`);
        await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });
        continue;
      }

      // 2. Check by date range in AEST timezone (Brisbane UTC+10)
      const submittedAt = parseDateFromSubject(subject);
      if (submittedAt) {
        const range = getAestDayUtcRange(submittedAt);
        if (range) {
          const { data: existingByDate } = await supabase
            .from('gotzinger_form_submissions')
            .select('id')
            .eq('template_slug', templateSlug)
            .gte('submitted_at', range.startUtc)
            .lte('submitted_at', range.endUtc)
            .limit(1);

          if (existingByDate && existingByDate.length > 0) {
            console.log(`Already ingested ${emailType} for date ${range.ymd}. Skipping download.`);
            await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true });
            continue;
          }
        }
      }

      uidsToDownload.push(msg.uid);
    }

    if (uidsToDownload.length > 0) {
      console.log(`Need to download full source for ${uidsToDownload.length} emails.`);
      // Download one by one to avoid timeout on large emails
      for (const uid of uidsToDownload) {
        const meta = envelopeMap.get(uid);
        console.log(`Downloading [${meta.emailType}]: "${meta.subject}" (UID ${uid})`);
        const srcMsg = await client.fetchOne(uid, { source: true, uid: true });
        downloaded.push({
          uid,
          sender: meta.sender,
          subject: meta.subject,
          source: srcMsg.source.toString('utf-8'),
          type: meta.emailType
        });
      }
    }
  } finally {
    lock.release();
  }
  await client.logout();
  console.log(`Downloaded ${downloaded.length} emails. IMAP disconnected.`);

  if (downloaded.length === 0) {
    console.log('No emails to process. Done.');
    return;
  }

  // ── Phase 2: Process offline (Gemini Vision + Supabase) ─────────
  // Split by type
  const preOpEmails = downloaded.filter(e => e.type === 'pre-op');
  const swabEmails = downloaded.filter(e => e.type === 'swab');

  const processedUids = []; // UIDs to mark as read after processing

  // ── Process Pre-Op Emails ────────────────────────────────────────
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

    // 1. Check if email subject already recorded in notes
    const { data: existingBySubj } = await supabase
      .from('gotzinger_form_submissions')
      .select('id')
      .eq('template_slug', 'client-pre-op')
      .ilike('notes', `%${email.subject}%`)
      .limit(1);

    if (existingBySubj && existingBySubj.length > 0) {
      console.log(`Already ingested pre-op (subject matched: "${email.subject}"). Skipping.`);
      processedUids.push(email.uid);
      continue;
    }

    // 2. Check by date range in AEST timezone (Brisbane UTC+10)
    const submittedAt = parseDateFromSubject(email.subject);
    const dateRange = submittedAt ? getAestDayUtcRange(submittedAt) : null;
    const dateOnly = dateRange?.ymd || new Date(Date.now() + 10 * 3600000).toISOString().split('T')[0];

    if (dateRange) {
      const { data: existingByDate } = await supabase
        .from('gotzinger_form_submissions')
        .select('id')
        .eq('template_slug', 'client-pre-op')
        .gte('submitted_at', dateRange.startUtc)
        .lte('submitted_at', dateRange.endUtc)
        .limit(1);

      if (existingByDate && existingByDate.length > 0) {
        console.log(`Already ingested pre-op for date ${dateRange.ymd}. Skipping.`);
        processedUids.push(email.uid);
        continue;
      }
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

    const storageDateDir = `client-preop/${dateOnly}`;
    const pdfUrls = [];
    const photoUrls = [];
    let parsed;

    if (pdfAttachments.length === 0) {
      console.log('  No PDF attachments found. Falling back to email text and inline images.');
      // Extract images
      const boundaries = [];
      const boundaryRegex = /boundary="?([^";\s]+)"?/gi;
      let bMatch;
      while ((bMatch = boundaryRegex.exec(email.source)) !== null) boundaries.push(bMatch[1]);
      
      const images = [];
      for (const boundary of boundaries) {
        const parts = email.source.split(`--${boundary}`);
        for (const part of parts) {
          if (!part.includes('image/jpeg') && !part.includes('image/png')) continue;
          const filenameMatch = part.match(/filename="?([^";\r\n]+)"?/i);
          const filename = filenameMatch ? filenameMatch[1].trim() : `img_${images.length}.jpg`;
          const bodySplit = part.split('\r\n\r\n');
          if (bodySplit.length < 2) continue;
          const cleanBody = bodySplit.slice(1).join('\r\n\r\n').replace(/[\r\n\s]/g, '').replace(/--[A-Za-z0-9_]+--?.*$/s, '');
          try {
            const buf = Buffer.from(cleanBody, 'base64');
            if (buf.length > 100) images.push({ filename, buffer: buf });
          } catch (err) {}
        }
      }

      console.log(`  Extracted ${images.length} inline images.`);
      for (const img of images) {
        const url = await uploadToStorage(img.buffer, `${storageDateDir}/photos/${img.filename}`, 'image/jpeg');
        if (url) photoUrls.push(url);
      }

      // Extract text body
      let textBody = '';
      const textBoundaryRegex = /Content-Type:\s*text\/plain[^>]*?\r\n\r\n([\s\S]*?)(\r\n--|_000_)/i;
      const match = email.source.match(textBoundaryRegex);
      if (match) {
        try {
          textBody = Buffer.from(match[1].replace(/[\r\n\s]/g, ''), 'base64').toString('utf8');
        } catch(e) {
          textBody = match[1];
        }
      } else {
        textBody = email.source.split('image/jpeg')[0];
      }

      try {
        parsed = await extractPreOpFromText(textBody);
        console.log(`  Gemini extracted ${parsed.areas?.length || 0} areas from text.`);
      } catch (err) {
        console.error(`  Gemini Text Extraction failed:`, err.message);
        throw new Error('Gemini Text Extraction failed to extract data');
      }
    } else {
      // ── Process PDF based workflow ──
      for (const att of pdfAttachments) {
        const safeName = att.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${storageDateDir}/${safeName}`;
        const url = await uploadToStorage(att.buffer, storagePath, 'application/pdf');
        if (url) {
          pdfUrls.push({ filename: att.filename, url });
          console.log(`  Uploaded: ${storagePath}`);
        }
      }

      const mainPdf = pdfAttachments.find(a => !a.filename.toLowerCase().includes('photo')) || pdfAttachments[0];
      console.log(`  Sending ${mainPdf.filename} to Gemini Vision for analysis...`);
      try {
        parsed = await extractPreOpWithVision(mainPdf.buffer);
        console.log(`  Gemini extracted ${parsed.areas?.length || 0} areas.`);
      } catch (err) {
        console.error(`  Gemini Vision failed:`, err.message);
        console.log(`  Skipping this email for now due to API failure. Will try again next cron tick.`);
        continue; // Skip this email, don't throw fatal error
      }
    }

    if (!parsed || !parsed.areas || parsed.areas.length === 0) {
      console.log('  No areas extracted by AI, skipping insertion.');
      continue;
    }

    if (parsed.date && parsed.date.startsWith('2016-')) {
      parsed.date = parsed.date.replace(/^2016-/, '2026-');
    }

    const finalDate = parsed.date
      ? new Date(parsed.date + 'T00:00:00+10:00').toISOString()
      : (submittedAt || new Date().toISOString());

    // Final safety check: verify no submission exists for this final date before inserting
    const finalRange = getAestDayUtcRange(finalDate);
    if (finalRange) {
      const { data: existingFinal } = await supabase
        .from('gotzinger_form_submissions')
        .select('id')
        .eq('template_slug', 'client-pre-op')
        .gte('submitted_at', finalRange.startUtc)
        .lte('submitted_at', finalRange.endUtc)
        .limit(1);

      if (existingFinal && existingFinal.length > 0) {
        console.log(`  Already have submission for ${finalRange.ymd} (ID: ${existingFinal[0].id}). Skipping duplicate insert.`);
        processedUids.push(email.uid);
        continue;
      }
    }

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

    // Extract photos from the Photos PDF (if present and if we are in PDF workflow)
    if (pdfAttachments.length > 0) {
      const photosPdf = pdfAttachments.find(a => a.filename.toLowerCase().includes('photo'));
      
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
          
          const imageFiles = output.split(/\r?\n/).filter(f => f.trim() && !f.startsWith('TOTAL:'));
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
          
          fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (err) {
          console.error(`  Photo extraction failed:`, err.message);
          try { fs.rmSync(`/tmp/preop-photos-*`, { recursive: true, force: true }); } catch (_) {}
        }
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
      console.log(`  ✓ Ingested: ${dateOnly} | Score: ${overallScore}% (${scorePass}/${scoreTotal} pass)`);
      processedUids.push(email.uid);
    }
  }
  } // end else (template found)
  } // end if (preOpEmails.length > 0)

  // ── Process Swab Emails ──────────────────────────────────────────
  for (const email of swabEmails) {
    console.log(`\nProcessing swab: "${email.subject}" from ${email.sender}`);

    const submittedAt = parseDateFromSwabSubject(email.subject) || new Date().toISOString();
    const dateOnly = submittedAt.split('T')[0];

    // Check for duplicate by matching the email subject in the notes
    const { data: existing } = await supabase
      .from('gotzinger_form_submissions')
      .select('id')
      .eq('template_slug', 'daily-swabs')
      .ilike('notes', `%${email.subject}%`)
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
      console.log(`  Skipping this email for now due to API failure. Will try again next cron tick.`);
      continue;
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
      console.log(`  ✓ Swab ingested: ${dateOnly} | Score: ${overallScore}% (${scorePass}/${scoreTotal} pass)`);
      processedUids.push(email.uid);
    }
  }

  if (processedUids.length > 0) {
    console.log(`\nMarking ${processedUids.length} emails as read...`);
    const client2 = new ImapFlow({
      host: IMAP_HOST,
      port: IMAP_PORT,
      secure: true,
      auth: { user: IMAP_USER, pass: IMAP_PASS },
      logger: false
    });

    try {
      await client2.connect();
      const lock2 = await client2.getMailboxLock('INBOX');
      try {
        for (const uid of processedUids) {
          await client2.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        }
      } finally {
        lock2.release();
      }
      await client2.logout();
      console.log('Emails marked as read.');
    } catch (err) {
      console.error('Failed to mark emails as read:', err.message);
    }
  }

  console.log(`[${new Date().toISOString()}] Ingestion complete.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

