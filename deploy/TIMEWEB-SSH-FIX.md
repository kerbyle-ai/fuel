# Timeweb VPS: SSH «banner exchange timeout»

## Важно: ufw ≠ облачный firewall Timeweb

**Отключённый `ufw` на сервере не означает, что порт 22 открыт снаружи.**

У Timeweb Cloud есть **отдельный firewall / группы безопасности** в панели (Сеть → Firewall / Security groups). Он фильтрует трафик **до** VM и не виден в `ufw status`.

Проверьте в панели Timeweb:

- правило **Inbound TCP 22** (и при необходимости **8090**) для вашего IP или `0.0.0.0/0`;
- что firewall **привязан к этой VPS** (147.45.175.194);
- нет ли DDoS-прокси / «защиты», которая режет длинные SSH-сессии.

На самой VM дополнительно смотрите `iptables` / `nftables` (не только ufw).

## Симптомы снаружи

| Проверка | Что значит |
|----------|------------|
| TCP на :22 успешен, **баннер SSH приходит** (`SSH-2.0-OpenSSH_...`) | До `sshd` доходим; проблема не в «закрытом порте» на уровне SYN |
| OpenSSH: `Connection timed out during banner exchange` или `Connection closed` | Полный handshake не завершается: `sshd`, лимиты, fail2ban, облачный FW, перегруз |
| :8090 TCP OK, HTTP **0 байт** | Сервис на 8090 не отвечает или слушает только localhost |
| :2222 TCP open, **нет SSH-баннера** | Не sshd (или другой сервис / полуоткрытый порт) |

## Диагностика через VNC (без SSH)

Скопируйте и выполните на сервере содержимое [`VNC-DIAGNOSE.sh`](./VNC-DIAGNOSE.sh) или:

```bash
bash deploy/VNC-DIAGNOSE.sh
```

Обратите внимание на:

- `systemctl status ssh` — active/running?
- `ss -tlnp` — кто слушает `:22` и `:8090`?
- `journalctl -u ssh` — ошибки, `MaxStartups`, `Connection closed`, OOM
- `curl http://127.0.0.1:8090/api/config` — сайт жив локально?

## Быстрые действия на сервере (VNC)

```bash
systemctl restart ssh
fail2ban-client status sshd 2>/dev/null || true
grep -E '^(MaxStartups|AllowUsers|PasswordAuthentication|PermitRootLogin)' /etc/ssh/sshd_config
```

## Подключение с клиента

```bash
ssh -vvv -o ConnectTimeout=60 root@147.45.175.194
```

IPv6: `2a03:6f00:a::2:b276` — проверьте, что у клиента и в панели Timeweb открыт **TCP 22 для IPv6**.

## Deploy fuel-map

После восстановления SSH:

```bash
cd fuel-map
SSHPASS='...' ./deploy/deploy-vps.sh
```