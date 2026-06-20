#!/usr/bin/env sh
# Run the Playwright E2E suite. Starts the Vite dev server, waits for it to
# serve, runs the tests, and ALWAYS tears the server down on exit (success or
# failure). The previous Makefile version used a bare `kill $$VITE_PID`, which
# never ran if the Playwright run crashed or `set -e` fired.
set -eu

VITE_PORT=5173
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

cd "$REPO_ROOT/packages/desktop"

VITE_LOG=$(mktemp)
echo "==> starting vite dev server on :$VITE_PORT"
npx vite --config vite.renderer.config.ts --port "$VITE_PORT" >"$VITE_LOG" 2>&1 &
VITE_PID=$!

cleanup() {
  rc=$?
  if kill -0 "$VITE_PID" 2>/dev/null; then
    kill "$VITE_PID" 2>/dev/null || true
    wait "$VITE_PID" 2>/dev/null || true
  fi
  if [ "$rc" -ne 0 ]; then
    echo "==> vite log (last 50 lines):" >&2
    tail -n 50 "$VITE_LOG" >&2 || true
  fi
  rm -f "$VITE_LOG"
  exit "$rc"
}
trap cleanup EXIT INT TERM

echo "==> waiting for vite to respond on http://localhost:$VITE_PORT"
ATTEMPTS=0
MAX_ATTEMPTS=40
until curl -sf "http://localhost:$VITE_PORT/" >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
    echo "vite did not become ready in time" >&2
    tail -n 50 "$VITE_LOG" >&2 || true
    exit 1
  fi
  sleep 0.5
done
echo "==> vite is up"

cd "$REPO_ROOT/packages/desktop-e2e"
npx playwright test --workers=1
