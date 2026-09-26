from pydantic import BaseModel, ConfigDict, StringConstraints
from typing import Annotated, Literal

StrTrimmed = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]

class HealthResponse(BaseModel):
    status: str
    message: str

class ProductCreate(BaseModel):
    sku: StrTrimmed
    name: StrTrimmed

class ProductResponse(BaseModel):
    id: int
    sku: str
    name: str

    model_config = ConfigDict(from_attributes=True)

class LocationCreate(BaseModel):
    name: StrTrimmed
    type: Literal["internal", "vendor", "customer"]

class LocationResponse(BaseModel):
    id: int
    name: str
    type: str

    model_config = ConfigDict(from_attributes=True)
