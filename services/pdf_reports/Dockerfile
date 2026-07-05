FROM python:3.12-slim

# Install uv for blazingly fast dependency management
RUN pip install uv

# Set the working directory inside the container
WORKDIR /app

# Copy the dependency files first (this caches the installation step!)
COPY pyproject.toml uv.lock ./

# Install the dependencies strictly using the lockfile
RUN uv sync --frozen

# Copy the rest of the application files
COPY . .

# Expose the port that the FastAPI server runs on (e.g. 8003 for PDF reports)
EXPOSE 8003

# Command to run the Uvicorn server using uv
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003"]
