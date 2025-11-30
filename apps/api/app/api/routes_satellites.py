from fastapi import APIRouter, HTTPException
from ..core.schemas import Satellite, TLE
from ..core.config import settings
import json
import os
import socket
import urllib.request
import urllib.parse
import urllib.error
import ssl
import certifi
import time
import http.cookiejar
from datetime import datetime, timedelta
import redis

router = APIRouter()

# Redis client for caching satellite catalogs
redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
REDIS_ACTIVE_KEY = "satellites:catalog:active"  # canonical cache for latest TLE catalog
REDIS_ACTIVE_TTL = 2 * 60 * 60  # 2 hours

SEED_SATS = [
    {"norad_id": 25544, "name": "ISS (ZARYA)", "owner_country": "US/RU", "constellation": None},
]
SEED_TLE = {
    25544: {
        "norad_id": 25544,
        "epoch": "2024-01-01T00:00:00Z",
        "line1": "1 25544U 98067A   24001.00000000  .00016717  00000+0  10270-3 0  9009",
        "line2": "2 25544  51.6424  22.2174 0005660 262.2182  97.7706 15.49717953    08",
    }
}


def _load_active_catalog_via_celestrak() -> list[dict]:
    """Load a combined 'active' catalog from Celestrak groups.

    This is used when Redis has no cached data. It will try a few
    Celestrak groups and merge the results.
    """
    data: list[dict] = []
    last_err: str | None = None
    groups_try = ["active", "visual", "stations", "science"]
    for g in groups_try:
        try:
            chunk = _fetch_celestrak_group(g.upper())
            if chunk:
                data.extend(chunk)
        except Exception as e:  # noqa: BLE001
            last_err = str(e)
            continue
    if not data:
        raise HTTPException(status_code=502, detail=f"Unable to load TLEs from Celestrak: {last_err or 'no groups responding'}")
    return data


def _get_active_catalog() -> list[dict]:
    """Return the latest satellite catalog, preferring Redis cache.

    This is the single canonical source for /satellites/active and
    /satellites/group/{group}. In the future, a Space-Track hourly
    job can simply write into REDIS_ACTIVE_KEY and all endpoints will
    read from that cache without touching Space-Track directly.
    """
    # 1) Try Redis cache first
    try:
        cached = redis_client.get(REDIS_ACTIVE_KEY)
    except Exception:
        cached = None

    if cached:
        try:
            data = json.loads(cached)
            if isinstance(data, list) and data:
                return data
        except Exception:
            # Corrupt cache; fall through to Celestrak
            pass

    # 2) Fallback: fetch fresh data from Celestrak and populate Redis
    data = _load_active_catalog_via_celestrak()
    try:
        redis_client.setex(REDIS_ACTIVE_KEY, REDIS_ACTIVE_TTL, json.dumps(data))
    except Exception:
        # Cache failures should not break the API
        pass
    return data

def _fetch_celestrak_group(group: str) -> list[dict]:
    # Try multiple hostnames to avoid intermittent failures
    hosts = [
        "https://celestrak.org",
        "https://celestrak.com",
    ]
    last_err: Exception | None = None
    for host in hosts:
        # Use TLE format to get TLE lines (not JSON which only has GP elements)
        url = f"{host}/NORAD/elements/gp.php?GROUP={group}&FORMAT=tle"
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": "OrbitAtlas/1.0 (+https://localhost)",
                    "Accept": "text/plain",
                    "Connection": "close",
                    "Pragma": "no-cache",
                    "Cache-Control": "no-cache",
                },
                method="GET",
            )
            verify = os.getenv("CELESTRAK_VERIFY_SSL", "true").lower() not in {"0","false","no"}
            ssl_ctx = ssl.create_default_context(cafile=certifi.where()) if verify else ssl._create_unverified_context()
            # Use shorter timeout (10 seconds) - fail fast if Celestrak is unreachable
            try:
                with urllib.request.urlopen(req, timeout=10, context=ssl_ctx) as resp:
                    body = resp.read().decode("utf-8", errors="replace")
            except (urllib.error.URLError, TimeoutError, socket.timeout) as timeout_err:
                raise TimeoutError(f"Celestrak request timed out after 10 seconds: {timeout_err}") from timeout_err
            
            # Parse TLE format: name, line1, line2 (3 lines per satellite)
            body = body.replace('\r\n', '\n').replace('\r', '\n')
            lines = [line.rstrip() for line in body.split('\n') if line.strip()]
            data = []
            i = 0
            while i < len(lines):
                # Look for TLE line1 (starts with "1 ")
                if i < len(lines) and lines[i].strip().startswith('1 '):
                    line1 = lines[i].strip()
                    # Next line should be line2 (starts with "2 ")
                    if i + 1 < len(lines) and lines[i + 1].strip().startswith('2 '):
                        line2 = lines[i + 1].strip()
                        # Previous line should be the name
                        name = lines[i - 1].strip() if i > 0 else "UNKNOWN"
                        # Extract NORAD ID from line1 (second field)
                        try:
                            parts = line1.split()
                            if len(parts) >= 2:
                                # NORAD ID is in format "00900U" or "900", extract number
                                norad_str = parts[1].rstrip('U')
                                norad_id = int(norad_str)
                            else:
                                i += 2
                                continue
                        except (ValueError, IndexError):
                            i += 2
                            continue
                        data.append({
                            "OBJECT_NAME": name,
                            "NORAD_CAT_ID": norad_id,
                            "TLE_LINE1": line1,
                            "TLE_LINE2": line2,
                        })
                        i += 2  # Skip line1 and line2
                    else:
                        i += 1
                else:
                    i += 1
            if data:
                return data
        except Exception as e:  # noqa: BLE001
            last_err = e
            continue
    raise RuntimeError(f"All hosts failed: {last_err}")


SPACE_TRACK_USERNAME = os.getenv("SPACE_TRACK_USERNAME")
SPACE_TRACK_PASSWORD = os.getenv("SPACE_TRACK_PASSWORD")
SPACE_TRACK_TIMEOUT = float(os.getenv("SPACE_TRACK_TIMEOUT", "25"))
SPACE_TRACK_LIMIT = int(os.getenv("SPACE_TRACK_LIMIT", "10000"))  # SAT LIMIT

_CACHE_ACTIVE: dict[str, object] = {"expires": 0.0, "data": None}


@router.get("/active")
def list_active(limit: int = 1000):  # SAT LIMIT
    """Return latest active satellites from cache (Redis) or Celestrak.

    IMPORTANT: This route must be defined BEFORE the '/{norad_id}' routes so
    FastAPI doesn't try to parse 'active' as an int and return 422.
    """
    # Prefer Redis cache, with Celestrak as a fallback.
    data = _get_active_catalog()
    if limit and isinstance(limit, int) and limit > 0:
        data = data[:limit]
    return data


@router.get("/group/{group}")
def list_group_satellites(group: str, limit: int = 1000):
    """Return satellites for a specific constellation/group."""
    # Load the full catalog from cache (or Celestrak) and filter by name.
    data = _get_active_catalog()
    group_upper = group.upper()

    # Simple name-based matching for groups (similar to frontend CONSTELLATION_FILTERS)
    name_patterns = {
        "STARLINK": ["STARLINK"],
        "LEOKUIPER": ["LEO (KUIPER)", "KUIPER"],
        "ONEWEB": ["ONEWEB"],
        "GPS": ["GPS", "NAVSTAR"],
        "NAVSTAR": ["NAVSTAR"],
        "GALILEO": ["GALILEO"],
        "GLONASS": ["GLONASS"],
        "BEIDOU": ["BEIDOU"],
        "SWARM": ["SWARM"],
        "ORBCOMM": ["ORBCOMM"],
        "SPIRE": ["SPIRE"],
        "PLANET": ["PLANET"],
        "JILIN-1": ["JILIN"],
    }

    patterns = name_patterns.get(group_upper, [group_upper])
    result: list[dict] = []
    for sat in data:
        name = (sat.get("OBJECT_NAME") or "").upper()
        if any(pat in name for pat in patterns):
            result.append(sat)
    
    if limit and isinstance(limit, int) and limit > 0:
        result = result[:limit]
    return result


def _fetch_space_track(limit: int) -> list[dict]:
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    headers = {
        "User-Agent": "OrbitAtlas/1.0 (+https://orbitatlas.dev)",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache",
        "Accept": "application/json",
    }
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
    limit = min(limit or SPACE_TRACK_LIMIT, SPACE_TRACK_LIMIT)
    # Query tle_latest class which includes TLE1 and TLE2 fields
    # Filter for recent TLEs (last 30 days) - URL encode the > symbol
    now_minus_30 = (datetime.utcnow() - timedelta(days=30)).strftime('%Y-%m-%d %H:%M:%S')
    epoch_filter = urllib.parse.quote(f">{now_minus_30}")
    tle_url = (
        "https://www.space-track.org/basicspacedata/query/"
        f"class/tle_latest/ORDINAL/1/EPOCH/{epoch_filter}/format/json/metadata/false/limit/{limit}"
    )
    tle_req = urllib.request.Request(tle_url, headers=headers)
    with opener.open(tle_req, timeout=SPACE_TRACK_TIMEOUT) as resp:
        body = resp.read().decode("utf-8", errors="replace")
    data = json.loads(body)
    if not isinstance(data, list):
        raise RuntimeError("Space-Track returned unexpected payload")
    # Space-Track returns TLE1/TLE2, map to TLE_LINE1/TLE_LINE2
    # Space-Track already includes OBJECT_NAME and NORAD_CAT_ID
    for obj in data:
        if "TLE_LINE1" not in obj and "TLE1" in obj:
            obj["TLE_LINE1"] = obj["TLE1"]
        if "TLE_LINE2" not in obj and "TLE2" in obj:
            obj["TLE_LINE2"] = obj["TLE2"]
    return data


def _fetch_space_track_filtered(name_pattern: str, limit: int) -> list[dict]:
    """Fetch satellites from Space-Track filtered by object name pattern."""
    if not SPACE_TRACK_USERNAME or not SPACE_TRACK_PASSWORD:
        raise RuntimeError("Space-Track credentials not configured")
    
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
    headers = {
        "User-Agent": "OrbitAtlas/1.0 (+https://orbitatlas.dev)",
        "Pragma": "no-cache",
        "Cache-Control": "no-cache",
        "Accept": "application/json",
    }
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
    limit = min(limit or SPACE_TRACK_LIMIT, SPACE_TRACK_LIMIT)
    # Filter for recent TLEs (last 30 days) and object name pattern
    now_minus_30 = (datetime.utcnow() - timedelta(days=30)).strftime('%Y-%m-%d %H:%M:%S')
    epoch_filter = urllib.parse.quote(f">{now_minus_30}")
    # Space-Track uses ~ for "contains" pattern matching (no wildcard needed, ~ does contains)
    # Format: OBJECT_NAME~pattern (the ~ operator does substring matching)
    name_filter = urllib.parse.quote(f"OBJECT_NAME~{name_pattern}")
    tle_url = (
        "https://www.space-track.org/basicspacedata/query/"
        f"class/tle_latest/ORDINAL/1/EPOCH/{epoch_filter}/OBJECT_NAME/{name_filter}/format/json/metadata/false/limit/{limit}"
    )
    tle_req = urllib.request.Request(tle_url, headers=headers)
    with opener.open(tle_req, timeout=SPACE_TRACK_TIMEOUT) as resp:
        body = resp.read().decode("utf-8", errors="replace")
    data = json.loads(body)
    if not isinstance(data, list):
        raise RuntimeError("Space-Track returned unexpected payload")
    # Space-Track returns TLE1/TLE2, map to TLE_LINE1/TLE_LINE2
    for obj in data:
        if "TLE_LINE1" not in obj and "TLE1" in obj:
            obj["TLE_LINE1"] = obj["TLE1"]
        if "TLE_LINE2" not in obj and "TLE2" in obj:
            obj["TLE_LINE2"] = obj["TLE2"]
    return data


@router.get("/", response_model=list[Satellite])
def list_satellites(q: str | None = None):
    if not q:
        return SEED_SATS
    ql = q.lower()
    return [s for s in SEED_SATS if ql in s["name"].lower()]

@router.get("/{norad_id}", response_model=Satellite)
def get_satellite(norad_id: int):
    for s in SEED_SATS:
        if s["norad_id"] == norad_id:
            return s
    raise HTTPException(status_code=404, detail="Not found")

@router.get("/{norad_id}/tle", response_model=TLE)
def get_tle(norad_id: int):
    tle = SEED_TLE.get(norad_id)
    if not tle:
        raise HTTPException(status_code=404, detail="TLE not found")
    return tle



