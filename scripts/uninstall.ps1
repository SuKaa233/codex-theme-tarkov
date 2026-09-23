[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$TargetCodexHome
)

$ErrorActionPreference = 'Stop'
$codexRoot = if ($TargetCodexHome) {
    $TargetCodexHome
} elseif ($env:CODEX_HOME) {
    $env:CODEX_HOME
} else {
    Join-Path $env:USERPROFILE '.codex'
}
$themesDir = Join-Path $codexRoot 'themes'

foreach ($name in @('Codex Field Kit Dark.tmTheme', 'Codex Field Kit Light.tmTheme')) {
    $target = Join-Path $themesDir $name
    if ((Test-Path -LiteralPath $target) -and $PSCmdlet.ShouldProcess($target, 'Remove installed theme')) {
        Remove-Item -LiteralPath $target
        Write-Host "Removed CLI theme: $target"
    }
}

Write-Host 'Desktop themes are stored by Codex. Reset them from Settings > Appearance if desired.'
