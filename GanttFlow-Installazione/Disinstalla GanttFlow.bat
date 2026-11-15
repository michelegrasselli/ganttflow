@echo off
rem Rimuove GanttFlow installato per l utente corrente
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0disinstalla.ps1"
pause
