[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$OutputPath)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$templatePath = Join-Path $root 'packaging\electron-builder.yml'
$commit = (& git -C $root rev-parse HEAD).Trim()
if ($commit -notmatch '^[0-9a-f]{40}$') { throw "Could not resolve an immutable source commit: $commit" }
$template = Get-Content -LiteralPath $templatePath -Raw
$url = "https://github.com/Ding-Ding-Projects/wording-lens/raw/$commit/packaging/wording-lens.ico"
$configured = [regex]::Replace($template, '(?m)^(\s*iconUrl:\s*).+$', ('$1' + $url))
if ($configured -eq $template -or $configured -notmatch [regex]::Escape("raw/$commit/packaging/wording-lens.ico")) { throw 'The immutable icon URL boundary was not generated.' }
$configured | Set-Content -LiteralPath $OutputPath -Encoding UTF8
