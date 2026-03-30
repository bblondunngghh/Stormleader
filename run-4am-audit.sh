#!/bin/bash
# StormPipe 4am Nightly UI Audit
# Runs Playwright tests against the local dev server, saves a report.

set -euo pipefail

cd /c/projects/stormleads

TODAY=$(date +%Y-%m-%d)
REPORT_DIR="tests/audit-reports"
REPORT_FILE="$REPORT_DIR/audit-${TODAY}.json"
LOG_FILE="$REPORT_DIR/audit-${TODAY}.log"

mkdir -p "$REPORT_DIR"

log() { echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

log "=== StormPipe 4am UI Audit — $TODAY ==="

# ── 1. Ensure API server is up ────────────────────────────────────────────────
API_RUNNING=false
if curl -sf http://localhost:3001/ >/dev/null 2>&1 || curl -sf http://localhost:3001/api/leads >/dev/null 2>&1; then
  API_RUNNING=true
  log "API server already running on :3001"
else
  log "Starting API server..."
  node server/src/index.js >> "$LOG_FILE" 2>&1 &
  SERVER_PID=$!
  sleep 5
  if kill -0 "$SERVER_PID" 2>/dev/null; then
    API_RUNNING=true
    log "API server started (PID $SERVER_PID)"
  else
    log "WARNING: API server may not have started cleanly"
  fi
fi

# ── 2. Ensure Vite dev server is up ───────────────────────────────────────────
VITE_RUNNING=false
if curl -sf http://localhost:5173 >/dev/null 2>&1; then
  VITE_RUNNING=true
  log "Vite dev server already running on :5173"
else
  log "Starting Vite dev server..."
  cd client && npx vite --host 0.0.0.0 >> "../$LOG_FILE" 2>&1 &
  VITE_PID=$!
  cd ..
  sleep 8
  if curl -sf http://localhost:5173 >/dev/null 2>&1; then
    VITE_RUNNING=true
    log "Vite dev server started (PID $VITE_PID)"
  else
    log "WARNING: Vite dev server may not be ready yet — waiting more..."
    sleep 10
  fi
fi

# ── 3. Ensure audit credentials are valid ────────────────────────────────────
log "Verifying audit credentials..."
LOGIN_TEST=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"waterlooconstruction1@gmail.com","password":"2Wealth&health","tenantSlug":"waterloo"}' 2>/dev/null)

if echo "$LOGIN_TEST" | grep -q '"error"'; then
  log "Credentials invalid — resetting password for audit user..."
  cd /c/projects/stormleads/server
  node --input-type=module << 'NODEEOF'
import pool from './src/db/pool.js';
import bcrypt from 'bcryptjs';
const hash = await bcrypt.hash('2Wealth&health', 10);
await pool.query(`UPDATE users u SET password_hash = $1 FROM tenants t WHERE u.tenant_id = t.id AND u.email = 'waterlooconstruction1@gmail.com' AND t.slug = 'waterloo'`, [hash]);
await pool.end();
NODEEOF
  cd /c/projects/stormleads
  log "Password reset complete."
else
  log "Credentials OK."
fi

# ── 4. Run Playwright tests ───────────────────────────────────────────────────
log "Running Playwright UI audit..."

EXIT_CODE=0
npx playwright test tests/nightly-audit.spec.js \
  --reporter=json \
  --output="$REPORT_DIR/results-${TODAY}" \
  2>&1 | tee -a "$LOG_FILE" || EXIT_CODE=$?

# Copy JSON results
if [ -f "tests/results.json" ]; then
  cp tests/results.json "$REPORT_FILE"
  log "Results saved to $REPORT_FILE"
fi

# ── 5. Summary ────────────────────────────────────────────────────────────────
if [ $EXIT_CODE -eq 0 ]; then
  log "=== AUDIT PASSED — All tests green ==="
else
  log "=== AUDIT FAILED (exit $EXIT_CODE) — See $LOG_FILE for details ==="
fi

log "=== Audit complete ==="
exit $EXIT_CODE
