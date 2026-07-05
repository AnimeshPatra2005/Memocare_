import os
import io
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

import tensorflow as tf
from tensorflow.keras.applications import DenseNet201
from tensorflow.keras.models import load_model

app = FastAPI(title="MemoCare MRI Model Service")

# Allow CORS for local development and frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define the classes in the exact alphabetical order the Kaggle generator used
CLASS_NAMES = ["Mild_Demented", "Moderate_Demented", "Non_Demented", "Very_Mild_Demented"]

# Global variables for models
densenet_model = None
ann_model = None

@app.on_event("startup")
async def load_models():
    """Load the models when the server starts up."""
    global densenet_model, ann_model
    
    print("Loading DenseNet201 Feature Extractor...")
    densenet_model = DenseNet201(weights='imagenet', include_top=False, input_shape=(224, 224, 3))
    densenet_model.trainable = False

    model_path = "dementia_ann_1x1conv.h5"
    if not os.path.exists(model_path):
        print(f"WARNING: Model file {model_path} not found! Please place it in the model_mri directory.")
    else:
        print("Loading ANN classifier...")
        ann_model = load_model(model_path)
        print("Models loaded successfully!")

@app.post("/predict")
async def predict_mri(file: UploadFile = File(...)):
    """Receives an MRI image and returns the dementia prediction."""
    if ann_model is None:
        raise HTTPException(status_code=500, detail="Model file not found on server.")

    # 1. Validate file is an image
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File provided is not an image.")

    try:
        # 2. Read and preprocess the image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
        
        # Use NEAREST interpolation to perfectly match Keras ImageDataGenerator default
        image = image.resize((224, 224), Image.Resampling.NEAREST)
        
        # Convert to numpy array and rescale (just like ImageDataGenerator rescale=1./255)
        img_array = np.array(image, dtype=np.float32) / 255.0
        
        # Add batch dimension: shape becomes (1, 224, 224, 3)
        img_array = np.expand_dims(img_array, axis=0)

        # 3. Extract Features (Returns 1, 7, 7, 1920)
        features = densenet_model.predict(img_array, verbose=0)
        
        # 4. Final Prediction using our custom 1x1 Conv ANN
        predictions = ann_model.predict(features, verbose=0)
        
        # Get the highest probability
        class_index = np.argmax(predictions[0])
        confidence = float(predictions[0][class_index])
        
        return {
            "prediction": CLASS_NAMES[class_index],
            "confidence": confidence,
            "all_probabilities": {CLASS_NAMES[i]: float(predictions[0][i]) for i in range(4)}
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy", "model_loaded": ann_model is not None}
