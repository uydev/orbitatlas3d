from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .api import routes_satellites, routes_visibility, routes_overflight, routes_meta

app = FastAPI(title="OrbitAtlas API", version="1.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)
app.include_router(routes_satellites.router, prefix="/satellites")
app.include_router(routes_visibility.router, prefix="/visibility")
app.include_router(routes_overflight.router, prefix="/overflight")
app.include_router(routes_meta.router, prefix="")



