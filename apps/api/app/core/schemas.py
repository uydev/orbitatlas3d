from pydantic import BaseModel
class Satellite(BaseModel):
    norad_id:int; name:str; owner_country:str|None=None; constellation:str|None=None
class TLE(BaseModel):
    norad_id:int; epoch:str; line1:str; line2:str



