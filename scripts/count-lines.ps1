[CmdletBinding()]
param([string]$OutputPath)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$paths = @(git -C $root ls-files)
$excluded = @('node_modules/', 'dist/', 'dist-electron/', 'coverage/', 'packaging/release-staging/')
$rows = [ordered]@{
  source = [ordered]@{ files = 0; total = 0; nonBlank = 0 }
  tests = [ordered]@{ files = 0; total = 0; nonBlank = 0 }
  stylesMarkup = [ordered]@{ files = 0; total = 0; nonBlank = 0 }
  documentation = [ordered]@{ files = 0; total = 0; nonBlank = 0 }
  other = [ordered]@{ files = 0; total = 0; nonBlank = 0 }
}
foreach ($relative in $paths) {
  if ([string]::IsNullOrWhiteSpace($relative) -or @($excluded | Where-Object { $relative.StartsWith($_, [StringComparison]::OrdinalIgnoreCase) }).Count) { continue }
  $file = Join-Path $root $relative
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { continue }
  $text = [IO.File]::ReadAllText($file)
  $lines = if ($text.Length -eq 0) { @() } else { [regex]::Split($text, "\r\n|\n|\r") }
  if ($lines.Count -gt 0 -and $lines[$lines.Count - 1] -eq '') { $lines = $lines[0..($lines.Count - 2)] }
  $key = if ($relative -match '(^|/)(test|tests|__tests__)(/|$)|\.(test|spec)\.') { 'tests' } elseif ($relative -match '\.(css|scss|sass|less|html|htm)$') { 'stylesMarkup' } elseif ($relative -match '(^|/)(docs?|design)(/|$)|\.md$') { 'documentation' } elseif ($relative -match '\.(ts|tsx|js|jsx|mjs|cjs|py|cs|cpp|h|hpp|json|yml|yaml|bat|ps1|sh)$') { 'source' } else { 'other' }
  $rows[$key].files++
  $rows[$key].total += $lines.Count
  $rows[$key].nonBlank += @($lines | Where-Object { $_.Trim().Length -gt 0 }).Count
}
$categoryNames = @('source', 'tests', 'stylesMarkup', 'documentation', 'other')
$totalFiles = 0
$totalLines = 0
$totalNonBlank = 0
foreach ($categoryName in $categoryNames) {
  $totalFiles += [int]$rows[$categoryName].files
  $totalLines += [int]$rows[$categoryName].total
  $totalNonBlank += [int]$rows[$categoryName].nonBlank
}
$rows.total = [ordered]@{ files = $totalFiles; total = $totalLines; nonBlank = $totalNonBlank }
$result = [ordered]@{ schemaVersion = 1; sourceCommit = (& git -C $root rev-parse HEAD).Trim(); generatedAt = (Get-Date).ToUniversalTime().ToString('o'); categories = $rows; exclusions = $excluded }
$json = $result | ConvertTo-Json -Depth 8
if ($OutputPath) { $json | Set-Content -LiteralPath $OutputPath -Encoding UTF8 }
$json
