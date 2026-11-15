# Installa "GanttCT by MG" per l'utente corrente (nessun permesso di amministratore richiesto).
# - copia l'app in %LOCALAPPDATA%\GanttCT
# - crea i collegamenti "GanttCT by MG" sul Desktop e nel menu Start, con l'icona dell'app
$ErrorActionPreference = 'Stop'
$appName = 'GanttCT by MG'
$src  = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'app'
$dest = Join-Path $env:LOCALAPPDATA 'GanttCT'

if (-not (Test-Path (Join-Path $src 'index.html'))) {
  throw "Cartella 'app' non trovata accanto a questo script: $src"
}

$desktop  = [Environment]::GetFolderPath('Desktop')
$programs = [Environment]::GetFolderPath('Programs')

# Rimuove un'eventuale installazione precedente con il vecchio nome (GanttFlow).
foreach ($old in @((Join-Path $desktop 'GanttFlow.lnk'), (Join-Path $programs 'GanttFlow.lnk'), (Join-Path $env:LOCALAPPDATA 'GanttFlow'))) {
  if (Test-Path $old) { Remove-Item -Recurse -Force $old }
}

Write-Host "Copia dei file in $dest ..."
if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
Copy-Item -Recurse $src $dest

$index = Join-Path $dest 'index.html'
$icon  = Join-Path $dest 'assets\icon.ico'
$url   = ([System.Uri]$index).AbsoluteUri

# Microsoft Edge (presente su Windows 11) apre l'app in una finestra dedicata.
$edge = @(
  (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

$shell = New-Object -ComObject WScript.Shell
foreach ($lnkPath in @((Join-Path $desktop "$appName.lnk"), (Join-Path $programs "$appName.lnk"))) {
  $lnk = $shell.CreateShortcut($lnkPath)
  if ($edge) {
    $lnk.TargetPath = $edge
    $lnk.Arguments  = "--app=`"$url`""
  } else {
    $lnk.TargetPath = $index
  }
  if (Test-Path $icon) { $lnk.IconLocation = "$icon,0" }
  $lnk.WorkingDirectory = $dest
  $lnk.Description      = "$appName - pianificatore Gantt e tempo ciclo"
  $lnk.Save()
}

Write-Host ''
Write-Host "Installazione di $appName completata."
Write-Host "Avvialo dal collegamento '$appName' sul Desktop o dal menu Start."
