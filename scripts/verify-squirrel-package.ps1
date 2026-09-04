[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$OutputPath,
  [string]$ExpectedCommit
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Get-FileDigest([Parameter(Mandatory=$true)][string]$LiteralPath, [ValidateSet('SHA1', 'SHA256')][string]$Algorithm = 'SHA256') {
  $stream = [IO.File]::Open($LiteralPath, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
  try {
    $algorithmInstance = if ($Algorithm -eq 'SHA1') { [Security.Cryptography.SHA1]::Create() } else { [Security.Cryptography.SHA256]::Create() }
    try { return ([BitConverter]::ToString($algorithmInstance.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
    finally { $algorithmInstance.Dispose() }
  } finally { $stream.Dispose() }
}
$out = (Resolve-Path $OutputPath).Path
$setup = Get-ChildItem -LiteralPath $out -Filter '*-Setup.exe' -File | Select-Object -First 1
$index = Join-Path $out 'RELEASES'
$packages = @(Get-ChildItem -LiteralPath $out -Filter '*.nupkg' -File)
if (-not $setup -or -not (Test-Path -LiteralPath $index) -or $packages.Count -eq 0) {
  throw "Squirrel.Windows output is incomplete under $out."
}
$sig = Get-AuthenticodeSignature -LiteralPath $setup.FullName
if ($sig.Status -ne 'NotSigned') { throw "Unsigned installer check failed: $($sig.Status)." }
$commit = (& git -C $root rev-parse HEAD).Trim()
if ($ExpectedCommit -and $commit -ne $ExpectedCommit) { throw "Source receipt mismatch: expected $ExpectedCommit, got $commit." }
$indexText = Get-Content -LiteralPath $index -Raw
$releaseLines = @($indexText -split "\r\n|\n|\r" | Where-Object { $_.Trim().Length -gt 0 })
if ($releaseLines.Count -eq 0) { throw 'RELEASES is empty.' }
foreach ($line in $releaseLines) { if ($line -notmatch '^[0-9a-fA-F]{40}\s+[0-9]+\s+\S+\.nupkg$') { throw "RELEASES contains an invalid record: $line" } }
foreach ($pkg in $packages) {
  if ($indexText -notmatch [regex]::Escape($pkg.Name)) { throw "RELEASES does not reference full package $($pkg.Name)." }
  $record = @($releaseLines | Where-Object { $_ -match ("\s" + [regex]::Escape($pkg.Name) + '$') }) | Select-Object -First 1
  if (-not $record) { throw "RELEASES has no parseable record for $($pkg.Name)." }
  $parts = $record -split '\s+'
  if ([int64]$parts[1] -ne [int64]$pkg.Length) { throw "RELEASES size differs from $($pkg.Name)." }
}
if (@($packages | Where-Object { $_.Name -notmatch '-delta\.nupkg$' }).Count -eq 0) { throw 'No full non-delta .nupkg was found.' }
if (Test-Path -LiteralPath (Join-Path $out 'source-receipt.json')) {
  $receipt = Get-Content -LiteralPath (Join-Path $out 'source-receipt.json') -Raw | ConvertFrom-Json
  if ($receipt.schemaVersion -ne 2 -or $receipt.receiptType -ne 'squirrel-windows-build') { throw 'source-receipt.json does not use schema version 2.' }
  foreach ($output in @($receipt.outputs)) {
    $outputPath = Join-Path $root $output.path
    if (-not (Test-Path -LiteralPath $outputPath)) { throw "Receipt output is missing: $($output.path)" }
    $outputItem = Get-Item -LiteralPath $outputPath
    if ([int64]$outputItem.Length -ne [int64]$output.bytes) { throw "Receipt byte count differs: $($output.path)" }
    if ((Get-FileDigest -LiteralPath $outputPath) -ne $output.sha256) { throw "Receipt SHA-256 differs: $($output.path)" }
  }
}
[ordered]@{
  schemaVersion = 2
  receiptType = 'squirrel-windows-verification'
  sourceCommit = $commit
  setup = [ordered]@{ name = $setup.Name; sha256 = (Get-FileDigest -LiteralPath $setup.FullName); signature = $sig.Status.ToString(); bytes = $setup.Length }
  releases = [ordered]@{ name = 'RELEASES'; sha256 = (Get-FileDigest -LiteralPath $index); bytes = (Get-Item -LiteralPath $index).Length }
  packages = @($packages | ForEach-Object { [ordered]@{ name = $_.Name; sha256 = (Get-FileDigest -LiteralPath $_.FullName); bytes = $_.Length } })
} | ConvertTo-Json -Depth 6
