<#
.SYNOPSIS
Copy-only staging of the recovered LightBridge optical candidates.
.DESCRIPTION
Verifies archive hashes, copies original files, verifies all 87 output hashes,
runs source tests and stages files for human review. Does not commit or push.
#>
param(
    [string]$SourceDirectory = (Join-Path $HOME "Downloads")
)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Checked {
    param([string]$Exe, [string[]]$Arguments)
    Write-Host ""
    Write-Host ("> " + $Exe + " " + ($Arguments -join " "))
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Exe exited with code $LASTEXITCODE"
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$qr = Join-Path $SourceDirectory "Parallax_LightBridge_v0.1.0_Candidate_Bundle.zip"
$stack = Join-Path $SourceDirectory "lightbridge-stack21-v0.2.zip"
if (-not (Test-Path -LiteralPath $qr -PathType Leaf)) { throw "Original QR ZIP not found: $qr" }
if (-not (Test-Path -LiteralPath $stack -PathType Leaf)) { throw "Original STACK-21 ZIP not found: $stack" }

if (Get-Command python -ErrorAction SilentlyContinue) {
    $pyExe = "python"; $pyPrefix = @()
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $pyExe = "py"; $pyPrefix = @("-3")
} else {
    throw "Python 3 is required. Install Python and retry."
}
if (Get-Command npm.cmd -ErrorAction SilentlyContinue) {
    $npmExe = "npm.cmd"
} elseif (Get-Command npm -ErrorAction SilentlyContinue) {
    $npmExe = "npm"
} else {
    throw "Node/npm is required."
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is required." }

Push-Location $repoRoot
try {
    $current = (& git branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0) { throw "Not a Git checkout." }
    if ($current -ne "recovery/import-original-sources") {
        throw "Wrong branch '$current'. Switch to recovery/import-original-sources."
    }
    $dirty = @(& git status --porcelain)
    if ($LASTEXITCODE -ne 0) { throw "Failed to inspect git status." }
    if ($dirty.Count -gt 0) {
        throw "Working tree must be clean before staging originals. Review existing changes first."
    }

    Invoke-Checked $pyExe ($pyPrefix + @("tools/import_recovered.py", "--qr", $qr, "--stack", $stack, "--dry-run"))
    Invoke-Checked $pyExe ($pyPrefix + @("tools/import_recovered.py", "--qr", $qr, "--stack", $stack))
    Invoke-Checked $pyExe ($pyPrefix + @("tools/verify_recovered.py"))

    foreach ($notice in @(
        "apps/qr-transfer-v0.1/LICENSE-NOTICE.md",
        "apps/qr-transfer-v0.1/THIRD_PARTY_NOTICES.md",
        "apps/qr-transfer-v0.1/vendor/LICENSE-qrcode-terminal-Apache-2.0.txt"
    )) {
        if (-not (Test-Path $notice -PathType Leaf)) {
            throw "Required historical or third-party notice missing: $notice"
        }
    }

    Push-Location "apps/qr-transfer-v0.1"
    try { Invoke-Checked $npmExe @("run", "check") }
    finally { Pop-Location }

    Push-Location "experiments/stack21-v0.2"
    try { Invoke-Checked "node" @("tests.mjs") }
    finally { Pop-Location }

    Invoke-Checked "git" @("add", "--", "apps/qr-transfer-v0.1", "experiments/stack21-v0.2", "RECOVERED-FILE-SHA256.json")
    Write-Host ""
    Write-Host "STAGED for review (NOT pushed):" -ForegroundColor Green
    Invoke-Checked "git" @("diff", "--cached", "--stat")
    Write-Host ""
    Write-Host "WARNING: the repository and PR are public." -ForegroundColor Yellow
    Write-Host "Inspect source, screenshots, logs and receipts before publishing." -ForegroundColor Yellow
    Write-Host "After reviewing, run the commands below manually:"
    Write-Host '  git commit -m "recovery: import original optical candidates unchanged"'
    Write-Host '  git push -u origin recovery/import-original-sources'
    Write-Host "Draft PR #4 will update automatically."
}
finally {
    Pop-Location
}
