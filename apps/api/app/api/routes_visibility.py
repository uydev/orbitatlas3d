from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def visibility(lat: float, lon: float, from_: str | None = None, to: str | None = None, minElev: float = 10.0, ids: list[int] | None = None):
    # Stubbed: always true for ISS for now
    return {"visible": True, "ids": ids or []}



