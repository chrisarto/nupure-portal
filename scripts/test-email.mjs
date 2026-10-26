import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true,
  auth: { user: 'noreply@rpfhygiene.com', pass: 'Shelly!49' },
});

const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Test Report Notification</title></head>
<body style="margin:0;padding:0;background:#eef2f7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:48px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(15,52,96,0.12);">
        <tr><td style="background:linear-gradient(150deg,#0f3460 0%,#16213e 60%,#0a1628 100%);padding:40px 44px 36px;">
          <div style="display:inline-block;background:rgba(0,180,216,0.18);border:1px solid rgba(0,180,216,0.4);border-radius:6px;padding:5px 12px;margin-bottom:20px;">
            <span style="color:#00b4d8;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">MJ Hygiene</span>
          </div>
          <h2 style="margin:0 0 6px;color:#fff;font-size:26px;font-weight:800;">Compliance Portal</h2>
          <p style="margin:0;color:#90e0ef;font-size:13px;">Report Notification Test</p>
        </td></tr>
        <tr><td style="height:5px;background:linear-gradient(90deg,#00b4d8,#0077b6,#023e8a);"></td></tr>
        <tr><td style="padding:48px 44px 40px;">
          <h1 style="margin:0 0 18px;color:#0f3460;font-size:22px;font-weight:700;">✅ Email notifications are working!</h1>
          <p style="margin:0 0 24px;color:#4a5568;font-size:15px;line-height:1.75;">This is a test of the MJ Hygiene Compliance Portal report notification system. When inspectors submit forms, a formatted report like this will be sent automatically to your configured recipient list.</p>
          
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
            <tr><td style="background:#f8fafc;padding:10px 16px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Sample Report Summary</td></tr>
            <tr><td style="padding:16px;">
              <table width="100%">
                <tr>
                  <td align="center" style="border-right:1px solid #e2e8f0;padding:12px;">
                    <div style="font-size:36px;font-weight:900;color:#16a34a;">94.5%</div>
                    <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;margin-top:4px;">Overall Score</div>
                  </td>
                  <td align="center" style="border-right:1px solid #e2e8f0;padding:12px;">
                    <div style="font-size:28px;font-weight:800;color:#16a34a;">85</div>
                    <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;margin-top:4px;">Pass</div>
                  </td>
                  <td align="center" style="border-right:1px solid #e2e8f0;padding:12px;">
                    <div style="font-size:28px;font-weight:800;color:#d97706;">7</div>
                    <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;margin-top:4px;">Re-Clean</div>
                  </td>
                  <td align="center" style="padding:12px;">
                    <div style="font-size:28px;font-weight:800;color:#dc2626;">3</div>
                    <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;margin-top:4px;">Fail</div>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>

          <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="border-radius:10px;background:linear-gradient(135deg,#00b4d8,#0077b6);box-shadow:0 4px 14px rgba(0,119,182,0.35);">
              <a href="https://rpfhygiene.com/dashboard" style="display:inline-block;padding:18px 44px;color:#fff;font-size:16px;font-weight:700;text-decoration:none;border-radius:10px;">View Full Report &rarr;</a>
            </td></tr>
          </table>

          <div style="background:#f0f9ff;border-radius:10px;padding:18px 22px;border-left:5px solid #00b4d8;">
            <p style="margin:0;color:#4a5568;font-size:13px;line-height:1.65;"><strong style="color:#0f3460;">📧 Notification system active:</strong> Configure recipient lists at Admin → Email Settings in the portal.</p>
          </div>
        </td></tr>
        <tr><td style="background:#f7f9fc;padding:28px 44px;border-top:1px solid #e8edf5;text-align:center;">
          <p style="margin:0 0 6px;color:#a0aec0;font-size:12px;">Sent to <strong style="color:#718096;">chris@mjhygiene.com.au</strong></p>
          <p style="margin:0;color:#a0aec0;font-size:12px;"><strong style="color:#4a5568;">MJ Hygiene Compliance Portal</strong> &bull; <a href="https://rpfhygiene.com" style="color:#0077b6;text-decoration:none;">rpfhygiene.com</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

try {
  await transporter.sendMail({
    from: '"MJ Hygiene Compliance Portal" <noreply@rpfhygiene.com>',
    to: 'chris@mjhygiene.com.au',
    subject: '[Test] MJ Hygiene Compliance Portal — Email Notification System',
    html,
  });
  console.log('✅ Report notification test email sent successfully to chris@mjhygiene.com.au');
} catch (err) {
  console.error('❌ Failed:', err.message);
}
