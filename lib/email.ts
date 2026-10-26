import nodemailer from 'nodemailer';

export interface EmailRecipient {
  name: string;
  email: string;
}

export interface ReportEmailData {
  templateName: string;
  submittedBy: string;
  submittedAt: string;
  area?: string;
  overallScore: number | null;
  scorePass: number;
  scoreFail: number;
  scoreReclean: number;
  scoreTotal: number;
  failItems: Array<{ label: string; section: string; comment?: string }>;
  recleanItems: Array<{ label: string; section: string; comment?: string }>;
  reportUrl: string;
  submissionId: string;
  pdfBuffer?: Buffer;
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 465),
  secure: Number(process.env.SMTP_PORT ?? 465) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function scoreColor(score: number | null): string {
  if (score === null) return '#64748b';
  if (score >= 95) return '#16a34a';
  if (score >= 85) return '#0284c7';
  if (score >= 70) return '#d97706';
  return '#dc2626';
}

function scoreLabel(score: number | null): string {
  if (score === null) return 'Not scored';
  if (score >= 95) return 'Excellent';
  if (score >= 85) return 'Good';
  if (score >= 70) return 'Needs Attention';
  return 'Action Required';
}

function buildProgressBar(score: number): string {
  const filled = Math.round(score / 5); // 20 blocks total
  const empty = 20 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export function buildReportEmailHtml(data: ReportEmailData): string {
  const color = scoreColor(data.overallScore);
  const label = scoreLabel(data.overallScore);
  const bar = data.overallScore !== null ? buildProgressBar(data.overallScore) : '';
  const formattedDate = new Date(data.submittedAt).toLocaleDateString('en-AU', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const issueRows = [
    ...data.failItems.map(i => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #fee2e2;">
          <span style="display:inline-block;background:#fef2f2;color:#dc2626;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;margin-right:8px;">FAIL</span>
          <strong>${i.label}</strong>${i.section ? ` <span style="color:#64748b;font-size:12px;">— ${i.section}</span>` : ''}
          ${i.comment ? `<br><span style="color:#64748b;font-size:12px;margin-left:60px;">${i.comment}</span>` : ''}
        </td>
      </tr>`),
    ...data.recleanItems.map(i => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #fef9c3;">
          <span style="display:inline-block;background:#fefce8;color:#ca8a04;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;margin-right:8px;">RE-CLEAN</span>
          <strong>${i.label}</strong>${i.section ? ` <span style="color:#64748b;font-size:12px;">— ${i.section}</span>` : ''}
          ${i.comment ? `<br><span style="color:#64748b;font-size:12px;margin-left:80px;">${i.comment}</span>` : ''}
        </td>
      </tr>`),
  ].join('');

  const issueSection = (data.failItems.length + data.recleanItems.length) > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <tr><td style="background:#f8fafc;padding:10px 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#475569;">⚠️ Issues Requiring Attention</td></tr>
      ${issueRows}
    </table>` : `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr><td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;text-align:center;color:#16a34a;font-weight:600;">✓ No issues found — all items passed</td></tr>
    </table>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Compliance Report — ${data.templateName}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- HEADER -->
        <tr><td style="background:linear-gradient(135deg,#0f3460,#1a5276);border-radius:12px 12px 0 0;padding:28px 32px;">
          <table width="100%"><tr>
            <td>
              <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">MJ Hygiene</div>
              <div style="font-size:13px;color:#94d2e8;letter-spacing:0.05em;margin-top:2px;">COMPLIANCE PORTAL</div>
            </td>
            <td align="right">
              <div style="background:rgba(255,255,255,0.15);border-radius:8px;padding:8px 14px;display:inline-block;">
                <div style="font-size:11px;color:#94d2e8;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;">Report Type</div>
                <div style="font-size:14px;color:#fff;font-weight:700;margin-top:2px;">${data.templateName}</div>
              </div>
            </td>
          </tr></table>
        </td></tr>

        <!-- BODY -->
        <tr><td style="background:#ffffff;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">

          <!-- Meta info -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr>
              <td style="padding:10px 14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
                <table width="100%"><tr>
                  <td><div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Inspector</div><div style="font-size:15px;font-weight:600;color:#0f172a;margin-top:2px;">${data.submittedBy}</div></td>
                  <td><div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Date &amp; Time</div><div style="font-size:15px;font-weight:600;color:#0f172a;margin-top:2px;">${formattedDate}</div></td>
                  ${data.area ? `<td><div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Area</div><div style="font-size:15px;font-weight:600;color:#0f172a;margin-top:2px;">${data.area}</div></td>` : ''}
                </tr></table>
              </td>
            </tr>
          </table>

          <!-- Score block -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;text-align:center;">
              <div style="font-size:48px;font-weight:900;color:${color};line-height:1;">${data.overallScore !== null ? `${data.overallScore}%` : '—'}</div>
              <div style="font-size:14px;font-weight:700;color:${color};margin-top:4px;">${label}</div>
              <div style="font-size:18px;color:${color};letter-spacing:2px;margin:10px 0;font-family:monospace;">${bar}</div>
              <table width="100%" style="margin-top:12px;"><tr>
                <td align="center" style="border-right:1px solid #e2e8f0;">
                  <div style="font-size:24px;font-weight:800;color:#16a34a;">${data.scorePass}</div>
                  <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Pass</div>
                </td>
                <td align="center" style="border-right:1px solid #e2e8f0;">
                  <div style="font-size:24px;font-weight:800;color:#d97706;">${data.scoreReclean}</div>
                  <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Re-Clean</div>
                </td>
                <td align="center">
                  <div style="font-size:24px;font-weight:800;color:#dc2626;">${data.scoreFail}</div>
                  <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;">Fail</div>
                </td>
              </tr></table>
            </td></tr>
          </table>

          <!-- Issues -->
          ${issueSection}

          <!-- CTA buttons -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding-right:8px;">
                <a href="${data.reportUrl}" style="display:block;background:#0f3460;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;text-align:center;">View Full Report →</a>
              </td>
              <td align="center" style="padding-left:8px;">
                <a href="${data.reportUrl.replace('/reports/submissions/', '/api/forms/submissions/')}/pdf" style="display:block;background:#f8fafc;color:#0f3460;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;font-size:15px;text-align:center;border:1px solid #e2e8f0;">Download PDF</a>
              </td>
            </tr>
          </table>

        </td></tr>

        <!-- FOOTER -->
        <tr><td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;">
          <p style="color:#94a3b8;font-size:12px;margin:0;">This email was sent automatically by the MJ Hygiene Compliance Portal.<br>Do not reply to this email.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendReportEmail(
  recipients: EmailRecipient[],
  data: ReportEmailData,
): Promise<{ success: boolean; error?: string }> {
  if (!recipients.length) return { success: true };

  const html = buildReportEmailHtml(data);
  const scoreText = data.overallScore !== null ? `${data.overallScore}% — ` : '';
  const subject = `[Compliance Report] ${scoreText}${data.templateName} — ${new Date(data.submittedAt).toLocaleDateString('en-AU')}`;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? 'noreply@nupure.tmservices.cloud',
      to: recipients.map(r => r.name ? `${r.name} <${r.email}>` : r.email).join(', '),
      subject,
      html,
    });
    return { success: true };
  } catch (err) {
    console.error('[email] Send failed:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function sendTestEmail(
  to: string,
  toName?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? 'noreply@nupure.tmservices.cloud',
      to: toName ? `${toName} <${to}>` : to,
      subject: 'MJ Hygiene Compliance Portal — Test Email',
      html: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:32px;">
        <h2 style="color:#0f3460;">✅ Email Configuration Working</h2>
        <p>This is a test email from the <strong>MJ Hygiene Compliance Portal</strong>.</p>
        <p>Your email notification settings are correctly configured. You will receive report notifications at this address.</p>
        <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
        <p style="color:#94a3b8;font-size:12px;">Sent from noreply@nupure.tmservices.cloud via smtp.hostinger.com</p>
      </body></html>`,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function sendInviteEmail(
  email: string,
  inviteUrl: string,
): Promise<{ success: boolean; error?: string }> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nupure.tmservices.cloud';
  const logoUrl = `${siteUrl}/logo.png`;
  const year = new Date().getFullYear();

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? 'MJ Hygiene <noreply@nupure.tmservices.cloud>',
      to: email,
      subject: "You're invited — Nu-Pure Compliance Portal",
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Portal Invitation</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f0f2f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;">

        <!-- LOGO BAR -->
        <tr><td align="center" style="padding:0 0 32px 0;">
          <img src="${logoUrl}" alt="MJ Hygiene" width="160" style="display:block;max-width:160px;height:auto;" />
        </td></tr>

        <!-- MAIN CARD -->
        <tr><td style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08),0 4px 12px rgba(0,0,0,0.04);">

          <!-- ACCENT BAR -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="height:4px;background:#0077b6;"></td>
            </tr>
          </table>

          <!-- BODY CONTENT -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:40px 40px 32px;">
            <tr><td>

              <!-- BADGE -->
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:24px;">
                <tr><td style="background:#e8f4f8;border-radius:20px;padding:6px 16px;">
                  <span style="font-size:12px;font-weight:700;color:#0077b6;text-transform:uppercase;letter-spacing:0.08em;">Nu-Pure</span>
                </td></tr>
              </table>

              <h1 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#111827;line-height:1.3;">You've been invited to the Compliance Portal</h1>

              <p style="margin:0 0 28px;font-size:15px;line-height:1.7;color:#4b5563;">
                Your account has been created on the MJ Hygiene Compliance Portal for Nu-Pure. Click below to set your password and get started.
              </p>

              <!-- CTA BUTTON -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr><td align="center">
                  <table cellpadding="0" cellspacing="0" role="presentation">
                    <tr><td style="background:#0077b6;border-radius:10px;">
                      <a href="${inviteUrl}" target="_blank" style="display:inline-block;background:#0077b6;border-radius:10px;padding:14px 48px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;letter-spacing:0.02em;text-align:center;">
                        Get Started &#8594;
                      </a>
                    </td></tr>
                  </table>
                </td></tr>
              </table>

              <!-- EXPIRY NOTE -->
              <p style="margin:28px 0 0;font-size:13px;color:#9ca3af;text-align:center;">
                This invitation link expires in 24 hours.
              </p>

            </td></tr>
          </table>

          <!-- DIVIDER -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:0 40px;">
            <tr><td style="border-top:1px solid #f0f0f0;"></td></tr>
          </table>

          <!-- SECURITY NOTE -->
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="padding:20px 40px 28px;">
            <tr><td>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
                <strong style="color:#6b7280;">Didn't expect this email?</strong> You can safely ignore it. This invitation was sent by an administrator at MJ Hygiene. Never share your login credentials with anyone.
              </p>
            </td></tr>
          </table>

        </td></tr>

        <!-- FOOTER -->
        <tr><td style="padding:28px 16px;text-align:center;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#6b7280;">MJ Hygiene — Nu-Pure</p>
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            <a href="${siteUrl}" style="color:#0077b6;text-decoration:none;">${siteUrl.replace('https://', '')}</a>
          </p>
          <p style="margin:12px 0 0;font-size:11px;color:#d1d5db;">&copy; ${year} MJ Hygiene. All rights reserved.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });
    return { success: true };
  } catch (err) {
    console.error('[email] Invite send failed:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}


/* ═══════════════════════════════════════════════════════════════
   Nu-Pure Stocktake Consumable Order Email
   ═══════════════════════════════════════════════════════════════ */

export interface StocktakeOrderEmailData {
  orderNumber: string;
  stocktakeDate: string;
  conductedBy: string;
  urgency: string;
  notes?: string;
  items: Array<{
    category: string;
    item_name: string;
    unit: string;
    par_level: number;
    current_stock: number;
    order_qty: number;
  }>;
  reportUrl: string;
}

export async function sendStocktakeOrderEmail(
  recipients: string[],
  data: StocktakeOrderEmailData,
): Promise<{ success: boolean; error?: string }> {
  const cleanEmails = recipients.map(e => e.trim()).filter(Boolean);
  if (cleanEmails.length === 0) return { success: true };

  const orderedItems = data.items.filter(i => i.order_qty > 0);
  const rowsHtml = (orderedItems.length > 0 ? orderedItems : data.items)
    .map(
      i => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;">${i.category}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#0f172a;">${i.item_name}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;text-align:center;">${i.par_level} ${i.unit}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;text-align:center;">${i.current_stock} ${i.unit}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;font-weight:800;color:${i.order_qty > 0 ? '#0284c7' : '#64748b'};text-align:center;">${i.order_qty} ${i.unit}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Consumable Stocktake & Order — ${data.orderNumber}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:linear-gradient(135deg,#0f3460,#0284c7);padding:26px 32px;color:#ffffff;">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#bae6fd;">MJ Hygiene — Nu-Pure Beverages (Stapylton)</div>
          <div style="font-size:22px;font-weight:800;margin-top:4px;">Consumable Stocktake &amp; Requisition Order</div>
          <div style="font-size:13px;color:#e0f2fe;margin-top:4px;">Order Ref: <strong>${data.orderNumber}</strong> &bull; ${data.urgency}</div>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;">
            <tr>
              <td><div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;">Conducted By</div><div style="font-size:14px;font-weight:700;color:#0f172a;margin-top:2px;">${data.conductedBy}</div></td>
              <td><div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;">Stocktake Date</div><div style="font-size:14px;font-weight:700;color:#0f172a;margin-top:2px;">${data.stocktakeDate}</div></td>
              <td><div style="font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700;">Lines to Order</div><div style="font-size:14px;font-weight:800;color:#0284c7;margin-top:2px;">${orderedItems.length} item(s)</div></td>
            </tr>
          </table>

          ${data.notes ? `<div style="margin-bottom:20px;padding:12px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:13px;color:#92400e;"><strong>Notes / Delivery Instructions:</strong> ${data.notes}</div>` : ''}

          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px;">
            <thead>
              <tr style="background:#f8fafc;">
                <th align="left" style="padding:10px 12px;font-size:11px;text-transform:uppercase;color:#475569;border-bottom:1px solid #e2e8f0;">Category</th>
                <th align="left" style="padding:10px 12px;font-size:11px;text-transform:uppercase;color:#475569;border-bottom:1px solid #e2e8f0;">Consumable Item</th>
                <th align="center" style="padding:10px 12px;font-size:11px;text-transform:uppercase;color:#475569;border-bottom:1px solid #e2e8f0;">Par Level</th>
                <th align="center" style="padding:10px 12px;font-size:11px;text-transform:uppercase;color:#475569;border-bottom:1px solid #e2e8f0;">On Hand</th>
                <th align="center" style="padding:10px 12px;font-size:11px;text-transform:uppercase;color:#0284c7;border-bottom:1px solid #e2e8f0;">Order Qty</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          <div style="text-align:center;">
            <a href="${data.reportUrl}" style="display:inline-block;background:#0f3460;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;">View &amp; Print Order in Portal →</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? 'MJ Hygiene — Nu-Pure Portal <noreply@nupure.tmservices.cloud>',
      to: cleanEmails.join(', '),
      subject: `[Nu-Pure Consumable Order ${data.orderNumber}] Stocktake Requisition — ${data.stocktakeDate}`,
      html,
    });
    return { success: true };
  } catch (err) {
    console.error('[email] Stocktake order email failed:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/* ═══════════════════════════════════════════════════════════════
   Nu-Pure QR Code Issue Alert & Completion Report Emails
   ═══════════════════════════════════════════════════════════════ */

export interface QrIssueEmailData {
  actionNumber: string;
  zone: string;
  area: string;
  category: string;
  priority: string;
  description: string;
  reportedByName?: string;
  reportedByEmail?: string;
  reportedByPhone?: string;
  createdAt: string;
  completedBy?: string;
  completedAt?: string;
  resolutionNotes?: string;
  reportUrl: string;
  pdfBuffer?: Buffer;
}

export async function sendQrIssueAlertEmail(
  recipients: string[],
  data: QrIssueEmailData,
): Promise<{ success: boolean; error?: string }> {
  const cleanEmails = recipients.map(e => e.trim()).filter(Boolean);
  if (cleanEmails.length === 0) return { success: true };

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="600" cellpadding="0" cellspacing="0" align="center" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #fecaca;">
    <tr><td style="background:#dc2626;padding:22px 28px;color:#ffffff;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#fee2e2;">Nu-Pure QR Code Issue Logged — Required Action</div>
      <div style="font-size:20px;font-weight:800;margin-top:4px;">${data.actionNumber}: ${data.area} (${data.zone})</div>
    </td></tr>
    <tr><td style="padding:26px 28px;">
      <p style="margin:0 0 16px;font-size:14px;color:#334155;">A new cleaning/hygiene issue has been reported via site QR code and logged as a <strong>Required Action</strong>.</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;font-size:13px;">
        <tr><td style="color:#64748b;font-weight:700;width:140px;">Zone / Room:</td><td style="color:#0f172a;font-weight:700;">${data.zone} — ${data.area}</td></tr>
        <tr><td style="color:#64748b;font-weight:700;">Category:</td><td style="color:#0f172a;">${data.category}</td></tr>
        <tr><td style="color:#64748b;font-weight:700;">Priority:</td><td style="color:#dc2626;font-weight:700;">${data.priority}</td></tr>
        <tr><td style="color:#64748b;font-weight:700;">Reported By:</td><td style="color:#0f172a;">${data.reportedByName || 'Site Scan'} ${data.reportedByEmail ? `(${data.reportedByEmail})` : ''} ${data.reportedByPhone ? `• ${data.reportedByPhone}` : ''}</td></tr>
        <tr><td style="color:#64748b;font-weight:700;">Issue Details:</td><td style="color:#0f172a;">${data.description}</td></tr>
      </table>
      <div style="text-align:center;">
        <a href="${data.reportUrl}" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:8px;font-weight:700;font-size:14px;">Action &amp; Resolve Issue in Portal →</a>
      </div>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? 'MJ Hygiene — Nu-Pure Portal <noreply@nupure.tmservices.cloud>',
      to: cleanEmails.join(', '),
      subject: `[Required Action ${data.actionNumber}] QR Issue Reported — ${data.area} (${data.priority})`,
      html,
    });
    return { success: true };
  } catch (err) {
    console.error('[email] QR issue alert email failed:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function sendQrIssueCompletionEmail(
  recipients: string[],
  data: QrIssueEmailData,
): Promise<{ success: boolean; error?: string }> {
  const cleanEmails = [...new Set(recipients.map(e => e.trim()).filter(Boolean))];
  if (cleanEmails.length === 0) return { success: true };

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="600" cellpadding="0" cellspacing="0" align="center" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #bbf7d0;">
    <tr><td style="background:#16a34a;padding:22px 28px;color:#ffffff;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#dcfce7;">Issue Completion Report — Closed Out</div>
      <div style="font-size:20px;font-weight:800;margin-top:4px;">${data.actionNumber}: ${data.area} (${data.zone})</div>
    </td></tr>
    <tr><td style="padding:26px 28px;">
      <p style="margin:0 0 16px;font-size:14px;color:#334155;">The required action raised for <strong>${data.area}</strong> has been rectified, verified, and formally closed out by MJ Hygiene.</p>
      <table width="100%" cellpadding="8" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;font-size:13px;">
        <tr><td style="color:#64748b;font-weight:700;width:150px;">Action Number:</td><td style="color:#0f172a;font-weight:700;">${data.actionNumber}</td></tr>
        <tr><td style="color:#64748b;font-weight:700;">Zone / Room:</td><td style="color:#0f172a;font-weight:700;">${data.zone} — ${data.area}</td></tr>
        <tr><td style="color:#64748b;font-weight:700;">Original Issue:</td><td style="color:#0f172a;">${data.description}</td></tr>
        <tr><td style="color:#64748b;font-weight:700;">Completed By:</td><td style="color:#16a34a;font-weight:700;">${data.completedBy || 'MJ Hygiene Team'}</td></tr>
        <tr><td style="color:#64748b;font-weight:700;">Corrective Action:</td><td style="color:#0f172a;">${data.resolutionNotes || 'Completed and sanitised to specification.'}</td></tr>
      </table>
      <div style="text-align:center;">
        <a href="${data.reportUrl}" style="display:inline-block;background:#0f3460;color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:8px;font-weight:700;font-size:14px;">View Official Completion Report →</a>
      </div>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? 'MJ Hygiene — Nu-Pure Portal <noreply@nupure.tmservices.cloud>',
      to: cleanEmails.join(', '),
      subject: `[Completion Report ${data.actionNumber}] Issue Resolved & Closed — ${data.area}`,
      html,
      attachments: data.pdfBuffer
        ? [
            {
              filename: `${data.actionNumber}-Completion-Report.pdf`,
              content: data.pdfBuffer,
              contentType: 'application/pdf',
            },
          ]
        : undefined,
    });
    return { success: true };
  } catch (err) {
    console.error('[email] QR issue completion email failed:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/* ═══════════════════════════════════════════════════════════════
   Nu-Pure Daily Cleaning Completion Report PDF Email
   ═══════════════════════════════════════════════════════════════ */

export interface DailyCompletionEmailData {
  date: string;
  completedRoomsCount: number;
  scheduledRoomsCount: number;
  totalMinutes: number;
  reportUrl: string;
  pdfUrl: string;
  pdfBuffer: Buffer;
}

export async function sendDailyCompletionReportEmail(
  recipients: string[],
  data: DailyCompletionEmailData,
): Promise<{ success: boolean; error?: string }> {
  const cleanEmails = [...new Set(recipients.map(e => e.trim()).filter(Boolean))];
  if (cleanEmails.length === 0) return { success: true };

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="620" cellpadding="0" cellspacing="0" align="center" style="max-width:620px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1;">
    <tr><td style="background:linear-gradient(135deg,#0f3460,#0284c7);padding:24px 30px;color:#ffffff;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#bae6fd;">MJ Hygiene Services • Nu-Pure Beverages (Stapylton)</div>
      <div style="font-size:21px;font-weight:800;margin-top:4px;">Daily Cleaning Completion Report (PDF Attached)</div>
      <div style="font-size:13px;color:#e0f2fe;margin-top:4px;">Shift Date: <strong>${data.date}</strong> • Ref: <strong>DCR-${data.date.replace(/-/g, '')}</strong></div>
    </td></tr>
    <tr><td style="padding:26px 30px;">
      <p style="margin:0 0 18px;font-size:14px;color:#334155;">Please find attached the official <strong>Daily Cleaning Completion Report PDF</strong> for the Nu-Pure Beverages Stapylton facility for <strong>${data.date}</strong>.</p>
      <table width="100%" cellpadding="10" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:22px;font-size:13px;">
        <tr><td style="color:#64748b;font-weight:700;width:180px;">Shift Date:</td><td style="color:#0f172a;font-weight:700;">${data.date}</td></tr>
        <tr><td style="color:#64748b;font-weight:700;">Rooms Completed:</td><td style="color:#16a34a;font-weight:800;">${data.completedRoomsCount} of ${data.scheduledRoomsCount} Scheduled Rooms</td></tr>
        <tr><td style="color:#64748b;font-weight:700;">Total Cleaning Duration:</td><td style="color:#0f172a;font-weight:700;">${data.totalMinutes} mins (${(data.totalMinutes / 60).toFixed(1)} hrs)</td></tr>
        <tr><td style="color:#64748b;font-weight:700;">PDF Attachment:</td><td style="color:#0284c7;font-weight:700;">Nu-Pure-Daily-Completion-Report-${data.date}.pdf</td></tr>
      </table>
      <div style="text-align:center;">
        <a href="${data.reportUrl}" style="display:inline-block;background:#0f3460;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;margin-right:8px;">View Report in Portal →</a>
        <a href="${data.pdfUrl}" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:700;font-size:14px;">Download PDF Direct →</a>
      </div>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM ?? 'MJ Hygiene — Nu-Pure Portal <noreply@nupure.tmservices.cloud>',
      to: cleanEmails.join(', '),
      subject: `[Daily Cleaning Completion Report] Nu-Pure Beverages — ${data.date}`,
      html,
      attachments: [
        {
          filename: `Nu-Pure-Daily-Completion-Report-${data.date}.pdf`,
          content: data.pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });
    return { success: true };
  } catch (err) {
    console.error('[email] Daily completion PDF email failed:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
