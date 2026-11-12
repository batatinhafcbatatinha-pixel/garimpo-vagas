@echo off
title Garimpo - vagas de dev
cd /d "%~dp0"
echo Abrindo o Garimpo em http://localhost:4321 ...
echo (deixe esta janela aberta enquanto usa o site; feche para desligar)
start "" http://localhost:4321
node server.js
pause
