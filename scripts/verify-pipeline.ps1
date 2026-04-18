$ErrorActionPreference = "Stop"

Write-Host "`n[verify] AI smoke checks"
node (Join-Path $PSScriptRoot "ai-smoke.mjs")

Write-Host "`n[verify] Frontend UI tests"
cmd /c "cd frontend && set CI=true&& npm.cmd test -- --watchAll=false"

Write-Host "`n[verify] Frontend production build"
cmd /c "cd frontend && npm.cmd run build"

Write-Host "`n[verify] Backend smoke checks"
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "backend-smoke.ps1")

Write-Host "`n[verify] Full pipeline passed."

