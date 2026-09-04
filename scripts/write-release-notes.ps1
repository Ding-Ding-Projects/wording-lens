[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$OutputPath,
  [Parameter(Mandatory=$true)][string]$Tag,
  [Parameter(Mandatory=$true)][string]$StartedAt,
  [Parameter(Mandatory=$true)][string]$CompletedAt,
  [Parameter(Mandatory=$true)][string]$LineCountPath,
  [Parameter(Mandatory=$true)][string]$ReceiptPath,
  [string]$CodeName = '',
  [string]$CodeNameUrl = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$start = [DateTimeOffset]::Parse($StartedAt).ToUniversalTime()
$end = [DateTimeOffset]::Parse($CompletedAt).ToUniversalTime()
$duration = $end - $start
$lineCount = Get-Content -LiteralPath $LineCountPath -Raw | ConvertFrom-Json
$receipt = Get-Content -LiteralPath $ReceiptPath -Raw | ConvertFrom-Json
$lines = $lineCount.categories
$format = '{0:00}:{1:00}:{2:00}' -f [int]$duration.TotalHours, $duration.Minutes, $duration.Seconds
$codeNameLine = if ($CodeName -and $CodeNameUrl) { "Release code name: [$CodeName]($CodeNameUrl), resolved from the public dim-sum catalog." } else { 'Release code name: unavailable; the public catalog or a published photo asset was not available during this workflow.' }
$body = @"
# Wording Lens $Tag

$codeNameLine

## Delivery

- Windows installer: unsigned Squirrel.Windows (`$($receipt.installer.path)`).
- Release index: `$($receipt.releaseIndex.path)`.
- Full package files: `$($receipt.packages.Count)`.
- Source commit: `$($receipt.sourceCommit)`.
- Code signing: not used, as required by the project policy. The operating system may show an unknown-publisher warning.

## Workflow timing (UTC)

- Workflow started: `$($start.ToString('o'))`
- Workflow completed: `$($end.ToString('o'))`
- Workflow duration: `$format`

## Line count

The committed command `pwsh -NoProfile -File scripts/count-lines.ps1` produced this table at the tagged commit. Vendored trees, dependency directories, build output, and lockfiles are excluded where applicable. Agent attribution is based on surviving lines from `git blame`, not historical additions.

| Category | Files | Total lines | Non-blank lines | Agent-attributed lines |
| --- | ---: | ---: | ---: | ---: |
| Source | $($lines.source.files) | $($lines.source.total) | $($lines.source.nonBlank) | $($lines.source.agentLines) |
| Tests | $($lines.tests.files) | $($lines.tests.total) | $($lines.tests.nonBlank) | $($lines.tests.agentLines) |
| Styles and markup | $($lines.stylesMarkup.files) | $($lines.stylesMarkup.total) | $($lines.stylesMarkup.nonBlank) | $($lines.stylesMarkup.agentLines) |
| Documentation | $($lines.documentation.files) | $($lines.documentation.total) | $($lines.documentation.nonBlank) | $($lines.documentation.agentLines) |
| Generated | $($lines.generated.files) | $($lines.generated.total) | $($lines.generated.nonBlank) | $($lines.generated.agentLines) |
| Vendored | $($lines.vendored.files) | $($lines.vendored.total) | $($lines.vendored.nonBlank) | $($lines.vendored.agentLines) |
| Unclassified text | $($lines.unclassifiedText.files) | $($lines.unclassifiedText.total) | $($lines.unclassifiedText.nonBlank) | $($lines.unclassifiedText.agentLines) |
| **Total** | **$($lines.total.files)** | **$($lines.total.total)** | **$($lines.total.nonBlank)** | **$($lines.total.agentLines)** |

The workflow did not run tests, lint, type checks, coverage, accessibility checks, or capture checks. Those checks remain local development responsibilities and are not release gates.
"@
$body | Set-Content -LiteralPath $OutputPath -Encoding UTF8
