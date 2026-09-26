from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List

from database import engine, get_db
import models
from schemas import HealthResponse, ProductCreate, ProductResponse, LocationCreate, LocationResponse

# Create all tables in the database (auto-generates tables if they don't exist)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="StockSense API")

@app.get("/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(status="ok", message="StockSense backend foundation is running")

@app.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    db_product = models.Product(sku=product.sku, name=product.name)
    db.add(db_product)
    try:
        db.commit()
        db.refresh(db_product)
        return db_product
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A product with this SKU already exists."
        )
    except Exception as e:
        db.rollback()
        print(f"Unexpected database error during product creation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected database error occurred."
        )

@app.get("/products", response_model=List[ProductResponse])
def list_products(db: Session = Depends(get_db)):
    return db.query(models.Product).all()

@app.post("/locations", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
def create_location(location: LocationCreate, db: Session = Depends(get_db)):
    db_location = models.Location(name=location.name, type=location.type)
    db.add(db_location)
    try:
        db.commit()
        db.refresh(db_location)
        return db_location
    except Exception as e:
        db.rollback()
        print(f"Unexpected database error during location creation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected database error occurred."
        )

@app.get("/locations", response_model=List[LocationResponse])
def list_locations(db: Session = Depends(get_db)):
    return db.query(models.Location).all()
