# StockSense

Inventory Management System for tracking stock movements, locations, adjustments, and ledger history.

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** FastAPI, SQLAlchemy, PostgreSQL, Uvicorn
- **Authentication & Security:** JWT (PyJWT), bcrypt

## Core Features

- **Signup & Login:** Secure user authentication with JWT access tokens.
- **OTP Password Reset:** Time-limited, hashed OTP verification flow.
- **Dashboard:** Real-time KPIs for total products, total stock, low stock warnings, and pending operations.
- **Product Management:** Create and catalog products with unique SKU tracking.
- **Receipts:** Manage inbound stock movements from vendors to internal warehouse locations.
- **Deliveries:** Process outbound customer orders with stock availability checks.
- **Internal Transfers:** Relocate inventory between internal storage locations without altering total stock balance.
- **Inventory Adjustments:** Reconcile physical inventory counts against system-recorded stock.
- **Stock Ledger:** Searchable and filterable double-entry audit trail of all historical inventory movements.
- **Location-Based Stock:** Per-location stock quantification.
- **JWT-Protected APIs:** Secure endpoints requiring valid bearer token authorization.

## Inventory Model

StockSense uses a double-entry inventory movement model:

- `stock_quants`: Tracks available stock by product and location.
- `stock_moves`: Complete ledger recording all inventory operations.
- **Receipt:** `vendor` → `internal` (increases internal stock).
- **Delivery:** `internal` → `customer` (decreases internal stock).
- **Internal Transfer:** `internal` → `internal` (relocates stock across locations).
- **Adjustment:** Reconciles physical count differences against a virtual `inventory_loss` location.

## Security & Concurrency

- **Password Hashing:** Passwords hashed with bcrypt.
- **Hashed OTP Storage:** 6-digit reset OTPs are salted and hashed before persistence, with automatic expiration and single-use invalidation.
- **JWT Authentication:** Protected inventory endpoints enforce Bearer token verification.
- **PostgreSQL Transactions:** ACID-compliant operations ensuring atomic updates.
- **Row-Level Locking:** Pessimistic locking (`SELECT ... FOR UPDATE`) during move validation prevents race conditions and negative inventory.

## Local Setup

### Prerequisites

- Node.js (v18+)
- Python (3.11+)
- PostgreSQL

### Backend Setup

The project uses environment variables for configuration. In your backend directory, ensure `.dev-env` is configured with `DATABASE_URL` and `JWT_SECRET`.

> Note: The application loads environment variables from the shell environment.

Run the backend:

```bash
cd backend
set -a
source .dev-env
set +a
./.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`.

### Frontend Setup

Run the Next.js development server:

```bash
cd frontend
npm run dev
```

The application will be accessible at `http://localhost:3000`.

### Development OTP Behavior

For the hackathon demo, the password reset OTP is printed directly to the backend terminal console rather than being sent through an external email delivery service.

## Recommended Demo Flow

1. **Login:** Authenticate into the application.
2. **Dashboard:** Review live inventory KPIs.
3. **Product:** Create a new product with name and SKU.
4. **Receipt:** Receive items from a vendor into an internal location.
5. **Transfer:** Move stock internally between warehouse locations.
6. **Delivery:** Ship items to a customer and observe stock deduction.
7. **Adjustment:** Enter a physical count to balance recorded inventory.
8. **Ledger:** Inspect the immutable audit log with filters and search.
