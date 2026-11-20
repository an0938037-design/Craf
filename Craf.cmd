@echo off
rem Craf — mở bàn vẽ trong một cửa sổ ứng dụng.
setlocal
cd /d "%~dp0"
where pythonw >nul 2>nul
if %errorlevel%==0 (
  start "" pythonw "craf.py" --open
) else (
  start "" python "craf.py" --open
)
