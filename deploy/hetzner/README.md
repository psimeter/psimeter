# Hetzner deployment

Deploys the PsiMeter app server (the `main` app, **not** the static coming-soon
`website` build) to a single Hetzner Cloud VM behind Caddy (automatic HTTPS/WSS),
run under systemd. This matches the single-stateful-process architecture recorded
in [`spec/RATIONALE.md` D17](../../spec/RATIONALE.md): one process, one persistent
disk for the hash-chained ledger and content-addressed blobs — **do not** put this
behind a multi-target load balancer or autoscaler (it would fork the chain).

## What's here
| File | Runs where | Does |
|------|-----------|------|
| `bootstrap.sh` | on the box, as root | install Node 20, Rust, Caddy, Python; create the `psimeter` user; firewall. Idempotent. |
| `deploy.sh` | on the box, as root | `npm ci`, build core + client + RDSEED sidecar, pick entropy source, render unit + Caddyfile, restart. Idempotent. |
| `psimeter.service` | template | systemd unit (`@…@` placeholders filled by `deploy.sh`). |
| `Caddyfile` | template | reverse proxy `@DOMAIN@` → `localhost:8787` with auto-TLS. |

## First deploy / redeploy (from a workstation)
The box pulls this branch from GitHub, then runs the two scripts:

```sh
ssh root@<server-ip> bash -s <<'EOF'
set -euo pipefail
git config --global --add safe.directory /opt/psimeter   # deploy.sh chowns the tree to the service user
if [ ! -d /opt/psimeter/.git ]; then
  apt-get update -qq && apt-get install -y -qq git
  git clone --branch deploy/hetzner https://github.com/psimeter/psimeter.git /opt/psimeter
fi
cd /opt/psimeter
git fetch origin deploy/hetzner && git reset --hard FETCH_HEAD
bash deploy/hetzner/bootstrap.sh
bash deploy/hetzner/deploy.sh
EOF
```

To redeploy after pushing new commits, just re-run the block (the clone is skipped).

## Runtime
- Service: `systemctl status|restart|stop psimeter`, logs: `journalctl -u psimeter -f`.
- Config lives in the systemd unit (`PSIMETER_ENTROPY`, `PSIMETER_BEACON=drand`,
  `PSIMETER_LEDGER=/opt/psimeter/ledger/prod.jsonl`, port 8787).
- Entropy source is auto-selected: real **RDSEED** when the CPU exposes it
  (verified via `entropy-provider --info`), otherwise the NON-confirmatory OS
  CSPRNG. Both are pilot-grade (non-confirmatory) by spec D1.
- Ledger + blobs persist under `/opt/psimeter/ledger/` on the VM's disk.

## Verify a deploy
```sh
curl -s https://app.psimeter.org/api/experiments | head
journalctl -u psimeter -n 30 --no-pager
# independent re-verification of the ledger (Python, stdlib):
python3 /opt/psimeter/analysis/analyze.py /opt/psimeter/ledger/prod.jsonl
```
