#!/bin/bash


echo "Starting backend with Uvicorn..."
cd backend
uvicorn main:app --reload &


echo "Starting frontend with Python's HTTP server..."
cd ../frontend
python -m http.server 9000 &

wait