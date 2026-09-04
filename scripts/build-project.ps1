[CmdletBinding()]
param(
  [switch]$Silent,
  [switch]$RunAfterBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$bootstrap = Join-Path $root 'scripts\bootstrap-dependencies.ps1'
& $bootstrap $(if ($Silent) { '-Silent' })
if ($LASTEXITCODE -ne 0) { throw "Dependency bootstrap exited with $LASTEXITCODE." }
$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) { throw 'npm.cmd was not found after dependency bootstrap.' }
$packageJson = Join-Path $root 'package.json'
if (-not (Test-Path -LiteralPath $packageJson)) { throw "The application manifest is missing: $packageJson" }

Push-Location $root
try {
  if (-not $Silent) { Write-Host '[build] Building the application through npm run build.' }
  & $npm.Source run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build exited with $LASTEXITCODE." }
} finally { Pop-Location }

$expected = @(
  (Join-Path $root 'dist-electron\main.js'),
  (Join-Path $root 'dist\index.html')
)
$missing = @($expected | Where-Object { -not (Test-Path -LiteralPath $_) })
if ($missing.Count -gt 0) { throw "The build completed without the expected application outputs: $($missing -join ', ')" }
if (-not $Silent) { Write-Host '[build] Verified dist-electron/main.js and dist/index.html.' }

if ($RunAfterBuild) {
  $electron = Join-Path $root 'node_modules\electron\dist\electron.exe'
  if (-not (Test-Path -LiteralPath $electron)) { $electron = (Get-Command electron.cmd -ErrorAction SilentlyContinue).Source }
  if (-not $electron) { throw 'The Electron executable was not found after the build.' }
  if (-not $Silent) { Write-Host '[build] Launching the built application.' }
  Start-Process -FilePath $electron -WorkingDirectory $root -ArgumentList @('.') | Out-Null
}
