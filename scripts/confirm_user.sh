#!/usr/bin/env bash
#
# AutoEcoWeb — подтверждение пользователя (status: pending -> active) по email.
#
# Скрипт НЕ создаёт пользователя: только обновляет статус существующей записи.
# Идемпотентен — повторный запуск безопасен.
#
# Использование:
#   scripts/confirm_user.sh user@example.com
#
# Секреты подключения читаются из корневого .env (POSTGRES_USER,
# POSTGRES_PASSWORD, POSTGRES_DB_NAME). Подключение идёт через контейнер
# postgres (docker compose exec): на сервере не нужны ни sudo, ни psql.
# По умолчанию берётся продовый compose-файл; для dev-стека:
#   COMPOSE_FILE=docker-compose.dev.yml scripts/confirm_user.sh user@example.com

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$REPO_ROOT/.env"

usage() {
  echo "Использование: $(basename "$0") <email>" >&2
  exit 2
}

# --- Аргументы ---------------------------------------------------------------
EMAIL="${1:-}"
[[ -n "$EMAIL" ]] || usage
# Бэкенд хранит email в нижнем регистре (register/login делают .lower()).
EMAIL="$(printf '%s' "$EMAIL" | tr '[:upper:]' '[:lower:]')"
if [[ ! "$EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
  echo "Ошибка: некорректный email: $EMAIL" >&2
  exit 2
fi

# --- Секреты из .env (файл не исполняется целиком — читаются только ключи) ---
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Ошибка: не найден $ENV_FILE (скопируйте .env.example)" >&2
  exit 1
fi

while IFS='=' read -r key value; do
  case "$key" in
    POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_DB_NAME)
      value="${value%\"}"; value="${value#\"}"  # снимаем кавычки, если есть
      value="${value%\'}"; value="${value#\'}"
      export "$key=$value"
      ;;
  esac
done < "$ENV_FILE"

: "${POSTGRES_USER:?POSTGRES_USER не задан в .env}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD не задан в .env}"
: "${POSTGRES_DB_NAME:?POSTGRES_DB_NAME не задан в .env}"

# --- Выполнение запроса -------------------------------------------------------
# Хост/порт из .env не нужны: psql запускается внутри контейнера postgres.
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.deploy.yml}"
cd "$REPO_ROOT"

echo "Подтверждаю пользователя: $EMAIL"
# SQL передаём через stdin: в `-c` psql не интерполирует переменные (:'email'),
# а из stdin — интерполирует. -T: без TTY, stdin идёт в psql как есть.
OUTPUT="$(PGPASSWORD="$POSTGRES_PASSWORD" \
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB_NAME" \
  -v email="$EMAIL" <<'SQL' 2>&1
UPDATE users SET status = 'active' WHERE email = :'email' RETURNING email, role, status;
SQL
)" || {
  echo "Ошибка при выполнении запроса:" >&2
  echo "$OUTPUT" >&2
  exit 1
}

if grep -q "UPDATE 0" <<<"$OUTPUT"; then
  echo "Ошибка: пользователь с email $EMAIL не найден в БД" >&2
  exit 1
fi

echo "$OUTPUT"
echo "Готово: $EMAIL подтверждён (status = active)."
