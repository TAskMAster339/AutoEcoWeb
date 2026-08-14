#!/usr/bin/env bash
set -euo pipefail

EMAIL=${1:-}
STATUS=${2:-}

if [[ -z "$EMAIL" || -z "$STATUS" ]]; then
    printf 'Использование: %s <email> <pending|verified|active|blocked>\n' "$0" >&2
    exit 1
fi

case "$STATUS" in
    pending|verified|active|blocked) ;;
    *)
        printf 'Ошибка: недопустимый статус: %s\n' "$STATUS" >&2
        exit 1
        ;;
esac

docker compose -f docker-compose.dev.yml exec -T postgres \
    sh -c 'psql -v ON_ERROR_STOP=1 -v email="$1" -v status="$2" -U "$POSTGRES_USER" -d "$POSTGRES_DB_NAME" -c "UPDATE users SET status = :\x27status\x27 WHERE email = :\x27email\x27;"' \
    sh "$EMAIL" "$STATUS"

printf 'Статус пользователя %s обновлён: %s\n' "$EMAIL" "$STATUS"
