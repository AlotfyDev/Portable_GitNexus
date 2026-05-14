#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Build GitNexus as a standalone portable binary via bun build --compile.
.DESCRIPTION
    Steps:
      1. Embed WASM grammars as base64 (scripts/embed-wasm.mjs)
      2. Generate portable constants (scripts/generate-constants.mjs --portable)
      3. Copy third-party assets (web UI, sidecar, config) next to output
      4. Run bun build --compile with portable-bootstrap.ts as entry
.PARAMETER OutDir
    Output directory for the portable binary. Default: ./gitnexus-portable
.PARAMETER SkipWasm
    Skip WASM embedding step (use if already up-to-date).
.PARAMETER SkipAssets
    Skip copying third-party assets (use if already up-to-date).
.EXAMPLE
    .\scripts\build-portable.ps1
    .\scripts\build-portable.ps1 -OutDir D:\releases\gitnexus
#>

param(
    [string]$OutDir = (Join-Path (Get-Location) "gitnexus-portable"),
    [switch]$SkipWasm,
    [switch]$SkipAssets
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

Write-Host "=== GitNexus Portable Build ===" -ForegroundColor Cyan
Write-Host "Repo root: $repoRoot"
Write-Host "Output:    $OutDir"
Write-Host ""

# 1. Embed WASM grammars as base64
if (-not $SkipWasm) {
    Write-Host "[1/4] Embedding WASM grammars..." -ForegroundColor Yellow
    Push-Location $repoRoot
    try {
        node scripts/embed-wasm.mjs
        if ($LASTEXITCODE -ne 0) { throw "embed-wasm.mjs failed with exit code $LASTEXITCODE" }
    } finally {
        Pop-Location
    }
    Write-Host "  ✓ WASM grammars embedded" -ForegroundColor Green
} else {
    Write-Host "[1/4] SKIPPED: WASM embedding" -ForegroundColor DarkYellow
}

# 2. Generate portable constants
Write-Host "[2/4] Generating portable constants..." -ForegroundColor Yellow
Push-Location $repoRoot
try {
    node scripts/generate-constants.mjs --portable
    if ($LASTEXITCODE -ne 0) { throw "generate-constants.mjs failed with exit code $LASTEXITCODE" }
} finally {
    Pop-Location
}
Write-Host "  ✓ Portable constants generated (IS_PORTABLE_BUILD=true)" -ForegroundColor Green

# 3. Create output directory and copy third-party assets
if (-not $SkipAssets) {
    Write-Host "[3/4] Copying third-party assets..." -ForegroundColor Yellow

    # Ensure clean output
    if (Test-Path -LiteralPath $OutDir) {
        Remove-Item -LiteralPath $OutDir -Recurse -Force
    }
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

    # Copy third-party folder
    $thirdParty = Join-Path $repoRoot "third-party"
    $destThirdParty = Join-Path $OutDir "third-party"
    if (Test-Path -LiteralPath $thirdParty) {
        New-Item -ItemType Directory -Path $destThirdParty -Force | Out-Null
        Get-ChildItem -Path $thirdParty | Copy-Item -Destination $destThirdParty -Recurse -Force -Container
        Write-Host "  ✓ Third-party assets copied" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ No third-party folder found — create it first" -ForegroundColor Yellow
    }
} else {
    Write-Host "[3/4] SKIPPED: Third-party assets" -ForegroundColor DarkYellow
}

# 4. Find bun executable
$bunPaths = @(
    (Join-Path $env:USERPROFILE "AppData\Roaming\npm\bun.cmd"),
    (Join-Path $env:USERPROFILE "AppData\Roaming\npm\bun"),
    "bun",
    "bun.cmd"
)
$bunExe = $null
foreach ($p in $bunPaths) {
    if (Get-Command $p -ErrorAction SilentlyContinue) { $bunExe = $p; break }
}
if (-not $bunExe) {
    Write-Error "bun not found. Install: npm install -g bun"
    exit 1
}
Write-Host "  Using bun: $bunExe"

# 5. Run bun build --compile
Write-Host "[4/4] Running bun build --compile..." -ForegroundColor Yellow
$entryPoint = Join-Path $repoRoot "src\portable-bootstrap.ts"
$outputBin = Join-Path $OutDir "gitnexus"
$bunArgs = @(
    "build",
    "--compile",
    "--entrypoint", $entryPoint,
    "--outfile", $outputBin,
    "--minify"
)

Write-Host "  Bun args:" @bunArgs
Push-Location $repoRoot
try {
    & $bunExe $bunArgs
    if ($LASTEXITCODE -ne 0) { throw "bun build --compile failed with exit code $LASTEXITCODE" }
} finally {
    Pop-Location
}

# Verify output
$binaryPath = "$outputBin.exe"
if (Test-Path -LiteralPath $binaryPath) {
    $size = (Get-Item -LiteralPath $binaryPath).Length
    $sizeMB = [math]::Round($size / 1MB, 1)
    Write-Host "" -ForegroundColor Green
    Write-Host "=== Build Complete ===" -ForegroundColor Cyan
    Write-Host "Output: $binaryPath ($sizeMB MB)" -ForegroundColor Green
    Write-Host "Binary + third-party folder in: $OutDir" -ForegroundColor Green
} else {
    Write-Error "Binary not found at $binaryPath — build may have failed"
    exit 1
}

# Restore dev constants (so dev mode still works)
Write-Host "Restoring dev-mode constants..." -ForegroundColor DarkYellow
Push-Location $repoRoot
try {
    node scripts/generate-constants.mjs
    if ($LASTEXITCODE -ne 0) { throw "Restore dev constants failed" }
} finally {
    Pop-Location
}
Write-Host "  ✓ Dev-mode constants restored" -ForegroundColor Green
