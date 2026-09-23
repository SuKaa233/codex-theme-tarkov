[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$codexRoot = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$target = Join-Path $codexRoot 'codex-tarkov-sfx.json'
$source = Join-Path (Join-Path $repoRoot 'config') 'config.example.json'

New-Item -ItemType Directory -Path $codexRoot -Force | Out-Null
if ((Test-Path -LiteralPath $target) -and -not $Force) {
    throw "Config already exists: $target. Re-run with -Force only if you want to replace it."
}

Copy-Item -LiteralPath $source -Destination $target -Force
Write-Host "Created editable sound config: $target"
