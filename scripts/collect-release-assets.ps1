[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$OutputPath,
  [Parameter(Mandatory=$true)][string]$DestinationPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path $OutputPath).Path
$destination = [IO.Path]::GetFullPath($DestinationPath)
if (-not (Test-Path -LiteralPath $destination)) { New-Item -ItemType Directory -Path $destination -Force | Out-Null }
$files = @(Get-ChildItem -LiteralPath $source -File | Where-Object { $_.Name -match '(-Setup\.exe$|^RELEASES$|\.nupkg$|\.nupkg\.sha512$|^source-receipt\.json$)' })
if ($files.Count -lt 3) { throw "Expected Setup.exe, RELEASES, and a full .nupkg in $source." }
foreach ($file in $files) { Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $destination $file.Name) -Force }
$receipt = [ordered]@{ schemaVersion = 1; sourceDirectory = $source; files = @($files | ForEach-Object { [ordered]@{ name = $_.Name; bytes = $_.Length; sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $_.FullName).Hash.ToLowerInvariant() } }) }
$receipt | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $destination 'release-assets.json') -Encoding UTF8
