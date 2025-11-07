SHELL := /bin/bash

setup:
	cd apps/web && npm install || yarn
	cd apps/api && poetry install

dev:
	cd infra/docker && docker-compose up --build -d
	@echo "Waiting 10s for DB..." && sleep 10
	./scripts/migrate.sh
	./scripts/seed.sh
	bash scripts/devdoctor.sh --quick

logs:
	cd infra/docker && docker-compose logs -f

down:
	cd infra/docker && docker-compose down -v

test:
	cd apps/api && pytest -q
	cd apps/web && npm run test

e2e:
	cd apps/web && npm run test:ui

doctor:
	bash scripts/devdoctor.sh --full

watchdog:
	python3 scripts/watchdog.py

build:
	cd apps/web && npm run build
	cd infra/docker && docker-compose build

deploy-dev:
	cd infra/terraform/envs/dev && terraform init && terraform apply -auto-approve



