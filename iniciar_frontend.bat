@echo off
chcp 65001 > nul
echo ==============================================================================
echo   🏢 TECNOCR SOLUCIONES S.A. - INICIADOR DEL FRONTEND (VITE + REACT)
echo ==============================================================================
echo.
echo Iniciando servidor de desarrollo en http://localhost:5173 ...
echo Mantén esta ventana abierta mientras usas el portal.
echo.
cd /d "%~dp0frontend"
npm run dev
pause
