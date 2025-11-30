#!/usr/bin/env bash
set -euo pipefail

# Refresh Space-Track TLE cache in Redis.
#
# This script is intended to be run manually or from cron on the HOST,
# not inside the container. It will:
#   - exec into the running "api" service container
#   - run the refresh_space_track_cache.py script once
#
# IMPORTANT:
#   - Only schedule this at most ONCE PER HOUR (per Space-Track policy)
#   - Use an off-peak minute, e.g. 17 minutes past the hour (HH:17)
#
# Example crontab entry (run once per hour at 17 minutes past):
#   17 * * * * /bin/bash -lc 'cd /Users/yilmazu/Projects/hephaestus-sytems/OrbitAtlas3D/orbitatlas-3d/infra/docker && ./refresh_space_track_cache.sh >> /tmp/space_track_refresh.log 2>&1'

THIS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$THIS_DIR"

echo "[refresh_space_track_cache.sh] Running refresh script inside api container..."
docker compose exec api python app/scripts/refresh_space_track_cache.py
echo "[refresh_space_track_cache.sh] Done."



