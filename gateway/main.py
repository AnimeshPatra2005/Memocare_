# gateway/main.py
import os
import httpx
import jwt
from typing import Dict, Any
from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
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
DB_SERVICE_URL = os.getenv("DB_SERVICE_URL", "http://db-service:8001")
MRI_SERVICE_URL = os.getenv("MRI_SERVICE_URL", "http://model-mri:8002")
TABULAR_SERVICE_URL = os.getenv("TABULAR_SERVICE_URL", "http://model-tabular:8003")
PDF_SERVICE_URL = os.getenv("PDF_SERVICE_URL", "http://pdf-reports:8004")

# Supabase JWT Secret for local verification
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

# Dependency to verify JWT and return the user's UUID
def get_current_user_id(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    
    token = authorization.split(" ")[1]
    
    if not SUPABASE_JWT_SECRET:
        raise HTTPException(status_code=500, detail="JWT secret not configured on gateway")
        
    try:
        # Supabase JWTs are signed with HS256 and contain "authenticated" as the role/audience
        payload = jwt.decode(
            token, 
            SUPABASE_JWT_SECRET, 
            algorithms=["HS256"], 
            options={"verify_aud": False} # Supabase uses aud: "authenticated"
        )
        return payload["sub"] # sub holds the Supabase User UUID
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid authorization token")


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
