# Deploy the MJ Hygiene Auth Email Hook to Supabase
# Run this from the rpf-portal directory:
#   cd C:\Users\chris\.gemini\antigravity\scratch\rpf-portal
#   .\scripts\deploy-auth-hook.ps1

$ErrorActionPreference = 'Stop'
$ProjectRef = 'ttxnxytewxqccuurivsn'

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MJ Hygiene Auth Email Hook Deploy" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Set Supabase secrets ────────────────────────────────────────────
Write-Host "Step 1: Setting SMTP secrets in Supabase..." -ForegroundColor Yellow

# NOTE: SMTP_PASS is read from the environment variable SMTP_PASS to avoid
# hardcoding credentials in this script. Set it before running:
#   $env:SMTP_PASS = 'your-password-here'
# Or pass it directly below (less secure, avoid committing).

$smtpPass = $env:SMTP_PASS
if (-not $smtpPass) {
  # Fallback for interactive use — remove/change before committing
  Write-Host "  SMTP_PASS env var not set. Prompting..." -ForegroundColor Gray
  $smtpPass = Read-Host -Prompt "Enter SMTP password" -AsSecureString |
    [System.Runtime.InteropServices.Marshal]::PtrToStringAuto(
      [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($_)
    )
}

npx supabase secrets set `
  --project-ref $ProjectRef `
  SMTP_HOST=smtp.hostinger.com `
  SMTP_PORT=465 `
  SMTP_USER=noreply@rpfhygiene.com `
  "SMTP_PASS=$smtpPass"

if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Failed to set secrets." -ForegroundColor Red
  exit 1
}
Write-Host "  Secrets set OK." -ForegroundColor Green

# ── Step 2: Deploy the Edge Function ────────────────────────────────────────
Write-Host ""
Write-Host "Step 2: Deploying auth-email-hook function..." -ForegroundColor Yellow

npx supabase functions deploy auth-email-hook `
  --project-ref $ProjectRef `
  --no-verify-jwt

if ($LASTEXITCODE -ne 0) {
  Write-Host "ERROR: Function deployment failed." -ForegroundColor Red
  exit 1
}
Write-Host "  Function deployed OK." -ForegroundColor Green

# ── Step 3: Instructions ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: You must now enable the hook in Supabase Dashboard." -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Open:" -ForegroundColor Cyan
Write-Host "     https://supabase.com/dashboard/project/$ProjectRef/auth/hooks" -ForegroundColor White
Write-Host ""
Write-Host "  2. Under 'Send Email', click 'Add hook'" -ForegroundColor Cyan
Write-Host "  3. Select Hook type: 'Supabase Edge Functions'" -ForegroundColor Cyan
Write-Host "  4. Select function: auth-email-hook" -ForegroundColor Cyan
Write-Host "  5. Click 'Save'" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Done! All MJ Hygiene auth emails will now use branded templates." -ForegroundColor Green
Write-Host ""
