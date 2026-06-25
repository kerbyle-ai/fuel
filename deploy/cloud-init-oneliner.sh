#!/bin/sh
# Timeweb Cloud-init user-data (shell script format).
# Panel: Configuration -> Cloud-init -> Edit. Works on first install / OS reinstall.
# First line MUST be #!/bin/sh (Timeweb requirement).
# After bootstrap: upload full fuel-map code via SSH or manual step.
set -e
LOG=/var/log/fuel-map-bootstrap.log
exec >>"$LOG" 2>&1
echo "=== fuel-map bootstrap $(date -Is) ==="
wget -qO- https://st.timeweb.com/cloud-static/scripts/serial_enable.sh | bash || true
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
mkdir -p /opt/fuel-map
mkdir -p /root/.ssh
chmod 700 /root/.ssh
grep -q 'user@SAP-WS01' /root/.ssh/authorized_keys 2>/dev/null || \
  echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILBnXTv4AMiU5tLXKs8uyOKRRL4uznu5miO+AkePppsr user@SAP-WS01' >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
ufw --force disable || true
ufw default deny incoming || true
ufw default allow outgoing || true
ufw allow 22/tcp || true
ufw allow 8090/tcp || true
ufw --force enable || true
systemctl enable ssh
systemctl restart ssh
touch /opt/fuel-map/.cloud-init-placeholder
echo "NOTE full fuel-map code upload still needs SSH or manual step"
echo "DONE $(date -Is)"
