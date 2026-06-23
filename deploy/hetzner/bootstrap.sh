#!/usr/bin/env bash
# Idempotent system bootstrap for the PsiMeter app server (Ubuntu 24.04).
# Installs Node.js 20, Rust (cargo/rustc), Caddy, Python; creates the service
# user; opens the firewall. Safe to re-run. Run as root.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

SERVICE_USER=psimeter
APP_DIR=/opt/psimeter

echo "[bootstrap] apt base packages"
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git build-essential python3 ufw \
  apt-transport-https debian-keyring debian-archive-keyring

# --- Node.js 20 LTS (NodeSource) ---
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v//' | cut -d. -f1)" -lt 18 ]; then
  echo "[bootstrap] installing Node.js 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs
fi
echo "[bootstrap] node $(node -v), npm $(npm -v)"

# --- Rust (apt; the entropy-provider is a zero-dep crate, rustup not needed) ---
if ! command -v cargo >/dev/null 2>&1; then
  echo "[bootstrap] installing Rust (cargo/rustc)"
  apt-get install -y -qq cargo rustc
fi
echo "[bootstrap] $(cargo --version)"

# --- Caddy (official cloudsmith repo) ---
if ! command -v caddy >/dev/null 2>&1; then
  echo "[bootstrap] installing Caddy"
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -qq
  apt-get install -y -qq caddy
fi
echo "[bootstrap] $(caddy version | head -1)"

# --- service user (no login shell; home is the app dir) ---
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  echo "[bootstrap] creating service user $SERVICE_USER"
  useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi

# --- firewall: ssh + http/https only ---
echo "[bootstrap] firewall (ssh + http/https)"
ufw allow OpenSSH >/dev/null 2>&1 || ufw allow 22/tcp >/dev/null
ufw allow 80/tcp  >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

echo "[bootstrap] done"
