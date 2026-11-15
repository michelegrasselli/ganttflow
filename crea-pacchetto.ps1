# Rigenera la cartella "GanttFlow-Installazione" con i file aggiornati dell'app.
# Uso:  powershell -ExecutionPolicy Bypass -File .\crea-pacchetto.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pkg  = Join-Path $root 'GanttFlow-Installazione'
$app  = Join-Path $pkg 'app'

if (Test-Path $app) { Remove-Item -Recurse -Force $app }
New-Item -ItemType Directory -Force $app | Out-Null

Copy-Item (Join-Path $root 'index.html') $app
Copy-Item (Join-Path $root 'LICENSE')    $app
foreach ($d in 'css', 'js', 'assets') {
  Copy-Item -Recurse (Join-Path $root $d) (Join-Path $app $d)
}
Write-Host "Pacchetto aggiornato in: $pkg"
