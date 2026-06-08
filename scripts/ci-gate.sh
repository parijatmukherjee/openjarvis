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

echo "==> test (unit) + coverage gate (>99% lines/statements/functions/branches)"
# `coverage` runs the full unit suite under v8 instrumentation and FAILS if any
# metric drops below the thresholds in vitest.config.ts. This is the merge gate:
# no PR lands below the coverage floor (enforced here, so it holds in Docker/CI
# regardless of whether the Codecov upload runs).
npm run coverage

echo "==> test:functional (black-box e2e — runs the real built artifacts)"
npm run test:functional

echo ""
echo "✅ ALL GATES PASSED"
