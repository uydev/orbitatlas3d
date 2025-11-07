from fastapi import APIRouter

router = APIRouter()

@router.get("/countries")
def countries():
    return ["US","RU","CN","EU"]

@router.get("/constellations")
def constellations():
    return ["Starlink","OneWeb","GPS","Galileo"]



