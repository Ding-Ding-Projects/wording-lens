[CmdletBinding()]
param(
  [string]$Version = '0.1.0',
  [int]$RunNumber = 0,
  [int]$RunAttempt = 1
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$base = "v$Version-build.$RunNumber.$RunAttempt"
$tag = $base
$suffix = 1
while ((git ls-remote --exit-code --tags origin "refs/tags/$tag" 2>$null)) {
  $tag = "$base.$suffix"
  $suffix++
}
$tag
