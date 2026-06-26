#!/usr/bin/env bash
# Install cron: benzin-price import every 2 hours on VPS.
# Run once: cd /opt/fuel-map && bash deploy/install-price-import-cron.sh
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/fuel-map}"
CRON_LINE="0 */2 * * * flock -n /var/lock/fuel-map-import.lock ${PROJECT_DIR}/deploy/run-benzin-import.sh >> /var/log/fuel-map-import.log 2>&1"

chmod +x "${PROJECT_DIR}/deploy/run-benzin-import.sh"

# Merge into root crontab (idempotent)
TMP="$(mktemp)"
crontab -l 2>/dev/null | grep -v 'run-benzin-import.sh' | grep -v 'fuel-map-import' >"$TMP" || true
echo "$CRON_LINE" >>"$TMP"
crontab "$TMP"
rm -f "$TMP"

echo "Installed cron (every 2 hours at :00):"
crontab -l | grep run-benzin-import || true
echo ""
echo "Logs: tail -f /var/log/fuel-map-import.log"
echo "Manual run: ${PROJECT_DIR}/deploy/run-benzin-import.sh"
