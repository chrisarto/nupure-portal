import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const brainDir = String.raw`C:\Users\chris\.gemini\antigravity\brain\b1635e90-7201-48ad-89f5-3830ebaaeb12\scratch\imap-scraper`;

const pdfsDir = path.join(brainDir, 'historical_pdfs');
const files = fs.readdirSync(pdfsDir).filter(f => f.endsWith('.pdf'));

for (const file of files.slice(0, 30)) {
  const pdfPath = path.join(pdfsDir, file);
  const out = spawnSync('python', [path.join(__dirname, 'parse_pdf_live.py'), pdfPath]);
  try {
    const res = JSON.parse(out.stdout.toString());
    console.log(`${file} => ${res.formType}`);
  } catch(e) {
    console.log(`${file} => ERROR`, out.stderr.toString());
  }
}
