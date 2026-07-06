# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Create the final Python container
FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install all python dependencies for the microservices
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    httpx \
    pyjwt \
    cryptography \
    sqlmodel \
    psycopg2-binary \
    python-dotenv \
    pandas \
    pillow \
    joblib \
    scikit-learn==1.6.1 \
    fpdf2 \
    python-multipart \
    tensorflow-cpu

# Copy built frontend assets from Stage 1 into the backend serving path
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Copy the microservices code
COPY gateway ./gateway
COPY services/db ./services/db
COPY services/model_mri ./services/model_mri
COPY services/model_tabular ./services/model_tabular
COPY services/pdf_reports ./services/pdf_reports

# Copy and set up the startup script
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# Environment variables to route requests internally on localhost ports
ENV DB_SERVICE_URL=http://localhost:8006 \
    MRI_SERVICE_URL=http://localhost:8005 \
    TABULAR_SERVICE_URL=http://localhost:8002 \
    PDF_SERVICE_URL=http://localhost:8003

# Expose port 7860 (Hugging Face Spaces default web port)
EXPOSE 7860

# Hugging Face runs containers as user 1000, so we set write permissions
RUN chown -R 1000:1000 /app
USER 1000

# Execute startup entrypoint
ENTRYPOINT ["./entrypoint.sh"]
