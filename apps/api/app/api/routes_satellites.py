from fastapi import APIRouter, HTTPException
from ..core.schemas import Satellite, TLE
import json
import os
import urllib.request
import urllib.parse
import ssl
import certifi
import time
import http.cookiejar

router = APIRouter()

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
            with urllib.request.urlopen(req, timeout=20, context=ssl_ctx) as resp:
                body = resp.read().decode("utf-8", errors="replace")
            
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
SPACE_TRACK_LIMIT = int(os.getenv("SPACE_TRACK_LIMIT", "400"))

_CACHE_ACTIVE: dict[str, object] = {"expires": 0.0, "data": None}


@router.get("/active")
def list_active(limit: int = 200):
    """Proxy Celestrak active satellites (GP format) to avoid CORS/client JSON issues.

    IMPORTANT: This route must be defined BEFORE the '/{norad_id}' routes so
    FastAPI doesn't try to parse 'active' as an int and return 422.
    """
    # cache for 10 minutes to prevent rate limits
    now = time.time()
    if isinstance(_CACHE_ACTIVE.get("expires"), (float, int)) and now < float(_CACHE_ACTIVE["expires"]):
        data = _CACHE_ACTIVE.get("data")
        if isinstance(data, list):
            return data[:limit] if limit and limit > 0 else data

    data: list[dict] | None = None
    last_err: str | None = None

    # Prefer Space-Track when credentials are available (includes TLE lines).
    if SPACE_TRACK_USERNAME and SPACE_TRACK_PASSWORD:
        try:
            data = _fetch_space_track(min(limit if limit and limit > 0 else SPACE_TRACK_LIMIT, SPACE_TRACK_LIMIT))
        except Exception as e:  # noqa: BLE001
            last_err = f"Space-Track failed: {e}"

    # Fallback to Celestrak if Space-Track unavailable or errored.
    if not data:
        groups_try = ["active", "visual", "stations", "science"]
        for g in groups_try:
            try:
                data = _fetch_celestrak_group(g)
                if data:
                    break
            except Exception as e:  # noqa: BLE001 - surface in 502 below
                last_err = str(e)
                continue

    if not data:
        raise HTTPException(status_code=502, detail=f"Unable to load TLEs: {last_err or 'no sources responding'}")
    _CACHE_ACTIVE["data"] = data
    _CACHE_ACTIVE["expires"] = now + 600  # 10 minutes
    if limit and isinstance(limit, int) and limit > 0:
        data = data[:limit]
    return data


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
    tle_url = (
        "https://www.space-track.org/basicspacedata/query/"
        f"class/tle_latest/ORDINAL/1/EPOCH/>now-30/format/json/metadata/false/limit/{limit}"
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



