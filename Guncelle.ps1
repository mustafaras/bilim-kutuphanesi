param([switch]$Publish)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$runtimePython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if (-not (Test-Path -LiteralPath $runtimePython)) { $runtimePython = 'python' }
& $runtimePython -X utf8 tools/sync_catalog.py
if ($LASTEXITCODE -ne 0) { throw 'Katalog oluşturulamadı.' }
& $runtimePython -X utf8 tools/validate_site.py
if ($LASTEXITCODE -ne 0) { throw 'Katalog doğrulaması başarısız.' }
if ($Publish) {
 git add -- site/data/catalog.json
 git diff --cached --quiet
 if ($LASTEXITCODE -eq 1) {
  git commit -m 'Update library catalog'
  if ($LASTEXITCODE -ne 0) { throw 'Commit başarısız.' }
  git push origin main
  if ($LASTEXITCODE -ne 0) { throw 'GitHub gönderimi başarısız.' }
 } else { Write-Host 'Yeni katalog değişikliği yok.' }
}
