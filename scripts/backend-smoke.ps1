$ErrorActionPreference = "Stop"

function Get-FreePort {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
  $listener.Start()
  $port = $listener.LocalEndpoint.Port
  $listener.Stop()
  return $port
}

$wd = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$port = Get-FreePort
$baseUrl = "http://127.0.0.1:$port"
$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("blood-agent-smoke-" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

$out = Join-Path $wd "logs\backend-smoke.out"
$err = Join-Path $wd "logs\backend-smoke.err"
New-Item -ItemType Directory -Force -Path (Join-Path $wd "logs") | Out-Null
if (Test-Path $out) { Remove-Item $out -Force }
if (Test-Path $err) { Remove-Item $err -Force }

$env:PORT = "$port"
$env:DATA_DIR = $tmp
$env:AUTH_SECRET = "smoke-secret"
$env:GEMINI_API_KEY = ""

$proc = Start-Process node -ArgumentList "server.js" -WorkingDirectory $wd -RedirectStandardOutput $out -RedirectStandardError $err -NoNewWindow -PassThru

try {
  $health = $null
  for ($i = 0; $i -lt 30; $i++) {
    try {
      $health = Invoke-RestMethod "$baseUrl/health"
      break
    } catch {
      Start-Sleep -Milliseconds 300
    }
  }

  if (-not $health) {
    throw "Backend did not start on $baseUrl"
  }

  $login = Invoke-RestMethod "$baseUrl/login" -Method Post -ContentType "application/json" -Body '{"email":"hospital@bloodagent.demo","password":"hospital123","role":"hospital"}'
  if (-not $login.token) { throw "Login did not return a token." }
  $headers = @{ Authorization = "Bearer $($login.token)" }

  $request = Invoke-RestMethod "$baseUrl/request-blood" -Method Post -Headers $headers -ContentType "application/json" -Body '{"patient":"Smoke Patient","bloodGroup":"O-","units":2,"urgency":"Critical","location":"AIIMS Emergency Wing","lat":28.567,"lng":77.21,"text":"Critical request for 2 units of O- blood for Smoke Patient at AIIMS Emergency Wing"}'
  if (-not $request.request.id) { throw "request-blood did not return a request id." }

  $patch = Invoke-RestMethod "$baseUrl/requests/$($request.request.id)/location" -Method Patch -Headers $headers -ContentType "application/json" -Body '{"lat":28.56,"lng":77.22,"location":"Pinned (Smoke)"}'
  if ($patch.request.location -ne "Pinned (Smoke)") { throw "Location patch failed." }

  Write-Host "[backend-smoke] OK"
} finally {
  if ($proc -and -not $proc.HasExited) { Stop-Process -Id $proc.Id -Force }
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  Remove-Item Env:PORT -ErrorAction SilentlyContinue
  Remove-Item Env:DATA_DIR -ErrorAction SilentlyContinue
  Remove-Item Env:AUTH_SECRET -ErrorAction SilentlyContinue
  Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue
}

