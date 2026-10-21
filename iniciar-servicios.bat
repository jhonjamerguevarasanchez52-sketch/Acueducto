@echo off
setlocal
set "RAIZ=%~dp0"

echo Iniciando servicios de HIDROAPP...
start "HIDROAPP API" /D "%RAIZ%backend" cmd /k npm.cmd start
start "HIDROAPP Panel" /D "%RAIZ%hidro-admin" cmd /k npm.cmd run dev -- --host 127.0.0.1

echo.
echo API:   http://localhost:3000
echo Panel: http://127.0.0.1:5173
echo Cierra cada ventana para detener su servicio.
endlocal
