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

# --- Part 2: Run the backend with uvicorn in the background ---
echo "Starting FastAPI backend with uvicorn..."
uvicorn backend.main:app --reload &
BACKEND_PID=$!
echo "Backend process started with PID: $BACKEND_PID"

echo "Backend is running on port 8000"

# --- Add a 10-second delay to allow the backend to start ---
echo "Waiting for 10 seconds to allow the backend to fully start..."
sleep 10

# --- Part 3: Run the frontend ---
echo "Starting frontend..."
cd frontend || { echo "Frontend directory not found!"; exit 1; }
npm run dev
echo "Frontend process started."