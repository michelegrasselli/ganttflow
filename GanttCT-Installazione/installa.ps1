# Installa "GanttCT by MG" per l'utente corrente (nessun permesso di amministratore richiesto).
# - copia l'app in %LOCALAPPDATA%\GanttCT
# - crea i collegamenti "GanttCT by MG V0" sul Desktop e nel menu Start, con l'icona dell'app
$ErrorActionPreference = 'Stop'
$appName      = 'GanttCT by MG'
$shortcutName = 'GanttCT by MG V0'
$src  = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'app'
$dest = Join-Path $env:LOCALAPPDATA 'GanttCT'

if (-not (Test-Path (Join-Path $src 'index.html'))) {
  throw "Cartella 'app' non trovata accanto a questo script: $src"
}

$desktop  = [Environment]::GetFolderPath('Desktop')
$programs = [Environment]::GetFolderPath('Programs')

# Rimuove collegamenti e cartelle delle installazioni precedenti
# (vecchio nome GanttFlow e collegamenti "GanttCT by MG" senza V0).
$old = @(
  (Join-Path $desktop 'GanttFlow.lnk'), (Join-Path $programs 'GanttFlow.lnk'), (Join-Path $env:LOCALAPPDATA 'GanttFlow'),
  (Join-Path $desktop 'GanttCT by MG.lnk'), (Join-Path $programs 'GanttCT by MG.lnk')
)
foreach ($o in $old) { if (Test-Path $o) { Remove-Item -Recurse -Force $o } }

Write-Host "Copia dei file in $dest ..."
# Svuota la cartella e copia il contenuto di 'app' al suo interno: funziona anche se la
# cartella non si può eliminare (ad esempio con l'app aperta) e non crea mai una
# sottocartella 'app' annidata.
New-Item -ItemType Directory -Force $dest | Out-Null
Get-ChildItem -Force $dest | Remove-Item -Recurse -Force
Copy-Item -Path (Join-Path $src '*') -Destination $dest -Recurse -Force

$index = Join-Path $dest 'index.html'
$icon  = Join-Path $dest 'assets\icon.ico'
$url   = ([System.Uri]$index).AbsoluteUri

# Microsoft Edge (presente su Windows 11) apre l'app in una finestra dedicata.
$edge = @(
  (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

$shell = New-Object -ComObject WScript.Shell
foreach ($lnkPath in @((Join-Path $desktop "$shortcutName.lnk"), (Join-Path $programs "$shortcutName.lnk"))) {
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
Write-Host "Avvialo dal collegamento '$shortcutName' sul Desktop o dal menu Start."
