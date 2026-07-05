from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd

app = FastAPI(title="Tabular Alzheimer's Prediction Service", version="1.0.0")

# Load the model on startup
MODEL_PATH = "alzheimer_model_optimized.pkl"
try:
    model = joblib.load(MODEL_PATH)
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

# Pydantic model for input validation
# We only require the exact 17 features that the model was trained on!
class PatientData(BaseModel):
    FunctionalAssessment: float
    ADL: float
    MMSE: float
    MemoryComplaints: int
    BehavioralProblems: int
    PhysicalActivity: float
    CholesterolHDL: float
    SleepQuality: float
    CholesterolTriglycerides: float
    CholesterolTotal: float
    DietQuality: float
    BMI: float
    AlcoholConsumption: float
    CholesterolLDL: float
    SystolicBP: float
    DiastolicBP: float
    Age: float

@app.post("/predict")
async def predict_alzheimers(data: PatientData):
    if model is None:
        raise HTTPException(status_code=500, detail="Model is not loaded on the server.")
    
    # 1. Ensure the order of columns matches EXACTLY what the model expects
    columns = [
        'FunctionalAssessment', 'ADL', 'MMSE', 'MemoryComplaints', 
        'BehavioralProblems', 'PhysicalActivity', 'CholesterolHDL', 
        'SleepQuality', 'CholesterolTriglycerides', 'CholesterolTotal', 
        'DietQuality', 'BMI', 'AlcoholConsumption', 'CholesterolLDL', 
        'SystolicBP', 'DiastolicBP', 'Age'
    ]
    
    # 2. Extract values in the correct order
    feature_values = [getattr(data, col) for col in columns]
    
    # 3. Create a DataFrame (Scikit-Learn expects a DataFrame with column names)
    input_df = pd.DataFrame([feature_values], columns=columns)
    
    try:
        # 4. Make prediction
        prediction = model.predict(input_df)[0]
        probabilities = model.predict_proba(input_df)[0]
        
        # Assuming 1 = Positive for Alzheimer's, 0 = Negative
        alzheimers_probability = float(probabilities[1])
        
        result_text = "High Likelihood" if prediction == 1 else "Low Likelihood"

        return {
            "prediction_class": int(prediction),
            "result_text": result_text,
            "alzheimers_probability": alzheimers_probability
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
