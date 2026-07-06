# gateway/main.py
import os
import httpx
import jwt
from jwt import PyJWKClient
from typing import Dict, Any
from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(title="MemoCare API Gateway", version="1.0.0")

# Enable CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Set this to your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment Variables for internal service URLs
DB_SERVICE_URL = os.getenv("DB_SERVICE_URL", "http://db-service:8002")
MRI_SERVICE_URL = os.getenv("MRI_SERVICE_URL", "http://model-mri:7860")
TABULAR_SERVICE_URL = os.getenv("TABULAR_SERVICE_URL", "http://model-tabular:8002")
PDF_SERVICE_URL = os.getenv("PDF_SERVICE_URL", "http://pdf-reports:8003")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

# Cache for PyJWKClient instances to avoid hitting the network on every request
jwk_clients = {}

# Dependency to verify JWT and return the user's UUID
def get_current_user_id(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    token = authorization.split(" ")[1]
    
    try:
        # 1. Decode token without verification to read the issuer ('iss') claim
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        issuer = unverified_payload.get("iss")
        if not issuer:
            raise HTTPException(status_code=401, detail="Invalid token: missing issuer claim")
        
        # 2. Get or create PyJWKClient for this issuer's JWKS endpoint
        # Supabase hosts their JWKS at the standard .well-known path
        jwks_url = f"{issuer.rstrip('/')}/.well-known/jwks.json"
        
        if jwks_url not in jwk_clients:
            headers = {"apikey": SUPABASE_ANON_KEY} if SUPABASE_ANON_KEY else {}
            jwk_clients[jwks_url] = PyJWKClient(jwks_url, headers=headers)
            
        jwks_client = jwk_clients[jwks_url]
        
        # 3. Retrieve the matching signing key from JWKS
        signing_key = jwks_client.get_signing_key_from_jwt(token)
        
        # 4. Verify signature using the retrieved public key (supports ES256 and RS256)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            options={"verify_aud": False}
        )
        return payload["sub"] # sub holds the Supabase User UUID
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid authorization token: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")


# --- HEALTH CHECK ---
@app.get("/health")
def health():
    return {"gateway": "healthy"}


# --- MACHINE LEARNING PREDICTIONS (Public Endpoints) ---

@app.post("/predict/mri")
async def predict_mri(file: UploadFile = File(...)):
    """Forward MRI image file to the MRI Model microservice"""
    async with httpx.AsyncClient() as client:
        try:
            # Read the uploaded file contents
            file_content = await file.read()
            files = {"file": (file.filename, file_content, file.content_type)}
            
            # Forward request to model_mri service
            response = await client.post(f"{MRI_SERVICE_URL}/predict", files=files, timeout=60.0)
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
                
            return response.json()
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"MRI Model Service unreachable: {e}")


@app.post("/predict/tabular")
async def predict_tabular(data: Dict[str, Any]):
    """Forward raw tabular features to the Tabular Model microservice"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f"{TABULAR_SERVICE_URL}/predict", json=data)
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            return response.json()
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Tabular Model Service unreachable: {e}")


# --- PROTECTED DATA ACCESS (Requires Supabase JWT) ---

class MRIRecordInput(BaseModel):
    encrypted_verdict: str
    iv: str

class TabularRecordInput(BaseModel):
    encrypted_data: str
    encrypted_verdict: str
    iv: str

@app.post("/records/mri")
async def save_mri_record(record: MRIRecordInput, user_id: str = Depends(get_current_user_id)):
    """Attach the verified user_id and save encrypted MRI record via DB service"""
    payload = {
        "user_id": user_id,
        "encrypted_verdict": record.encrypted_verdict,
        "iv": record.iv
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f"{DB_SERVICE_URL}/records/mri", json=payload)
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            return response.json()
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Database Service unreachable: {e}")


@app.get("/records/mri")
async def fetch_mri_records(user_id: str = Depends(get_current_user_id)):
    """Fetch encrypted MRI records belonging to the verified user_id"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{DB_SERVICE_URL}/records/mri/{user_id}")
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            return response.json()
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Database Service unreachable: {e}")


@app.post("/records/tabular")
async def save_tabular_record(record: TabularRecordInput, user_id: str = Depends(get_current_user_id)):
    """Attach the verified user_id and save encrypted tabular record via DB service"""
    payload = {
        "user_id": user_id,
        "encrypted_data": record.encrypted_data,
        "encrypted_verdict": record.encrypted_verdict,
        "iv": record.iv
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(f"{DB_SERVICE_URL}/records/tabular", json=payload)
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            return response.json()
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Database Service unreachable: {e}")


@app.get("/records/tabular")
async def fetch_tabular_records(user_id: str = Depends(get_current_user_id)):
    """Fetch encrypted tabular records belonging to the verified user_id"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{DB_SERVICE_URL}/records/tabular/{user_id}")
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            return response.json()
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Database Service unreachable: {e}")


@app.post("/generate-pdf")
async def generate_pdf(data: Dict[str, Any], user_id: str = Depends(get_current_user_id)):
    """Forward data to PDF Service and return the generated report file"""
    async with httpx.AsyncClient() as client:
        try:
            # We forward user data to the pdf-reports service
            response = await client.post(f"{PDF_SERVICE_URL}/generate", json=data)
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            
            # Return binary PDF file stream
            from fastapi.responses import Response
            return Response(content=response.content, media_type="application/pdf")
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"PDF Service unreachable: {e}")

@app.delete("/records/mri/{record_id}")
async def delete_mri_record(record_id: str, user_id: str = Depends(get_current_user_id)):
    """Forward delete request for MRI record to DB service, checking ownership"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.delete(f"{DB_SERVICE_URL}/records/mri/{record_id}/{user_id}")
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            return response.json()
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Database Service unreachable: {e}")

@app.delete("/records/tabular/{record_id}")
async def delete_tabular_record(record_id: str, user_id: str = Depends(get_current_user_id)):
    """Forward delete request for tabular record to DB service, checking ownership"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.delete(f"{DB_SERVICE_URL}/records/tabular/{record_id}/{user_id}")
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            return response.json()
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Database Service unreachable: {e}")

# --- SERVE FRONTEND STATIC FILES (SPA Catch-all) ---
frontend_dist = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../frontend/dist")

if os.path.exists(frontend_dist):
    # Mount Vite static assets folder
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="static_assets")

    # Serve index.html for all other paths (supporting React router client-side routes)
    @app.get("/{catchall:path}")
    async def serve_react_app(catchall: str):
        # Prevent catching API endpoints that actually returned 404
        if catchall.startswith(("predict", "records", "generate-pdf", "health", "docs", "redoc", "openapi.json")):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        return FileResponse(os.path.join(frontend_dist, "index.html"))
