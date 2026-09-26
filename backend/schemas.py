from pydantic import BaseModel, ConfigDict, StringConstraints, Field
from typing import Annotated, Literal

StrTrimmed = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]

class UserCreate(BaseModel):
    email: StrTrimmed
    password: str = Field(..., min_length=8)

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    email: str
    model_config = ConfigDict(from_attributes=True)

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

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
    type: Literal["internal", "vendor", "customer", "inventory_loss"]

class LocationResponse(BaseModel):
    id: int
    name: str
    type: str

    model_config = ConfigDict(from_attributes=True)

class StockMoveCreate(BaseModel):
    reference: StrTrimmed
    type: Literal["receipt", "delivery", "transfer", "adjustment"]
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

class ForgotPasswordRequest(BaseModel):
    email: StrTrimmed

class ResetPasswordRequest(BaseModel):
    email: StrTrimmed
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8)

class AdjustmentCreate(BaseModel):
    product_id: int
    location_id: int
    counted_qty: int = Field(..., ge=0)
