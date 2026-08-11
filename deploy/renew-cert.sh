#!/usr/bin/env bash
# AutoEcoWeb — продление Let's Encrypt сертификата.
# Запускается cron'ом пользователя deploy ежедневно в 03:30 (см. `crontab -l`).
# certbot renew сам решает, пора ли продлевать (< 30 дней до истечения),
# и использует webroot-аутентикатор из сохранённого конфига (renewal/*.conf).
# Лог: deploy/certbot-renew.log
set -uo pipefail

cd /home/deploy/AutoEcoWeb || exit 1
LOG=/home/deploy/AutoEcoWeb/deploy/certbot-renew.log

if docker compose -f docker-compose.deploy.yml run --rm certbot renew --quiet >>"$LOG" 2>&1; then
  # Сертификат мог обновиться (live/fullchain.pem — symlink на новый архив):
  # перезагружаем nginx, чтобы он отдавал свежий сертификат.
  if docker exec autoecoweb-nginx-1 nginx -s reload >>"$LOG" 2>&1; then
    echo "$(date -Is) renew ok, nginx reloaded" >>"$LOG"
  else
    echo "$(date -Is) renew ok, но nginx reload упал!" >>"$LOG"
  fi
else
  echo "$(date -Is) renew FAILED — смотри лог выше" >>"$LOG"
fi
