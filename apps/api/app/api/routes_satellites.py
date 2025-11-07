from fastapi import APIRouter, HTTPException
from ..core.schemas import Satellite, TLE

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



