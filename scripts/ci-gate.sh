#!/usr/bin/env sh
# The single source of truth for "the gate" — the checks every PR must pass.
# Run locally, inside Docker (Dockerfile.test), and in CI. Fails fast on the
# first failing check.
set -eu

echo "==> build"
npm run build

echo "==> lint"
npm run lint

echo "==> format:check"
npm run format:check

echo "==> test"
npm test

echo ""
echo "✅ ALL GATES PASSED"
