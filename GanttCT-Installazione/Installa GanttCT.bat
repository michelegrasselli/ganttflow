@echo off
rem Installa GanttCT by MG per l utente corrente (non servono permessi di amministratore)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0installa.ps1"
pause
