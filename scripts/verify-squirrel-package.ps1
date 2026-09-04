[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$OutputPath,
  [string]$ExpectedCommit
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
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
foreach ($pkg in $packages) {
  if ($indexText -notmatch [regex]::Escape($pkg.Name)) { throw "RELEASES does not reference full package $($pkg.Name)." }
}
[ordered]@{
  sourceCommit = $commit
  setup = [ordered]@{ name = $setup.Name; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $setup.FullName).Hash.ToLowerInvariant(); signature = $sig.Status.ToString(); bytes = $setup.Length }
  releases = [ordered]@{ name = 'RELEASES'; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $index).Hash.ToLowerInvariant(); bytes = (Get-Item -LiteralPath $index).Length }
  packages = @($packages | ForEach-Object { [ordered]@{ name = $_.Name; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToLowerInvariant(); bytes = $_.Length } })
} | ConvertTo-Json -Depth 6
