#!/usr/bin/env bash
set -euo pipefail

BASE_URL="https://dtlcprcpvdomrehbejhw.supabase.co"

usage() {
  cat <<EOF
Usage: $(basename "$0") <command> [options]

Commands:
  ingest                    Trigger current-week data collection
  backfill <weeks>          Backfill N weeks of historical data (1-52, default 26)

Options:
  --skip-trends             Skip Google Trends (much faster, recommended for large backfills)
  --dry-run                 Log what would be written without inserting data
  --date YYYY-MM-DD         Override target date (ingest only)
  --help                    Show this help message

Environment:
  SUPABASE_SERVICE_ROLE_KEY Required. Your Supabase project service role key.

Examples:
  export SUPABASE_SERVICE_ROLE_KEY='your-key-here'
  $(basename "$0") ingest
  $(basename "$0") backfill 35 --skip-trends
  $(basename "$0") backfill 4 --dry-run
EOF
  exit 0
}

# --- Validate environment ---
if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "Error: SUPABASE_SERVICE_ROLE_KEY is not set."
  echo "Export it before running: export SUPABASE_SERVICE_ROLE_KEY='your-key-here'"
  exit 1
fi

if [[ $# -eq 0 ]] || [[ "$1" == "--help" ]]; then
  usage
fi

COMMAND="$1"
shift

# --- Helper: call endpoint and print result ---
call_endpoint() {
  local url="$1"
  local method="${2:-POST}"

  echo "→ ${method} ${url}"
  echo ""

  local response http_code body
  response=$(curl -s -w "\n%{http_code}" \
    -X "${method}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    "${url}")

  http_code=$(echo "${response}" | tail -n1)
  body=$(echo "${response}" | sed '$d')

  # Pretty-print if jq is available
  if command -v jq &>/dev/null; then
    echo "${body}" | jq .
  else
    echo "${body}"
  fi

  echo ""
  if [[ "${http_code}" -ge 200 ]] && [[ "${http_code}" -lt 300 ]]; then
    echo "✓ Success (HTTP ${http_code})"
    return 0
  else
    echo "✗ Failed (HTTP ${http_code})"
    return 1
  fi
}

# --- Commands ---

case "${COMMAND}" in
  ingest)
    DATE_PARAM=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --date) DATE_PARAM="?date=$2"; shift 2 ;;
        --help) usage ;;
        *) echo "Unknown option: $1"; exit 1 ;;
      esac
    done
    echo "=== Triggering pipeline ingest ==="
    call_endpoint "${BASE_URL}/functions/v1/ingest-signals${DATE_PARAM}" POST
    ;;

  backfill)
    WEEKS="${1:-26}"
    shift || true
    SKIP_TRENDS="false"
    DRY_RUN="false"

    while [[ $# -gt 0 ]]; do
      case "$1" in
        --skip-trends) SKIP_TRENDS="true"; shift ;;
        --dry-run) DRY_RUN="true"; shift ;;
        --help) usage ;;
        *) echo "Unknown option: $1"; exit 1 ;;
      esac
    done

    echo "=== Triggering ${WEEKS}-week historical backfill ==="
    echo "  skip_trends=${SKIP_TRENDS}  dry_run=${DRY_RUN}"
    echo ""
    call_endpoint "${BASE_URL}/functions/v1/backfill-historical?weeks=${WEEKS}&skip_trends=${SKIP_TRENDS}&dry_run=${DRY_RUN}" POST
    ;;

  *)
    echo "Unknown command: ${COMMAND}"
    echo "Run '$(basename "$0") --help' for usage."
    exit 1
    ;;
esac
