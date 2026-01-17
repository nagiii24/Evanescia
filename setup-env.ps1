# Script to help complete .env.local setup
# Run this script to add missing environment variables

Write-Host "=== Hungify Environment Setup ===" -ForegroundColor Cyan
Write-Host ""

# Check current .env.local
if (Test-Path .env.local) {
    Write-Host "Found existing .env.local file" -ForegroundColor Green
    $currentContent = Get-Content .env.local
    
    # Check what's missing
    $hasConvexUrl = $currentContent | Select-String "NEXT_PUBLIC_CONVEX_URL"
    $hasJwtDomain = $currentContent | Select-String "CLERK_JWT_ISSUER_DOMAIN"
    $hasAppId = $currentContent | Select-String "CLERK_APPLICATION_ID"
    
    Write-Host ""
    Write-Host "Current status:" -ForegroundColor Yellow
    Write-Host "  Convex URL: $(if ($hasConvexUrl) { '✓ Set' } else { '✗ Missing' })"
    Write-Host "  JWT Domain: $(if ($hasJwtDomain) { '✓ Set' } else { '✗ Missing' })"
    Write-Host "  App ID: $(if ($hasAppId) { '✓ Set' } else { '✗ Missing' })"
    Write-Host ""
    
    # Get Convex URL
    if (-not $hasConvexUrl) {
        Write-Host "To get Convex URL:" -ForegroundColor Cyan
        Write-Host "1. Run: npx convex dev" -ForegroundColor White
        Write-Host "2. Look for 'Convex URL: https://...' in the output" -ForegroundColor White
        Write-Host "3. Or check your Convex dashboard: https://dashboard.convex.dev" -ForegroundColor White
        Write-Host ""
        $convexUrl = Read-Host "Enter your NEXT_PUBLIC_CONVEX_URL (or press Enter to skip)"
        if ($convexUrl) {
            Add-Content .env.local "`nNEXT_PUBLIC_CONVEX_URL=$convexUrl"
            Write-Host "✓ Added Convex URL" -ForegroundColor Green
        }
    }
    
    # Get JWT Domain
    if (-not $hasJwtDomain) {
        Write-Host ""
        Write-Host "To get Clerk JWT Issuer Domain:" -ForegroundColor Cyan
        Write-Host "1. Go to: https://dashboard.clerk.com" -ForegroundColor White
        Write-Host "2. Select your app → Settings → General" -ForegroundColor White
        Write-Host "3. Look for 'JWT Issuer' (format: https://your-app.clerk.accounts.dev)" -ForegroundColor White
        Write-Host ""
        $jwtDomain = Read-Host "Enter CLERK_JWT_ISSUER_DOMAIN (or press Enter to skip)"
        if ($jwtDomain) {
            Add-Content .env.local "`nCLERK_JWT_ISSUER_DOMAIN=$jwtDomain"
            Write-Host "✓ Added JWT Domain" -ForegroundColor Green
        }
    }
    
    # Get Application ID
    if (-not $hasAppId) {
        Write-Host ""
        Write-Host "To get Clerk Application ID:" -ForegroundColor Cyan
        Write-Host "1. Go to: https://dashboard.clerk.com" -ForegroundColor White
        Write-Host "2. Select your app → Settings → General" -ForegroundColor White
        Write-Host "3. Look for 'Application ID'" -ForegroundColor White
        Write-Host ""
        $appId = Read-Host "Enter CLERK_APPLICATION_ID (or press Enter to skip)"
        if ($appId) {
            Add-Content .env.local "`nCLERK_APPLICATION_ID=$appId"
            Write-Host "✓ Added Application ID" -ForegroundColor Green
        }
    }
    
    Write-Host ""
    Write-Host "Setup complete! Check .env.local for all values." -ForegroundColor Green
} else {
    Write-Host "No .env.local file found. Creating template..." -ForegroundColor Yellow
    Copy-Item .env.local.template .env.local -ErrorAction SilentlyContinue
    Write-Host "Created .env.local template. Please fill in the values." -ForegroundColor Green
}
