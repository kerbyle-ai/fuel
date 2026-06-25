#!/bin/bash
# Paste this entire script into Timeweb VNC console (as root), then press Enter.
# Installs SAP-WS01 public key for passwordless SSH from Windows workstation.
set -euo pipefail

KEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAILBnXTv4AMiU5tLXKs8uyOKRRL4uznu5miO+AkePppsr user@SAP-WS01'

mkdir -p /root/.ssh
chmod 700 /root/.ssh

touch /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

if ! grep -qF "$KEY" /root/.ssh/authorized_keys; then
  echo "$KEY" >> /root/.ssh/authorized_keys
  echo "Added SAP-WS01 key to authorized_keys"
else
  echo "SAP-WS01 key already present"
fi

SSHD_CFG="/etc/ssh/sshd_config"
DROPIN="/etc/ssh/sshd_config.d/99-pubkey.conf"

if grep -qE '^\s*PubkeyAuthentication\s+no' "$SSHD_CFG" 2>/dev/null; then
  sed -i 's/^\s*PubkeyAuthentication\s\+no/PubkeyAuthentication yes/' "$SSHD_CFG"
  echo "Enabled PubkeyAuthentication in $SSHD_CFG"
elif ! grep -qE '^\s*PubkeyAuthentication\s+yes' "$SSHD_CFG" 2>/dev/null; then
  mkdir -p /etc/ssh/sshd_config.d
  echo 'PubkeyAuthentication yes' > "$DROPIN"
  echo "Created $DROPIN"
fi

if systemctl is-active --quiet ssh 2>/dev/null; then
  systemctl restart ssh
elif systemctl is-active --quiet sshd 2>/dev/null; then
  systemctl restart sshd
else
  service ssh restart 2>/dev/null || service sshd restart
fi

echo "Done. Test from SAP-WS01: ssh -i ~/.ssh/id_ed25519 root@147.45.175.194"
