import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import nodemailer from 'npm:nodemailer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthHookPayload {
  user: {
    id: string;
    email: string;
    user_metadata: Record<string, string>;
    app_metadata: Record<string, string>;
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type:
      | 'signup'
      | 'recovery'
      | 'magiclink'
      | 'email_change_new'
      | 'email_change_current'
      | 'reauthentication';
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

type EmailActionType = AuthHookPayload['email_data']['email_action_type'];

// ---------------------------------------------------------------------------
// SMTP Transporter
// ---------------------------------------------------------------------------

const transporter = nodemailer.createTransport({
  host: Deno.env.get('SMTP_HOST') ?? 'smtp.hostinger.com',
  port: Number(Deno.env.get('SMTP_PORT') ?? '465'),
  secure: true, // SSL on port 465
  auth: {
    user: Deno.env.get('SMTP_USER') ?? 'noreply@rpfhygiene.com',
    pass: Deno.env.get('SMTP_PASS'),
  },
});

// ---------------------------------------------------------------------------
// URL Builder
// ---------------------------------------------------------------------------

function buildActionUrl(
  siteUrl: string,
  tokenHash: string,
  actionType: EmailActionType,
  redirectTo: string,
): string {
  const base = siteUrl.replace(/\/$/, '');
  const encodedRedirect = encodeURIComponent(redirectTo);
  return `${base}/auth/v1/verify?token=${tokenHash}&type=${actionType}&redirect_to=${encodedRedirect}`;
}

// ---------------------------------------------------------------------------
// Subject Lines
// ---------------------------------------------------------------------------

function getSubject(actionType: EmailActionType): string {
  switch (actionType) {
    case 'signup':
      return 'Confirm your MJ Hygiene Compliance Portal account';
    case 'email_change_new':
    case 'email_change_current':
      return 'Confirm your MJ Hygiene Compliance Portal email change';
    case 'recovery':
      return 'Reset your MJ Hygiene Compliance Portal password';
    case 'magiclink':
      return 'Your MJ Hygiene Compliance Portal sign-in link';
    case 'reauthentication':
      return 'Confirm your MJ Hygiene Compliance Portal action';
    default:
      return 'Action required — MJ Hygiene Compliance Portal';
  }
}

// ---------------------------------------------------------------------------
// Content helpers
// ---------------------------------------------------------------------------

function getCtaLabel(actionType: EmailActionType): string {
  switch (actionType) {
    case 'signup':
    case 'email_change_new':
    case 'email_change_current':
      return 'Verify Email Address';
    case 'recovery':
      return 'Reset My Password';
    case 'magiclink':
      return 'Sign In Now';
    case 'reauthentication':
      return 'Confirm Action';
    default:
      return 'Continue';
  }
}

function getHeading(actionType: EmailActionType): string {
  switch (actionType) {
    case 'signup':
      return "You're almost in — verify your email";
    case 'email_change_new':
    case 'email_change_current':
      return 'Confirm your email address change';
    case 'recovery':
      return 'Password reset requested';
    case 'magiclink':
      return 'Here is your sign-in link';
    case 'reauthentication':
      return 'Confirm your identity';
    default:
      return 'Action required';
  }
}

function getBodyText(actionType: EmailActionType): string {
  switch (actionType) {
    case 'signup':
      return 'Welcome to MJ Hygiene Compliance Portal! Click the button below to verify your email address and activate your account. This link expires in 24 hours.';
    case 'email_change_new':
    case 'email_change_current':
      return 'We received a request to change the email address on your MJ Hygiene Compliance Portal account. Click the button below to confirm this change.';
    case 'recovery':
      return "We received a request to reset the password for your MJ Hygiene Compliance Portal account. Click the button below to choose a new password. If you didn't request this, you can safely ignore this email.";
    case 'magiclink':
      return 'Click the button below to sign in to your MJ Hygiene Compliance Portal account instantly — no password required. This link expires in 1 hour and can only be used once.';
    case 'reauthentication':
      return 'To confirm a sensitive action on your MJ Hygiene Compliance Portal account, please verify your identity by clicking the button below.';
    default:
      return 'Please click the button below to continue with your MJ Hygiene Compliance Portal account.';
  }
}

// ---------------------------------------------------------------------------
// MJ Hygiene HTML Email Template  (navy #0f3460 / teal #00b4d8)
// ---------------------------------------------------------------------------

function buildEmail(
  actionType: EmailActionType,
  actionUrl: string,
  recipientEmail: string,
): { subject: string; html: string } {
  const subject = getSubject(actionType);
  const ctaLabel = getCtaLabel(actionType);
  const heading = getHeading(actionType);
  const bodyText = getBodyText(actionType);
  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#eef2f7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#eef2f7;padding:48px 16px;">
    <tr>
      <td align="center">

        <!-- Email Card -->
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;
                      overflow:hidden;box-shadow:0 8px 32px rgba(15,52,96,0.12);">

          <!-- Header -->
        <tr>
          <td style="background:linear-gradient(150deg,#0f3460 0%,#16213e 60%,#0a1628 100%);padding:32px 44px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <img src="https://rpfhygiene.com/logo.png" alt="MJ Hygiene Compliance Portal" width="180" style="display:block;max-width:180px;height:auto;background:#fff;border-radius:10px;padding:8px 12px;" />
                </td>
                <td align="right" style="vertical-align:middle;">
                  <p style="margin:0;color:#90e0ef;font-size:12px;text-align:right;">Compliance Portal</p>
                  <p style="margin:4px 0 0;color:#90e0ef;font-size:11px;text-align:right;">Keeping workplaces safe &amp; compliant</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

          <!-- Gradient accent bar -->
          <tr>
            <td style="height:5px;background:linear-gradient(90deg,#00b4d8 0%,#0077b6 50%,#023e8a 100%);"></td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td style="padding:48px 44px 40px;">

              <h1 style="margin:0 0 18px;color:#0f3460;font-size:22px;font-weight:700;
                          line-height:1.35;letter-spacing:-0.2px;">
                ${heading}
              </h1>

              <p style="margin:0 0 36px;color:#4a5568;font-size:15px;line-height:1.75;">
                ${bodyText}
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:36px;">
                <tr>
                  <td style="border-radius:10px;
                             background:linear-gradient(135deg,#00b4d8 0%,#0077b6 100%);
                             box-shadow:0 4px 14px rgba(0,119,182,0.35);">
                    <a href="${actionUrl}"
                       style="display:inline-block;padding:18px 44px;color:#ffffff;
                              font-size:16px;font-weight:700;text-decoration:none;
                              border-radius:10px;letter-spacing:0.3px;">
                      ${ctaLabel} &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback URL -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#f7faff;border-radius:8px;padding:16px 20px;
                             border:1px solid #e2ecf8;">
                    <p style="margin:0 0 6px;color:#718096;font-size:12px;font-weight:600;
                               text-transform:uppercase;letter-spacing:0.8px;">
                      Or copy this link
                    </p>
                    <p style="margin:0;word-break:break-all;">
                      <a href="${actionUrl}"
                         style="color:#0077b6;font-size:13px;text-decoration:underline;
                                line-height:1.5;">
                        ${actionUrl}
                      </a>
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- ── Security Notice ── -->
          <tr>
            <td style="padding:0 44px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:#f0f9ff;border-radius:10px;padding:18px 22px;
                             border-left:5px solid #00b4d8;">
                    <p style="margin:0;color:#4a5568;font-size:13px;line-height:1.65;">
                      <strong style="color:#0f3460;">&#128274; Security reminder:</strong>&nbsp;
                      This link is unique to this request and will expire shortly.
                      Never share it. MJ Hygiene staff will <em>never</em> ask you for this link.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="background:#f7f9fc;padding:28px 44px;border-top:1px solid #e8edf5;">
              <p style="margin:0 0 6px;color:#a0aec0;font-size:12px;text-align:center;">
                Sent to <strong style="color:#718096;">${recipientEmail}</strong>
              </p>
              <p style="margin:0 0 6px;color:#a0aec0;font-size:12px;text-align:center;">
                <strong style="color:#4a5568;">MJ Hygiene Compliance Portal</strong>
                &nbsp;&bull;&nbsp;
                <a href="https://rpfhygiene.com"
                   style="color:#0077b6;text-decoration:none;">rpfhygiene.com</a>
                &nbsp;&bull;&nbsp;
                noreply@rpfhygiene.com
              </p>
              <p style="margin:0;color:#cbd5e0;font-size:11px;text-align:center;">
                &copy; ${year} MJ Hygiene. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Email Card -->

      </td>
    </tr>
  </table>

</body>
</html>`;

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Main Handler
// ---------------------------------------------------------------------------

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const payload = (await req.json()) as AuthHookPayload;

    const { email } = payload.user;
    const { email_action_type, token_hash, redirect_to, site_url } =
      payload.email_data;

    console.log(
      `[auth-email-hook] type=${email_action_type} to=${email}`,
    );

    const actionUrl = buildActionUrl(
      site_url,
      token_hash,
      email_action_type,
      redirect_to,
    );

    const { subject, html } = buildEmail(email_action_type, actionUrl, email);

    const fromEmail =
      Deno.env.get('SMTP_USER') ?? 'noreply@rpfhygiene.com';

    await transporter.sendMail({
      from: `"MJ Hygiene Compliance Portal" <${fromEmail}>`,
      to: email,
      subject,
      html,
    });

    console.log(`[auth-email-hook] Email sent successfully to ${email}`);

    // Empty response body tells Supabase NOT to send the default email
    return new Response(JSON.stringify({}), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('[auth-email-hook] Error:', err);

    // Non-empty error response causes Supabase to fall back to default email
    return new Response(
      JSON.stringify({
        error: {
          message:
            err instanceof Error
              ? err.message
              : 'Unknown error in auth-email-hook',
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
});
