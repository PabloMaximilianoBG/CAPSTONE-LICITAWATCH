# Versión Windows de iniciar-backend.sh: levanta las 19 JVM en orden BD -> Ambassador -> BS -> BFF -> gateway.
# Uso (en la raíz del repo):  powershell -ExecutionPolicy Bypass -File scripts\iniciar-backend.ps1 [-Frontend]
# Clave de PostgreSQL: variable DB_PASS, o POSTGRES_PASSWORD de un .env en la raíz (si existe); si no, postgres.
# Correo: igual que en Linux, se lee correo.env si existe. Logs en logs\<módulo>.log
param([switch]$Frontend, [int]$GatewayPort = 8090)
$ErrorActionPreference = 'Stop'
$Raiz = Split-Path -Parent $PSScriptRoot
Set-Location $Raiz

function LeerEnv($archivo) {
  $vals = @{}
  if (Test-Path $archivo) {
    Get-Content $archivo | Where-Object { $_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$' } | ForEach-Object { $vals[$matches[1]] = $matches[2].Trim().Trim('"') }
  }
  $vals
}
$local = LeerEnv "$Raiz\.env"
if (-not $env:DB_USER -and $local.POSTGRES_USER) { $env:DB_USER = $local.POSTGRES_USER }
if (-not $env:DB_PASS -and $local.POSTGRES_PASSWORD) { $env:DB_PASS = $local.POSTGRES_PASSWORD }
# Webpay Plus devuelve al usuario al BFF de Ventas pasando por el gateway (ver ms-ventas-ambassador/application.yml).
if (-not $env:TBK_RETURN_URL) { $env:TBK_RETURN_URL = "http://localhost:$GatewayPort/api/ventas/webpay/retorno" }
$correo = LeerEnv "$Raiz\correo.env"
foreach ($k in $correo.Keys) { Set-Item "Env:$k" $correo[$k] }
if ($correo.Count) { "Correo: usando correo.env (MAIL_ACTIVO=$($env:MAIL_ACTIVO))" }

# Si el perfil de Windows tiene espacios en TEMP, la JVM falla con "Unable to establish loopback connection".
$tmp = 'C:\licitawatch-tmp'
$logs = "$Raiz\logs"; New-Item -ItemType Directory -Force $logs, $tmp | Out-Null
$opts = @('-Xms48m', '-Xmx256m', '-Xss512k', '-XX:+UseSerialGC', '-XX:TieredStopAtLevel=1', "-Djdk.net.unixdomain.tmpdir=$tmp")

& "$PSScriptRoot\detener-backend.ps1" -Silencioso

function Jar($m) {
  if ($m -eq 'api-gateway') { return "api-gateway\target\api-gateway-1.0.0.jar" }
  $d = $m -replace '^ms-([a-z]+)-.*', '$1'
  "microservicios\$d\$m\target\$m-1.0.0.jar"
}
function Iniciar($m) {
  Remove-Item "$logs\$m.log", "$logs\$m.err.log" -ErrorAction SilentlyContinue
  $p = Start-Process java -ArgumentList ($opts + @('-jar', (Jar $m))) -RedirectStandardOutput "$logs\$m.log" `
    -RedirectStandardError "$logs\$m.err.log" -WindowStyle Hidden -PassThru
  $p.Id | Set-Content "$logs\$m.pid"
}
function Esperar($mods) {
  foreach ($m in $mods) {
    $ok = $false
    for ($i = 0; $i -lt 120; $i++) {
      if (Select-String -Path "$logs\$m.log" -Pattern 'Started .*Application' -Quiet -ErrorAction SilentlyContinue) { $ok = $true; break }
      if (-not (Get-Process -Id (Get-Content "$logs\$m.pid") -ErrorAction SilentlyContinue)) { break }
      Start-Sleep 1
    }
    if ($ok) { "  OK $m" } else { "  FALLO $($m): revisa logs\$m.log y logs\$m.err.log" }
  }
}

$dom = 'usuarios', 'licitaciones', 'ventas', 'notificaciones', 'chat'
$bd = $dom | ForEach-Object { "ms-$_-bd" }
$amb = @('ms-ventas-ambassador')
$bs = @($dom | ForEach-Object { "ms-$_-bs" }) + 'ms-asistente-bs'
$bff = @($dom | ForEach-Object { "ms-$_-bff" }) + 'ms-asistente-bff'

foreach ($m in $bd + $amb + $bs + $bff + 'api-gateway') {
  if (-not (Test-Path (Jar $m))) { "Falta el jar de $m (ejecuta en la raíz: mvn -DskipTests install)"; exit 1 }
}

"Capa BD (828x) ...";  $bd | ForEach-Object { Iniciar $_ }; Esperar $bd
"Ambassador de Ventas (8383) ..."; $amb | ForEach-Object { Iniciar $_ }; Esperar $amb
"Capa BS (818x) ...";  $bs | ForEach-Object { Iniciar $_ }; Esperar $bs
"Capa BFF (808x) ..."; $bff | ForEach-Object { Iniciar $_ }; Esperar $bff
"API Gateway ($GatewayPort) ..."; $env:PORT = "$GatewayPort"; Iniciar 'api-gateway'; Remove-Item Env:PORT; Esperar @('api-gateway')
"Listo. Prueba http://localhost:$GatewayPort/api/catalogos/rubros"

if ($Frontend) {
  if (-not (Test-Path "$Raiz\frontend\node_modules")) { npm --prefix frontend install }
  $p = Start-Process cmd -ArgumentList '/c', 'npm run dev' -WorkingDirectory "$Raiz\frontend" -PassThru
  $p.Id | Set-Content "$logs\frontend.pid"
  "Frontend: http://localhost:5173 (se abre en otra ventana)"
}
