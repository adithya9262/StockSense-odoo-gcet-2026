from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from typing import List

from database import engine, get_db
import models
from schemas import (
    HealthResponse, ProductCreate, ProductResponse, 
    LocationCreate, LocationResponse, StockMoveCreate, StockMoveResponse, DashboardResponse
)

# Create all tables in the database (auto-generates tables if they don't exist)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="StockSense API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(status="ok", message="StockSense backend foundation is running")

@app.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(db: Session = Depends(get_db)):
    try:
        total_products = db.query(models.Product).count()
        
        internal_locs = db.query(models.Location.id).filter(models.Location.type == "internal")
        
        total_stock_val = db.query(func.sum(models.StockQuant.qty)).filter(
            models.StockQuant.location_id.in_(internal_locs)
        ).scalar()
        total_stock = int(total_stock_val) if total_stock_val else 0
        
        low_stock = db.query(models.StockQuant).filter(
            models.StockQuant.location_id.in_(internal_locs),
            models.StockQuant.qty <= 10
        ).count()
        
        pending_receipts = db.query(models.StockMove).filter(models.StockMove.type == "receipt", models.StockMove.status == "draft").count()
        pending_deliveries = db.query(models.StockMove).filter(models.StockMove.type == "delivery", models.StockMove.status == "draft").count()
        pending_transfers = db.query(models.StockMove).filter(models.StockMove.type == "transfer", models.StockMove.status == "draft").count()
        
        return {
            "total_products": total_products,
            "total_stock": total_stock,
            "low_stock": low_stock,
            "pending_receipts": pending_receipts,
            "pending_deliveries": pending_deliveries,
            "pending_transfers": pending_transfers,
        }
    except Exception as e:
        db.rollback()
        print(f"Unexpected database error loading dashboard: {e}")
        raise HTTPException(status_code=500, detail="Unable to load dashboard. Please try again.")

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

@app.post("/moves", response_model=List[StockMoveResponse], status_code=status.HTTP_201_CREATED)
def create_moves(moves: List[StockMoveCreate], db: Session = Depends(get_db)):
    db_moves = []
    for move in moves:
        if move.source_location_id == move.dest_location_id:
            raise HTTPException(status_code=400, detail="Source and destination locations cannot be the same.")
        
        product = db.query(models.Product).filter_by(id=move.product_id).first()
        if not product:
            raise HTTPException(status_code=400, detail="Invalid product ID.")
            
        source_loc = db.query(models.Location).filter_by(id=move.source_location_id).first()
        dest_loc = db.query(models.Location).filter_by(id=move.dest_location_id).first()
        
        if not source_loc or not dest_loc:
            raise HTTPException(status_code=400, detail="Invalid location ID.")
            
        if move.type == "receipt" and (source_loc.type != "vendor" or dest_loc.type != "internal"):
            raise HTTPException(status_code=400, detail="Receipts must move from vendor to internal.")
        elif move.type == "delivery" and (source_loc.type != "internal" or dest_loc.type != "customer"):
            raise HTTPException(status_code=400, detail="Deliveries must move from internal to customer.")
        elif move.type == "transfer" and (source_loc.type != "internal" or dest_loc.type != "internal"):
            raise HTTPException(status_code=400, detail="Transfers must move from internal to internal.")

        db_move = models.StockMove(
            reference=move.reference,
            type=move.type,
            product_id=move.product_id,
            source_location_id=move.source_location_id,
            dest_location_id=move.dest_location_id,
            qty=move.qty,
            status="draft"
        )
        db.add(db_move)
        db_moves.append(db_move)
    try:
        db.commit()
        for m in db_moves:
            db.refresh(m)
        return db_moves
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error.")
    except Exception as e:
        db.rollback()
        print(f"Unexpected database error during move creation: {e}")
        raise HTTPException(status_code=500, detail="An unexpected database error occurred.")

@app.post("/moves/{reference:path}/validate")
def validate_operation(reference: str, db: Session = Depends(get_db)):
    moves = db.query(models.StockMove).filter(
        models.StockMove.reference == reference,
        models.StockMove.status == "draft"
    ).all()
    
    if not moves:
        raise HTTPException(status_code=404, detail="No draft moves found for this reference.")
        
    try:
        for move in moves:
            source_loc = db.query(models.Location).filter_by(id=move.source_location_id).first()
            dest_loc = db.query(models.Location).filter_by(id=move.dest_location_id).first()

            # 1. Row Locking to prevent race conditions (only track internal locations)
            source_quant = None
            if source_loc.type == "internal":
                source_quant = db.query(models.StockQuant).filter_by(
                    product_id=move.product_id, location_id=move.source_location_id
                ).with_for_update().first()
                if not source_quant:
                    source_quant = models.StockQuant(product_id=move.product_id, location_id=move.source_location_id, qty=0)
                    db.add(source_quant)
                    db.flush()

            dest_quant = None
            if dest_loc.type == "internal":
                dest_quant = db.query(models.StockQuant).filter_by(
                    product_id=move.product_id, location_id=move.dest_location_id
                ).with_for_update().first()
                if not dest_quant:
                    dest_quant = models.StockQuant(product_id=move.product_id, location_id=move.dest_location_id, qty=0)
                    db.add(dest_quant)
                    db.flush()

            # 3. Validation: Internal locations cannot go negative
            if source_loc.type == "internal" and source_quant.qty < move.qty:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Insufficient stock for product ID {move.product_id} at location ID {move.source_location_id}."
                )

            # 4. Execute the move (Double Entry for internal locations only)
            if source_quant:
                source_quant.qty -= move.qty
            if dest_quant:
                dest_quant.qty += move.qty
            
            move.status = "done"

        # 5. Commit everything as a single atomic transaction
        db.commit()
        return {"message": f"Successfully validated {len(moves)} moves for reference {reference}."}

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        print(f"Validation error: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during validation.")

@app.get("/ledger", response_model=List[StockMoveResponse])
def get_ledger(db: Session = Depends(get_db)):
    return db.query(models.StockMove).filter(models.StockMove.status == "done").order_by(models.StockMove.created_at.desc()).all()
