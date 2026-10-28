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
  # Si el PC se reinició el proceso ya no existe: se ignora el error de taskkill.
  $idFront = Get-Content $pidFront -ErrorAction SilentlyContinue
  if ($idFront -and (Get-Process -Id $idFront -ErrorAction SilentlyContinue)) { & cmd /c "taskkill /PID $idFront /T /F >nul 2>&1" }
  Remove-Item $pidFront -Force -ErrorAction SilentlyContinue
}
# Si el frontend se levantó a mano (sin .pid), se detiene el proceso node que escucha en el puerto 5173.
Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object {
  if ((Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName -eq 'node') { & cmd /c "taskkill /PID $($_.OwningProcess) /T /F >nul 2>&1" }
}
if (-not $Silencioso -or $n) { "Detenidos $n procesos del backend y el frontend." }
