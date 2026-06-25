#!/bin/bash
# Paste in Timeweb VNC console as root
set -x
echo "=== $(date -Is) VNC diagnose ==="
systemctl status ssh --no-pager
ss -tlnp | grep -E ':22|:8090'
iptables -L -n 2>/dev/null | head -20
nft list ruleset 2>/dev/null | head -30
df -h /
free -m
journalctl -u ssh -n 30 --no-pager
curl -s -m 3 http://127.0.0.1:8090/api/config || echo no-local-site