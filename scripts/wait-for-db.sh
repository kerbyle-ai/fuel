#!/bin/sh
# Ожидание готовности PostgreSQL перед запуском API
set -e

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
MAX_RETRIES="${DB_WAIT_RETRIES:-30}"
SLEEP_SEC="${DB_WAIT_INTERVAL:-2}"

echo "Ожидание PostgreSQL на ${DB_HOST}:${DB_PORT}..."

i=0
while [ "$i" -lt "$MAX_RETRIES" ]; do
  if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    echo "PostgreSQL доступен."
    exec "$@"
  fi
  i=$((i + 1))
  echo "  попытка ${i}/${MAX_RETRIES}..."
  sleep "$SLEEP_SEC"
done

echo "Ошибка: PostgreSQL не ответил за отведённое время." >&2
exit 1
