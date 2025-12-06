#!/usr/bin/env bash
set -euo pipefail

# TODO: Windows users can run via WSL or adapt to PowerShell.

pnpm -C server dev &
pnpm -C client dev &
pnpm -C narrative-service dev &
wait
