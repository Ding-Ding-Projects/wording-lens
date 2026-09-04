[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$OutputPath,
  [Parameter(Mandatory=$true)][string]$Tag,
  [Parameter(Mandatory=$true)][string]$StartedAt,
  [Parameter(Mandatory=$true)][string]$CompletedAt,
  [Parameter(Mandatory=$true)][string]$LineCountPath,
  [Parameter(Mandatory=$true)][string]$ReceiptPath,
  [string]$CodeName = 'Classic Har Gow · 蝦餃',
  [string]$CodeNameUrl = 'https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/latest'
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
$body = @"
# Wording Lens $Tag

Release code name: [$CodeName]($CodeNameUrl), resolved from the public dim-sum catalog.

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
| Other | $($lines.other.files) | $($lines.other.total) | $($lines.other.nonBlank) | $($lines.other.agentLines) |
| **Total** | **$($lines.total.files)** | **$($lines.total.total)** | **$($lines.total.nonBlank)** | **$($lines.total.agentLines)** |

The workflow did not run tests, lint, type checks, coverage, accessibility checks, or capture checks. Those checks remain local development responsibilities and are not release gates.
"@
$body | Set-Content -LiteralPath $OutputPath -Encoding UTF8
