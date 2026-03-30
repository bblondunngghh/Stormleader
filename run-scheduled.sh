#!/bin/bash
# StormPipe Scheduled Runner
# Dispatches to the right script based on the current hour.
# 04:xx  → 4am UI audit (Playwright tests)
# 05:xx  → Overnight competitor/improvement build

HOUR=$(date +%H)

cd /c/Projects/stormleads

if [ "$HOUR" = "04" ]; then
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running 4am UI audit..."
  bash run-4am-audit.sh
else
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running overnight build (hour=$HOUR)..."
  bash run-overnight.sh
fi
