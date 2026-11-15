@echo off
rem Rimuove GanttCT by MG installato per l utente corrente
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0disinstalla.ps1"
pause
