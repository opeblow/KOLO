#!/usr/bin/env bash
# Runs one CI step. On failure, the last lines of output become a GitHub
# annotation, so the error shows on the pull request without opening logs.
#   bash scripts/ci-step.sh "Typecheck" pnpm typecheck
set -o pipefail
title="$1"
shift
log="$(mktemp)"
"$@" 2>&1 | tee "$log"
code=${PIPESTATUS[0]}
if [ "$code" -ne 0 ]; then
  msg="$(tail -n 60 "$log" | sed -e 's/\x1b\[[0-9;]*m//g' -e 's/%/%25/g' -e 's/\r//g' | awk 'BEGIN{ORS="%0A"} {print}')"
  echo "::error title=${title} failed::${msg}"
fi
exit "$code"
