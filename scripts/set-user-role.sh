#!/usr/bin/env bash
set -euo pipefail

EMAIL=${1:-}
ROLE=${2:-}

if [[ -z "$EMAIL" || -z "$ROLE" ]]; then
    printf 'Использование: %s <email> <user|admin>\n' "$0" >&2
    exit 1
fi

case "$ROLE" in
    user|admin) ;;
    *)
        printf 'Ошибка: недопустимая роль: %s\n' "$ROLE" >&2
        exit 1
        ;;
esac

docker compose -f docker-compose.dev.yml exec -T postgres \
    sh -c 'psql -v ON_ERROR_STOP=1 -v email="$1" -v role="$2" -U "$POSTGRES_USER" -d "$POSTGRES_DB_NAME" -c "UPDATE users SET role = :\x27role\x27 WHERE email = :\x27email\x27;"' \
    sh "$EMAIL" "$ROLE"

printf 'Роль пользователя %s обновлена: %s\n' "$EMAIL" "$ROLE"
