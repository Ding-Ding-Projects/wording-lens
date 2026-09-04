[CmdletBinding()]
param([string]$OutputPath)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

# This inventory is deliberately hand-written. A new extension must be classified here rather than silently disappearing.
$sourceExtensions = @('.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.py', '.cs', '.cpp', '.h', '.hpp', '.bat', '.ps1', '.sh', '.json', '.yml', '.yaml')
$textExtensions = @('.md', '.txt', '.toml', '.xml', '.html', '.htm', '.css', '.scss', '.sass', '.less', '.svg')
$styleExtensions = @('.css', '.scss', '.sass', '.less', '.html', '.htm', '.svg')
$binaryExtensions = @('.ico', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.zip', '.7z', '.exe', '.dll', '.nupkg', '.pdf')
$lockFileNames = @('package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock', 'Gemfile.lock', 'composer.lock')
$generatedPrefixes = @('dist/', 'dist-electron/', 'coverage/', 'packaging/release-staging/', 'generated/', 'build/')
$vendoredPrefixes = @('vendor/', 'third_party/', 'node_modules/', 'packages/vendor/')
$excluded = [ordered]@{ lockfiles = $lockFileNames; binaryExtensions = $binaryExtensions; generatedPrefixes = $generatedPrefixes; vendoredPrefixes = $vendoredPrefixes }

function New-Row { return [ordered]@{ files = 0; total = 0; nonBlank = 0; agentLines = 0; otherLines = 0 } }
$rows = [ordered]@{ source = New-Row; tests = New-Row; stylesMarkup = New-Row; documentation = New-Row; generated = New-Row; vendored = New-Row; unclassifiedText = New-Row; binaryExcluded = [ordered]@{ files = 0; bytes = 0 }; lockfilesExcluded = [ordered]@{ files = 0; bytes = 0 } }
$paths = @(git -C $root ls-files)
foreach ($relative in $paths) {
  if ([string]::IsNullOrWhiteSpace($relative)) { continue }
  $normalized = $relative.Replace('\', '/')
  $file = Join-Path $root $relative
  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { continue }
  $item = Get-Item -LiteralPath $file
  $leaf = Split-Path -Leaf $normalized
  if ($lockFileNames -contains $leaf) { $rows.lockfilesExcluded.files++; $rows.lockfilesExcluded.bytes += $item.Length; continue }
  $extension = [IO.Path]::GetExtension($leaf).ToLowerInvariant()
  if ($binaryExtensions -contains $extension) { $rows.binaryExcluded.files++; $rows.binaryExcluded.bytes += $item.Length; continue }
  $bytes = [IO.File]::ReadAllBytes($file)
  if (@($bytes | Where-Object { $_ -eq 0 }).Count -gt 0) { $rows.binaryExcluded.files++; $rows.binaryExcluded.bytes += $item.Length; continue }
  $text = [Text.Encoding]::UTF8.GetString($bytes)
  $lines = if ($text.Length -eq 0) { @() } else { [regex]::Split($text, "\r\n|\n|\r") }
  if ($lines.Count -gt 0 -and $lines[$lines.Count - 1] -eq '') { $lines = $lines[0..($lines.Count - 2)] }
  $category = if (@($generatedPrefixes | Where-Object { $normalized.StartsWith($_, [StringComparison]::OrdinalIgnoreCase) }).Count) { 'generated' } elseif (@($vendoredPrefixes | Where-Object { $normalized.StartsWith($_, [StringComparison]::OrdinalIgnoreCase) }).Count) { 'vendored' } elseif ($sourceExtensions -contains $extension) { 'source' } elseif ($textExtensions -contains $extension) { 'unclassifiedText' } else { 'unclassifiedText' }
  if ($normalized -match '(^|/)(test|tests|__tests__)(/|$)|\.(test|spec)\.') { $category = 'tests' } elseif ($styleExtensions -contains $extension) { $category = 'stylesMarkup' } elseif ($normalized -match '(^|/)(docs?|design)(/|$)|\.md$') { $category = 'documentation' }
  $rows[$category].files++; $rows[$category].total += $lines.Count; $rows[$category].nonBlank += @($lines | Where-Object { $_.Trim().Length -gt 0 }).Count
  $author = ''
  foreach ($blameLine in @(git -C $root blame --line-porcelain -- $relative)) { if ($blameLine.StartsWith('author ')) { $author = $blameLine.Substring(7) } elseif ($blameLine.StartsWith("`t")) { if ($author -eq 'Claude Fable 5') { $rows[$category].agentLines++ } else { $rows[$category].otherLines++ } } }
}
$countedNames = @('source', 'tests', 'stylesMarkup', 'documentation', 'generated', 'vendored', 'unclassifiedText')
$total = New-Row
foreach ($name in $countedNames) { foreach ($field in @('files', 'total', 'nonBlank', 'agentLines', 'otherLines')) { $total[$field] += [int]$rows[$name][$field] } }
$rows.total = $total
$result = [ordered]@{ schemaVersion = 2; sourceCommit = (& git -C $root rev-parse HEAD).Trim(); generatedAt = (Get-Date).ToUniversalTime().ToString('o'); extensionInventory = [ordered]@{ source = $sourceExtensions; text = $textExtensions; stylesMarkup = $styleExtensions; binaryExcluded = $binaryExtensions; lockfilesExcluded = $lockFileNames }; categories = $rows; exclusions = $excluded }
$json = $result | ConvertTo-Json -Depth 10
if ($OutputPath) { $json | Set-Content -LiteralPath $OutputPath -Encoding UTF8 }
$json
