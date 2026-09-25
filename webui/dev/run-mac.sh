#!/bin/bash
# Preview the web UI on a Mac (or any machine with python3) without a feeder.
# Uses the committed build in adsb-setup/static/spa - no Node needed.
set -e
cd "$(dirname "$0")"
VENV=.venv
if [ ! -x "$VENV/bin/python" ]; then
    echo "creating python venv in webui/dev/$VENV ..."
    python3 -m venv "$VENV"
    "$VENV/bin/pip" install -q flask
fi
PORT=${PORT:-5173}
URL="http://127.0.0.1:$PORT/_dev"
echo "UI preview at $URL  (Ctrl-C to stop)"
(sleep 1.5 && open "$URL" 2>/dev/null || true) &
exec "$VENV/bin/python" mock_server.py --port "$PORT" "$@"
