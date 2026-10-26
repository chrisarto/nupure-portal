import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

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
  console.log('Sending custom email to Indy...');
  
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
      <p>Hi Indy,</p>
      <p>The new <strong>MJ Hygiene Compliance Portal</strong> for Real Pet Food is now live and ready for you to access.</p>
      
      <p>Your account has been fully set up. You can log in using your email address and the following password:</p>
      
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
        <strong style="font-size: 20px; color: #0f3460; font-family: monospace;">BetterHygiene 911</strong>
      </div>

      <div style="text-align: center; margin: 32px 0;">
        <a href="https://rpfhygiene.com/login" style="background: #00ccff; color: #0a0e1a; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Go to Portal Login</a>
      </div>

      <p>This portal gives you direct, real-time access to:</p>
      <ul style="margin-bottom: 24px;">
        <li>Staff Training Matrix & Records</li>
        <li>WMS Procedure Lookup</li>
        <li>Master Sanitation Schedule</li>
        <li>Digital Form Inspections & Reports</li>
      </ul>

      <h3 style="color: #0f3460; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">How it works</h3>
      <p>The portal automatically syncs with the master Airtable database every 30 minutes, so your team's training records and schedules are always up to date.</p>

      <h3 style="color: #0f3460; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Need Help?</h3>
      <p>We've prepared a comprehensive User Manual that covers everything from tracking compliance to managing users. You can access it anytime from the bottom of the navigation menu in the portal.</p>

      <p style="margin-top: 32px;">Regards,<br><strong>Chris & the MJ Hygiene Team</strong></p>
    </div>
  </div>
</body>
</html>
  `;

  await transporter.sendMail({
    from: '"MJ Hygiene Compliance Portal" <' + (process.env.EMAIL_FROM || 'noreply@rpfhygiene.com') + '>',
    to: 'indy@mjhygiene.com.au',
    subject: 'Welcome to the RPF Compliance Portal - Login Details',
    html: html,
  });

  console.log('Email sent successfully!');
}

main().catch(console.error);
