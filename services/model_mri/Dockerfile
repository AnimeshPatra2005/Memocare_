FROM python:3.12-slim

WORKDIR /app

# Install uv for fast dependency management
RUN pip install uv

# Copy the dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies into the system python environment
RUN uv pip install --system .

# Copy the rest of the application code and model
COPY . .

# Expose the single port Hugging Face Spaces allows
EXPOSE 7860

# Run the FastAPI app on the required Hugging Face port
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
