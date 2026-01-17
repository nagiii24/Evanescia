# Quick script to add missing environment variables to .env.local
Write-Host ""
Write-Host "=== Adding Missing Environment Variables ===" -ForegroundColor Cyan
Write-Host ""

# Check if .env.local exists
if (-not (Test-Path .env.local)) {
    Write-Host "Error: .env.local not found!" -ForegroundColor Red
    exit 1
}

# Check what's already there
$content = Get-Content .env.local -Raw
$needsConvex = $content -notmatch "NEXT_PUBLIC_CONVEX_URL"
$needsJwtDomain = $content -notmatch "CLERK_JWT_ISSUER_DOMAIN"
$needsAppId = $content -notmatch "CLERK_APPLICATION_ID"

if ((-not $needsConvex) -and (-not $needsJwtDomain) -and (-not $needsAppId)) {
    Write-Host "All environment variables are already set!" -ForegroundColor Green
    exit 0
}

Write-Host "Missing variables:" -ForegroundColor Yellow
if ($needsConvex) { Write-Host "  - NEXT_PUBLIC_CONVEX_URL" }
if ($needsJwtDomain) { Write-Host "  - CLERK_JWT_ISSUER_DOMAIN" }
if ($needsAppId) { Write-Host "  - CLERK_APPLICATION_ID" }
Write-Host ""

# Get Convex URL
if ($needsConvex) {
    Write-Host "1. NEXT_PUBLIC_CONVEX_URL" -ForegroundColor Cyan
    Write-Host "   Get it from: npx convex dev output or https://dashboard.convex.dev" -ForegroundColor Gray
    $convexUrl = Read-Host "   Enter Convex URL (or press Enter to skip)"
    if ($convexUrl -and $convexUrl.Length -gt 0) {
        Add-Content .env.local "`nNEXT_PUBLIC_CONVEX_URL=$convexUrl"
        Write-Host "   Added successfully" -ForegroundColor Green
    }
    Write-Host ""
}

# Get JWT Domain
if ($needsJwtDomain) {
    Write-Host "2. CLERK_JWT_ISSUER_DOMAIN" -ForegroundColor Cyan
    Write-Host "   Get it from: https://dashboard.clerk.com -> Settings -> General -> JWT Issuer" -ForegroundColor Gray
    Write-Host "   Format: https://your-app-name.clerk.accounts.dev" -ForegroundColor Gray
    $jwtDomain = Read-Host "   Enter JWT Issuer Domain (or press Enter to skip)"
    if ($jwtDomain -and $jwtDomain.Length -gt 0) {
        Add-Content .env.local "`nCLERK_JWT_ISSUER_DOMAIN=$jwtDomain"
        Write-Host "   Added successfully" -ForegroundColor Green
    }
    Write-Host ""
}

# Get Application ID
if ($needsAppId) {
    Write-Host "3. CLERK_APPLICATION_ID" -ForegroundColor Cyan
    Write-Host "   Get it from: https://dashboard.clerk.com -> Settings -> General -> Application ID" -ForegroundColor Gray
    $appId = Read-Host "   Enter Application ID (or press Enter to skip)"
    if ($appId -and $appId.Length -gt 0) {
        Add-Content .env.local "`nCLERK_APPLICATION_ID=$appId"
        Write-Host "   Added successfully" -ForegroundColor Green
    }
    Write-Host ""
}

Write-Host "Done! Check .env.local to verify all values are set." -ForegroundColor Green
Write-Host "Restart your dev server (npm run dev) for changes to take effect." -ForegroundColor Yellow
