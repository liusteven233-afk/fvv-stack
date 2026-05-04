"""FastAPI entry point"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from models.database import init_db
from api import ml_auth, ml_api, products, listings, orders, after_sales, pricing

app = FastAPI(title="FVV Stack API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Router registrations
app.include_router(ml_auth.router, prefix="/api/ml/auth", tags=["ML Auth"])
app.include_router(ml_api.router, prefix="/api/ml", tags=["ML API"])
app.include_router(products.router, prefix="/api/products", tags=["Products"])
app.include_router(listings.router, prefix="/api/listings", tags=["Listings"])
app.include_router(orders.router, prefix="/api/orders", tags=["Orders & Purchases"])
app.include_router(after_sales.router, prefix="/api/after-sales", tags=["After Sales"])
app.include_router(pricing.router, prefix="/api/pricing", tags=["Pricing"])


@app.on_event("startup")
def startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok", "service": "fvv-stack"}
