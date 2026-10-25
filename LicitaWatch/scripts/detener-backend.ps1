# Versión Windows de detener-backend.sh: detiene las JVM (y el frontend) que levantó iniciar-backend.ps1.
# Uso (en la raíz del repo):  powershell -ExecutionPolicy Bypass -File scripts\detener-backend.ps1
param([switch]$Silencioso)
$Raiz = Split-Path -Parent $PSScriptRoot
$n = 0
# Busca por línea de comandos (más fiable que los .pid si el PC se reinició).
Get-CimInstance Win32_Process -Filter "Name = 'java.exe'" | Where-Object { $_.CommandLine -match '-1\.0\.0\.jar' } | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $n++
}
$pidFront = "$Raiz\logs\frontend.pid"
if (Test-Path $pidFront) {
  taskkill /PID (Get-Content $pidFront) /T /F 2>$null | Out-Null
  Remove-Item $pidFront
}
if (-not $Silencioso -or $n) { "Detenidos $n procesos del backend." }
