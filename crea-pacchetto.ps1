# Rigenera le icone (da Icona.png) e la cartella "GanttCT-Installazione"
# con i file aggiornati dell'app.
# Uso:  powershell -ExecutionPolicy Bypass -File .\crea-pacchetto.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pkg  = Join-Path $root 'GanttCT-Installazione'
$app  = Join-Path $pkg 'app'
$assets = Join-Path $root 'assets'

function Get-ResizedPng([System.Drawing.Image]$img, [int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  $scale = [Math]::Min($size / $img.Width, $size / $img.Height)
  $w = [int][Math]::Round($img.Width * $scale); $h = [int][Math]::Round($img.Height * $scale)
  $g.DrawImage($img, [int](($size - $w) / 2), [int](($size - $h) / 2), $w, $h)
  $g.Dispose()
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  return ,$ms.ToArray()
}

# --- icone: assets/icon.png (favicon) e assets/icon.ico (collegamenti di Windows)
$srcImg = Join-Path $root 'Icona.png'
if (Test-Path $srcImg) {
  New-Item -ItemType Directory -Force $assets | Out-Null
  $img = [System.Drawing.Image]::FromFile($srcImg)
  try {
    [System.IO.File]::WriteAllBytes((Join-Path $assets 'icon.png'), (Get-ResizedPng $img 256))
    $sizes = 16, 24, 32, 48, 64, 128, 256
    $pngs = @(); foreach ($s in $sizes) { $pngs += ,(Get-ResizedPng $img $s) }
    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter $ms
    $bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$sizes.Count)
    $offset = 6 + 16 * $sizes.Count
    for ($i = 0; $i -lt $sizes.Count; $i++) {
      $s = $sizes[$i]; $len = $pngs[$i].Length
      $dim = if ($s -ge 256) { 0 } else { $s }
      $bw.Write([byte]$dim); $bw.Write([byte]$dim); $bw.Write([byte]0); $bw.Write([byte]0)
      $bw.Write([UInt16]1); $bw.Write([UInt16]32); $bw.Write([UInt32]$len); $bw.Write([UInt32]$offset)
      $offset += $len
    }
    foreach ($p in $pngs) { $bw.Write($p) }
    $bw.Flush()
    [System.IO.File]::WriteAllBytes((Join-Path $assets 'icon.ico'), $ms.ToArray())
    $bw.Dispose()
  } finally { $img.Dispose() }
  Write-Host 'Icone rigenerate da Icona.png'
}

# --- copia dell'app nel pacchetto
if (Test-Path $app) { Remove-Item -Recurse -Force $app }
New-Item -ItemType Directory -Force $app | Out-Null
Copy-Item (Join-Path $root 'index.html') $app
Copy-Item (Join-Path $root 'LICENSE')    $app
foreach ($d in 'css', 'js', 'assets') {
  Copy-Item -Recurse (Join-Path $root $d) (Join-Path $app $d)
}
Write-Host "Pacchetto aggiornato in: $pkg"
