[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$probe = Join-Path ([IO.Path]::GetTempPath()) ("wording-lens-native-module-probe-{0}.ps1" -f [guid]::NewGuid().ToString('N'))
try {
  @'
$ErrorActionPreference = 'Stop'
Get-Command Get-FileHash, Get-AuthenticodeSignature, Expand-Archive | ForEach-Object Name
'@ | Set-Content -LiteralPath $probe -Encoding UTF8
  $command = "set `"PSModulePath=C:\\invalid`" && call `"$root\\download-dependencies.bat`" /s && powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$probe`""
  $output = & cmd.exe /d /c $command 2>&1
  if ($LASTEXITCODE -ne 0) { throw "The native Windows PowerShell module probe failed: $($output -join [Environment]::NewLine)" }
  foreach ($name in @('Get-FileHash', 'Get-AuthenticodeSignature', 'Expand-Archive')) {
    if ($output -notcontains $name) { throw "The native Windows PowerShell module probe did not resolve $name." }
  }
  Write-Output 'Native Windows PowerShell module probe: PASS'
} finally {
  Remove-Item -LiteralPath $probe -Force -ErrorAction SilentlyContinue
}
