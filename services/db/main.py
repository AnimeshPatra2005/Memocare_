import os
from datetime import datetime
from typing import List, Optional
from uuid import UUID, uuid4
from fastapi import FastAPI, Depends, HTTPException
from sqlmodel import Field, SQLModel, Session, create_engine, select
from dotenv import load_dotenv


load_dotenv()

# Get the Supabase Connection String from environment variables
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in environment variables!")

# The Engine handles the connections to Supabase PostgreSQL
engine = create_engine(DATABASE_URL)

class MRIRecord(SQLModel, table=True):
    __tablename__: str = "mri_records"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(index=True) # Linked to Supabase Auth User ID
    encrypted_verdict: str
    iv: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

class TabularRecord(SQLModel, table=True):
    __tablename__: str = "tabular_records"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(index=True)
    encrypted_data: str # Contains encrypted age, health stats, etc.
    encrypted_verdict: str
    iv: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

app = FastAPI(title="MemoCare DB Service")

# This event runs when the FastAPI service starts up
@app.on_event("startup")
def on_startup():
    # Automatically creates the tables in Supabase if they do not exist yet
    SQLModel.metadata.create_all(engine)

# Dependency injection to get DB connection sessions
def get_db():
    with Session(engine) as session:
        yield session

# --- MRI Endpoints ---

@app.post("/records/mri", response_model=MRIRecord)
def create_mri_record(record: MRIRecord, db: Session = Depends(get_db)):
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

@app.get("/records/mri/{user_id}", response_model=List[MRIRecord])
def get_mri_records(user_id: UUID, db: Session = Depends(get_db)):
    statement = select(MRIRecord).where(MRIRecord.user_id == user_id).order_by(MRIRecord.created_at.desc())
    results = db.exec(statement).all()
    return results

# --- Tabular Endpoints ---

@app.post("/records/tabular", response_model=TabularRecord)
def create_tabular_record(record: TabularRecord, db: Session = Depends(get_db)):
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

@app.get("/records/tabular/{user_id}", response_model=List[TabularRecord])
def get_tabular_records(user_id: UUID, db: Session = Depends(get_db)):
    statement = select(TabularRecord).where(TabularRecord.user_id == user_id).order_by(TabularRecord.created_at.desc())
    results = db.exec(statement).all()
    return results
