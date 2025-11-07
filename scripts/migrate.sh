#!/usr/bin/env bash
set -e
docker exec -i $(docker ps --filter "name=db" -q) psql -U postgres -d orbit < apps/api/migrations/0001_init.sql
docker exec -i $(docker ps --filter "name=db" -q) psql -U postgres -d orbit < apps/api/migrations/0002_views.sql



