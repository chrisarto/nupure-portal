import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ImapFlow } from 'imapflow';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const envPath = path.join(rootDir, '.env.local');
const content = fs.readFileSync(envPath, 'utf8');
content.split(/\r?\n/).forEach(line => {
  const m = line.match(/^([^#=][^=]*)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].replace(/^["']|["']$/g, '').trim();
});

const IMAP_HOST = process.env.IMAP_HOST || 'imap.hostinger.com';
const IMAP_PORT = Number(process.env.IMAP_PORT || 993);
const IMAP_USER = process.env.IMAP_USER || 'reportlink@mj-gotzinger-hygiene.com';
const IMAP_PASS = process.env.IMAP_PASS || 'Shelly!49';

async function main() {
  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: IMAP_USER, pass: IMAP_PASS },
    logger: false
  });

  await client.connect();
  console.log('Connected to IMAP.');

  const lock = await client.getMailboxLock('INBOX');
  try {
    const uids = await client.search({ since: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) });
    console.log(`Total emails in last 7 days: ${uids.length}`);

    for (const uid of uids) {
      const msg = await client.fetchOne(uid, { envelope: true, flags: true });
      const sender = msg.envelope?.from?.[0]?.address || '';
      const subject = msg.envelope?.subject || '';
      const date = msg.envelope?.date;
      const flags = Array.from(msg.flags || []);

      console.log(`UID: ${uid} | Flags: [${flags.join(', ')}]`);
      console.log(`  Date: ${date}`);
      console.log(`  From: ${sender}`);
      console.log(`  Subject: "${subject}"\n`);
    }
  } finally {
    lock.release();
  }
  await client.logout();
}

main().catch(console.error);
