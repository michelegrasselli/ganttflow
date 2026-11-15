# Rimuove "GanttCT by MG" installato per l'utente corrente.
# I progetti salvati nel browser restano: esportali prima in JSON se vuoi conservarli.
$ErrorActionPreference = 'Stop'
$desktop  = [Environment]::GetFolderPath('Desktop')
$programs = [Environment]::GetFolderPath('Programs')
$targets = @(
  (Join-Path $desktop 'GanttCT by MG.lnk'),
  (Join-Path $programs 'GanttCT by MG.lnk'),
  (Join-Path $env:LOCALAPPDATA 'GanttCT'),
  # eventuale installazione con il vecchio nome
  (Join-Path $desktop 'GanttFlow.lnk'),
  (Join-Path $programs 'GanttFlow.lnk'),
  (Join-Path $env:LOCALAPPDATA 'GanttFlow')
)
foreach ($t in $targets) { if (Test-Path $t) { Remove-Item -Recurse -Force $t } }
Write-Host 'GanttCT by MG disinstallato.'
