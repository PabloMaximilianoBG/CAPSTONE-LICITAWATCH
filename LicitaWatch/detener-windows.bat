@echo off
rem Doble clic: detiene backend (19 servicios) y frontend en Windows.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\detener-backend.ps1
pause
