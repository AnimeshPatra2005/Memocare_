#!/bin/bash

# Start DB Service in the background
echo "Starting Database Service..."
(cd services/db && uvicorn main:app --host 0.0.0.0 --port 8006) &

# Start MRI Model Service in the background (runs internally on port 8005)
echo "Starting MRI Model Service..."
(cd services/model_mri && uvicorn main:app --host 0.0.0.0 --port 8005) &

# Start Tabular Model Service in the background
echo "Starting Tabular Model Service..."
(cd services/model_tabular && uvicorn main:app --host 0.0.0.0 --port 8002) &

# Start PDF Service in the background
echo "Starting PDF Service..."
(cd services/pdf_reports && uvicorn main:app --host 0.0.0.0 --port 8003) &

# Wait for internal services to warm up
echo "Warming up microservices..."
sleep 5

# Start API Gateway in the foreground (main process on Hugging Face port 7860)
echo "Starting API Gateway..."
exec uvicorn gateway.main:app --host 0.0.0.0 --port 7860
