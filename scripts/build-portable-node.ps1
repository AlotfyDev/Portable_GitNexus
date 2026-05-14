param(
    [string]$OutDir = (Join-Path (Get-Location) "gitnexus-portable-node"),
    [switch]$SkipWasm,
    [switch]$SkipTsc
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$embedWasm = Join-Path (Join-Path $repoRoot "scripts") "embed-wasm.mjs"
$genConstants = Join-Path (Join-Path $repoRoot "scripts") "generate-constants.mjs"
$tscPath = Join-Path (Join-Path (Join-Path $repoRoot "node_modules") ".bin") "tsc.cmd"

Write-Host "=== GitNexus Node.js Portable Package Build ==="
Write-Host "Repo root: $repoRoot"
Write-Host "Output: $OutDir"
Write-Host ""

Write-Host "[1/13] Cleaning output directory..."
if (Test-Path -LiteralPath $OutDir) {
    Remove-Item -LiteralPath $OutDir -Recurse -Force
    Write-Host "  Removed existing: $OutDir"
}
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
Write-Host "  Created: $OutDir"

if (-not $SkipWasm) {
    Write-Host "[2/13] Embedding WASM grammars..."
    & node $embedWasm
    if ($LASTEXITCODE -ne 0) { throw "embed-wasm.mjs failed" }
    Write-Host "  OK WASM grammars embedded"
} else {
    Write-Host "[2/13] SKIPPED: WASM embedding"
}

Write-Host "[3/13] Generating portable constants..."
& node $genConstants "--portable"
if ($LASTEXITCODE -ne 0) { throw "generate-constants.mjs --portable failed" }
Write-Host "  OK Portable constants generated"

if (-not $SkipTsc) {
    Write-Host "[4/13] Compiling TypeScript..."
    if (Test-Path -LiteralPath $tscPath) {
        & $tscPath
    } else {
        & "npx" "tsc"
    }
    if ($LASTEXITCODE -ne 0) { throw "TypeScript compilation failed" }
    Write-Host "  OK TypeScript compiled"
} else {
    Write-Host "[4/13] SKIPPED: TypeScript compilation"
}

Write-Host "[5/13] Creating output structure..."
New-Item -ItemType Directory -Path (Join-Path $OutDir "dist") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $OutDir "vendor") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $OutDir "third-party") -Force | Out-Null
Write-Host "  Created dist/, vendor/, third-party/"

Write-Host "[6/13] Copying dist/..."
$srcDist = Join-Path $repoRoot "dist"
$dstDist = Join-Path $OutDir "dist"
if (Test-Path -LiteralPath $srcDist) {
    Copy-Item -Path "$srcDist\*" -Destination $dstDist -Recurse -Force
    Write-Host "  Copied dist/"
} else {
    Write-Warning "dist/ not found"
}

Write-Host "[7/13] Copying vendor/gitnexus-shared..."
$srcShared = Join-Path (Join-Path $repoRoot "node_modules") "gitnexus-shared"
$dstShared = Join-Path (Join-Path $OutDir "vendor") "gitnexus-shared"
if (Test-Path -LiteralPath $srcShared) {
    Copy-Item -Path $srcShared -Destination $dstShared -Recurse -Force
    Write-Host "  Copied vendor/gitnexus-shared"
} else {
    Write-Warning "gitnexus-shared not found in node_modules"
}

Write-Host "[8/13] Copying third-party/..."
$srcThird = Join-Path $repoRoot "third-party"
$dstThird = Join-Path $OutDir "third-party"
if (Test-Path -LiteralPath $srcThird) {
    Copy-Item -Path "$srcThird\*" -Destination $dstThird -Recurse -Force
    Write-Host "  Copied third-party/"
} else {
    Write-Warning "third-party/ not found"
}

Write-Host "[9/13] Creating package.json..."
$repoPkgPath = Join-Path $repoRoot "package.json"
$repoPkg = Get-Content $repoPkgPath -Raw | ConvertFrom-Json
$depCopy = @{}
$repoPkg.dependencies.PSObject.Properties | ForEach-Object { $depCopy[$_.Name] = $_.Value }
$depCopy["gitnexus-shared"] = "file:vendor/gitnexus-shared"
$portablePkg = [ordered]@{
    name = "gitnexus-portable"
    version = $repoPkg.version
    private = $true
    type = "module"
    main = "dist/cli/index.js"
    dependencies = $depCopy
    optionalDependencies = [ordered]@{
        "node-addon-api" = "^8.0.0"
        "node-gyp-build" = "^4.8.0"
        "tree-sitter-kotlin" = "^0.3.8"
    }
}
$portableJson = $portablePkg | ConvertTo-Json -Depth 10
$portableJsonPath = Join-Path $OutDir "package.json"
Set-Content -Path $portableJsonPath -Value $portableJson -Encoding UTF8
Write-Host "  Created package.json"

Write-Host "[10/13] Copying node_modules..."
$srcModules = Join-Path $repoRoot "node_modules"
$dstModules = Join-Path $OutDir "node_modules"
if (Test-Path -LiteralPath $srcModules) {
    Write-Host "  Copying node_modules (this may take a moment)..."
    Copy-Item -Path $srcModules -Destination $dstModules -Recurse -Force
    Write-Host "  Copied node_modules"
} else {
    Write-Warning "node_modules not found"
}

Write-Host "[11/13] Writing launcher scripts..."
$cmdPath = Join-Path $OutDir "gitnexus.cmd"
$cmdContent = '@echo off
REM GitNexus Portable Launcher (Node.js)
set "GITNEXUS_APP_DIR=%~dp0"
node "%~dp0dist\cli\index.js" %*
'
Set-Content -Path $cmdPath -Value $cmdContent -Encoding ASCII
$ps1Path = Join-Path $OutDir "gitnexus.ps1"
$ps1Content = '# GitNexus Portable Launcher (PowerShell)
$env:GITNEXUS_APP_DIR = $PSScriptRoot
node "$PSScriptRoot\dist\cli\index.js" @args
'
Set-Content -Path $ps1Path -Value $ps1Content -Encoding UTF8
Write-Host "  Created launchers"

Write-Host "[12/13] Verifying output..."
$errors = @()
$items = @(
    @("dist\cli\index.js", "dist/cli/index.js"),
    @("node_modules", "node_modules"),
    @("third-party\config\portable-config.yaml", "third-party/config/portable-config.yaml"),
    @("third-party\web-ui\index.html", "third-party/web-ui/index.html"),
    @("third-party\web-ui\index.html", "third-party/web-ui/index.html"),
    @("vendor\gitnexus-shared", "vendor/gitnexus-shared"),
    @("gitnexus.cmd", "gitnexus.cmd"),
    @("gitnexus.ps1", "gitnexus.ps1"),
    @("package.json", "package.json")
)
foreach ($item in $items) {
    $fullPath = Join-Path $OutDir $item[0]
    if (Test-Path -LiteralPath $fullPath) {
        Write-Host "  OK $($item[1])"
    } else {
        Write-Warning "MISSING $($item[1]) ($fullPath)"
        $errors += $item[1]
    }
}
$totalSize = (Get-ChildItem -Path $OutDir -Recurse -Force | Measure-Object -Property Length -Sum).Sum
$sizeMB = [math]::Round($totalSize / 1MB, 1)
Write-Host "  Total size: $sizeMB MB"

Write-Host "[13/13] Restoring dev-mode constants..."
& node $genConstants
if ($LASTEXITCODE -ne 0) { throw "Restore dev constants failed" }
Write-Host "  OK Dev-mode constants restored"
Write-Host ""

Write-Host "=== Build Complete ==="
if ($errors.Count -gt 0) {
    Write-Host "Warnings: $($errors.Count) expected paths missing:"
    foreach ($e in $errors) { Write-Host "  - $e" }
}
Write-Host "Output: $OutDir ($sizeMB MB)"
Write-Host "Launcher: $cmdPath"
