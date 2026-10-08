#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/backend"
VENV="$HOME/.workbuddy/binaries/python/envs/ai-ecp"
PY="$VENV/Scripts/python.exe"
BASEPY="/c/Users/EC504/.workbuddy/binaries/python/versions/3.13.12/python.exe"
if [ ! -x "$PY" ]; then
  echo "[首次运行] 创建受管 venv 并安装 Flask..."
  "$BASEPY" -m venv "$VENV"
  "$PY" -m pip install flask
fi
echo "正在启动 智选云 AI 电商在线售货系统 (AI-ECP) -> http://127.0.0.1:5000"
"$PY" app.py
