#!/usr/bin/env bash
# Idempotent app deploy: install deps, build core + client + RDSEED sidecar,
# pick the entropy source, render the systemd unit + Caddyfile, (re)start.
# Run as root from the repo checkout. Safe to re-run for redeploys.
set -euo pipefail

APP_DIR=/opt/psimeter
SERVICE_USER=psimeter
DOMAIN="${PSIMETER_DOMAIN:-app.psimeter.org}"
LEDGER_DIR="$APP_DIR/ledger"

cd "$APP_DIR"
echo "[deploy] building @ $(git rev-parse --short HEAD) (branch $(git rev-parse --abbrev-ref HEAD))"

# --- dependencies & build (NODE_ENV must NOT be 'production' here, or npm would
#     drop the dev deps we need to build: vite, tsx, typescript) ---
unset NODE_ENV
npm ci
npm run build:core
npm run build:client
echo "[deploy] building RDSEED sidecar"
cargo build --release --manifest-path packages/entropy-provider/Cargo.toml

# --- choose the entropy source: real RDSEED if the CPU exposes it, else OS ---
SIDE="packages/entropy-provider/target/release/entropy-provider"
ENTROPY=os
if [ -x "$SIDE" ] && "$SIDE" --info | grep -q '"available":true'; then
  ENTROPY=rdseed
fi
echo "[deploy] entropy source: $ENTROPY"
echo "[deploy] sidecar --info: $("$SIDE" --info 2>/dev/null || echo 'n/a')"

# --- persistent ledger directory ---
mkdir -p "$LEDGER_DIR"

# --- render systemd unit ---
sed -e "s|@APP_DIR@|$APP_DIR|g" \
    -e "s|@USER@|$SERVICE_USER|g" \
    -e "s|@ENTROPY@|$ENTROPY|g" \
    -e "s|@LEDGER@|$LEDGER_DIR/prod.jsonl|g" \
    deploy/hetzner/psimeter.service > /etc/systemd/system/psimeter.service

# --- render Caddy config ---
sed -e "s|@DOMAIN@|$DOMAIN|g" deploy/hetzner/Caddyfile > /etc/caddy/Caddyfile

# --- ownership: service user owns the whole tree (incl. ledger + npm cache) ---
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR"

# --- (re)start the service and reload Caddy ---
systemctl daemon-reload
systemctl enable psimeter >/dev/null 2>&1 || true
systemctl restart psimeter
if caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
  systemctl reload caddy 2>/dev/null || systemctl restart caddy
else
  echo "[deploy] WARNING: caddy config failed validation"; caddy validate --config /etc/caddy/Caddyfile || true
fi

echo "[deploy] done — entropy=$ENTROPY domain=$DOMAIN"
