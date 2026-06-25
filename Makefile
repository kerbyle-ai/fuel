.PHONY: help config up down build rebuild logs ps \
        dev-db dev-api dev-frontend dev \
        migrate seed import-osm shell-db clean

COMPOSE := docker compose
ENV_FILE := --env-file .env

help: ## Показать справку
	@grep -E '^[a-zA-Z0-9_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

config: ## Проверить docker-compose.yml
	$(COMPOSE) config

up: ## Запустить все сервисы (detached)
	$(COMPOSE) $(ENV_FILE) up -d --build

down: ## Остановить и удалить контейнеры
	$(COMPOSE) down

build: ## Собрать образы
	$(COMPOSE) build

rebuild: ## Пересобрать без кэша
	$(COMPOSE) build --no-cache

logs: ## Логи всех сервисов
	$(COMPOSE) logs -f

logs-api: ## Логи API
	$(COMPOSE) logs -f api

logs-nginx: ## Логи nginx
	$(COMPOSE) logs -f nginx

ps: ## Статус контейнеров
	$(COMPOSE) ps

dev-db: ## Только PostgreSQL + PostGIS
	$(COMPOSE) up -d db

dev-api: dev-db ## Backend локально (tsx watch)
	cd backend && npm install && npm run dev

dev-frontend: ## Frontend локально (Vite dev server)
	cd frontend && npm install && npm run dev

dev: dev-db ## DB в Docker + API и frontend локально
	@echo "Запустите в отдельных терминалах: make dev-api && make dev-frontend"

migrate: ## Миграции БД (локально)
	cd backend && npm run migrate

seed: ## Сид Москвы (локально)
	cd backend && npm run seed

import-osm: dev-db ## Полный импорт АЗС из OSM (~26k, долго)
	cd scripts && npm install && npm run import:osm

shell-db: ## psql в контейнере
	$(COMPOSE) exec db psql -U $${POSTGRES_USER:-fuelmap} -d $${POSTGRES_DB:-fuelmap}

clean: ## Удалить контейнеры и том БД
	$(COMPOSE) down -v

prod-up: ## Production: up без проброса портов БД (используйте .env production)
	$(COMPOSE) $(ENV_FILE) up -d --build
