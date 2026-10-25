@echo off
rem Doble clic: levanta backend (19 servicios) y frontend en Windows.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\iniciar-backend.ps1 -Frontend
pause
