param([ValidateSet('setup', 'start', 'stop')][string]$Action = 'start')
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$localRoot = Join-Path $projectRoot '.local'
$mysqlRoot = Join-Path $localRoot 'mysql'
$toolsRoot = Join-Path $localRoot 'tools'
$version = '8.4.11'
$archivePath = Join-Path $localRoot "downloads/mysql-$version-winx64.zip"
$binaryRoot = Join-Path $toolsRoot "mysql-$version-winx64"
$serverPath = Join-Path $binaryRoot 'bin/mysqld.exe'
$adminPath = Join-Path $binaryRoot 'bin/mysqladmin.exe'
$configPath = Join-Path $mysqlRoot 'my.ini'
$clientPath = Join-Path $mysqlRoot 'root-client.ini'
$dataPath = Join-Path $mysqlRoot 'data'
$pidPath = Join-Path $mysqlRoot 'process.json'
$environmentPath = Join-Path $projectRoot '.env'
$utf8 = New-Object Text.UTF8Encoding($false)

function Write-LocalFile([string]$Path, [string]$Content) {
  [IO.File]::WriteAllText($Path, $Content, $utf8)
}
function New-Password {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}
function Get-OwnedProcess {
  if (!(Test-Path -LiteralPath $pidPath)) { return $null }
  $record = Get-Content -LiteralPath $pidPath -Raw | ConvertFrom-Json
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($record.id)"
  if (!$process) { return $null }
  if ($process.ExecutablePath -ne $serverPath -or !$process.CommandLine.Contains($configPath)) {
    throw 'Stored process does not belong to this project. Refusing to control it.'
  }
  return $process
}
function Start-LocalMysql([string]$InitFile = '') {
  if (Get-OwnedProcess) {
    & $adminPath "--defaults-file=$clientPath" ping --silent 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Project MySQL process exists but is not ready. Wait for shutdown/startup before retrying.' }
    Write-Output 'Project MySQL is already running on 127.0.0.1:3307.'
    return
  }
  if (Get-NetTCPConnection -State Listen -LocalPort 3307 -ErrorAction SilentlyContinue) {
    throw 'Port 3307 is occupied. No existing service was changed.'
  }
  $arguments = '--defaults-file="{0}"' -f $configPath
  if ($InitFile) { $arguments += ' --init-file="{0}"' -f $InitFile }
  $process = Start-Process -FilePath $serverPath -ArgumentList $arguments -WindowStyle Hidden -PassThru
  Write-LocalFile $pidPath (@{ id = $process.Id } | ConvertTo-Json)
  for ($attempt = 0; $attempt -lt 45; $attempt++) {
    Start-Sleep -Seconds 1
    if ($process.HasExited) { throw 'Project MySQL exited. Inspect .local/mysql/server.err locally.' }
    & $adminPath "--defaults-file=$clientPath" ping --silent 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Output "MySQL $version ready on 127.0.0.1:3307."; return }
  }
  throw 'Project MySQL did not become ready within 45 seconds.'
}

if ($Action -eq 'stop') {
  $ownedProcess = Get-OwnedProcess
  if (!$ownedProcess) { Write-Output 'Project MySQL is not running.'; exit 0 }
  $stoppingProcess = Get-Process -Id $ownedProcess.ProcessId -ErrorAction SilentlyContinue
  & $adminPath "--defaults-file=$clientPath" shutdown
  if ($LASTEXITCODE -ne 0) { throw 'MySQL did not shut down cleanly.' }
  if ($stoppingProcess -and !$stoppingProcess.WaitForExit(45000)) { throw 'MySQL shutdown is still in progress. Data was retained.' }
  Write-Output 'Project MySQL stopped; data retained.'
  exit 0
}
if ($Action -eq 'start') {
  if (!(Test-Path -LiteralPath $clientPath)) { throw 'Run npm run db:setup:windows first.' }
  Start-LocalMysql
  exit 0
}

if ((Test-Path -LiteralPath $clientPath) -and (Test-Path -LiteralPath $environmentPath)) {
  Start-LocalMysql
  Write-Output 'Existing project setup preserved. No schema or credentials changed.'
  exit 0
}
if ((Test-Path -LiteralPath $environmentPath) -or (Test-Path -LiteralPath $dataPath)) {
  throw 'Existing environment or data detected. Setup will not overwrite it; see docs/SETUP.md.'
}
if (Get-NetTCPConnection -State Listen -LocalPort 3307 -ErrorAction SilentlyContinue) {
  throw 'Port 3307 is occupied. No existing service was changed.'
}
New-Item -ItemType Directory -Path $mysqlRoot, $toolsRoot, (Split-Path $archivePath) -Force | Out-Null
if (!(Test-Path -LiteralPath $archivePath)) {
  & curl.exe --fail --location --silent --show-error --output $archivePath "https://dev.mysql.com/get/Downloads/MySQL-8.4/mysql-$version-winx64.zip"
  if ($LASTEXITCODE -ne 0) { throw 'Official MySQL archive download failed.' }
}
# Published Oracle checksum, fetched over HTTPS; fail before running a mismatched archive.
if ((Get-FileHash -Algorithm MD5 -LiteralPath $archivePath).Hash -ne '2E833921898A9A030EA6BFE81BD811BC') {
  throw 'MySQL archive integrity check failed.'
}
if (!(Test-Path -LiteralPath $serverPath)) { Expand-Archive -LiteralPath $archivePath -DestinationPath $toolsRoot }
$serverBase = $binaryRoot.Replace('\', '/')
$serverData = $dataPath.Replace('\', '/')
$serverLog = (Join-Path $mysqlRoot 'server.err').Replace('\', '/')
Write-LocalFile $configPath @"
[mysqld]
basedir=$serverBase
datadir=$serverData
port=3307
bind-address=127.0.0.1
mysqlx=0
character-set-server=utf8mb4
collation-server=utf8mb4_0900_ai_ci
default-storage-engine=InnoDB
default-time-zone=+00:00
innodb-buffer-pool-size=128M
log-error=$serverLog
"@
& $serverPath "--defaults-file=$configPath" --initialize-insecure
if ($LASTEXITCODE -ne 0) { throw 'MySQL initialization failed. Existing data will not be reset.' }
$rootPassword = New-Password
$appPassword = New-Password
$testPassword = New-Password
$initPath = Join-Path $mysqlRoot 'initialize.sql'
Write-LocalFile $initPath @"
ALTER USER 'root'@'localhost' IDENTIFIED BY '$rootPassword';
CREATE DATABASE moointer_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE moointer_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'moointer_app'@'127.0.0.1' IDENTIFIED BY '$appPassword';
CREATE USER 'moointer_test'@'127.0.0.1' IDENTIFIED BY '$testPassword';
GRANT SELECT ON moointer_dev.* TO 'moointer_app'@'127.0.0.1';
GRANT ALL PRIVILEGES ON moointer_test.* TO 'moointer_test'@'127.0.0.1';
"@
Write-LocalFile $clientPath @"
[client]
user=root
password=$rootPassword
host=127.0.0.1
port=3307
protocol=tcp
"@
try {
  Start-LocalMysql $initPath
  Write-LocalFile $environmentPath @"
DATABASE_URL="mysql://moointer_app:$appPassword@127.0.0.1:3307/moointer_dev"
TEST_DATABASE_URL="mysql://moointer_test:$testPassword@127.0.0.1:3307/moointer_test"
"@
  Write-Output 'Local credentials saved to ignored files. Development and test databases are separate. No operational tables created.'
} finally {
  # Only a known, single bootstrap file is removed; never delete a data directory.
  if (Test-Path -LiteralPath $initPath) { Remove-Item -LiteralPath $initPath }
}
