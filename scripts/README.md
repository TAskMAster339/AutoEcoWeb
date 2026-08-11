# Скрипты обслуживания БД

Операционные скрипты для управления пользователями напрямую в БД.
Ни один скрипт **не создаёт** пользователей — только обновляет статус/роль
существующей записи по email.

## Зачем

Регистрация создаёт пользователя с `status = pending`, и логин такого
аккаунта отклоняется («Аккаунт не подтверждён»). Подтверждение и назначение
админа выполняются оператором вручную этими скриптами (почтовой верификации
в архитектуре нет).

## Скрипты

| Скрипт | Действие | SQL |
|---|---|---|
| `confirm_user.sh <email>` | Подтвердить пользователя | `UPDATE users SET status='active'` |
| `make_admin.sh <email>` | Назначить администратора | `UPDATE users SET role='admin'` |

Оба скрипта идемпотентны: повторный запуск безопасен.

## Как работают

1. Читают секреты подключения из корневого `.env` (только `POSTGRES_USER`,
   `POSTGRES_PASSWORD`, `POSTGRES_DB_NAME`; файл не исполняется целиком).
2. Подключаются к БД через контейнер `postgres`:
   `docker compose exec -T postgres psql ...` — на сервере не нужны
   ни sudo, ни установленный psql.
3. Email приводится к нижнему регистру (так его хранит бэкенд) и передаётся
   в SQL через psql-переменную `:'email'` (безопасное экранирование).
4. `RETURNING email, role, status` показывает результат; если строка не
   найдена — скрипт завершается с ошибкой (exit 1).

## Использование

```bash
# Прод (сервер, из каталога репозитория)
scripts/confirm_user.sh user@example.com
scripts/make_admin.sh user@example.com

# Dev-стек
COMPOSE_FILE=docker-compose.dev.yml scripts/confirm_user.sh user@example.com
```

Первый пользователь: зарегистрироваться → подтвердить → назначить админом:

```bash
scripts/confirm_user.sh user@example.com
scripts/make_admin.sh user@example.com
```

## Требования

- Docker с запущенным стеком (контейнер `postgres` поднят).
- Корневой `.env` с валидными `POSTGRES_USER` / `POSTGRES_PASSWORD` /
  `POSTGRES_DB_NAME` (совпадают с теми, что у контейнера).
- Переменная `COMPOSE_FILE` — опционально; по умолчанию
  `docker-compose.deploy.yml`.
