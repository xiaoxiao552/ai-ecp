@echo off
chcp 65001 >nul
cd /d %~dp0backend
set "PY=C:\Users\EC504\.workbuddy\binaries\python\envs\ai-ecp\Scripts\python.exe"
set "BASEPY=C:\Users\EC504\.workbuddy\binaries\python\versions\3.13.12\python.exe"
if not exist "%PY%" (
  echo [首次运行] 创建受管 venv 并安装 Flask...
  "%BASEPY%" -m venv "C:\Users\EC504\.workbuddy\binaries\python\envs\ai-ecp"
  "%PY%" -m pip install flask
)
echo 正在启动 智选云 AI 电商在线售货系统 (AI-ECP) ...
echo 启动后请浏览器访问 http://127.0.0.1:5000
"%PY%" app.py
pause
