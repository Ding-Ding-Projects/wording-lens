[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$source = Join-Path $root 'scripts/bootstrap-dependencies.ps1'
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($source, [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count -gt 0) { throw "Bootstrap script parse failed: $parseErrors" }

# Load only the exact hash function and digest guard. Do not bootstrap tools,
# download archives, execute installers, or replace the dependency cache.
$hashFunction = $ast.Find({
  param($node)
  $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-Sha256'
}, $true)
if (-not $hashFunction) { throw 'The bootstrap hash function is missing.' }
. ([scriptblock]::Create($hashFunction.Extent.Text))
$digestGuard = $ast.Find({
  param($node)
  $node -is [System.Management.Automation.Language.IfStatementAst] -and
    $node.Clauses[0].Item1.Extent.Text -eq '$actual -ne $nodeSpec.sha256.ToLowerInvariant()'
}, $true)
if (-not $digestGuard) { throw 'The bootstrap digest guard is missing.' }
$checkDigest = [scriptblock]::Create($digestGuard.Extent.Text)

function Assert-FileReleased([string]$Path) {
  # An outstanding OpenRead handle denies this exclusive read/write open on Windows.
  $handle = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
  $handle.Dispose()
}

$fixture = Join-Path ([IO.Path]::GetTempPath()) ("wording-lens-hash-{0}.txt" -f [guid]::NewGuid().ToString('N'))
try {
  [IO.File]::WriteAllBytes($fixture, [Text.Encoding]::UTF8.GetBytes('abc'))
  $actual = Get-Sha256 -LiteralPath $fixture
  $expected = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  if ($actual -cne $expected) { throw "Hash fixture failed: expected $expected, got $actual." }
  $nodeSpec = [pscustomobject]@{ sha256 = $expected.ToUpperInvariant(); source = 'neutral hash fixture' }
  & $checkDigest
  Assert-FileReleased -Path $fixture

  $nodeSpec = [pscustomobject]@{ sha256 = ('0' * 64); source = 'neutral hash fixture' }
  $rejected = $false
  try { & $checkDigest } catch {
    if ($_.Exception.Message -notlike 'SHA-256 mismatch for neutral hash fixture:*') { throw }
    $rejected = $true
  }
  if (-not $rejected) { throw 'The exact bootstrap digest guard accepted a mismatched archive hash.' }
  Assert-FileReleased -Path $fixture
  [pscustomobject]@{
    digestMatch = 'passed'
    digestMismatch = 'rejected'
    exclusiveFileOpenAfterSuccessAndMismatch = 'passed'
    platform = [Environment]::OSVersion.Platform.ToString()
  } | ConvertTo-Json
} finally {
  Remove-Item -LiteralPath $fixture -Force -ErrorAction SilentlyContinue
}
