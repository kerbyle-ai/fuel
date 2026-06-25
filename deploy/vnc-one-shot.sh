#!/bin/bash
# fuel-map - one-shot bootstrap for Timeweb VNC console (paste entire script).
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
LOG=/var/log/fuel-map-vnc-bootstrap.log
exec > >(tee -a "$LOG") 2>&1
echo "=== fuel-map VNC bootstrap $(date -Is) ==="
echo "=== 1. System health ==="
uptime || true
df -h / /var || true
free -h || true
USEP=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "${USEP:-0}" -ge 90 ]; then
  echo "WARN: disk >= 90%, pruning..."
  docker system prune -af 2>/dev/null || true
  journalctl --vacuum-size=200M 2>/dev/null || true
  apt-get clean 2>/dev/null || true
fi
echo "=== 2. SSH ==="
apt-get update -qq
apt-get install -y -qq openssh-server curl ca-certificates gnupg ufw jq 2>/dev/null || true
systemctl enable ssh 2>/dev/null || systemctl enable sshd 2>/dev/null || true
systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true
systemctl is-active ssh 2>/dev/null || systemctl is-active sshd
if [ -f /etc/ssh/sshd_config ]; then
  grep -q '^UseDNS' /etc/ssh/sshd_config || echo 'UseDNS no' >> /etc/ssh/sshd_config
  grep -q '^GSSAPIAuthentication' /etc/ssh/sshd_config || echo 'GSSAPIAuthentication no' >> /etc/ssh/sshd_config
  systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true
fi
echo "=== 3. Docker ==="
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker
docker --version
docker compose version 2>/dev/null || true
echo "=== 4. Firewall ==="
ufw --force disable 2>/dev/null || true
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment SSH
ufw allow 80/tcp comment HTTP
ufw allow 443/tcp comment HTTPS
ufw allow 8090/tcp comment fuel-map-test
ufw --force enable
ufw status verbose || true
echo "=== 5. App directory ==="
mkdir -p /opt/fuel-map
cd /opt/fuel-map
if [ ! -f docker-compose.yml ]; then
  echo "No docker-compose.yml - upload tarball to /tmp/fuel-map-deploy.tar.gz then:"
  echo "  tar -xzf /tmp/fuel-map-deploy.tar.gz -C /opt/fuel-map"
  echo "  cd /opt/fuel-map && docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build"
else
  echo "=== 6. Docker Compose ==="
  if [ ! -f .env ]; then
    cp deploy/.env.production.example .env
    sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -base64 24)|" .env
    sed -i 's|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=http://147.45.175.194:8090|' .env || true
  fi
  docker compose -f docker-compose.yml -f docker-compose.prod.yml down 2>/dev/null || true
  docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
  for i in $(seq 1 60); do
    if curl -sf --max-time 5 http://127.0.0.1:8090/api/health >/dev/null; then
      curl -sS http://127.0.0.1:8090/api/health
      break
    fi
    sleep 10
  done
fi
echo "=== DONE ==="
ss -tlnp | grep ':22' || true
