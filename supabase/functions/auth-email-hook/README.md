# Auth Email Hook — MJ Hygiene Compliance Portal

A Supabase Auth Email Hook that intercepts all Supabase authentication emails and replaces them with professionally branded HTML emails for the **MJ Hygiene Compliance Portal**.

## What It Does

Every time Supabase needs to send an auth email (signup confirmation, password reset, magic link, etc.), it calls this Edge Function **instead** of sending its default template. The function:

1. Receives the auth hook payload from Supabase
2. Builds a branded HTML email with inline CSS (renders in Gmail & Outlook)
3. Sends it via Hostinger SMTP (`noreply@rpfhygiene.com`)
4. Returns `{}` — which signals Supabase to **suppress** its own default email

If the function errors, it returns a 500 with an `error` key, which causes Supabase to fall back to sending its default email. This means auth always works even if SMTP is temporarily down.

## Email Action Types Handled

| Supabase Action         | Subject Line                                              | CTA              |
|-------------------------|-----------------------------------------------------------|------------------|
| `signup`                | Confirm your MJ Hygiene Compliance Portal account         | Verify Email     |
| `recovery`              | Reset your MJ Hygiene Compliance Portal password          | Reset My Password|
| `magiclink`             | Your MJ Hygiene Compliance Portal sign-in link            | Sign In Now      |
| `email_change_new`      | Confirm your MJ Hygiene Compliance Portal email change    | Verify Email     |
| `email_change_current`  | Confirm your MJ Hygiene Compliance Portal email change    | Verify Email     |
| `reauthentication`      | Confirm your MJ Hygiene Compliance Portal action          | Confirm Action   |

## Required Secrets

Set these in Supabase before deploying (the deploy script handles this):

| Secret      | Value                    |
|-------------|--------------------------|
| `SMTP_HOST` | `smtp.hostinger.com`     |
| `SMTP_PORT` | `465`                    |
| `SMTP_USER` | `noreply@rpfhygiene.com` |
| `SMTP_PASS` | *(your SMTP password)*   |

## How to Deploy

### Prerequisites
- `npx supabase` CLI available
- Logged in to Supabase CLI: `npx supabase login`

### Run the deploy script

```powershell
# From the rpf-portal root directory:
$env:SMTP_PASS = 'your-smtp-password-here'
.\scripts\deploy-auth-hook.ps1
```

The script will:
1. Push SMTP secrets to the Supabase project
2. Deploy the `auth-email-hook` Edge Function with `--no-verify-jwt`

### Or manually:

```powershell
# Set secrets
npx supabase secrets set --project-ref ttxnxytewxqccuurivsn `
  SMTP_HOST=smtp.hostinger.com `
  SMTP_PORT=465 `
  SMTP_USER=noreply@rpfhygiene.com `
  SMTP_PASS=your-password

# Deploy function
npx supabase functions deploy auth-email-hook `
  --project-ref ttxnxytewxqccuurivsn `
  --no-verify-jwt
```

## Enable in Supabase Dashboard (Required)

Deploying the function alone is not enough — you must activate the hook in the dashboard:

1. **Open:** [Auth Hooks Dashboard](https://supabase.com/dashboard/project/ttxnxytewxqccuurivsn/auth/hooks)
2. Under **"Send Email"**, click **"Add hook"**
3. Set **Hook type** → `Supabase Edge Functions`
4. Set **Function** → `auth-email-hook`
5. Click **"Save"**

> ⚠️ Until this is done, Supabase will continue sending its default (unbranded) emails.

## Why `verify_jwt = false`?

Supabase calls auth hooks directly from its internal auth service — without a user JWT. The `verify_jwt = false` config in `supabase/config.toml` disables JWT verification for this function so Supabase can call it successfully.

> This is expected and safe for auth hooks — see [Supabase Auth Hook docs](https://supabase.com/docs/guides/auth/auth-hooks).

## File Structure

```
supabase/
├── config.toml                          # Project ref + hook config
└── functions/
    └── auth-email-hook/
        ├── index.ts                     # Edge Function (this is deployed)
        └── README.md                    # This file

scripts/
└── deploy-auth-hook.ps1                 # One-click deployment script
```

## Email Design

- **Brand colours:** Navy `#0f3460` / Teal `#00b4d8`
- **Fully inline CSS** for maximum email client compatibility
- Includes fallback plain-text link below the CTA button
- Security reminder block in every email
- Renders correctly in Gmail, Outlook, Apple Mail

## Troubleshooting

### Email not received
1. Check Supabase Edge Function logs:
   `https://supabase.com/dashboard/project/ttxnxytewxqccuurivsn/functions`
2. Check that the hook is enabled in Auth → Hooks dashboard
3. Verify SMTP secrets are set: `npx supabase secrets list --project-ref ttxnxytewxqccuurivsn`

### SMTP authentication error
- Confirm `SMTP_PASS` secret is correct
- Hostinger SMTP uses port 465 with SSL (not STARTTLS)

### Function returns 500
- Supabase will automatically fall back to its default email — auth still works
- Check function logs for the specific error

## Adding a New App in Future

If this Supabase project ever needs to serve a second app:

1. Add an app detection function (e.g. check `user_metadata.app` or `redirect_to` domain)
2. Create a second `buildEmail()` variant with the new app's branding
3. Branch inside the main handler: call one builder or the other based on detection
4. The SMTP `from` address may differ per app — set additional secrets if needed
