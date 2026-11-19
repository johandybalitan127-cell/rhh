# Iniciar servidor frontend en Vite + React
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "  🏢 TECNOCR SOLUCIONES S.A. - INICIADOR DEL FRONTEND (VITE + REACT)" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Iniciando servidor en http://localhost:5173..." -ForegroundColor Green
Write-Host "Mantén esta terminal abierta mientras usas el portal web." -ForegroundColor Yellow
Write-Host ""

Set-Location -Path "$PSScriptRoot\frontend"
npm run dev
