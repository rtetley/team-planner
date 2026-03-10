#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Build and deploy TeamTree (frontend + backend) to a remote VM
# =============================================================================
# Usage:
#   ./deploy/deploy.sh [options] <action(s)>
#
# Required:
#   DEPLOY_HOST   Hostname or IP of the target VM  (or --host)
#
# Connection options:
#   --host <host>         VM hostname or IP
#   --user <user>         SSH user (default: current user)
#   --key  <path>         SSH private key (default: let SSH choose)
#   --port <port>         SSH port (default: 22)
#
# Path options:
#   --dir  <path>         Remote frontend directory  (default: /www/teamtree)
#   --server-dir <path>   Remote server directory    (default: /opt/teamtree-server)
#   --api-port <port>     Port the Node.js server listens on (default: 3001)
#   --service <name>      systemd service name       (default: teamtree-api)
#
# Update actions (at least one required, can be combined):
#   --update-frontend     Build Vite app locally and sync dist/ to the VM
#   --update-server       Build Node.js server locally, sync and restart service
#   --update-db           Run database migrations on the remote VM
#   --all                 Equivalent to all three update actions above
#
# One-time setup (opt-in, can be combined with update actions):
#   --with-nginx          Install nginx on the VM and deploy nginx.conf +
#                         teamtree.conf (creates a new virtual host)
#   --update-proxy-conf   Upload teamtree.conf to /etc/nginx/proxy.d/ only
#                         (use when iterating on routing rules)
#   --with-service        Install and enable the teamtree-api systemd unit
#                         (run once on first deploy; does NOT start the service
#                         automatically — create <server-dir>/.env first)
#
#   --help, -h            Show this help
#
# Environment variables (alternative to flags):
#   DEPLOY_HOST, DEPLOY_USER, DEPLOY_KEY, DEPLOY_PORT
#
# Examples:
#   # First-time full deploy
#   ./deploy/deploy.sh --host 1.2.3.4 --with-nginx --with-service --all
#
#   # Day-to-day frontend update
#   ./deploy/deploy.sh --host 1.2.3.4 --update-frontend
#
#   # Backend update + run migrations
#   ./deploy/deploy.sh --host 1.2.3.4 --update-server --update-db
#
#   # Update routing rules only
#   ./deploy/deploy.sh --host 1.2.3.4 --update-proxy-conf
# =============================================================================
set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RESET='\033[0m'
info()    { echo -e "${GREEN}[deploy]${RESET} $*"; }
step()    { echo -e "${CYAN}[deploy]${RESET} ── $*"; }
warn()    { echo -e "${YELLOW}[deploy]${RESET} $*"; }
error()   { echo -e "${RED}[deploy] ERROR:${RESET} $*" >&2; exit 1; }

# ── Defaults ──────────────────────────────────────────────────────────────────
DEPLOY_USER="${DEPLOY_USER:-$USER}"
DEPLOY_KEY="${DEPLOY_KEY:-}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-/www/teamtree}"
SERVER_DIR="${SERVER_DIR:-/opt/teamtree-server}"
API_PORT="${API_PORT:-3001}"
SERVICE_NAME="${SERVICE_NAME:-teamtree-api}"

NGINX_CONF_DEST="/etc/nginx/sites-available/teamtree"
NGINX_CONF_LINK="/etc/nginx/sites-enabled/teamtree"
PROXY_CONF_DEST="/etc/nginx/proxy.d/teamtree.conf"
SERVICE_DEST="/etc/systemd/system/${SERVICE_NAME}.service"

WITH_NGINX=false
UPDATE_PROXY_CONF=false
WITH_SERVICE=false
DO_FRONTEND=false
DO_SERVER=false
DO_DB=false

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Argument parsing ──────────────────────────────────────────────────────────
show_help() {
  # Print all leading comment lines (skip shebang, stop at first non-comment)
  awk 'NR>1 && /^[^#]/{exit} NR>1{print}' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

[[ $# -eq 0 ]] && show_help

while [[ $# -gt 0 ]]; do
  case $1 in
    --host)               DEPLOY_HOST="$2";   shift 2 ;;
    --user)               DEPLOY_USER="$2";   shift 2 ;;
    --key)                DEPLOY_KEY="$2";    shift 2 ;;
    --port)               DEPLOY_PORT="$2";   shift 2 ;;
    --dir)                REMOTE_DIR="$2";    shift 2 ;;
    --server-dir)         SERVER_DIR="$2";    shift 2 ;;
    --api-port)           API_PORT="$2";      shift 2 ;;
    --service)            SERVICE_NAME="$2";  shift 2 ;;
    --update-frontend)    DO_FRONTEND=true;   shift ;;
    --update-server)      DO_SERVER=true;     shift ;;
    --update-db)          DO_DB=true;         shift ;;
    --all)                DO_FRONTEND=true; DO_SERVER=true; DO_DB=true; shift ;;
    --with-nginx)         WITH_NGINX=true;    shift ;;
    --update-proxy-conf)  UPDATE_PROXY_CONF=true; shift ;;
    --with-service)       WITH_SERVICE=true;  shift ;;
    --help|-h)            show_help ;;
    *) error "Unknown option: $1. Run with --help for usage." ;;
  esac
done

# ── Validation ────────────────────────────────────────────────────────────────
[[ -z "${DEPLOY_HOST:-}" ]] && \
  error "DEPLOY_HOST is not set. Pass --host <ip> or export DEPLOY_HOST=<ip>"

[[ -n "$DEPLOY_KEY" && ! -f "$DEPLOY_KEY" ]] && \
  error "SSH key not found: $DEPLOY_KEY"

if [[ "$DO_FRONTEND" == false && "$DO_SERVER" == false && "$DO_DB" == false &&
      "$WITH_NGINX" == false && "$UPDATE_PROXY_CONF" == false && "$WITH_SERVICE" == false ]]; then
  error "No action specified. Pass at least one of: --update-frontend, --update-server, --update-db, --all, --with-nginx, --update-proxy-conf, --with-service"
fi

# ── SSH helpers ───────────────────────────────────────────────────────────────
SSH_ARGS=(-p "$DEPLOY_PORT"
          -o StrictHostKeyChecking=accept-new
          -o BatchMode=yes)
[[ -n "$DEPLOY_KEY" ]] && SSH_ARGS+=(-i "$DEPLOY_KEY")

run_ssh()  { ssh  "${SSH_ARGS[@]}" "${DEPLOY_USER}@${DEPLOY_HOST}" "$@"; }
run_rsync() {
  rsync -az --delete \
    -e "ssh ${SSH_ARGS[*]}" \
    "$@"
}

# ── Step: update frontend ─────────────────────────────────────────────────────
if [[ "$DO_FRONTEND" == true ]]; then
  step "Building frontend…"
  cd "$REPO_ROOT"
  yarn build
  info "Build complete → dist/"

  step "Preparing remote directory ${REMOTE_DIR}…"
  run_ssh "sudo mkdir -p '${REMOTE_DIR}' && sudo chown '${DEPLOY_USER}:${DEPLOY_USER}' '${REMOTE_DIR}'"

  step "Syncing dist/ to ${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_DIR}…"
  run_rsync "$REPO_ROOT/dist/" "${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_DIR}/"
  info "Frontend synced."
fi

# ── Step: update backend ──────────────────────────────────────────────────────
if [[ "$DO_SERVER" == true ]]; then
  step "Building server…"
  cd "$REPO_ROOT/server"
  yarn build
  info "Server build complete → server/dist/"

  step "Preparing remote server directory ${SERVER_DIR}…"
  run_ssh "sudo mkdir -p '${SERVER_DIR}' && sudo chown '${DEPLOY_USER}:${DEPLOY_USER}' '${SERVER_DIR}'"

  step "Syncing server/dist/ and package files to ${DEPLOY_USER}@${DEPLOY_HOST}:${SERVER_DIR}…"
  # Sync the compiled output and manifest files (never .env)
  run_rsync \
    "$REPO_ROOT/server/dist/" \
    "${DEPLOY_USER}@${DEPLOY_HOST}:${SERVER_DIR}/dist/"

  rsync -az \
    -e "ssh ${SSH_ARGS[*]}" \
    "$REPO_ROOT/server/package.json" \
    "$REPO_ROOT/server/yarn.lock" \
    "${DEPLOY_USER}@${DEPLOY_HOST}:${SERVER_DIR}/"

  step "Installing production dependencies on VM…"
  run_ssh "cd '${SERVER_DIR}' && yarn install --production --frozen-lockfile --silent"

  step "Restarting service ${SERVICE_NAME}…"
  if run_ssh "systemctl is-active --quiet '${SERVICE_NAME}' 2>/dev/null || systemctl is-enabled --quiet '${SERVICE_NAME}' 2>/dev/null"; then
    run_ssh "sudo systemctl restart '${SERVICE_NAME}'"
    info "Service ${SERVICE_NAME} restarted."
  else
    warn "Service ${SERVICE_NAME} is not installed or not enabled."
    warn "Run with --with-service to install it, then create ${SERVER_DIR}/.env and start manually."
  fi
fi

# ── Step: run database migrations ────────────────────────────────────────────
if [[ "$DO_DB" == true ]]; then
  step "Running database migrations on VM…"
  # The runner loads dotenv automatically when invoked as a CLI entry point.
  # It expects a .env file in the server working directory (SERVER_DIR).
  if ! run_ssh "test -f '${SERVER_DIR}/.env' || test -f '${SERVER_DIR}/.env.production'"; then
    error "Neither ${SERVER_DIR}/.env nor ${SERVER_DIR}/.env.production found on the VM. Create one from deploy/.env.production.example before running migrations."
  fi
  run_ssh "cd '${SERVER_DIR}' && node dist/migrations/runner.js"
  info "Migrations complete."
fi

# ── Step: install nginx (full, opt-in) ───────────────────────────────────────
if [[ "$WITH_NGINX" == true ]]; then
  step "Ensuring nginx is installed on the VM…"
  run_ssh "command -v nginx > /dev/null 2>&1 || (sudo apt-get update -qq && sudo apt-get install -y nginx)"

  step "Uploading nginx configuration files…"

  # Substitute placeholders in teamtree.conf
  local_proxy_conf="$(mktemp)"
  sed \
    -e "s|__APP_DIR__|${REMOTE_DIR}|g" \
    -e "s|__API_PORT__|${API_PORT}|g" \
    "$SCRIPT_DIR/teamtree.conf" > "$local_proxy_conf"

  rsync -az -e "ssh ${SSH_ARGS[*]}" \
    "$SCRIPT_DIR/nginx.conf"  "${DEPLOY_USER}@${DEPLOY_HOST}:/tmp/teamtree.nginx.conf"
  rsync -az -e "ssh ${SSH_ARGS[*]}" \
    "$local_proxy_conf"       "${DEPLOY_USER}@${DEPLOY_HOST}:/tmp/teamtree.conf"
  rm -f "$local_proxy_conf"

  PROXY_CONF_DIR="$(dirname "$PROXY_CONF_DEST")"
  run_ssh bash <<REMOTE
    set -euo pipefail
    sudo mv /tmp/teamtree.nginx.conf ${NGINX_CONF_DEST}
    sudo mkdir -p ${PROXY_CONF_DIR}
    sudo mv /tmp/teamtree.conf ${PROXY_CONF_DEST}
    sudo ln -sfn ${NGINX_CONF_DEST} ${NGINX_CONF_LINK}
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t
    sudo systemctl enable nginx
    sudo systemctl reload nginx || sudo systemctl start nginx
REMOTE

  info "nginx configured and reloaded."
  warn "SSL: update ssl_certificate / ssl_certificate_key in nginx.conf, or run:"
  warn "  sudo certbot --nginx -d <your-domain>"
fi

# ── Step: update proxy.d conf only (opt-in) ───────────────────────────────────
if [[ "$UPDATE_PROXY_CONF" == true ]]; then
  step "Uploading teamtree.conf to ${PROXY_CONF_DEST}…"

  local_proxy_conf="$(mktemp)"
  sed \
    -e "s|__APP_DIR__|${REMOTE_DIR}|g" \
    -e "s|__API_PORT__|${API_PORT}|g" \
    "$SCRIPT_DIR/teamtree.conf" > "$local_proxy_conf"

  rsync -az -e "ssh ${SSH_ARGS[*]}" \
    "$local_proxy_conf" "${DEPLOY_USER}@${DEPLOY_HOST}:/tmp/teamtree.conf"
  rm -f "$local_proxy_conf"

  PROXY_CONF_DIR="$(dirname "$PROXY_CONF_DEST")"
  run_ssh bash <<REMOTE
    set -euo pipefail
    sudo mkdir -p ${PROXY_CONF_DIR}
    sudo mv /tmp/teamtree.conf ${PROXY_CONF_DEST}
    sudo nginx -t
    sudo systemctl reload nginx
REMOTE

  info "teamtree.conf installed and nginx reloaded."
fi

# ── Step: install systemd service (opt-in) ────────────────────────────────────
if [[ "$WITH_SERVICE" == true ]]; then
  step "Installing systemd service ${SERVICE_NAME}…"

  local_service="$(mktemp)"
  sed \
    -e "s|__DEPLOY_USER__|${DEPLOY_USER}|g" \
    -e "s|__SERVER_DIR__|${SERVER_DIR}|g" \
    "$SCRIPT_DIR/teamtree-api.service" > "$local_service"

  rsync -az -e "ssh ${SSH_ARGS[*]}" \
    "$local_service" "${DEPLOY_USER}@${DEPLOY_HOST}:/tmp/${SERVICE_NAME}.service"
  rm -f "$local_service"

  run_ssh bash <<REMOTE
    set -euo pipefail
    sudo mv /tmp/${SERVICE_NAME}.service ${SERVICE_DEST}
    sudo systemctl daemon-reload
    sudo systemctl enable ${SERVICE_NAME}
REMOTE

  info "Service ${SERVICE_NAME} installed and enabled."
  warn "Create ${SERVER_DIR}/.env.production (see deploy/.env.production.example), then start with:"
  warn "  sudo systemctl start ${SERVICE_NAME}"
  warn "  journalctl -u ${SERVICE_NAME} -f"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
info "✅  Done!"
[[ "$DO_FRONTEND" == true ]] && info "   Frontend → ${REMOTE_DIR} on ${DEPLOY_HOST}"
[[ "$DO_SERVER"   == true ]] && info "   Server   → ${SERVER_DIR} on ${DEPLOY_HOST}"
[[ "$DO_DB"       == true ]] && info "   Database migrations applied."
