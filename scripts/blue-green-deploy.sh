#!/usr/bin/env bash
# blue-green-deploy.sh
# Zero-downtime blue-green deployment for Stellar-Spend (Docker Compose).
#
# Usage:
#   ./scripts/blue-green-deploy.sh [IMAGE_TAG]
#
# Requirements: docker, docker compose, curl
# The script expects docker-compose.blue.yml and docker-compose.green.yml
# to exist alongside this script's parent directory.
#
# Optional environment variables:
#   SLACK_WEBHOOK_URL   - Slack webhook for deploy notifications
#   DEPLOY_HISTORY_FILE - Path to deploy history log (default: .deploy-history)

set -euo pipefail

IMAGE_TAG="${1:-latest}"
APP_IMAGE="stellar-spend:${IMAGE_TAG}"
HEALTH_URL="http://localhost"
HEALTH_RETRIES=10
HEALTH_INTERVAL=5  # seconds between retries
DEPLOY_HISTORY_FILE="${DEPLOY_HISTORY_FILE:-.deploy-history}"
DEPLOY_START=$(date -u +%s)

# ── Notification helper ───────────────────────────────────────────────────────

notify() {
  local status="$1" message="$2"
  echo "==> [NOTIFY] ${status}: ${message}"
  if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    local color
    case "$status" in
      SUCCESS) color="good" ;;
      FAILURE) color="danger" ;;
      *)       color="warning" ;;
    esac
    curl -s -X POST "$SLACK_WEBHOOK_URL" \
      -H 'Content-type: application/json' \
      --data "{\"attachments\":[{\"color\":\"${color}\",\"text\":\"[stellar-spend] ${message}\"}]}" \
      > /dev/null || true
  fi
}

# ── Deploy history ────────────────────────────────────────────────────────────

record_deploy() {
  local status="$1" active="$2" duration="$3"
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) image=${IMAGE_TAG} slot=${active} status=${status} duration=${duration}s" \
    >> "$DEPLOY_HISTORY_FILE"
}

# ── Health check ─────────────────────────────────────────────────────────────

health_check() {
  local port="$1"
  local url="${HEALTH_URL}:${port}/api/health"
  for i in $(seq 1 "$HEALTH_RETRIES"); do
    if curl -sf "$url" | grep -q '"status":"ok"'; then
      echo "  Health check passed on port ${port}"
      return 0
    fi
    echo "  Attempt ${i}/${HEALTH_RETRIES}: waiting ${HEALTH_INTERVAL}s..."
    sleep "$HEALTH_INTERVAL"
  done
  echo "  ERROR: Health check failed after ${HEALTH_RETRIES} attempts on port ${port}" >&2
  return 1
}

# ── Smoke tests ───────────────────────────────────────────────────────────────
# Runs the full Playwright smoke suite (e2e/smoke.spec.ts).
# Budget is capped at SMOKE_BUDGET_MS (default 60 s).
# Failures post to SLACK_WEBHOOK_URL if set.

smoke_tests() {
  local port="$1"
  local base="${HEALTH_URL}:${port}"
  local budget_ms="${SMOKE_BUDGET_MS:-60000}"

  echo "==> Running Playwright smoke tests on port ${port} (budget ${budget_ms}ms)..."

  BASE_URL="${base}" \
  SMOKE_BUDGET_MS="${budget_ms}" \
  SMOKE_ALERT_WEBHOOK="${SLACK_WEBHOOK_URL:-}" \
    npx playwright test e2e/smoke.spec.ts \
      --reporter=line \
      --timeout="${budget_ms}" \
      2>&1

  local exit_code=$?
  if [ "$exit_code" -eq 0 ]; then
    echo "  [PASS] All smoke checks passed"
  else
    echo "  [FAIL] Smoke suite failed (exit ${exit_code})" >&2
  fi
  return "$exit_code"
}

# ── Determine slots ───────────────────────────────────────────────────────────

active_env() {
  if docker compose -f docker-compose.blue.yml ps --status running 2>/dev/null | grep -q "Up"; then
    echo "blue"
  else
    echo "green"
  fi
}

CURRENT=$(active_env)
if [ "$CURRENT" = "blue" ]; then
  NEXT="green"; NEXT_PORT=3001; CURRENT_PORT=3000
else
  NEXT="blue";  NEXT_PORT=3000; CURRENT_PORT=3001
fi

echo "==> Current active environment: ${CURRENT} (port ${CURRENT_PORT})"
echo "==> Deploying to: ${NEXT} (port ${NEXT_PORT})"
notify "INFO" "Deploy started — image=${IMAGE_TAG} target=${NEXT}"

# ── 1. Build image ────────────────────────────────────────────────────────────
echo "==> Building image ${APP_IMAGE}..."
docker build -t "$APP_IMAGE" .

# ── 2. Start new environment ─────────────────────────────────────────────────
echo "==> Starting ${NEXT} environment..."
IMAGE_TAG="$IMAGE_TAG" docker compose -f "docker-compose.${NEXT}.yml" up -d

# ── 3. Health check ───────────────────────────────────────────────────────────
echo "==> Running health checks on ${NEXT}..."
if ! health_check "$NEXT_PORT"; then
  echo "==> ROLLBACK: ${NEXT} failed health checks. Stopping it."
  docker compose -f "docker-compose.${NEXT}.yml" down
  DURATION=$(( $(date -u +%s) - DEPLOY_START ))
  record_deploy "FAILED_HEALTH" "$CURRENT" "$DURATION"
  notify "FAILURE" "Deploy FAILED (health check) — image=${IMAGE_TAG} slot=${NEXT} duration=${DURATION}s"
  exit 1
fi

# ── 4. Smoke tests ────────────────────────────────────────────────────────────
if ! smoke_tests "$NEXT_PORT"; then
  echo "==> ROLLBACK: ${NEXT} failed smoke tests. Stopping it."
  docker compose -f "docker-compose.${NEXT}.yml" down
  DURATION=$(( $(date -u +%s) - DEPLOY_START ))
  record_deploy "FAILED_SMOKE" "$CURRENT" "$DURATION"
  notify "FAILURE" "Deploy FAILED (smoke tests) — image=${IMAGE_TAG} slot=${NEXT} duration=${DURATION}s"
  exit 1
fi

# ── 5. Switch traffic ─────────────────────────────────────────────────────────
echo "==> Switching traffic to ${NEXT} (port ${NEXT_PORT})..."
# If using nginx, reload its config here, e.g.:
#   sed -i "s/proxy_pass http:\/\/localhost:[0-9]*/proxy_pass http:\/\/localhost:${NEXT_PORT}/" /etc/nginx/conf.d/stellar-spend.conf
#   nginx -s reload
echo "$NEXT" > .active-env
echo "==> Traffic switched to ${NEXT}"

# ── 6. Stop old environment ───────────────────────────────────────────────────
echo "==> Stopping old environment: ${CURRENT}..."
docker compose -f "docker-compose.${CURRENT}.yml" down

DURATION=$(( $(date -u +%s) - DEPLOY_START ))
record_deploy "SUCCESS" "$NEXT" "$DURATION"
notify "SUCCESS" "Deploy SUCCESS — image=${IMAGE_TAG} active=${NEXT} duration=${DURATION}s"
echo "==> Deployment complete. Active: ${NEXT} on port ${NEXT_PORT} (${DURATION}s)"
