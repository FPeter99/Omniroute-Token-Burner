@echo off
title OmniRoute Token Egeto
cd /d "%~dp0"
echo OmniRoute Token Egeto Szerver inditasa...
start http://localhost:4420
node server.js
pause
