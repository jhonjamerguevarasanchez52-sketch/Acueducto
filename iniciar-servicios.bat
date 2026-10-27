@echo off
setlocal
set "RAIZ=%~dp0"

echo Iniciando servicios de HIDROAPP...
start "HIDROAPP API" /D "%RAIZ%backend" cmd /k npm.cmd start
start "HIDROAPP Panel" /D "%RAIZ%hidro-admin" cmd /k npm.cmd run dev -- --host 0.0.0.0 --port 5173 --strictPort

echo.
echo API:   http://localhost:3000/api
echo Panel: http://localhost:5173
echo Cierra cada ventana para detener su servicio.
endlocal
