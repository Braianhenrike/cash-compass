[CmdletBinding()]
param(
  [switch]$ResetDb
)

$ErrorActionPreference = 'Stop'

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptRoot
$EnvFilePath = Join-Path $ProjectRoot '.env'

Set-Location $ProjectRoot

function Write-Step {
  param([string]$Message)

  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Fail {
  param([string]$Message)

  Write-Host ""
  Write-Host "ERRO: $Message" -ForegroundColor Red
  exit 1
}

function Resolve-CommandName {
  param([string[]]$Names)

  foreach ($name in $Names) {
    $command = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) {
      return $name
    }
  }

  return $null
}

function Invoke-CapturedCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$CommandName,
    [string[]]$ArgumentList = @(),
    [int]$TimeoutSeconds = 20
  )

  $job = Start-Job -ScriptBlock {
    param($WorkingDirectory, $ResolvedCommandName, $ResolvedArguments)

    Set-Location $WorkingDirectory
    $output = & $ResolvedCommandName @ResolvedArguments 2>&1
    $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }

    return [pscustomobject]@{
      ExitCode = $exitCode
      Output = @($output | ForEach-Object { $_.ToString() })
    }
  } -ArgumentList $ProjectRoot, $CommandName, $ArgumentList

  if (-not (Wait-Job $job -Timeout $TimeoutSeconds)) {
    Stop-Job $job | Out-Null
    Remove-Job $job | Out-Null

    return [pscustomobject]@{
      ExitCode = -1
      StdOut = ''
      StdErr = "Timeout depois de $TimeoutSeconds segundos."
    }
  }

  $result = Receive-Job $job
  Remove-Job $job | Out-Null
  $joinedOutput = ($result.Output -join [Environment]::NewLine).Trim()

  return [pscustomobject]@{
    ExitCode = $result.ExitCode
    StdOut = if ($result.ExitCode -eq 0) { $joinedOutput } else { '' }
    StdErr = if ($result.ExitCode -eq 0) { '' } else { $joinedOutput }
  }
}

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$CommandName,
    [string[]]$ArgumentList = @()
  )

  & $CommandName @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    $renderedArgs = if ($ArgumentList.Count -gt 0) { " $($ArgumentList -join ' ')" } else { '' }
    Fail "Falha ao executar $CommandName$renderedArgs"
  }
}

function Get-DockerStatus {
  param([string]$DockerCommandName)

  $probe = Invoke-CapturedCommand -CommandName $DockerCommandName -ArgumentList @('ps', '--format', '{{.Names}}') -TimeoutSeconds 8
  return [pscustomobject]@{
    IsReady = ($probe.ExitCode -eq 0)
    Message = if ($probe.ExitCode -eq 0) { 'ok' } elseif ($probe.StdErr) { $probe.StdErr } else { 'Docker nao respondeu.' }
  }
}

function Start-DockerDesktop {
  $candidates = @(
    'C:\Program Files\Docker\Docker\Docker Desktop.exe',
    (Join-Path $env:USERPROFILE 'Desktop\Docker Desktop.lnk')
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      Start-Process $candidate | Out-Null
      return
    }
  }

  Fail 'Nao encontrei o Docker Desktop para iniciar automaticamente.'
}

function Wait-ForDocker {
  param([string]$DockerCommandName)

  $dockerStatus = Get-DockerStatus -DockerCommandName $DockerCommandName
  if ($dockerStatus.IsReady) {
    Write-Host 'Docker pronto.' -ForegroundColor Green
    return
  }

  Write-Step 'Docker nao esta pronto. Abrindo o Docker Desktop...'
  Start-DockerDesktop

  $deadline = (Get-Date).AddMinutes(5)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 5
    $dockerStatus = Get-DockerStatus -DockerCommandName $DockerCommandName
    if ($dockerStatus.IsReady) {
      Write-Host 'Docker pronto.' -ForegroundColor Green
      return
    }

    if ($dockerStatus.Message -match 'unable to start') {
      Fail "O Docker Desktop abriu, mas o engine nao iniciou. Detalhe: $($dockerStatus.Message)"
    }

    Write-Host 'Aguardando o Docker ficar pronto...' -ForegroundColor Yellow
  }

  Fail 'O Docker Desktop nao ficou pronto a tempo.'
}

function Ensure-Dependencies {
  param(
    [string]$NpmCommandName,
    [string]$NodeModulesPath
  )

  if ((Test-Path $NodeModulesPath) -and (Test-Path (Join-Path $NodeModulesPath 'supabase'))) {
    return
  }

  Write-Step 'Instalando dependencias com npm install...'
  Invoke-CheckedCommand -CommandName $NpmCommandName -ArgumentList @('install')
}

function Get-SupabaseEnvMap {
  param([string]$NpxCommandName)

  $status = Invoke-CapturedCommand -CommandName $NpxCommandName -ArgumentList @('supabase', 'status', '-o', 'env') -TimeoutSeconds 30
  if ($status.ExitCode -ne 0) {
    $details = if ($status.StdErr) { $status.StdErr } else { 'sem detalhes adicionais' }
    Fail "Nao consegui ler o status do Supabase. $details"
  }

  $map = @{}
  foreach ($line in ($status.StdOut -split "(`r`n|`n|`r)")) {
    if ($line -match '^\s*([A-Za-z0-9_.-]+)=(.*)$') {
      $map[$matches[1]] = $matches[2].Trim()
    }
  }

  return $map
}

function Get-FirstNonEmptyValue {
  param(
    [hashtable]$Map,
    [string[]]$Keys
  )

  foreach ($key in $Keys) {
    if ($Map.ContainsKey($key) -and $Map[$key]) {
      return $Map[$key]
    }
  }

  return $null
}

function Write-SupabaseEnvFile {
  param(
    [string]$FilePath,
    [string]$SupabaseUrl,
    [string]$PublishableKey
  )

  $existingLines = @()
  if (Test-Path $FilePath) {
    $existingLines = Get-Content $FilePath
  }

  $filteredLines = @()
  foreach ($line in $existingLines) {
    if ($line -notmatch '^VITE_SUPABASE_URL=' -and $line -notmatch '^VITE_SUPABASE_PUBLISHABLE_KEY=') {
      $filteredLines += $line
    }
  }

  $filteredLines += "VITE_SUPABASE_URL=$SupabaseUrl"
  $filteredLines += "VITE_SUPABASE_PUBLISHABLE_KEY=$PublishableKey"

  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllLines($FilePath, $filteredLines, $utf8NoBom)
}

$NodeCommandName = Resolve-CommandName -Names @('node', 'node.exe')
$NpmCommandName = Resolve-CommandName -Names @('npm.cmd', 'npm')
$NpxCommandName = Resolve-CommandName -Names @('npx.cmd', 'npx')
$DockerCommandName = Resolve-CommandName -Names @('docker', 'docker.exe')

if (-not $NodeCommandName) {
  Fail 'Node.js nao esta disponivel no PATH.'
}

if (-not $NpmCommandName) {
  Fail 'npm nao esta disponivel no PATH.'
}

if (-not $NpxCommandName) {
  Fail 'npx nao esta disponivel no PATH.'
}

if (-not $DockerCommandName) {
  Fail 'docker nao esta disponivel no PATH.'
}

Write-Step 'Validando dependencias locais do projeto...'
Ensure-Dependencies -NpmCommandName $NpmCommandName -NodeModulesPath (Join-Path $ProjectRoot 'node_modules')

Write-Step 'Garantindo que o Docker esteja pronto...'
Wait-ForDocker -DockerCommandName $DockerCommandName

Write-Step 'Subindo o Supabase local...'
Invoke-CheckedCommand -CommandName $NpxCommandName -ArgumentList @('supabase', 'start')

$shouldResetDb = $ResetDb.IsPresent -or -not (Test-Path $EnvFilePath)
if ($shouldResetDb) {
  Write-Step 'Aplicando migrations com supabase db reset --yes...'
  Invoke-CheckedCommand -CommandName $NpxCommandName -ArgumentList @('supabase', 'db', 'reset', '--yes')
} else {
  Write-Host ''
  Write-Host 'Pulando db reset para preservar seus dados locais.' -ForegroundColor DarkYellow
  Write-Host 'Se quiser recriar o banco local, rode: .\start-cashcompass.cmd -ResetDb' -ForegroundColor DarkYellow
}

Write-Step 'Sincronizando migrations pendentes sem resetar seus dados...'
Invoke-CheckedCommand -CommandName $NpxCommandName -ArgumentList @('supabase', 'db', 'push', '--local', '--include-all', '--yes')

Write-Step 'Atualizando o .env com a URL e a anon key locais...'
$supabaseEnv = Get-SupabaseEnvMap -NpxCommandName $NpxCommandName
$supabaseUrl = Get-FirstNonEmptyValue -Map $supabaseEnv -Keys @('API_URL', 'SUPABASE_URL')
$publishableKey = Get-FirstNonEmptyValue -Map $supabaseEnv -Keys @('ANON_KEY', 'PUBLISHABLE_KEY', 'SUPABASE_ANON_KEY')

if (-not $supabaseUrl) {
  Fail 'Nao encontrei a URL local do Supabase na saida do comando status.'
}

if (-not $publishableKey) {
  Fail 'Nao encontrei a anon key local do Supabase na saida do comando status.'
}

Write-SupabaseEnvFile -FilePath $EnvFilePath -SupabaseUrl $supabaseUrl -PublishableKey $publishableKey
Write-Host '.env atualizado com sucesso.' -ForegroundColor Green

Write-Step 'Ligando o frontend com npm run dev...'
Invoke-CheckedCommand -CommandName $NpmCommandName -ArgumentList @('run', 'dev')
