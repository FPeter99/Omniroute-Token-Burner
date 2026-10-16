@echo off
title OmniRoute Token Burner
cd /d "%~dp0"
echo Starting OmniRoute Token Burner Web Server...
start http://localhost:4420
node server.js
pause
