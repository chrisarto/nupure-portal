import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

import dotenv from 'dotenv';
dotenv.config({ path: path.join(rootDir, '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const STORAGE_BUCKET = 'documents';
async function uploadToStorage(buffer, storagePath, contentType) {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, buffer, { contentType, upsert: true });
  if (error) return null;
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

async function main() {
  const emlPath = 'C:\\Users\\chris\\Downloads\\Post - Op Inspection 17_09.eml';
  const source = fs.readFileSync(emlPath, 'utf8');

  // Extract base64 images
  const images = [];
  const boundaries = [];
  let bMatch;
  const boundaryRegex = /boundary="?([^";\s]+)"?/gi;
  while ((bMatch = boundaryRegex.exec(source)) !== null) boundaries.push(bMatch[1]);

  for (const boundary of boundaries) {
    const parts = source.split(`--${boundary}`);
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

  console.log(`Found ${images.length} images in email.`);

  // Upload images
  const photoUrls = [];
  const dateOnly = '2026-09-18';
  for (const img of images) {
    const url = await uploadToStorage(img.buffer, `client-preop/${dateOnly}/photos/${img.filename}`, 'image/jpeg');
    if (url) photoUrls.push(url);
  }

  // Extract only the text body to avoid sending 1M+ tokens of base64 images
  let textBody = '';
  const textBoundaryRegex = /Content-Type:\s*text\/plain[^>]*?\r\n\r\n([\s\S]*?)(\r\n--|_000_)/i;
  const match = source.match(textBoundaryRegex);
  if (match) {
    const rawBase64 = match[1].replace(/[\r\n\s]/g, '');
    try {
      textBody = Buffer.from(rawBase64, 'base64').toString('utf8');
    } catch(e) {
      textBody = match[1]; // fallback in case it's not base64
    }
  } else {
    // If regex fails, just chop off everything after the first image to save tokens
    textBody = source.split('image/jpeg')[0];
  }
  
  const prompt = `You are extracting data from an email containing a post-op / pre-op hygiene inspection report.
The email contains a list of areas (like Production, Packing) and bullet points of defects.
Convert this into our standard JSON format.
The defects should be marked as "fail" (compliance "U") or "reclean" (compliance "M"). The sender says they were "re-cleaned and sanitised unless otherwise noted", so mark them as "reclean" ("M"), except if they say they will "address it tonight" or "continue working on this", mark as "fail" ("U").
Format:
{
  "date": "2026-09-18",
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

  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
  const result = await model.generateContent([
    { text: prompt },
    { text: "EMAIL CONTENT:\n" + textBody }
  ]);
  
  let text = result.response.text().trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  const parsed = JSON.parse(text);

  // Map to submission
  const { data: templates } = await supabase.from('gotzinger_form_templates').select('*').eq('slug', 'daily-pre-op-fresh-meat').single();
  
  const responses = {};
  let scoreTotal = 0, scorePass = 0, scoreFail = 0, scoreReclean = 0;
  
  for (const area of parsed.areas) {
    for (const item of area.items) {
      const itemId = `auto_${crypto.randomUUID().substring(0,8)}`;
      let resultStr = 'pass';
      if (item.compliance === 'U') resultStr = 'fail';
      else if (item.compliance === 'M') resultStr = 'marginal';
      
      responses[itemId] = {
        result: resultStr,
        compliance: item.compliance,
        defect: item.defect,
        correctiveAction: item.correctiveAction,
        _label: item.label,
        _area: area.name
      };
      
      scoreTotal++;
      if (resultStr === 'pass') scorePass++;
      else if (resultStr === 'fail') scoreFail++;
      else if (resultStr === 'marginal') scoreReclean++;
    }
  }

  responses.global_photos = photoUrls;
  
  const sectionScores = {}; // We skip section scores for text dump
  const overallScore = scoreTotal > 0 ? Math.round(((scoreTotal - scoreFail) / scoreTotal) * 10000) / 100 : 0;

  const sub = {
    template_id: templates.id,
    template_slug: 'client-pre-op',
    template_name: 'Client Pre-Op (Gotzinger Internal)',
    submitted_by: 'shantelle',
    submitted_by_email: 'shantelle@mjhygiene.com.au',
    site: 'Gotzinger Smallgoods',
    area: 'Low Risk',
    responses,
    notes: 'Auto-ingested from email: "Post - Op Inspection 17/09"',
    status: 'submitted',
    submitted_at: '2026-09-18T05:00:00+10:00',
    score_total: scoreTotal,
    score_pass: scorePass,
    score_fail: scoreFail,
    score_reclean: scoreReclean,
    overall_score: overallScore
  };

  const { error } = await supabase.from('gotzinger_form_submissions').insert(sub);
  if (error) console.error(error);
  else console.log('Successfully inserted.');
}

main().catch(console.error);
