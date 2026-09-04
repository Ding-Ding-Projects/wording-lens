[CmdletBinding()]
param(
  [switch]$Silent,
  [switch]$RunAfterBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$bootstrap = Join-Path $root 'scripts\bootstrap-dependencies.ps1'
$sourceStatus = @(git -C $root status --porcelain)
if ($sourceStatus.Count -gt 0) { throw "The source checkout is dirty; commit source changes before building. Files: $($sourceStatus -join ', ')" }
if (-not $Silent) {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $elevatedArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath)
    if ($RunAfterBuild) { $elevatedArgs += '-RunAfterBuild' }
    $elevated = Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList $elevatedArgs -Wait -PassThru
    exit $elevated.ExitCode
  }
}
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
  (Join-Path $root 'dist-electron\apps\desktop\electron\main.js'),
  (Join-Path $root 'dist-electron\apps\desktop\electron\preload.js'),
  (Join-Path $root 'dist-electron\packages\core\src\provenance.js'),
  (Join-Path $root 'dist-electron\packages\integration\vocabulary-boundary.js'),
  (Join-Path $root 'dist\renderer\index.html')
)
$missing = @($expected | Where-Object { -not (Test-Path -LiteralPath $_) })
if ($missing.Count -gt 0) { throw "The build completed without the expected application outputs: $($missing -join ', ')" }
if (-not $Silent) { Write-Host '[build] Verified dist-electron/apps/desktop/electron/main.js and dist/renderer/index.html.' }

if ($RunAfterBuild) {
  $electron = Join-Path $root 'node_modules\electron\dist\electron.exe'
  if (-not (Test-Path -LiteralPath $electron)) { $electron = (Get-Command electron.cmd -ErrorAction SilentlyContinue).Source }
  if (-not $electron) { throw 'The Electron executable was not found after the build.' }
  if (-not $Silent) { Write-Host '[build] Launching the built application.' }
  Start-Process -FilePath $electron -WorkingDirectory $root -ArgumentList @('.') | Out-Null
}
