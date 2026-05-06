@echo off
title POption Signal Analyzer
color 0A

echo.
echo  ================================================
echo   POption Signal Analyzer - Iniciando...
echo  ================================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo  [ERROR] Python no encontrado.
    echo.
    echo  Por favor instala Python desde:
    echo  https://www.python.org/downloads/
    echo.
    echo  IMPORTANTE: Durante la instalacion marca la casilla
    echo  "Add Python to PATH"
    echo.
    pause
    exit /b 1
)

echo  [OK] Python encontrado.

:: Install dependencies silently
echo  [..] Instalando dependencias ^(primera vez puede tardar 1-2 min^)...
python -m pip install --quiet --upgrade pip
python -m pip install --quiet -r requirements.txt

if errorlevel 1 (
    color 0C
    echo.
    echo  [ERROR] Fallo instalando dependencias.
    echo  Intenta correr este archivo como Administrador.
    echo.
    pause
    exit /b 1
)

echo  [OK] Dependencias instaladas.
echo.
echo  ================================================
echo   Servidor iniciando en http://localhost:8000
echo  ================================================
echo.
echo  NO cierres esta ventana mientras uses la app.
echo  Para cerrar la app, cierra esta ventana.
echo.

:: Open browser after 2 seconds
start "" /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8000"

:: Start server
python -m uvicorn main:app --host 127.0.0.1 --port 8000

pause
