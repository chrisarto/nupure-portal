# Gotzinger Portal — VPS Deployment Guide

**Domain:** mj-gotzinger-hygiene.com
**Port:** 3009
**GitHub:** https://github.com/chrisarto/gotzinger-portal (private)
**Directory:** /var/www/gotzinger-portal

> ⚠️ This is a NEW deployment. RPF portal is already running on port 3008 — these steps will NOT touch it.

---

## 1. Clone & Install

```bash
cd /var/www
git clone https://github.com/chrisarto/gotzinger-portal.git
cd gotzinger-portal
npm install
```

## 2. Create Environment File

```bash
nano .env.local
```

Paste the following (fill in values from your local `.env.local`):

```env
# Airtable Configuration
AIRTABLE_API_KEY=<your-airtable-api-key>
AIRTABLE_BASE_OPS=<your-ops-base-id>
AIRTABLE_BASE_TRAINING=<your-training-base-id>

# Supabase (sanitation-management project)
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# SMTP Email
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=noreply@mj-gotzinger-hygiene.com
SMTP_PASS=<your-smtp-password>
EMAIL_FROM=noreply@mj-gotzinger-hygiene.com

SUPABASE_HOOK_SECRET=<your-hook-secret>
```

## 3. Build

```bash
npm run build
```

## 4. Start with PM2 (Port 3009)

```bash
# Start the app and background jobs
pm2 start ecosystem.config.cjs

# Verify it's running
pm2 list

# Save so it survives reboots
pm2 save
```

You should see three processes:
- `gotzinger-portal-app` — the Next.js app on port 3009
- `gotzinger-airtable-sync` — Airtable sync (every 30 min)
- `gotzinger-email-ingest` — Email digest (daily 9am AEST)

## 5. DNS — Point Domain to VPS

In your domain registrar (where you purchased mj-gotzinger-hygiene.com), add these DNS records pointing to your VPS IP:

| Type | Name | Value |
|------|------|-------|
| A | @ | `<your-vps-ip>` |
| A | www | `<your-vps-ip>` |

Wait for DNS propagation (usually 5–30 minutes).

## 6. Nginx Config (NEW site — does NOT touch existing sites)

```bash
# Copy the nginx config (already in the repo)
sudo cp /var/www/gotzinger-portal/gotzinger-portal.nginx /etc/nginx/sites-available/gotzinger-portal

# Enable it (symlink)
sudo ln -s /etc/nginx/sites-available/gotzinger-portal /etc/nginx/sites-enabled/gotzinger-portal

# Test nginx config is valid (IMPORTANT — checks ALL sites are OK)
sudo nginx -t

# Reload nginx (graceful — does not interrupt other sites)
sudo systemctl reload nginx
```

## 7. SSL Certificate (Let's Encrypt)

Once DNS has propagated:

```bash
sudo certbot --nginx -d mj-gotzinger-hygiene.com -d www.mj-gotzinger-hygiene.com
```

Certbot will automatically update the nginx config with SSL certificates.

## 8. Verify

- Visit https://mj-gotzinger-hygiene.com — should show the login page
- Check PM2: `pm2 list` — all 3 processes should be `online`
- Check logs: `pm2 logs gotzinger-portal-app --lines 20`

---

## Updating the App Later

```bash
cd /var/www/gotzinger-portal
git pull
npm install
npm run build
pm2 restart gotzinger-portal-app
```

## Port Allocation Reference

| App | Port | Domain |
|-----|------|--------|
| RPF Portal | 3008 | rpfhygiene.com |
| **Gotzinger Portal** | **3009** | **mj-gotzinger-hygiene.com** |
