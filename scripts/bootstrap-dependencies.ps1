[CmdletBinding()]
param([switch]$Silent, [switch]$ToolchainOnly)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$manifestPath = Join-Path $root 'dependencies.manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.schemaVersion -ne 1 -or $manifest.platform -ne 'windows-x64') {
  throw "Unsupported dependency manifest at $manifestPath."
}

function Write-Phase([string]$Message) {
  if (-not $Silent) { Write-Host "[bootstrap] $Message" }
}

function Get-Sha256([Parameter(Mandatory=$true)][string]$LiteralPath) {
  $stream = [IO.File]::OpenRead($LiteralPath)
  try {
    $sha256 = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha256.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
    finally { $sha256.Dispose() }
  } finally { $stream.Dispose() }
}

function Get-LocalToolRoot {
  $base = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $env:USERPROFILE 'AppData\Local' }
  $path = Join-Path $base 'WordingLens\toolchain'
  New-Item -ItemType Directory -Force -Path $path | Out-Null
  return $path
}

$nodeSpec = @($manifest.dependencies | Where-Object { $_.name -eq 'Node.js' })[0]
if (-not $nodeSpec) { throw 'The dependency manifest does not declare Node.js.' }
$builderSpec = @($manifest.dependencies | Where-Object { $_.name -eq 'electron-builder' })[0]
if (-not $builderSpec) { throw 'The dependency manifest does not declare electron-builder.' }
$toolRoot = Get-LocalToolRoot
$nodeRoot = Join-Path $toolRoot ($nodeSpec.installRelativePath -replace '^\.toolchain[\\/]', '')
$nodeExe = Join-Path $nodeRoot 'node.exe'
$npmCmd = Join-Path $nodeRoot 'npm.cmd'
$nodeVersionMismatch = $false
if (Test-Path -LiteralPath $nodeExe) {
  try { $nodeVersionMismatch = ((& $nodeExe --version).Trim() -ne "v$($nodeSpec.version)") } catch { $nodeVersionMismatch = $true }
}

if (-not (Test-Path -LiteralPath $nodeExe) -or -not (Test-Path -LiteralPath $npmCmd) -or $nodeVersionMismatch) {
  Write-Phase "Downloading $($nodeSpec.name) $($nodeSpec.version) from $($nodeSpec.source)."
  $download = Join-Path ([IO.Path]::GetTempPath()) ("wording-lens-node-{0}.zip" -f [guid]::NewGuid().ToString('N'))
  $stage = Join-Path ([IO.Path]::GetTempPath()) ("wording-lens-node-{0}" -f [guid]::NewGuid().ToString('N'))
  try {
    Invoke-WebRequest -UseBasicParsing -Uri $nodeSpec.source -OutFile $download
    $actual = Get-Sha256 -LiteralPath $download
    if ($actual -ne $nodeSpec.sha256.ToLowerInvariant()) {
      throw "SHA-256 mismatch for $($nodeSpec.source): expected $($nodeSpec.sha256), got $actual."
    }
    Expand-Archive -LiteralPath $download -DestinationPath $stage -Force
    $expanded = Get-ChildItem -LiteralPath $stage -Directory -Filter "node-v$($nodeSpec.version)-win-x64" | Select-Object -First 1 -ExpandProperty FullName
    if (-not $expanded) { throw "The Node.js archive did not contain the expected version directory for $($nodeSpec.version)." }
    if (-not (Test-Path -LiteralPath (Join-Path $expanded 'node.exe'))) { throw 'The Node.js archive did not contain node.exe.' }
    if (Test-Path -LiteralPath $nodeRoot) { Remove-Item -LiteralPath $nodeRoot -Recurse -Force }
    New-Item -ItemType Directory -Force -Path (Split-Path $nodeRoot) | Out-Null
    Move-Item -LiteralPath $expanded -Destination $nodeRoot
  } finally {
    Remove-Item -LiteralPath $download -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
  }
}

$env:PATH = "$nodeRoot;$nodeRoot;$env:PATH"
Write-Phase "Using Node.js $(& $nodeExe --version) from $nodeRoot."
Write-Phase "Using npm $(& $npmCmd --version)."
if ($ToolchainOnly) { return }

$packageJson = Join-Path $root 'package.json'
if (-not (Test-Path -LiteralPath $packageJson)) {
  Write-Phase 'No package.json is present yet; the source lane will provide the application manifest.'
  exit 0
}

Push-Location $root
try {
  if (Test-Path -LiteralPath (Join-Path $root 'package-lock.json')) {
    Write-Phase 'Installing declared npm dependencies from package-lock.json.'
    & $npmCmd ci --no-audit --no-fund --ignore-scripts
  } else {
    Write-Phase 'Installing declared npm dependencies from package.json.'
    & $npmCmd install --no-audit --no-fund --ignore-scripts --package-lock=false
  }
  if ($LASTEXITCODE -ne 0) { throw "npm dependency installation exited with $LASTEXITCODE." }
  Write-Phase 'Installing the pinned electron-builder release tool in the user-local toolchain.'
  & $npmCmd install --global --prefix $toolRoot --no-audit --no-fund --ignore-scripts ("electron-builder@{0}" -f $builderSpec.version)
  if ($LASTEXITCODE -ne 0) { throw "electron-builder installation exited with $LASTEXITCODE." }
} finally { Pop-Location }

$env:PATH = "$toolRoot;$toolRoot\node_modules\.bin;$env:PATH"
$builderCommand = Get-Command electron-builder.cmd -ErrorAction SilentlyContinue
if (-not $builderCommand) { throw 'The pinned electron-builder command was not found after installation.' }
$builderVersion = (& $builderCommand.Source --version).Trim()
if ($builderVersion -ne $builderSpec.version) { throw "electron-builder version mismatch: expected $($builderSpec.version), got $builderVersion." }
$electronPackage = Join-Path $root 'node_modules\electron\package.json'
if (-not (Test-Path -LiteralPath $electronPackage)) { throw "The declared Electron dependency is missing: $electronPackage" }
$electronInstall = Join-Path $root 'node_modules\electron\install.js'
$electronExe = Join-Path $root 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path -LiteralPath $electronExe)) {
  Write-Phase 'Running the exact Electron package install step to materialize the platform binary.'
  & $nodeExe $electronInstall
  if ($LASTEXITCODE -ne 0) { throw "Electron package installation exited with $LASTEXITCODE." }
}
if (-not (Test-Path -LiteralPath $electronExe)) { throw "Electron was declared and its install step completed, but the binary is missing: $electronExe" }
Write-Phase "Verified Electron binary at $electronExe."
