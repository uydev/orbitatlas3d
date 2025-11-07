#!/usr/bin/env bash
set -euo pipefail
MODE=${1:-"--quick"}

section(){ echo -e "\n\033[1;36m== $1 ==\033[0m"; }
ok(){ echo -e "  ✅ $1"; }
warn(){ echo -e "  ⚠️  $1"; }
err(){ echo -e "  ❌ $1"; }

section "Env Versions"
node -v && ok "Node OK" || warn "Node missing"
python3 --version && ok "Python OK" || warn "Python missing"
docker --version && ok "Docker OK" || err "Docker missing"
terraform -version >/dev/null 2>&1 && ok "Terraform OK" || warn "Terraform missing"
aws --version >/dev/null 2>&1 && ok "AWS CLI OK" || warn "AWS CLI missing"

section "Ports"
for p in 5173 8000 5432 6379; do
  if lsof -i :$p >/dev/null 2>&1; then ok "Port $p available (or in use by expected svc)"; else warn "Port $p may be blocked"; fi
done

section "Docker Compose Up"
pushd infra/docker >/dev/null
docker-compose ps
popd >/dev/null

section "DB Check"
until docker exec -t $(docker ps --filter "name=db" -q) psql -U postgres -d orbit -c "select PostGIS_Full_Version();" >/dev/null 2>&1; do
  warn "Waiting for Postgres/PostGIS..."
  sleep 3
done
ok "PostGIS ready"

section "Migrations"
./scripts/migrate.sh && ok "Migrations applied"

section "API Health"
if curl -sSf http://localhost:8000/docs >/dev/null; then ok "API up"; else warn "API not up yet"; fi

section "Web Health"
if curl -sSf http://localhost:5173 >/dev/null; then ok "Web up"; else warn "Web not up yet"; fi

if [[ "$MODE" == "--full" ]]; then
  section "Redis Ping"
  docker exec -t $(docker ps --filter "name=cache" -q) redis-cli ping || warn "Redis ping failed"
fi

section "Summary"
echo "Dev Doctor completed."



