#!/bin/bash
# --- Run the backend with uvicorn in the background ---
source .venv/bin/activate
echo "Starting FastAPI backend with uvicorn..."
uvicorn backend.main:app --reload



