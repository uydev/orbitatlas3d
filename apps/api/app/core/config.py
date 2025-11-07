import os
from pydantic import BaseModel
class Settings(BaseModel):
    DATABASE_URL: str = os.getenv("DATABASE_URL","postgresql://postgres:postgres@db:5432/orbit")
    REDIS_URL: str = os.getenv("REDIS_URL","redis://cache:6379/0")
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS","*")
settings = Settings()



