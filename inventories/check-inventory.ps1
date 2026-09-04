[CmdletBinding()]
param(
    [string]$InventoryPath = (Join-Path $PSScriptRoot '..\INVENTORY.md'),
    [string]$ProbeMissingId
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $InventoryPath -PathType Leaf)) {
    throw "Inventory file was not found: $InventoryPath"
}

$text = Get-Content -Raw -LiteralPath $InventoryPath
$featureIds = 1..55 | ForEach-Object { 'F{0:D2}' -f $_ }
$surfaceIds = 1..14 | ForEach-Object { 'S{0:D2}' -f $_ }

function Assert-Row([string]$id) {
    $escaped = [regex]::Escape($id)
    $matches = [regex]::Matches($text, "(?m)^\| $escaped \|")
    if ($matches.Count -ne 1) {
        throw "Expected exactly one inventory row for $id, found $($matches.Count)."
    }
    if ($ProbeMissingId -eq $id) {
        throw "Negative probe removed required row $id."
    }
}

foreach ($id in $featureIds) { Assert-Row $id }
foreach ($id in $surfaceIds) { Assert-Row $id }

$requiredPhrases = @(
    'Baseline commit:',
    'Pending implementation',
    'Pending evidence',
    'Evidence acceptance rule'
)
foreach ($phrase in $requiredPhrases) {
    if (-not $text.Contains($phrase)) {
        throw "Required inventory phrase is missing: $phrase"
    }
}

Write-Output "Inventory structure verified: $($featureIds.Count) feature rows, $($surfaceIds.Count) surface rows."
