import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 465),
  secure: Number(process.env.SMTP_PORT || 465) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Please provide an email address as the first argument.');
    process.exit(1);
  }

  // Extract first name from email (e.g. chris@... -> Chris)
  const nameParts = email.split('@')[0].split(/[._-]/);
  const firstName = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
  
  console.log(`Generating password recovery link for ${email}...`);
  let data = null;
  const res = await supabase.auth.admin.generateLink({
    type: 'recovery',
    email: email,
  });

  if (res.error) {
    if (res.error.code === 'user_not_found' || res.error.message.includes('not found')) {
      console.log('User not found, generating invite link instead...');
      const inviteRes = await supabase.auth.admin.generateLink({
        type: 'invite',
        email: email,
      });
      if (inviteRes.error) {
         console.error('Invite error:', inviteRes.error);
         process.exit(1);
      }
      data = inviteRes.data;
    } else {
      console.error('Error generating link:', res.error);
      process.exit(1);
    }
  } else {
    data = res.data;
  }

  // Encode the action link and wrap it in our intermediate page
  // This prevents enterprise email scanners from automatically following the link and consuming the single-use token.
  const rawActionLink = data.properties.action_link;
  const actionLink = `https://rpfhygiene.com/auth-verify?url=${encodeURIComponent(rawActionLink)}`;
  console.log('Link generated successfully.');

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; background: #f1f5f9; padding: 32px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <div style="background: #0f3460; padding: 24px; color: white; text-align: center;">
      <img src="https://rpfhygiene.com/images/mj-hygiene-logo.png" alt="MJ Hygiene Logo" style="height: 60px; margin-bottom: 16px;">
      <h1 style="margin: 0; font-size: 24px;">Welcome to the RPF Compliance Portal</h1>
    </div>
    <div style="padding: 32px; color: #1e293b; line-height: 1.6;">
      <p>Hi ${firstName},</p>
      <p>The new <strong>MJ Hygiene Compliance Portal</strong> for Real Pet Food is now live and ready for you to access.</p>
      
      <p>This portal gives you direct, real-time access to:</p>
      <ul style="margin-bottom: 24px;">
        <li>Staff Training Matrix & Records</li>
        <li>WMS Procedure Lookup</li>
        <li>Master Sanitation Schedule</li>
        <li>Digital Form Inspections & Reports</li>
      </ul>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${actionLink}" style="background: #00ccff; color: #0a0e1a; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Set Your Password & Log In</a>
      </div>

      <h3 style="color: #0f3460; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">How it works</h3>
      <p>The portal automatically syncs with the master Airtable database every 30 minutes, so your team's training records and schedules are always up to date. You can also trigger a manual sync directly from the Dashboard if needed.</p>

      <h3 style="color: #0f3460; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Need Help?</h3>
      <p>We've prepared a comprehensive User Manual that covers everything from tracking compliance to managing users. You can access it anytime from the bottom of the navigation menu in the portal, or via the direct links below:</p>
      <ul>
        <li><a href="https://rpfhygiene.com/manual.html" style="color: #0099cc;">View Interactive Manual</a></li>
        <li><a href="https://rpfhygiene.com/manual.pdf" style="color: #0099cc;">Download PDF Manual</a></li>
      </ul>

      <p style="margin-top: 32px;">Regards,<br><strong>Chris & the MJ Hygiene Team</strong></p>
    </div>
  </div>
</body>
</html>
  `;

  console.log('Sending email...');
  await transporter.sendMail({
    from: '"MJ Hygiene Compliance Portal" <' + (process.env.EMAIL_FROM || 'noreply@rpfhygiene.com') + '>',
    to: email,
    subject: 'Welcome to the RPF Compliance Portal',
    html: html,
  });

  console.log('Email sent successfully!');
}

main().catch(console.error);
