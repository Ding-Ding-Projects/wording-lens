[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$OutputPath)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$templatePath = Join-Path $root 'packaging\electron-builder.yml'
$iconCommit = (& git -C $root rev-parse origin/main).Trim()
if ($iconCommit -notmatch '^[0-9a-f]{40}$') { throw "Could not resolve the public main icon commit: $iconCommit" }
$iconPath = 'packaging/wording-lens.ico'
$publicIconBlob = (& git -C $root rev-parse ("$iconCommit`:$iconPath")).Trim()
$localIconBlob = (& git -C $root hash-object $iconPath).Trim()
if ($publicIconBlob -notmatch '^[0-9a-f]{40}$' -or $localIconBlob -notmatch '^[0-9a-f]{40}$') { throw 'Could not resolve immutable icon blobs.' }
if ($publicIconBlob -ne $localIconBlob) { throw "The local icon does not match the public main icon revision $iconCommit." }
$template = Get-Content -LiteralPath $templatePath -Raw
$url = "https://github.com/Ding-Ding-Projects/wording-lens/raw/$iconCommit/$iconPath"
$configured = [regex]::Replace($template, '(?m)^(\s*iconUrl:\s*).+$', ('$1' + $url))
if ($configured -eq $template -or $configured -notmatch [regex]::Escape("raw/$iconCommit/$iconPath")) { throw 'The immutable icon URL boundary was not generated.' }
$configured | Set-Content -LiteralPath $OutputPath -Encoding UTF8
