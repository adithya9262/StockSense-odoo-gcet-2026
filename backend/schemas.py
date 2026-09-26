from pydantic import BaseModel, ConfigDict, StringConstraints, Field
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

class StockMoveCreate(BaseModel):
    reference: StrTrimmed
    type: Literal["receipt", "delivery", "transfer"]
    product_id: int
    source_location_id: int
    dest_location_id: int
    qty: int = Field(..., gt=0)

class StockMoveResponse(BaseModel):
    id: int
    reference: str
    type: str
    product_id: int
    source_location_id: int
    dest_location_id: int
    qty: int
    status: str

    model_config = ConfigDict(from_attributes=True)

class DashboardResponse(BaseModel):
    total_products: int
    total_stock: int
    low_stock: int
    pending_receipts: int
    pending_deliveries: int
    pending_transfers: int
