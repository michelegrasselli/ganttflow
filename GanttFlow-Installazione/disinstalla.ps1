# Rimuove GanttFlow installato per l'utente corrente.
# I progetti salvati nel browser restano: esportali prima in JSON se vuoi conservarli.
$ErrorActionPreference = 'Stop'
$dest = Join-Path $env:LOCALAPPDATA 'GanttFlow'
$links = @(
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'GanttFlow.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Programs')) 'GanttFlow.lnk')
)
foreach ($l in $links) { if (Test-Path $l) { Remove-Item -Force $l } }
if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
Write-Host 'GanttFlow disinstallato.'
