$ErrorActionPreference = 'Stop'

$raiz = $PSScriptRoot
$apiDir = Join-Path $raiz 'backend'
$panelDir = Join-Path $raiz 'hidro-admin'
$appDir = Join-Path $raiz 'frontend\hidroapp'
$sdkAndroid = Join-Path $env:LOCALAPPDATA 'Android\sdk'
$avdHome = Join-Path $env:USERPROFILE '.android\avd'
$configVsCode = Get-Content (Join-Path $raiz '.vscode\settings.json') -Raw | ConvertFrom-Json
$avd = $configVsCode.'hidroapp.androidAvd'
if ([string]::IsNullOrWhiteSpace($avd)) { $avd = 'Pixel_9' }
if ($avd -notmatch '^[A-Za-z0-9_.-]+$') { throw "Nombre de AVD no válido: $avd" }

$env:ANDROID_USER_HOME = Join-Path $env:USERPROFILE '.android'
$env:ANDROID_AVD_HOME = $avdHome
$env:ANDROID_SDK_ROOT = $sdkAndroid
$env:ANDROID_HOME = $sdkAndroid

$flutter = (Get-Command 'flutter.bat' -ErrorAction Stop).Source
$adb = Join-Path $sdkAndroid 'platform-tools\adb.exe'
$emulator = Join-Path $sdkAndroid 'emulator\emulator.exe'
if (-not (Test-Path $adb)) { throw "No se encontró ADB: $adb" }
if (-not (Test-Path $emulator)) { throw "No se encontró el emulador de Android: $emulator" }
if (-not (Test-Path (Join-Path $avdHome "$avd.avd"))) { throw "No se encontró el AVD '$avd' en $avdHome" }

$logDir = Join-Path $env:TEMP 'HIDROAPP-vscode'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Test-PortListening([int]$port) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $attempt = $client.ConnectAsync('127.0.0.1', $port)
        return $attempt.Wait(500) -and $client.Connected
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

function Start-NodeService([string]$name, [string]$directory, [string]$script) {
    $stdout = Join-Path $logDir "$name.out.log"
    $stderr = Join-Path $logDir "$name.err.log"
    Start-Process -FilePath $env:ComSpec `
        -ArgumentList @('/d', '/c', "npm.cmd $script") `
        -WorkingDirectory $directory `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdout `
        -RedirectStandardError $stderr | Out-Null
}

Write-Output 'HIDROAPP: preparando el entorno Android.'

if (-not (Test-PortListening 3000)) { Start-NodeService 'api' $apiDir 'start' }
if (-not (Test-PortListening 5173)) { Start-NodeService 'panel' $panelDir 'run dev -- --host 127.0.0.1' }

$serviciosListos = $false
for ($i = 0; $i -lt 60; $i++) {
    if ((Test-PortListening 3000) -and (Test-PortListening 5173)) {
        $serviciosListos = $true
        break
    }
    Start-Sleep -Seconds 1
}
if (-not $serviciosListos) {
    Get-Content (Join-Path $logDir 'api.err.log') -Tail 20 -ErrorAction SilentlyContinue
    Get-Content (Join-Path $logDir 'panel.err.log') -Tail 20 -ErrorAction SilentlyContinue
    throw "La API y el panel no quedaron listos. Revisa los registros en $logDir"
}
Write-Output 'HIDROAPP: API y panel listos.'

& $adb start-server | Out-Null
$dispositivo = $null
for ($i = 0; $i -lt 30; $i++) {
    $linea = & $adb devices | Select-String '^emulator-\d+\s+device\b' | Select-Object -First 1
    if ($linea) {
        $dispositivo = ($linea.ToString() -split '\s+')[0]
        break
    }
    Start-Sleep -Seconds 1
}

if (-not $dispositivo) {
    Start-Process -FilePath $emulator -ArgumentList @('-avd', $avd, '-no-boot-anim') | Out-Null
    for ($i = 0; $i -lt 180; $i++) {
        $linea = & $adb devices | Select-String '^emulator-\d+\s+device\b' | Select-Object -First 1
        if ($linea) {
            $dispositivo = ($linea.ToString() -split '\s+')[0]
            break
        }
        Start-Sleep -Seconds 2
    }
}
if (-not $dispositivo) { throw "El emulador '$avd' no apareció en ADB." }

$arranqueCompleto = $false
for ($i = 0; $i -lt 120; $i++) {
    $estado = (& $adb -s $dispositivo shell getprop sys.boot_completed 2>$null | Select-Object -First 1).ToString().Trim()
    if ($estado -eq '1') {
        $arranqueCompleto = $true
        break
    }
    Start-Sleep -Seconds 2
}
if (-not $arranqueCompleto) { throw "El emulador $dispositivo no terminó de iniciar." }

Write-Output "HIDROAPP: emulador listo; iniciando Flutter."
Push-Location $appDir
try {
    & $flutter run -d $dispositivo `
        --dart-define=API_BASE_URL=http://10.0.2.2:3000/api `
        --dart-define=ALLOW_INSECURE_LOCAL_API=true
    if ($LASTEXITCODE -ne 0) { throw "flutter run terminó con código $LASTEXITCODE" }
} finally {
    Pop-Location
}
