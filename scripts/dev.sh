#!/usr/bin/env sh
# Start the desktop app in dev mode. Always runs the Vite renderer; runs
# Electron when a display is available (or via xvfb-run). Falls back to
# "renderer only" mode on headless servers without xvfb, so the renderer can
# still be opened in a browser at http://localhost:5173.
#
# Modes (in order of preference):
#   1. xvfb-run is installed          → wrap electron in a virtual display
#   2. DISPLAY is set                  → run electron directly
#   3. neither                          → run vite only; print a clear message
#
# The previous Makefile version used `concurrently` which sent SIGTERM to
# the renderer the moment electron failed (e.g. on a headless server). This
# script handles each case explicitly.
set -eu

VITE_PORT=5173
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
DESKTOP_DIR="$REPO_ROOT/packages/desktop"

cd "$DESKTOP_DIR"

VITE_LOG=$(mktemp)
VITE_PID=""

cleanup() {
  rc=$?
  if [ -n "$VITE_PID" ] && kill -0 "$VITE_PID" 2>/dev/null; then
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

echo "==> starting vite dev server on :$VITE_PORT"
npx vite --config vite.renderer.config.ts --port "$VITE_PORT" >"$VITE_LOG" 2>&1 &
VITE_PID=$!

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

if command -v xvfb-run >/dev/null 2>&1; then
  echo "==> launching electron under xvfb-run (virtual display)"
  # --no-sandbox: the SUID chrome-sandbox helper requires root:4755, which
  # we cannot assume on every dev machine. Skipping the sandbox is safe
  # for dev (not for production) because the renderer is just localhost.
  #
  # --disable-gpu / --disable-software-rasterizer: the virtual Xvfb display
  # has no GPU; without these, Electron logs harmless "Failed to send
  # GpuControl.CreateCommandBuffer" and "Exiting GPU process" errors at
  # startup. The renderer still works (software path).
  #
  # --disable-dev-shm-usage: /dev/shm is small in many containers; tells
  # Chromium to use /tmp instead so we don't run out of shared memory.
  exec xvfb-run --auto-servernum --server-args="-screen 0 1280x800x24" \
    npx electron . \
      --no-sandbox \
      --disable-gpu \
      --disable-software-rasterizer \
      --disable-dev-shm-usage
elif [ -n "${DISPLAY:-}" ]; then
  echo "==> launching electron against DISPLAY=${DISPLAY}"
  exec npx electron . \
    --no-sandbox \
    --disable-gpu \
    --disable-software-rasterizer \
    --disable-dev-shm-usage
else
  cat <<EOF
==> no display server detected and xvfb-run is not installed.

The Vite renderer is running at http://localhost:${VITE_PORT}/ — open it in
a browser to see the UI. The Electron shell (which provides native window,
tray, and IPC) needs a display server.

To run the full app on a headless box:
  - Debian/Ubuntu:  apt-get install -y xvfb
  - Alpine:         apk add xvfb
  - macOS/Windows:  already have one — just run 'make dev' on a workstation

Or override per-run with:
  DISPLAY=:0 make dev
EOF
  # Wait for the user to kill the script (Ctrl-C). The vite child is
  # torn down by the EXIT trap.
  wait "$VITE_PID"
fi
