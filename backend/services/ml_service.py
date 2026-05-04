"""Mercado Libre API service - OAuth + REST calls"""
import os
import json
import time
from datetime import datetime, timedelta
from typing import Optional
import httpx
from sqlalchemy.orm import Session

from models.database import SessionLocal
from models.ml_account import MLAccount

# ML OAuth endpoints
ML_AUTH_URL = "https://auth.mercadolibre.com.ar"
ML_API_URL = "https://api.mercadolibre.com"

# Site IDs
SITES = {
    "MLM": "México",
    "MLB": "Brasil",
    "MLC": "Chile",
    "MCO": "Colombia",
    "MLA": "Argentina",
    "MLU": "Uruguay",
}

# Default ML app credentials (user needs to register their own)
DEFAULT_CLIENT_ID = ""
DEFAULT_CLIENT_SECRET = ""


class MLService:
    """Handles ML OAuth and API calls"""

    @staticmethod
    def get_auth_url(client_id: str, redirect_uri: str) -> str:
        """Generate OAuth authorization URL"""
        return (
            f"{ML_AUTH_URL}/authorization"
            f"?response_type=code"
            f"&client_id={client_id}"
            f"&redirect_uri={redirect_uri}"
        )

    @staticmethod
    async def exchange_code(client_id: str, client_secret: str, code: str, redirect_uri: str) -> dict:
        """Exchange auth code for tokens"""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{ML_API_URL}/oauth/token",
                data={
                    "grant_type": "authorization_code",
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "redirect_uri": redirect_uri,
                }
            )
            resp.raise_for_status()
            return resp.json()

    @staticmethod
    async def refresh_token(client_id: str, client_secret: str, refresh_token: str) -> dict:
        """Refresh access token"""
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{ML_API_URL}/oauth/token",
                data={
                    "grant_type": "refresh_token",
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "refresh_token": refresh_token,
                }
            )
            resp.raise_for_status()
            return resp.json()

    @staticmethod
    async def get_headers(account_id: int) -> dict:
        """Get auth headers for an account, auto-refreshing if needed"""
        db = SessionLocal()
        try:
            account = db.query(MLAccount).filter(MLAccount.id == account_id).first()
            if not account:
                raise ValueError(f"Account {account_id} not found")

            # Check if token needs refresh (5 min buffer)
            if account.token_expires_at < datetime.utcnow() + timedelta(minutes=5):
                # Refresh
                token_data = await MLService.refresh_token(
                    account.client_id,
                    account.client_secret,
                    account.refresh_token,
                )
                account.access_token = token_data["access_token"]
                account.refresh_token = token_data.get("refresh_token", account.refresh_token)
                account.token_expires_at = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 21600))
                db.commit()

            return {
                "Authorization": f"Bearer {account.access_token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            }
        finally:
            db.close()

    # --- API Methods ---

    @staticmethod
    async def get_user_info(account_id: int) -> dict:
        """Get seller info"""
        headers = await MLService.get_headers(account_id)
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{ML_API_URL}/users/me", headers=headers)
            resp.raise_for_status()
            return resp.json()

    @staticmethod
    async def get_categories(site_id: str) -> list:
        """Get category tree for a site"""
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{ML_API_URL}/sites/{site_id}/categories")
            resp.raise_for_status()
            return resp.json()

    @staticmethod
    async def get_category_attributes(category_id: str) -> list:
        """Get required attributes for a category"""
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{ML_API_URL}/categories/{category_id}/attributes")
            resp.raise_for_status()
            return resp.json()

    @staticmethod
    async def create_listing(account_id: int, listing_data: dict) -> dict:
        """Create a listing on ML"""
        headers = await MLService.get_headers(account_id)
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{ML_API_URL}/items",
                json=listing_data,
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json()

    @staticmethod
    async def update_listing(account_id: int, item_id: str, update_data: dict) -> dict:
        """Update an existing listing"""
        headers = await MLService.get_headers(account_id)
        async with httpx.AsyncClient() as client:
            resp = await client.put(
                f"{ML_API_URL}/items/{item_id}",
                json=update_data,
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json()

    @staticmethod
    async def update_description(account_id: int, item_id: str, description: str) -> dict:
        """Update listing description"""
        headers = await MLService.get_headers(account_id)
        async with httpx.AsyncClient() as client:
            resp = await client.put(
                f"{ML_API_URL}/items/{item_id}/description",
                json={"plain_text": description},
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json()

    @staticmethod
    async def upload_image(account_id: int, image_url: str) -> dict:
        """Upload image from URL to ML"""
        headers = await MLService.get_headers(account_id)
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{ML_API_URL}/pictures",
                json={"source": image_url},
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json()

    @staticmethod
    async def get_orders(account_id: int, filters: dict = None) -> list:
        """Get orders for an account"""
        headers = await MLService.get_headers(account_id)
        account = SessionLocal().query(MLAccount).filter(MLAccount.id == account_id).first()
        params = {"seller": account.user_id}
        if filters:
            params.update(filters)
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{ML_API_URL}/orders/search",
                params=params,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("results", [])

    @staticmethod
    async def get_questions(account_id: int, item_id: str = None) -> list:
        """Get questions for listings"""
        headers = await MLService.get_headers(account_id)
        params = {}
        if item_id:
            params["item"] = item_id
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{ML_API_URL}/questions/search",
                params=params,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("questions", [])

    @staticmethod
    async def answer_question(account_id: int, question_id: int, answer_text: str) -> dict:
        """Answer a buyer question"""
        headers = await MLService.get_headers(account_id)
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{ML_API_URL}/questions/{question_id}/answer",
                json={"text": answer_text, "question_id": question_id},
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json()

    @staticmethod
    async def get_messages(account_id: int, order_id: str) -> list:
        """Get order conversation messages"""
        headers = await MLService.get_headers(account_id)
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{ML_API_URL}/messages/packs/{order_id}",
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json()

    @staticmethod
    async def send_message(account_id: int, order_id: str, text: str) -> dict:
        """Send message to buyer"""
        headers = await MLService.get_headers(account_id)
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{ML_API_URL}/messages/packs/{order_id}/messages",
                json={"text": text},
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json()

    @staticmethod
    async def get_shipment(account_id: int, shipment_id: str) -> dict:
        """Get shipment details"""
        headers = await MLService.get_headers(account_id)
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{ML_API_URL}/shipments/{shipment_id}",
                headers=headers,
            )
            resp.raise_for_status()
            return resp.json()
