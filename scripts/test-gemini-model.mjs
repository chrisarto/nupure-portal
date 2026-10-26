import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const envPath = path.join(rootDir, '.env.local');
const content = fs.readFileSync(envPath, 'utf8');
content.split(/\r?\n/).forEach(line => {
  const m = line.match(/^([^#=][^=]*)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].replace(/^["']|["']$/g, '').trim();
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testModel(modelName) {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    const res = await model.generateContent('Hello');
    console.log(`✓ Model "${modelName}" SUCCESS:`, res.response.text().trim());
  } catch (err) {
    console.error(`✗ Model "${modelName}" FAILED:`, err.message);
  }
}

async function main() {
  await testModel('gemini-3.5-flash-lite');
  await testModel('gemini-2.0-flash');
  await testModel('gemini-1.5-flash');
}

main();
