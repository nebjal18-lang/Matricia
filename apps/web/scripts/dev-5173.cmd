@echo off
cd /d C:\Projects\Matricia\apps\web
set PATH=C:\Program Files\nodejs;C:\Users\jal18\AppData\Local\pnpm;%PATH%
echo === FIRST START %DATE% %TIME% > C:\Projects\Matricia\apps\web\.next-dev.log
call C:\Users\jal18\AppData\Local\pnpm\pnpm.CMD exec next dev --port 5173 >> C:\Projects\Matricia\apps\web\.next-dev.log 2>&1
echo === SECOND START %DATE% %TIME% >> C:\Projects\Matricia\apps\web\.next-dev.log
call C:\Users\jal18\AppData\Local\pnpm\pnpm.CMD exec next dev --port 5173 >> C:\Projects\Matricia\apps\web\.next-dev.log 2>&1
echo === EXIT %ERRORLEVEL% %DATE% %TIME% >> C:\Projects\Matricia\apps\web\.next-dev.log
