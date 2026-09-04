[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Repository)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$catalogUrl = 'https://raw.githubusercontent.com/Ding-Ding-Projects/dim-sum-photos/main/catalog/index.json'
$catalogRepository = 'Ding-Ding-Projects/dim-sum-photos'
$empty = [ordered]@{ schemaVersion = 1; available = $false; codeName = ''; codeNameUrl = ''; reason = '' }
try {
  $catalog = (Invoke-WebRequest -UseBasicParsing -Uri $catalogUrl).Content | ConvertFrom-Json
  $releasePages = @(gh api --paginate --slurp "repos/$Repository/releases?per_page=100" | ConvertFrom-Json)
  $priorReleases = @($releasePages | ForEach-Object { $_ })
  $used = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach ($release in $priorReleases) {
    if ($release.body) {
      foreach ($dish in @($catalog.dishes)) { if ($release.body -match [regex]::Escape($dish.name.en) -and $release.body -match [regex]::Escape($dish.name.zhHant)) { [void]$used.Add($dish.id) } }
    }
  }
  $catalogPages = @(gh api --paginate --slurp "repos/$catalogRepository/releases?per_page=100" | ConvertFrom-Json)
  $catalogReleases = @($catalogPages | ForEach-Object { $_ }) | Where-Object { -not $_.draft -and $_.tag_name -like 'catalog-v1*' }
  $assets = @($catalogReleases | ForEach-Object { $_.assets })
  foreach ($dish in @($catalog.dishes)) {
    if ($used.Contains($dish.id) -or -not $dish.image.path) { continue }
    $assetName = Split-Path -Leaf $dish.image.path
    $asset = @($assets | Where-Object { $_.name -eq $assetName }) | Select-Object -First 1
    if ($asset -and $asset.browser_download_url -like 'https://*') {
      [ordered]@{ schemaVersion = 1; available = $true; codeName = "$($dish.name.en) · $($dish.name.zhHant)"; codeNameUrl = $asset.browser_download_url; reason = '' } | ConvertTo-Json -Compress
      exit 0
    }
  }
  $empty.reason = 'No unused catalog record with a published catalog-v1 photo asset was found.'
} catch {
  $empty.reason = "Catalog resolution unavailable: $($_.Exception.Message)"
}
$empty | ConvertTo-Json -Compress
