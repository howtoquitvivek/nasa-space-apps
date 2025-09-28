#!/bin/bash
# --- Run the backend with uvicorn in the background ---
echo "Starting FastAPI backend with uvicorn..."
uvicorn backend.main:app --reload



