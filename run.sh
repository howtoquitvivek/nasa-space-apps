#!/bin/bash
# --- Part 1: Activate the virtual environment ---
if [ -d ".venv" ]; then
    echo "Activating virtual environment..."
    source .venv/bin/activate
    echo "Virtual environment activated."
else
    echo "Error: Virtual environment (.venv) not found. Please create it first."
    exit 1
fi

# --- Part 2: Run the backend with uvicorn ---
echo "Starting FastAPI backend with uvicorn..."
uvicorn backend.main:app --reload
echo "Backend process started with PID: $BACKEND_PID"

echo "Backend is running on port 8000"

