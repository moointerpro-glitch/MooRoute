param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$source = [IO.Path]::GetFullPath('C:\xampp\htdocs\MooRoute')
$target = [IO.Path]::GetFullPath('C:\xampp\htdocs\moointer-transport')
$parent = [IO.Path]::GetFullPath('C:\xampp\htdocs')

# Run from the parent after closing editors, image viewers and coding tools using this workspace.
Set-Location -LiteralPath $parent
if ((Split-Path $source -Parent) -ne $parent -or (Split-Path $target -Parent) -ne $parent) { throw 'Target validation failed.' }
if ((Test-Path -LiteralPath $target) -or !(Test-Path -LiteralPath (Join-Path $source '.git'))) { throw 'Source missing or target already exists; nothing moved.' }
$configFile = Join-Path $source '.local\mysql\my.ini'
if (!(Test-Path -LiteralPath $configFile)) { throw 'Project MySQL configuration missing.' }
$configBefore = [IO.File]::ReadAllText($configFile)
if (!$configBefore.Contains($source.Replace('\', '/'))) { throw 'Unexpected MySQL configuration; nothing moved.' }
if ($CheckOnly) { Write-Output 'PASS: exact source/target and MySQL paths validated; no services stopped or files changed.'; exit 0 }

function Invoke-ProjectCommand([string]$Directory, [string]$Script) {
  Push-Location -LiteralPath $Directory
  try { & npm.cmd run $Script; if ($LASTEXITCODE -ne 0) { throw "Project command failed: $Script" } }
  finally { Pop-Location }
}
function Start-Preview([string]$Directory) {
  $next = Join-Path $Directory 'node_modules\next\dist\bin\next'
  Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @('"' + $next + '"', 'start', '--hostname', '127.0.0.1', '--port', '3010') -WorkingDirectory $Directory -WindowStyle Hidden -RedirectStandardOutput (Join-Path $Directory '.local\preview.log') -RedirectStandardError (Join-Path $Directory '.local\preview-error.log') | Out-Null
}
$listener = Get-NetTCPConnection -State Listen -LocalPort 3010 -ErrorAction SilentlyContinue
if ($listener) {
  $preview = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
  if ($preview.Name -ne 'node.exe' -or !$preview.CommandLine.Contains($source) -or $preview.CommandLine -notmatch 'start.*3010') { throw 'Port 3010 belongs to another application; nothing changed.' }
}
Invoke-ProjectCommand $source 'db:backup:verify'
$environmentHash = (Get-FileHash -LiteralPath (Join-Path $source '.env') -Algorithm SHA256).Hash
if ($listener) { Stop-Process -Id $listener.OwningProcess; }
Invoke-ProjectCommand $source 'db:stop:windows'
$utf8 = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText($configFile, $configBefore.Replace($source.Replace('\', '/'), $target.Replace('\', '/')), $utf8)
try {
  # Same-volume rename only; no copy, recursive deletion, reset or migration.
  Rename-Item -LiteralPath $source -NewName 'moointer-transport' -ErrorAction Stop
} catch {
  [IO.File]::WriteAllText($configFile, $configBefore, $utf8)
  Invoke-ProjectCommand $source 'db:start:windows'
  if ($listener) { Start-Preview $source }
  throw 'Workspace is still locked. MySQL configuration and services restored at the original path. Save and close applications using MooRoute, then rerun.'
}
if ((Get-FileHash -LiteralPath (Join-Path $target '.env') -Algorithm SHA256).Hash -ne $environmentHash) { throw 'Environment verification failed; data retained at target.' }
Invoke-ProjectCommand $target 'db:start:windows'
Invoke-ProjectCommand $target 'db:check'
Invoke-ProjectCommand $target 'build'
Start-Preview $target
$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  try { $health = Invoke-RestMethod -Uri 'http://127.0.0.1:3010/api/health/live'; if ($health.status -eq 'ok') { $ready = $true; break } } catch { }
  Start-Sleep -Seconds 1
}
if (!$ready) { throw 'Folder renamed and MySQL started; preview needs inspection. No data was reset.' }
$result = @{ source = $source; target = $target; environmentPreserved = $true; checks = @('db:backup:verify', 'db:start:windows', 'db:check', 'build', 'GET /api/health/live'); completedAt = [DateTime]::UtcNow.ToString('o') }
[IO.File]::WriteAllText((Join-Path $target '.local\workspace-rename.json'), ($result | ConvertTo-Json), $utf8)
$note = "`r`nWorkspace rename completed at $($result.completedAt): $target. Verified backup restore, retained environment, MySQL readiness, production build and preview liveness. See .local/workspace-rename.json (no credentials).`r`n"
foreach ($document in @('docs\PROGRESS.md', 'docs\HANDOFF.md')) { [IO.File]::AppendAllText((Join-Path $target $document), $note, $utf8) }
Write-Output 'PASS: renamed to moointer-transport, MySQL and credentials retained, preview ready on http://127.0.0.1:3010. Open the new folder in your editor.'
