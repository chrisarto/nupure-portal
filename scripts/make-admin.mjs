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

async function makeAdmin(email) {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error listing users:', error.message);
    return;
  }
  
  const user = data.users.find(u => u.email === email);
  if (!user) {
    console.log(`User not found: ${email}`);
    return;
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, role: 'admin' }
  });

  if (updateError) {
    console.error(`Error updating ${email}:`, updateError.message);
  } else {
    console.log(`Successfully made ${email} an admin!`);
  }
}

async function main() {
  await makeAdmin('mark.mclaughlan@mjhygiene.com.au');
  await makeAdmin('gavin@mjhygiene.com.au');
}

main().catch(console.error);
