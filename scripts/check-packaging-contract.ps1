[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$release = Get-Content (Join-Path $root '.github/workflows/release.yml') -Raw
$pages = Get-Content (Join-Path $root '.github/workflows/pages.yml') -Raw
$builder = Get-Content (Join-Path $root 'packaging/electron-builder.yml') -Raw
$build = Get-Content (Join-Path $root 'scripts/build-project.ps1') -Raw
$bootstrap = Get-Content (Join-Path $root 'scripts/bootstrap-dependencies.ps1') -Raw
$installer = Get-Content (Join-Path $root 'scripts/build-installer.ps1') -Raw
$counter = Get-Content (Join-Path $root 'scripts/count-lines.ps1') -Raw
$codename = Get-Content (Join-Path $root 'scripts/select-release-codename.ps1') -Raw
$required = @(
  'workflow_dispatch', 'isDraft', 'gh release upload', 'assets', 'asset.size',
  'RELEASES', '.nupkg', 'source-receipt.json', 'startedAt', 'draft=false'
)
foreach ($needle in $required) { if ($release -notmatch [regex]::Escape($needle)) { throw "Release contract is missing: $needle" } }
if ($pages -match '(?m)^\s*workflow_dispatch:\s*$|(?m)^\s*cancel-in-progress:\s*') { throw 'Pages deployment must remain push-only without cancellation.' }
if ($builder -notmatch [regex]::Escape('dist-electron/apps/desktop/electron/main.js')) { throw 'Builder contract is missing the Electron entry point.' }
foreach ($needle in @('dist-electron\apps\desktop\electron\main.js', 'dist\renderer\index.html')) { if ($build -notmatch [regex]::Escape($needle)) { throw "Build contract is missing: $needle" } }
foreach ($needle in @('sourceExtensions', 'textExtensions', 'binaryExtensions', 'lockFileNames', 'generatedPrefixes', 'vendoredPrefixes', 'unclassifiedText')) { if ($counter -notmatch [regex]::Escape($needle)) { throw "Line-counter inventory is missing: $needle" } }
foreach ($needle in @('catalog/index.json', 'catalog-v1', 'browser_download_url', 'gh api --paginate --slurp')) { if ($codename -notmatch [regex]::Escape($needle)) { throw "Code-name resolver is missing: $needle" } }
if ($builder -match 'raw/main|remoteReleases:|setupIcon:') { throw 'Mutable or unsupported packaging configuration remains.' }
foreach ($needle in @('nodeSpec.version', 'builderSpec.version', 'nodeVersionMismatch', 'builderVersion', 'electronInstall', 'electronExe')) { if ($bootstrap -notmatch [regex]::Escape($needle)) { throw "Bootstrap contract is missing: $needle" } }
foreach ($needle in @('dist-electron\apps\desktop\electron\main.js', 'dist\renderer\index.html', 'source checkout is dirty')) { if ($build -notmatch [regex]::Escape($needle)) { throw "Build contract is missing: $needle" } }
if ($counter -match 'dist-electron/main\.js|dist/index\.html|--no-save') { throw 'Obsolete packaging contract text remains.' }
if ($installer -match '(?m)^\s*&\s*\$npm\.Source\s+exec') { throw 'Installer must use the verified pinned electron-builder command.' }
Write-Output 'Packaging contract regression: PASS'
