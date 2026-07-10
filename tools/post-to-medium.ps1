<#
.SYNOPSIS
  One-click: prepare a markdown article and push it to Medium as a draft.

.DESCRIPTION
  Runs two steps in sequence:
    1. medium-prep.py     -> converts mermaid/tables to images, writes <name>.medium.md
    2. medium-publish.py  -> opens Medium and pastes it in as a draft (Playwright)

  First run opens a browser so you can log into Medium once. Every run after
  that is automatic.

.EXAMPLE
  ./tools/post-to-medium.ps1 RAG/rag-deep-dive-part-0.md

.EXAMPLE
  ./tools/post-to-medium.ps1 RAG/rag-deep-dive-part-0.md -Publish
#>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$File,

    [switch]$Publish,        # publish live instead of saving a draft
    [switch]$KeepOpen,       # leave the browser open at the end
    [switch]$SkipPrep,       # the file is already a .medium.md; skip step 1
    [switch]$SystemProfile,  # clone your real Chrome profile (beats Cloudflare); close Chrome first
    [string]$ChromeProfile = "Default",  # which Chrome profile (e.g. "Profile 1")
    [switch]$RefreshProfile  # re-copy the profile (use if login/clearance expired)
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path $File)) {
    Write-Error "File not found: $File"
    exit 1
}

# --- Step 1: prepare (unless skipped or already a .medium.md) ---
$mediumFile = $File
if (-not $SkipPrep -and $File -notmatch '\.medium\.md$') {
    Write-Host "`n[1/2] Preparing article (images for mermaid + tables)…" -ForegroundColor Cyan
    python "$PSScriptRoot/medium-prep.py" $File
    if ($LASTEXITCODE -ne 0) { Write-Error "medium-prep failed."; exit 1 }

    $dir  = Split-Path -Parent $File
    $stem = [System.IO.Path]::GetFileNameWithoutExtension($File)
    $mediumFile = if ($dir) { Join-Path $dir "$stem.medium.md" } else { "$stem.medium.md" }
}

if (-not (Test-Path $mediumFile)) {
    Write-Error "Prepared file not found: $mediumFile"
    exit 1
}

# --- Step 2: publish ---
Write-Host "`n[2/2] Sending to Medium…" -ForegroundColor Cyan

$needsSeed = $SystemProfile -and ($RefreshProfile -or -not (Test-Path "$PSScriptRoot/.medium-profile-system"))
if ($SystemProfile -and $needsSeed) {
    # To COPY your cookies/login cleanly, Chrome must be closed so the cookie
    # database is flushed and unlocked. (After the copy, Chrome can be open.)
    $running = Get-Process chrome -ErrorAction SilentlyContinue
    if ($running) {
        Write-Host "  ! Your profile is about to be copied (to carry your Medium login)." -ForegroundColor Yellow
        Write-Host "    Chrome must be FULLY closed so cookies copy cleanly." -ForegroundColor Yellow
        $ans = Read-Host "    Close all Chrome windows, then press Enter (or type 'kill' to force-close)"
        if ($ans -eq "kill") {
            Stop-Process -Name chrome -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        }
    }
}

$pubArgs = @("$PSScriptRoot/medium-publish.py", $mediumFile)
if ($Publish)        { $pubArgs += "--publish" }
if ($KeepOpen)       { $pubArgs += "--keep-open" }
if ($SystemProfile)  { $pubArgs += @("--use-system-profile", "--chrome-profile", $ChromeProfile) }
if ($RefreshProfile) { $pubArgs += "--refresh-profile" }

python @pubArgs
exit $LASTEXITCODE
