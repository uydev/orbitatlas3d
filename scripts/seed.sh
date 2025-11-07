#!/usr/bin/env bash
set -e
# Countries & cities
docker exec -i $(docker ps --filter "name=db" -q) psql -U postgres -d orbit < data-seed/countries.sql
docker exec -i $(docker ps --filter "name=db" -q) psql -U postgres -d orbit < data-seed/cities.sql
# Satellites CSV -> simple import using COPY (assumes matching columns)
docker exec -i $(docker ps --filter "name=db" -q) psql -U postgres -d orbit -c "\copy satellite(norad_id,name,owner_country,constellation,mission_type,launch_date) FROM STDIN WITH CSV HEADER" < data-seed/sample_satellites.csv
# TLE JSON: quick Python upsert executed in API container
docker exec -i $(docker ps --filter "name=api" -q) python - <<'PY'
import json, os, psycopg2
src_paths = ['/app/seed/sample_tles.json','/seed/sample_tles.json']
path = next((p for p in src_paths if os.path.exists(p)), None)
if not path:
    print('no sample_tles.json found')
    raise SystemExit(0)
j=json.load(open(path,'r'))
conn=psycopg2.connect(os.getenv('DATABASE_URL','postgresql://postgres:postgres@db:5432/orbit'))
cur=conn.cursor()
for t in j:
  cur.execute("insert into tle(norad_id,epoch,line1,line2,source,ingested_at) values(%s,%s,%s,%s,'seed',now()) on conflict do nothing", (t['norad_id'], t['epoch'], t['line1'], t['line2']))
conn.commit(); cur.close(); conn.close()
PY



