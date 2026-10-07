@echo off
setlocal
title coran - serveur de developpement

rem Se place dans le dossier du script pour fonctionner depuis n'importe quel cwd.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] Node.js est introuvable dans le PATH.
  echo Installez Node.js 20+ puis relancez ce script.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Dependances absentes - installation en cours...
  call npm ci
  if errorlevel 1 (
    echo [ERREUR] Echec de "npm ci".
    pause
    exit /b 1
  )
)

echo Demarrage du serveur sur http://localhost:5173
call npm run dev -- --open