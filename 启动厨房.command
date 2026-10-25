#!/bin/zsh
cd "$(dirname "$0")"
if ! curl -fsS http://127.0.0.1:8766/index.html >/dev/null 2>&1; then
  /usr/bin/python3 -m http.server 8766 --bind 127.0.0.1 &
  KITCHEN_SERVER_PID=$!
  trap 'kill "$KITCHEN_SERVER_PID" 2>/dev/null' EXIT INT TERM
  sleep 1
  open 'http://127.0.0.1:8766/'
  wait "$KITCHEN_SERVER_PID"
else
  open 'http://127.0.0.1:8766/'
fi
