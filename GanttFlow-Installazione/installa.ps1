# Installa GanttFlow per l'utente corrente (nessun permesso di amministratore richiesto).
# - copia l'app in %LOCALAPPDATA%\GanttFlow
# - crea i collegamenti sul Desktop e nel menu Start
$ErrorActionPreference = 'Stop'
$src  = Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) 'app'
$dest = Join-Path $env:LOCALAPPDATA 'GanttFlow'

if (-not (Test-Path (Join-Path $src 'index.html'))) {
  throw "Cartella 'app' non trovata accanto a questo script: $src"
}

Write-Host "Copia dei file in $dest ..."
if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
Copy-Item -Recurse $src $dest

$index = Join-Path $dest 'index.html'
$url   = ([System.Uri]$index).AbsoluteUri

# Microsoft Edge (presente su Windows 11) apre l'app in una finestra dedicata.
$edge = @(
  (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

$shell = New-Object -ComObject WScript.Shell
$targets = @(
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'GanttFlow.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Programs')) 'GanttFlow.lnk')
)
foreach ($lnkPath in $targets) {
  $lnk = $shell.CreateShortcut($lnkPath)
  if ($edge) {
    $lnk.TargetPath   = $edge
    $lnk.Arguments    = "--app=`"$url`""
    $lnk.IconLocation = "$edge,0"
  } else {
    $lnk.TargetPath   = $index
  }
  $lnk.WorkingDirectory = $dest
  $lnk.Description      = 'GanttFlow - pianificatore Gantt'
  $lnk.Save()
}

Write-Host ''
Write-Host 'Installazione completata.'
Write-Host 'Avvia GanttFlow dal collegamento sul Desktop o dal menu Start.'
