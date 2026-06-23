<#
  Build the PsiMeter white paper to PDF.

  Usage:   pwsh ./build.ps1            # or:  powershell -File build.ps1
  Output:  psimeter-whitepaper.pdf

  Requires Typst >= 0.15 (https://typst.app). The first run downloads the
  charged-ieee and CeTZ packages from the Typst Universe and (if missing) the
  TeX Gyre fonts from CTAN.
#>
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$fonts = Join-Path $here "fonts"

# --- locate the typst binary -------------------------------------------------
$typst = (Get-Command typst -ErrorAction SilentlyContinue).Source
if (-not $typst) {
  $cand = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter typst.exe -ErrorAction SilentlyContinue |
          Select-Object -First 1 -ExpandProperty FullName
  if ($cand) { $typst = $cand }
}
if (-not $typst) { throw "Typst not found. Install with:  winget install --id Typst.Typst" }
Write-Host "Using $typst"

# --- ensure the heading sans font (TeX Gyre Heros, a Helvetica clone) ---------
# The body (Libertinus Serif) and mono (DejaVu Sans Mono) ship with Typst; only
# the sans used for headings needs fetching.
New-Item -ItemType Directory -Force $fonts | Out-Null
$base = "https://mirrors.ctan.org/fonts/tex-gyre/opentype"
$need = @(
  "texgyreheros-regular.otf","texgyreheros-bold.otf","texgyreheros-italic.otf","texgyreheros-bolditalic.otf"
)
foreach ($f in $need) {
  $dest = Join-Path $fonts $f
  if (-not (Test-Path $dest)) {
    Write-Host "Fetching font $f"
    Invoke-WebRequest -Uri "$base/$f" -OutFile $dest
  }
}

# --- compile -----------------------------------------------------------------
& $typst compile (Join-Path $here "main.typ") (Join-Path $here "psimeter-whitepaper.pdf") `
    --root $here --font-path $fonts
Write-Host "Wrote psimeter-whitepaper.pdf"
