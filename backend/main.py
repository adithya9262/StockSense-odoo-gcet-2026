import os
import jwt
import bcrypt
import secrets
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy import func
from typing import List

from database import engine, get_db
import models
from schemas import (
    HealthResponse, ProductCreate, ProductResponse,
    LocationCreate, LocationResponse, StockMoveCreate, StockMoveResponse, DashboardResponse,
    UserCreate, UserLogin, UserResponse, TokenResponse,
    ForgotPasswordRequest, ResetPasswordRequest, AdjustmentCreate
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

JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is not set.")
ALGORITHM = "HS256"

def verify_password(plain_password, hashed_password):
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=1440)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user

@app.post("/auth/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(user: UserCreate, db: Session = Depends(get_db)):
    email = user.email.lower()
    existing_user = db.query(models.User).filter(models.User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    hashed_pwd = get_password_hash(user.password)
    db_user = models.User(email=email, password_hash=hashed_pwd)
    db.add(db_user)
    try:
        db.commit()
        db.refresh(db_user)
        return db_user
    except Exception as e:
        db.rollback()
        print(f"Signup error: {e}")
        raise HTTPException(status_code=500, detail="Unable to create account. Please try again.")

@app.post("/auth/login", response_model=TokenResponse)
def login(user: UserLogin, db: Session = Depends(get_db)):
    email = user.email.lower().strip()
    db_user = db.query(models.User).filter(models.User.email == email).first()
    if not db_user or not verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    access_token = create_access_token(data={"sub": str(db_user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    db_user = db.query(models.User).filter(models.User.email == email).first()
    if db_user:
        otp_plaintext = "".join(secrets.choice("0123456789") for _ in range(6))
        otp_hash = get_password_hash(otp_plaintext)

        # Invalidate any existing unused OTPs
        db.query(models.PasswordResetOTP).filter(
            models.PasswordResetOTP.user_id == db_user.id,
            models.PasswordResetOTP.used == False
        ).update({"used": True})

        expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
        db_otp = models.PasswordResetOTP(
            user_id=db_user.id,
            otp_hash=otp_hash,
            expires_at=expires_at
        )
        db.add(db_otp)
        try:
            db.commit()
            print(f"\nDEVELOPMENT OTP: {otp_plaintext}\n")
        except Exception as e:
            db.rollback()
            print(f"Failed to create OTP: {e}")
            raise HTTPException(status_code=500, detail="Internal server error.")

    return {"message": "If the account exists, an OTP has been generated."}

@app.post("/auth/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    db_user = db.query(models.User).filter(models.User.email == email).first()

    if not db_user:
        raise HTTPException(status_code=400, detail="Invalid request. Please try again.")

    db_otp = db.query(models.PasswordResetOTP).filter(
        models.PasswordResetOTP.user_id == db_user.id,
        models.PasswordResetOTP.used == False
    ).order_by(models.PasswordResetOTP.created_at.desc()).first()

    if not db_otp:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP.")

    # Python datetimes are naive if timezone isn't set, but we set it with timezone.utc.
    # Just to be safe we compare with datetime.now(timezone.utc)
    if datetime.now(timezone.utc) > db_otp.expires_at:
        db_otp.used = True
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid or expired OTP.")

    if not verify_password(req.otp, db_otp.otp_hash):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP.")

    db_user.password_hash = get_password_hash(req.new_password)
    db_otp.used = True

    # Invalidate all other unused OTPs just in case
    db.query(models.PasswordResetOTP).filter(
        models.PasswordResetOTP.user_id == db_user.id,
        models.PasswordResetOTP.used == False
    ).update({"used": True})

    try:
        db.commit()
        return {"message": "Password reset successful."}
    except Exception as e:
        db.rollback()
        print(f"Failed to reset password: {e}")
        raise HTTPException(status_code=500, detail="Internal server error.")

@app.get("/auth/me", response_model=UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.get("/health", response_model=HealthResponse)
def health_check():
    return HealthResponse(status="ok", message="StockSense backend foundation is running")

@app.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
def create_product(product: ProductCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
def list_products(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Product).all()

@app.post("/locations", response_model=LocationResponse, status_code=status.HTTP_201_CREATED)
def create_location(location: LocationCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
def list_locations(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Location).all()

@app.post("/moves", response_model=List[StockMoveResponse], status_code=status.HTTP_201_CREATED)
def create_moves(moves: List[StockMoveCreate], db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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
def validate_operation(reference: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
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

@app.post("/adjustments", status_code=status.HTTP_201_CREATED)
def create_adjustment(adj: AdjustmentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    product = db.query(models.Product).filter_by(id=adj.product_id).first()
    if not product:
        raise HTTPException(status_code=400, detail="Invalid product ID.")

    location = db.query(models.Location).filter_by(id=adj.location_id, type="internal").first()
    if not location:
        raise HTTPException(status_code=400, detail="Invalid location. Must be an internal location.")

    try:
        # Lock the quant for this product/location
        quant = db.query(models.StockQuant).filter_by(
            product_id=adj.product_id, location_id=adj.location_id
        ).with_for_update().first()

        if not quant:
            quant = models.StockQuant(product_id=adj.product_id, location_id=adj.location_id, qty=0)
            db.add(quant)
            db.flush()

        difference = adj.counted_qty - quant.qty

        if difference == 0:
            db.rollback()
            return {"message": "No adjustment needed. Physical count matches recorded stock."}

        # Get or create inventory loss location
        loss_loc = db.query(models.Location).filter_by(type="inventory_loss").first()
        if not loss_loc:
            loss_loc = models.Location(name="Inventory Adjustment", type="inventory_loss")
            db.add(loss_loc)
            db.flush()

        if difference > 0:
            source_id = loss_loc.id
            dest_id = location.id
            move_qty = difference
        else:
            source_id = location.id
            dest_id = loss_loc.id
            move_qty = abs(difference)

        # Update physical stock
        quant.qty = adj.counted_qty

        # Create ledger entry
        reference = f"WH/ADJ/{secrets.token_hex(4).upper()}"
        move = models.StockMove(
            reference=reference,
            type="adjustment",
            product_id=adj.product_id,
            source_location_id=source_id,
            dest_location_id=dest_id,
            qty=move_qty,
            status="done"
        )
        db.add(move)

        db.commit()
        return {"message": "Adjustment successful.", "reference": reference}
    except Exception as e:
        db.rollback()
        print(f"Adjustment error: {e}")
        raise HTTPException(status_code=500, detail="An error occurred during adjustment.")

@app.get("/stock/{product_id}/{location_id}")
def get_stock(product_id: int, location_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    quant = db.query(models.StockQuant).filter_by(
        product_id=product_id, location_id=location_id
    ).first()
    return {"qty": quant.qty if quant else 0}

@app.get("/ledger", response_model=List[StockMoveResponse])
def get_ledger(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.StockMove).filter(models.StockMove.status == "done").order_by(models.StockMove.created_at.desc()).all()
