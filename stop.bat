@echo off
title Stop OmniRoute Token Burner
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File .\stop.ps1
pause
