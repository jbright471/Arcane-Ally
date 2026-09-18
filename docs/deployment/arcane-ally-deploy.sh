#!/usr/bin/env bash
set -Eeuo pipefail

# Fixed, fail-closed Arcane Ally deployment controller for Bastet.
# It intentionally accepts only the exact head of the reviewed live-baseline
# branch. The September product release adds explicitly reviewed paths
# to the original client/UI scope; schemas, lockfiles, auth modules, and
# other infrastructure remain outside the allowlist.

umask 077

MODE="${1:-status}"
REQUESTED_SHA="${2:-}"

COMPOSE_FILE="/home/bastet/homelab/projects/docker-compose.yml"
COMPOSE_PROJECT="projects-stack"
REPOSITORY="/home/bastet/homelab/arcane-ally/repository.git"
RELEASE_ROOT="/home/bastet/homelab/arcane-ally/releases"
DEPLOYMENT_ROOT="/home/bastet/homelab/arcane-ally/deployment"
BACKUP_ROOT="/home/bastet/homelab/arcane-ally/backups"
DATA_ROOT="/home/bastet/DnD Project/data"
DATABASE_FILE="$DATA_ROOT/dnd.db"
SERVER_ENV="$DEPLOYMENT_ROOT/server.env"
PREFLIGHT_SCRIPT="$DEPLOYMENT_ROOT/arcane-ally-preflight.py"
REMOTE_URL="https://github.com/jbright471/Arcane-Ally.git"
REMOTE_REF="refs/heads/automation/arcane-ally-live-baseline"
FETCH_REF="refs/remotes/automation/live-baseline"
BACKEND_SERVICE="dnd-party-sync-backend"
FRONTEND_SERVICE="dnd-party-sync-frontend"
BACKEND_CONTAINER="dnd-party-sync-backend"
FRONTEND_CONTAINER="dnd-party-sync-frontend"
FRONTEND_URL="http://192.168.50.209:5173/"
BACKEND_URL="http://127.0.0.1:3002/api/health"

log() { printf '%s\n' "$*"; }
fail() {
  printf 'deployment_status=blocked\nreason=%s\n' "$*" >&2
  if [[ "${ROLLBACK_REQUIRED:-0}" == "1" ]]; then
    rollback 1
  fi
  exit 1
}
require_command() { command -v "$1" >/dev/null 2>&1 || fail "required command is unavailable: $1"; }

for command_name in docker git python3 flock; do
  require_command "$command_name"
done

[[ -f "$COMPOSE_FILE" ]] || fail "shared Compose owner is missing"
[[ -d "$REPOSITORY" ]] || fail "Arcane Ally bare repository is missing"
[[ -f "$DATABASE_FILE" ]] || fail "persistent Arcane Ally database is missing"
[[ -f "$SERVER_ENV" ]] || fail "deployment environment file is missing"
[[ -f "$PREFLIGHT_SCRIPT" ]] || fail "preflight script is missing"

container_revision() {
  docker inspect "$1" --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'
}

container_state() {
  docker inspect "$1" --format '{{.State.Status}}'
}

backend_health() {
  docker inspect "$BACKEND_CONTAINER" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}'
}

CURRENT_BACKEND_SHA="$(container_revision "$BACKEND_CONTAINER")"
CURRENT_FRONTEND_SHA="$(container_revision "$FRONTEND_CONTAINER")"
[[ "$CURRENT_BACKEND_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "backend revision label is invalid"
[[ "$CURRENT_FRONTEND_SHA" == "$CURRENT_BACKEND_SHA" ]] || fail "frontend and backend revision labels disagree"
CURRENT_SHA="$CURRENT_BACKEND_SHA"
CURRENT_SHORT="${CURRENT_SHA:0:7}"

if [[ "$MODE" == "status" ]]; then
  log "deployment_status=observed"
  log "revision=$CURRENT_SHA"
  log "backend_state=$(container_state "$BACKEND_CONTAINER")"
  log "backend_health=$(backend_health)"
  log "frontend_state=$(container_state "$FRONTEND_CONTAINER")"
  exit 0
fi

[[ "$MODE" == "plan" || "$MODE" == "deploy" || "$MODE" == "rollback" ]] || fail "mode must be status, plan, deploy, or rollback"

mkdir -p "$DEPLOYMENT_ROOT" "$BACKUP_ROOT" "$RELEASE_ROOT"
exec 9>"$DEPLOYMENT_ROOT/deploy.lock"
flock -n 9 || fail "another Arcane Ally deployment is active"

if [[ "$MODE" == "rollback" ]]; then
  [[ -n "$REQUESTED_SHA" ]] || fail "rollback requires the full currently deployed revision"
  [[ "$REQUESTED_SHA" == "$CURRENT_SHA" ]] || fail "rollback target does not match the currently deployed revision"

  ROLLBACK_RECORD="$(python3 - "$BACKUP_ROOT" "$CURRENT_SHA" <<'PY'
import json
import sys
from pathlib import Path

backup_root, current = Path(sys.argv[1]), sys.argv[2]
for manifest in sorted(backup_root.glob("*/manifest.json"), reverse=True):
    try:
        record = json.loads(manifest.read_text())
    except (OSError, json.JSONDecodeError):
        continue
    if record.get("target_revision") == current:
        previous = record.get("previous_revision", "")
        compose_name = record.get("compose_backup", "")
        if len(previous) == 40 and compose_name:
            print(f"{manifest.parent}|{previous}|{compose_name}")
            break
else:
    raise SystemExit("no verified rollback manifest matches the live revision")
PY
)" || fail "no verified rollback manifest matches the live revision"

  IFS='|' read -r ROLLBACK_DIR PREVIOUS_SHA COMPOSE_BACKUP_NAME <<<"$ROLLBACK_RECORD"
  [[ "$PREVIOUS_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "rollback manifest has an invalid previous revision"
  PREVIOUS_SHORT="${PREVIOUS_SHA:0:7}"
  [[ -f "$ROLLBACK_DIR/$COMPOSE_BACKUP_NAME" ]] || fail "rollback Compose backup is missing"
  docker image inspect "arcane-ally-backend:$PREVIOUS_SHORT" >/dev/null 2>&1 || fail "previous backend image is missing"
  [[ -d "$RELEASE_ROOT/$PREVIOUS_SHORT/client" ]] || fail "previous frontend release is missing"

  SAFETY_COMPOSE="$ROLLBACK_DIR/docker-compose.yml.pre-manual-rollback-$CURRENT_SHA"
  cp --preserve=mode,timestamps "$COMPOSE_FILE" "$SAFETY_COMPOSE"

  restore_failed_rollback() {
    local exit_code="${1:-$?}"
    trap - ERR
    printf 'deployment_status=rollback-failed\nreason=restoring pre-rollback Compose state\n' >&2
    cp --preserve=mode,timestamps "$SAFETY_COMPOSE" "$COMPOSE_FILE"
    docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" up -d --no-deps --force-recreate "$BACKEND_SERVICE" "$FRONTEND_SERVICE" >&2 || true
    exit "$exit_code"
  }
  trap restore_failed_rollback ERR

  cp --preserve=mode,timestamps "$ROLLBACK_DIR/$COMPOSE_BACKUP_NAME" "$COMPOSE_FILE"
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" config --quiet
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" up -d --no-deps --force-recreate "$BACKEND_SERVICE" "$FRONTEND_SERVICE"

  for _ in $(seq 1 60); do
    ROLLED_BACK_HEALTH="$(backend_health 2>/dev/null || true)"
    [[ "$ROLLED_BACK_HEALTH" == "healthy" ]] && break
    if [[ "$ROLLED_BACK_HEALTH" == "unhealthy" ]]; then
      printf 'deployment_status=rollback-failed\nreason=rolled-back backend became unhealthy\n' >&2
      restore_failed_rollback 1
    fi
    sleep 2
  done
  if [[ "${ROLLED_BACK_HEALTH:-}" != "healthy" ]]; then
    printf 'deployment_status=rollback-failed\nreason=rolled-back backend did not become healthy\n' >&2
    restore_failed_rollback 1
  fi

  python3 - "$BACKEND_URL" "$FRONTEND_URL" <<'PY'
import json
import sys
import time
import urllib.request

for url in sys.argv[1:]:
    last_error = None
    for _ in range(60):
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                body = response.read(2048)
                if response.status == 200 and body:
                    break
        except Exception as error:
            last_error = error
        time.sleep(2)
    else:
        raise SystemExit(f"rollback endpoint verification failed for {url}: {last_error}")

with urllib.request.urlopen(sys.argv[1], timeout=5) as response:
    if json.load(response).get("status") != "ok":
        raise SystemExit("rolled-back backend health payload did not report ok")
PY

  if [[ "$(container_revision "$BACKEND_CONTAINER")" != "$PREVIOUS_SHA" ]]; then
    printf 'deployment_status=rollback-failed\nreason=rolled-back backend revision label does not match\n' >&2
    restore_failed_rollback 1
  fi
  if [[ "$(container_revision "$FRONTEND_CONTAINER")" != "$PREVIOUS_SHA" ]]; then
    printf 'deployment_status=rollback-failed\nreason=rolled-back frontend revision label does not match\n' >&2
    restore_failed_rollback 1
  fi
  trap - ERR
  log "deployment_status=rolled-back"
  log "revision=$PREVIOUS_SHA"
  log "from_revision=$CURRENT_SHA"
  exit 0
fi

git --git-dir="$REPOSITORY" fetch --quiet "$REMOTE_URL" "+$REMOTE_REF:$FETCH_REF"
REMOTE_SHA="$(git --git-dir="$REPOSITORY" rev-parse "$FETCH_REF^{commit}")"
TARGET_SHA="${REQUESTED_SHA:-$REMOTE_SHA}"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "target revision must be a full Git SHA"
[[ "$TARGET_SHA" == "$REMOTE_SHA" ]] || fail "target revision is not the current reviewed baseline head"

if [[ "$TARGET_SHA" == "$CURRENT_SHA" ]]; then
  log "deployment_status=no-change"
  log "revision=$CURRENT_SHA"
  exit 0
fi

git --git-dir="$REPOSITORY" cat-file -e "$CURRENT_SHA^{commit}" 2>/dev/null || fail "current live revision is absent from the deployment repository"
git --git-dir="$REPOSITORY" merge-base --is-ancestor "$CURRENT_SHA" "$TARGET_SHA" || fail "target is not a fast-forward descendant of the live revision"

mapfile -t CHANGED_FILES < <(git --git-dir="$REPOSITORY" diff --name-only "$CURRENT_SHA..$TARGET_SHA")
(( ${#CHANGED_FILES[@]} > 0 )) || fail "target revision has no recorded changes"

RUNTIME_CHANGE=0
BLOCKED_FILES=()
for changed_file in "${CHANGED_FILES[@]}"; do
  case "$changed_file" in
    client/src/*|client/public/*|client/index.html|client/package.json|client/vite.config.ts|server/server.js|Dockerfile)
      RUNTIME_CHANGE=1
      ;;
    docs/*|.github/*|README.md|CHANGELOG.md|LICENSE|client/README.md|server/test/productionServerSecurity.test.js)
      ;;
    *)
      BLOCKED_FILES+=("$changed_file")
      ;;
  esac
done

if (( ${#BLOCKED_FILES[@]} > 0 )); then
  printf 'deployment_status=blocked\nreason=change set exceeds the reviewed product release allowlist\n' >&2
  printf 'blocked_file=%s\n' "${BLOCKED_FILES[@]}" >&2
  exit 1
fi

if (( RUNTIME_CHANGE == 0 )); then
  log "deployment_status=no-runtime-change"
  log "current_revision=$CURRENT_SHA"
  log "candidate_revision=$TARGET_SHA"
  exit 0
fi

TARGET_SHORT="${TARGET_SHA:0:7}"
RELEASE_PATH="$RELEASE_ROOT/$TARGET_SHORT"
IMAGE="arcane-ally-backend:$TARGET_SHORT"

log "deployment_status=eligible"
log "current_revision=$CURRENT_SHA"
log "candidate_revision=$TARGET_SHA"
log "changed_file_count=${#CHANGED_FILES[@]}"

if [[ "$MODE" == "plan" ]]; then
  exit 0
fi

if [[ -e "$RELEASE_PATH" ]]; then
  [[ -f "$RELEASE_PATH/.git" ]] || fail "candidate release path already exists but is not a Git worktree"
  EXISTING_SHA="$(git -C "$RELEASE_PATH" rev-parse HEAD)"
  [[ "$EXISTING_SHA" == "$TARGET_SHA" ]] || fail "candidate release path points to a different revision"
  [[ -z "$(git -C "$RELEASE_PATH" status --porcelain)" ]] || fail "candidate release worktree is dirty"
else
  git --git-dir="$REPOSITORY" worktree add --detach "$RELEASE_PATH" "$TARGET_SHA" >/dev/null
fi

docker build --pull=false --label "org.opencontainers.image.revision=$TARGET_SHA" -t "$IMAGE" "$RELEASE_PATH"

TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
STAGING_DIR="$DEPLOYMENT_ROOT/preflight-$TARGET_SHORT-$TIMESTAMP"
STAGING_CONTAINER="arcane-ally-preflight-$TARGET_SHORT"
mkdir -p "$STAGING_DIR"

python3 - "$DATABASE_FILE" "$STAGING_DIR/dnd.db" <<'PY'
import sqlite3
import sys

source_path, destination_path = sys.argv[1:]
source = sqlite3.connect(f"file:{source_path}?mode=ro", uri=True)
destination = sqlite3.connect(destination_path)
try:
    source.backup(destination)
    result = destination.execute("PRAGMA quick_check").fetchone()[0]
    if result != "ok":
        raise SystemExit(f"staging database quick_check failed: {result}")
finally:
    destination.close()
    source.close()
PY

cleanup_preflight() {
  docker rm -f "$STAGING_CONTAINER" >/dev/null 2>&1 || true
}
trap cleanup_preflight EXIT
cleanup_preflight

NETWORK_NAME="$(docker inspect "$BACKEND_CONTAINER" --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{"\n"}}{{end}}' | head -n 1)"
[[ -n "$NETWORK_NAME" ]] || fail "backend Compose network could not be identified"

docker run -d --rm \
  --name "$STAGING_CONTAINER" \
  --network "$NETWORK_NAME" \
  -p 127.0.0.1:3102:3001 \
  --env-file "$SERVER_ENV" \
  -e PORT=3001 \
  -e DB_PATH=/app/data/dnd.db \
  -v "$STAGING_DIR:/app/data" \
  "$IMAGE" >/dev/null

for _ in $(seq 1 30); do
  PREFLIGHT_HEALTH="$(docker inspect "$STAGING_CONTAINER" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' 2>/dev/null || true)"
  [[ "$PREFLIGHT_HEALTH" == "healthy" ]] && break
  [[ "$PREFLIGHT_HEALTH" == "unhealthy" || "$PREFLIGHT_HEALTH" == "exited" ]] && fail "candidate preflight container failed"
  sleep 2
done
[[ "${PREFLIGHT_HEALTH:-}" == "healthy" ]] || fail "candidate preflight container did not become healthy"

set -a
# shellcheck disable=SC1090
. "$SERVER_ENV"
set +a
ARCANE_PREFLIGHT_URL="http://127.0.0.1:3102" \
ARCANE_PREFLIGHT_DB="$STAGING_DIR/dnd.db" \
ARCANE_PREFLIGHT_CREATE_GRANT=1 \
python3 "$PREFLIGHT_SCRIPT"
unset DM_PIN
cleanup_preflight

BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP-$TARGET_SHORT"
mkdir -p "$BACKUP_DIR"
cp --preserve=mode,timestamps "$COMPOSE_FILE" "$BACKUP_DIR/docker-compose.yml.pre-$CURRENT_SHORT"

python3 - "$DATABASE_FILE" "$BACKUP_DIR/dnd.db" <<'PY'
import sqlite3
import sys

source_path, destination_path = sys.argv[1:]
source = sqlite3.connect(f"file:{source_path}?mode=ro", uri=True)
destination = sqlite3.connect(destination_path)
try:
    source.backup(destination)
    result = destination.execute("PRAGMA quick_check").fetchone()[0]
    if result != "ok":
        raise SystemExit(f"production backup quick_check failed: {result}")
finally:
    destination.close()
    source.close()
PY

OLD_IMAGE_ID="$(docker image inspect "arcane-ally-backend:$CURRENT_SHORT" --format '{{.Id}}')"
NEW_IMAGE_ID="$(docker image inspect "$IMAGE" --format '{{.Id}}')"
python3 - "$BACKUP_DIR/manifest.json" "$TIMESTAMP" "$CURRENT_SHA" "$TARGET_SHA" "$OLD_IMAGE_ID" "$NEW_IMAGE_ID" <<'PY'
import json
import sys
from pathlib import Path

path, timestamp, previous, target, previous_image, target_image = sys.argv[1:]
Path(path).write_text(json.dumps({
    "timestamp_utc": timestamp,
    "previous_revision": previous,
    "target_revision": target,
    "previous_image_id": previous_image,
    "target_image_id": target_image,
    "database_backup": "dnd.db",
    "compose_backup": f"docker-compose.yml.pre-{previous[:7]}",
}, indent=2) + "\n")
PY

python3 - "$COMPOSE_FILE" "$CURRENT_SHA" "$TARGET_SHA" <<'PY'
import os
import stat
import sys
from pathlib import Path

path = Path(sys.argv[1])
old_full, new_full = sys.argv[2:]
old_short, new_short = old_full[:7], new_full[:7]
text = path.read_text()
if text.count(old_full) != 2:
    raise SystemExit("expected exactly two live full-revision labels in Compose")
text = text.replace(old_full, new_full)
if text.count(old_short) != 3:
    raise SystemExit("expected exactly three live short-revision references in Compose")
text = text.replace(old_short, new_short)
mode = stat.S_IMODE(path.stat().st_mode)
temporary = path.with_suffix(path.suffix + ".arcane-next")
temporary.write_text(text)
os.chmod(temporary, mode)
os.replace(temporary, path)
PY

docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" config --quiet

ROLLBACK_REQUIRED=1
rollback() {
  local exit_code="${1:-$?}"
  trap - ERR
  if [[ "${ROLLBACK_REQUIRED:-0}" == "1" ]]; then
    printf 'deployment_status=rolling-back\nreason=deployment verification failed\n' >&2
    cp --preserve=mode,timestamps "$BACKUP_DIR/docker-compose.yml.pre-$CURRENT_SHORT" "$COMPOSE_FILE"
    docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" up -d --no-deps --force-recreate "$BACKEND_SERVICE" "$FRONTEND_SERVICE" >&2 || true
  fi
  exit "$exit_code"
}
trap rollback ERR

docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT" up -d --no-deps --force-recreate "$BACKEND_SERVICE" "$FRONTEND_SERVICE"

for _ in $(seq 1 60); do
  LIVE_HEALTH="$(backend_health 2>/dev/null || true)"
  [[ "$LIVE_HEALTH" == "healthy" ]] && break
  [[ "$LIVE_HEALTH" == "unhealthy" ]] && fail "deployed backend became unhealthy"
  sleep 2
done
[[ "${LIVE_HEALTH:-}" == "healthy" ]] || fail "deployed backend did not become healthy"

python3 - "$BACKEND_URL" "$FRONTEND_URL" <<'PY'
import json
import sys
import time
import urllib.request

for url in sys.argv[1:]:
    last_error = None
    for _ in range(60):
        try:
            with urllib.request.urlopen(url, timeout=5) as response:
                body = response.read(2048)
                if response.status == 200 and body:
                    break
        except Exception as error:
            last_error = error
        time.sleep(2)
    else:
        raise SystemExit(f"endpoint verification failed for {url}: {last_error}")

with urllib.request.urlopen(sys.argv[1], timeout=5) as response:
    payload = json.load(response)
    if payload.get("status") != "ok":
        raise SystemExit("backend health payload did not report ok")
PY

[[ "$(container_revision "$BACKEND_CONTAINER")" == "$TARGET_SHA" ]] || fail "backend revision label does not match target"
[[ "$(container_revision "$FRONTEND_CONTAINER")" == "$TARGET_SHA" ]] || fail "frontend revision label does not match target"
[[ "$(container_state "$BACKEND_CONTAINER")" == "running" ]] || fail "backend is not running"
[[ "$(container_state "$FRONTEND_CONTAINER")" == "running" ]] || fail "frontend is not running"

ROLLBACK_REQUIRED=0
trap - ERR
trap cleanup_preflight EXIT

log "deployment_status=success"
log "revision=$TARGET_SHA"
log "backup_manifest=$BACKUP_DIR/manifest.json"
log "frontend_url=$FRONTEND_URL"
