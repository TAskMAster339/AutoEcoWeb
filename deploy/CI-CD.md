# CI/CD и автопродление сертификата

## GitHub Actions: push в main → деплой

Файл: `.github/workflows/deploy.yml`

- **job `test`** — проверки на ubuntu-latest:
  - frontend: `npm ci` + `npm run build` (внутри `tsc -b` + `vite build`)
  - backend: `pip install -r requirements.txt pytest` + `pytest` (БД не нужна — тесты на sqlite in-memory)
- **job `deploy`** (только после зелёного `test`) — по SSH на `deploy@autoeco.mooo.com`:
  1. `git checkout -- .` — сброс случайных правок на сервере (сервер — деплой-таргет)
  2. `git pull --ff-only origin main` — сервер пулит из GitHub (ключ на сервере уже есть)
  3. `docker compose -f docker-compose.deploy.yml up -d --build` — пересборка backend/frontend
  4. если в пуше менялся `deploy/nginx.conf` — `up -d --force-recreate nginx`
     (git заменяет inode файла, а контейнер держит старый bind-mount — без пересоздания nginx работал бы на устаревшем конфиге)
  5. проверка: `curl -sf https://autoeco.mooo.com/health` и корня сайта

### Разовая настройка

1. Приватный ключ для SSH раннера → сервер уже сгенерирован и лежит в
   `~/.ssh/autoecoweb_ci` (публичная часть добавлена в `~/.ssh/authorized_keys` на сервере).
2. Добавьте его содержимое в GitHub-секрет:
   **Repo → Settings → Secrets and variables → Actions → New repository secret**
   - Name: `SSH_DEPLOY_KEY`
   - Value: содержимое файла `~/.ssh/autoecoweb_ci` (целиком, включая `-----BEGIN/END OPENSSH PRIVATE KEY-----`)
3. Всё. Пуш в `main` запускает пайплайн автоматически.

### Полезное

- Ручной запуск: **Actions → Deploy → Run workflow** (кнопка, `workflow_dispatch`)
- Логи деплоя: Actions → Deploy → последний run → job `deploy`
- Отменить параллельные деплои нельзя (concurrency group `deploy`) — новый ждёт завершения старого

## Автопродление сертификата (cron на сервере)

- Скрипт: `deploy/renew-cert.sh` (лежит в репозитории, git pull обновляет его на сервере)
- Крон пользователя deploy: `30 3 * * *` — ежедневно в 03:30
- Логика: `certbot renew --quiet` (сам пропускает, если до истечения > 30 дней;
  webroot-аутентикатор берётся из сохранённого конфига) → при успехе `nginx -s reload`
- Лог: `deploy/certbot-renew.log` (одна строка в день, если всё ок)

### Проверка вручную

```bash
# на сервере (dry-run — ничего не меняет, только проверяет путь продления)
cd /home/deploy/AutoEcoWeb && docker compose -f docker-compose.deploy.yml run --rm certbot renew --dry-run

# крон
crontab -l
```
