[CmdletBinding()]
param(
    [ValidateSet('dark', 'light')]
    [string]$Variant = 'dark',

    [switch]$SkipCli,

    [switch]$SkipClipboard,

    [string]$TargetCodexHome
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot

if (-not $SkipCli) {
    $codexRoot = if ($TargetCodexHome) {
        $TargetCodexHome
    } elseif ($env:CODEX_HOME) {
        $env:CODEX_HOME
    } else {
        Join-Path $env:USERPROFILE '.codex'
    }

    $themesDir = Join-Path $codexRoot 'themes'
    New-Item -ItemType Directory -Path $themesDir -Force | Out-Null

    foreach ($name in @('Codex Field Kit Dark.tmTheme', 'Codex Field Kit Light.tmTheme')) {
        $source = Join-Path (Join-Path $repoRoot 'themes') $name
        $destination = Join-Path $themesDir $name
        Copy-Item -LiteralPath $source -Destination $destination -Force
        Write-Host "Installed CLI theme: $destination"
    }
}

if (-not $SkipClipboard) {
    $shareFile = Join-Path (Join-Path $repoRoot 'desktop') "codex-field-kit-$Variant.txt"
    $shareString = (Get-Content -LiteralPath $shareFile -Raw).Trim()
    Set-Clipboard -Value $shareString
    Write-Host "Copied the $Variant desktop theme to the clipboard."
    Write-Host 'Open Codex Settings > Appearance, choose the matching theme card, click Import, and paste.'
}

if (-not $SkipCli) {
    Write-Host 'In Codex CLI, run /theme and select Codex Field Kit Dark or Codex Field Kit Light.'
}
