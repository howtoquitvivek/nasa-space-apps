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
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "Backend process started with PID: $BACKEND_PID"

# --- Part 3: Run the frontend ---
echo "Starting frontend..."
python -m http.server 9000 --directory frontend &
FRONTEND_PID=$!
echo "Frontend process started with PID: $FRONTEND_PID"

echo "Backend is running on http://0.0.0.0:8000"
echo "Frontend is running on http://0.0.0.0:9000"
