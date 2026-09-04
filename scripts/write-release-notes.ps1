[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$OutputPath,
  [Parameter(Mandatory=$true)][string]$Tag,
  [Parameter(Mandatory=$true)][string]$StartedAt,
  [Parameter(Mandatory=$true)][string]$CompletedAt,
  [Parameter(Mandatory=$true)][string]$LineCountPath,
  [Parameter(Mandatory=$true)][string]$ReceiptPath
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

The committed command `pwsh -NoProfile -File scripts/count-lines.ps1` produced this table at the tagged commit. Vendored trees, dependency directories, build output, and lockfiles are excluded where applicable.

| Category | Files | Total lines | Non-blank lines |
| --- | ---: | ---: | ---: |
| Source | $($lines.source.files) | $($lines.source.total) | $($lines.source.nonBlank) |
| Tests | $($lines.tests.files) | $($lines.tests.total) | $($lines.tests.nonBlank) |
| Styles and markup | $($lines.stylesMarkup.files) | $($lines.stylesMarkup.total) | $($lines.stylesMarkup.nonBlank) |
| Documentation | $($lines.documentation.files) | $($lines.documentation.total) | $($lines.documentation.nonBlank) |
| Other | $($lines.other.files) | $($lines.other.total) | $($lines.other.nonBlank) |
| **Total** | **$($lines.total.files)** | **$($lines.total.total)** | **$($lines.total.nonBlank)** |

The workflow did not run tests, lint, type checks, coverage, accessibility checks, or capture checks. Those checks remain local development responsibilities and are not release gates.
"@
$body | Set-Content -LiteralPath $OutputPath -Encoding UTF8
