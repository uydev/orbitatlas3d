from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def overflight(noradId: int, time: str):
    # Stubbed response
    return {"noradId": noradId, "time": time, "over": {"country": "US", "city": "New York"}}



