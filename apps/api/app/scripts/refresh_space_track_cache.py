import os
import json
import http.cookiejar
import urllib.request
import urllib.parse
from datetime import datetime, timedelta

import redis

"""
Space-Track cache refresh script.

This script is **not** called by any API endpoint. You run it manually
or from cron **at most once per hour**, at an off-peak minute (e.g. HH:17),
as required by Space-Track's API policy.

What it does:
 1. Logs in to Space-Track **once** using the configured credentials.
 2. Issues a single query to the recommended /class/gp endpoint to
    retrieve the newest ephemerides for on-orbit objects.
 3. Parses the result (3-line format: name + TLE line1 + TLE line2).
 4. Writes the catalog into Redis under the same key used by the API:
      satellites:catalog:active

The FastAPI routes /satellites/active and /satellites/group/{group}
already read from this Redis key via _get_active_catalog(), so once
this script is scheduled and your Space-Track account is re-enabled,
the web app will automatically start serving Space-Track data from
the cache without making per-request calls to Space-Track.
"""

SPACE_TRACK_USERNAME = os.getenv("SPACE_TRACK_USERNAME", "").strip()
SPACE_TRACK_PASSWORD = os.getenv("SPACE_TRACK_PASSWORD", "").strip()
SPACE_TRACK_TIMEOUT = float(os.getenv("SPACE_TRACK_TIMEOUT", "25"))

REDIS_URL = os.getenv("REDIS_URL", "redis://cache:6379/0")
REDIS_ACTIVE_KEY = "satellites:catalog:active"
REDIS_ACTIVE_TTL = 2 * 60 * 60  # 2 hours


def _fetch_space_track_gp(limit: int) -> list[dict]:
  """
  Fetch latest GP elements from Space-Track using the recommended /class/gp
  endpoint, in 3-line (3le) format. This function logs in once and performs
  a single query.

  NOTE: Only call this from a low-frequency, scheduled context (≤ 1/hour).
  """
  if not SPACE_TRACK_USERNAME or not SPACE_TRACK_PASSWORD:
      raise RuntimeError("SPACE_TRACK_USERNAME / SPACE_TRACK_PASSWORD not set")

  cj = http.cookiejar.CookieJar()
  opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
  headers = {
      "User-Agent": "OrbitAtlas/1.0 (+https://orbitatlas.dev)",
      "Pragma": "no-cache",
      "Cache-Control": "no-cache",
      "Accept": "text/plain",
  }

  # 1) Login once
  login_data = urllib.parse.urlencode(
      {"identity": SPACE_TRACK_USERNAME, "password": SPACE_TRACK_PASSWORD}
  ).encode("utf-8")
  login_req = urllib.request.Request(
      "https://www.space-track.org/ajaxauth/login",
      data=login_data,
      method="POST",
      headers=headers,
  )
  with opener.open(login_req, timeout=SPACE_TRACK_TIMEOUT) as resp:
      if resp.getcode() != 200:
          raise RuntimeError(f"Space-Track login failed with status {resp.getcode()}")

  # 2) Query recommended GP endpoint (newest elset for on-orbit objects, last ~3 days)
  now_minus_3 = (datetime.utcnow() - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S")
  epoch_filter = urllib.parse.quote(f">{now_minus_3}")

  # Use 3-line TLE format (name + line1 + line2) for easy reuse of TLE parsing
  gp_url = (
      "https://www.space-track.org/basicspacedata/query/"
      f"class/gp/DECAY_DATE/null-val/EPOCH/{epoch_filter}/format/3le"
  )
  gp_req = urllib.request.Request(gp_url, headers=headers)
  with opener.open(gp_req, timeout=SPACE_TRACK_TIMEOUT) as resp:
      body = resp.read().decode("utf-8", errors="replace")

  # 3) Parse 3LE format: name, line1, line2 (3 lines per satellite)
  body = body.replace("\r\n", "\n").replace("\r", "\n")
  lines = [line.rstrip() for line in body.split("\n") if line.strip()]
  data: list[dict] = []
  i = 0
  while i < len(lines):
      name = lines[i].strip()
      if i + 2 >= len(lines):
          break
      line1 = lines[i + 1].strip()
      line2 = lines[i + 2].strip()
      # Basic validation
      if not line1.startswith("1 ") or not line2.startswith("2 "):
          i += 1
          continue
      try:
          parts = line1.split()
          norad_str = parts[1].rstrip("U")
          norad_id = int(norad_str)
      except Exception:
          i += 3
          continue
      data.append(
          {
              "OBJECT_NAME": name,
              "NORAD_CAT_ID": norad_id,
              "TLE_LINE1": line1,
              "TLE_LINE2": line2,
          }
      )
      i += 3

  if not data:
      raise RuntimeError("Space-Track GP query returned no data")

  # Apply an upper bound on how many we store, for sanity
  data = data[:limit]
  return data


def main() -> None:
  """Entry point for the refresh script."""
  limit = int(os.getenv("SPACE_TRACK_LIMIT", "10000"))
  print(f"[refresh_space_track_cache] Using Redis: {REDIS_URL}")
  print(f"[refresh_space_track_cache] Fetching up to {limit} satellites from Space-Track /class/gp...")

  catalog = _fetch_space_track_gp(limit)
  print(f"[refresh_space_track_cache] Fetched {len(catalog)} satellites from Space-Track")

  r = redis.Redis.from_url(REDIS_URL, decode_responses=True)
  payload = json.dumps(catalog)
  r.setex(REDIS_ACTIVE_KEY, REDIS_ACTIVE_TTL, payload)
  print(f"[refresh_space_track_cache] Wrote catalog to Redis key '{REDIS_ACTIVE_KEY}' (TTL={REDIS_ACTIVE_TTL}s)")


if __name__ == "__main__":
  main()



