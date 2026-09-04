[CmdletBinding()]
param([switch]$Silent)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sourceStatus = @(git -C $root status --porcelain)
if ($sourceStatus.Count -gt 0) { throw "The source checkout is dirty; commit source changes before bootstrapping. Files: $($sourceStatus -join ', ')" }
$bootstrap = Join-Path $root 'scripts\bootstrap-dependencies.ps1'
$bootstrapArgs = if ($Silent) { @{ Silent = $true } } else { @{} }
& $bootstrap @bootstrapArgs
if ($LASTEXITCODE -ne 0) { throw "Dependency bootstrap exited with $LASTEXITCODE." }
$build = Join-Path $root 'scripts\build-project.ps1'
$buildArgs = if ($Silent) { @{ Silent = $true } } else { @{} }
& $build @buildArgs
if ($LASTEXITCODE -ne 0) { throw "Application build exited with $LASTEXITCODE." }

$npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npm) { throw 'npm.cmd was not found after dependency bootstrap.' }
$builder = Get-Command electron-builder.cmd -ErrorAction SilentlyContinue
if (-not $builder) { throw 'The pinned electron-builder command was not found after dependency bootstrap.' }
$config = Join-Path $root 'packaging\electron-builder.yml'
$generatedConfig = Join-Path ([IO.Path]::GetTempPath()) ("wording-lens-builder-{0}.yml" -f [guid]::NewGuid().ToString('N'))
$icon = Join-Path $root 'packaging\wording-lens.ico'
if (-not (Test-Path -LiteralPath $icon)) { throw "The packaged application icon is missing: $icon" }
$out = Join-Path $root 'dist\squirrel-windows'
if (Test-Path -LiteralPath $out) { Remove-Item -LiteralPath $out -Recurse -Force }

Push-Location $root
try {
  & (Join-Path $root 'scripts\generate-builder-config.ps1') -OutputPath $generatedConfig
  if (-not $Silent) { Write-Host '[installer] Creating the unsigned Squirrel.Windows installer.' }
  & $builder.Source --win squirrel --config $generatedConfig
  if ($LASTEXITCODE -ne 0) { throw "electron-builder exited with $LASTEXITCODE." }
} finally { Pop-Location; Remove-Item -LiteralPath $generatedConfig -Force -ErrorAction SilentlyContinue }

$setup = Join-Path $out 'Wording-Lens-0.1.0-Setup.exe'
if (-not (Test-Path -LiteralPath $setup)) {
  $setup = Get-ChildItem -LiteralPath $out -Filter '*-Setup.exe' -File | Select-Object -First 1 -ExpandProperty FullName
}
$releases = Join-Path $out 'RELEASES'
$nupkg = @(Get-ChildItem -LiteralPath $out -Filter '*.nupkg' -File)
if (-not $setup -or -not (Test-Path -LiteralPath $releases) -or $nupkg.Count -eq 0) {
  throw "Squirrel.Windows output is incomplete. Expected Setup.exe, RELEASES, and a full .nupkg under $out."
}
if (@($nupkg | Where-Object { $_.Name -notmatch '-delta\.nupkg$' }).Count -eq 0) { throw 'Squirrel.Windows output contains no full non-delta .nupkg.' }
$signature = Get-AuthenticodeSignature -LiteralPath $setup
if ($signature.Status -ne 'NotSigned') { throw "The installer signing status was $($signature.Status), expected NotSigned." }

$receipt = [ordered]@{
  schemaVersion = 2
  receiptType = 'squirrel-windows-build'
  sourceCommit = (& git -C $root rev-parse HEAD).Trim()
  sourceDirty = [bool](& git -C $root status --porcelain)
  installer = [ordered]@{ path = $setup.Substring($root.Length + 1); sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $setup).Hash.ToLowerInvariant(); signature = $signature.Status.ToString() }
  releaseIndex = [ordered]@{ path = $releases.Substring($root.Length + 1); sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $releases).Hash.ToLowerInvariant() }
  packages = @($nupkg | ForEach-Object { [ordered]@{ path = $_.FullName.Substring($root.Length + 1); sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToLowerInvariant() } })
}
$receipt.outputs = @(@($setup, $releases) + $nupkg | ForEach-Object { $item = Get-Item -LiteralPath $_; [ordered]@{ path = $item.FullName.Substring($root.Length + 1); bytes = $item.Length; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $item.FullName).Hash.ToLowerInvariant() } })
$receiptPath = Join-Path $out 'source-receipt.json'
$receipt | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $receiptPath -Encoding UTF8
if (-not $Silent) { Write-Host "[installer] Verified unsigned installer: $($setup.Substring($root.Length + 1))" }
