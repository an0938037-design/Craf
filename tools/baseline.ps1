<#
  baseline.ps1 - do hien trang ma nguon Craf truoc va sau khi chuyen module.
  Chi doc, khong sua gi. ASCII-only: Windows PowerShell 5.1 doc file .ps1
  khong BOM theo ANSI, nen script nay khong dung dau tieng Viet.

  Chay:  powershell -ExecutionPolicy Bypass -File tools\baseline.ps1
#>
[CmdletBinding()]
param([string]$Repo)

$ErrorActionPreference = 'Stop'

if (-not $Repo) {
  $here = $PSScriptRoot
  if (-not $here) { $here = Split-Path -Parent $MyInvocation.MyCommand.Path }
  $Repo = Split-Path -Parent $here
}
$srcExt = @('.js', '.mjs', '.html', '.css', '.md', '.json')

function Get-Stats {
  param([string]$Path, [string]$Label)

  if (Test-Path -LiteralPath $Path -PathType Leaf) {
    $li = Get-Content -LiteralPath $Path
    return [pscustomobject]@{
      Muc   = $Label
      Files = 1
      Lines = $li.Count
      KB    = [math]::Round((Get-Item -LiteralPath $Path).Length / 1KB, 1)
    }
  }

  if (Test-Path -LiteralPath $Path -PathType Container) {
    $fs = @(Get-ChildItem -LiteralPath $Path -Recurse -File -ErrorAction SilentlyContinue)
    $lines = 0
    foreach ($f in $fs) {
      if ($srcExt -contains $f.Extension) { $lines += (Get-Content -LiteralPath $f.FullName).Count }
    }
    $kb = if ($fs.Count) { [math]::Round((($fs | Measure-Object Length -Sum).Sum) / 1KB, 1) } else { 0 }
    return [pscustomobject]@{ Muc = $Label; Files = $fs.Count; Lines = $lines; KB = $kb }
  }

  return [pscustomobject]@{ Muc = $Label; Files = 0; Lines = 0; KB = 0 }
}

Write-Output "Craf - baseline  $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
Write-Output "repo: $Repo"
Write-Output ''

$rows = @()
$rows += Get-Stats (Join-Path $Repo 'app\app.js')     'app/app.js (monolith)'
$rows += Get-Stats (Join-Path $Repo 'app\index.html') 'app/index.html'
$rows += Get-Stats (Join-Path $Repo 'app\style.css')  'app/style.css'

$srcRoot = Join-Path $Repo 'app\src'
if (Test-Path -LiteralPath $srcRoot) {
  foreach ($d in Get-ChildItem -LiteralPath $srcRoot -Directory | Sort-Object Name) {
    $rows += Get-Stats $d.FullName "app/src/$($d.Name)"
  }
}

$rows += Get-Stats (Join-Path $Repo 'tools') 'tools'
$rows | Format-Table -AutoSize | Out-String -Width 120 | Write-Output

if (Test-Path -LiteralPath (Join-Path $Repo '.git')) {
  Push-Location $Repo
  try {
    $head = (& git rev-parse --short HEAD 2>$null)
    $dirty = (@(& git status --porcelain 2>$null) | Measure-Object -Line).Lines
    Write-Output ("git HEAD   : " + $(if ($head) { $head } else { '(chua co commit)' }))
    Write-Output ("file dirty : " + $dirty)
  } finally { Pop-Location }
}

Write-Output ''
Write-Output ("app.js con ton tai : " + (Test-Path -LiteralPath (Join-Path $Repo 'app\app.js')))
