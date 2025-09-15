#!/bin/bash

# --- Part 1: Activate the virtual environment ---
# Check if the virtual environment exists
if [ -d ".venv" ]; then
    echo "Activating virtual environment..."
    source .venv/bin/activate
    echo "Virtual environment activated."
else
    echo "Error: Virtual environment (.venv) not found. Please create it first."
    exit 1
fi

# --- Part 2: Run the backend with uvicorn ---
# Note: You have a typo in your command. It should be 'uvicorn', not 'uvivorn'.
echo "Starting FastAPI backend with uvicorn..."
# The & at the end runs the process in the background, allowing the script to continue.
# The > /dev/null 2>&1 redirects all output to nothing, to keep the terminal clean.
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "Backend process started with PID: $BACKEND_PID"


# --- Part 3: Run the frontend ---
# Note: Your command 'fronten/ python -m host 9000' is likely incorrect.
# A common way to run a frontend is with a simple Python web server.
# Here's a common example for a static site. Adjust this command as needed.
echo "Starting frontend..."
# The & runs the frontend in the background as well.
# This assumes your frontend is a static site that can be served from the 'frontend' directory.
python -m http.server 9000 --directory frontend &
FRONTEND_PID=$!
echo "Frontend process started with PID: $FRONTEND_PID"

echo "Backend is running on http://0.0.0.0:8000"
echo "Frontend is running on http://0.0.0.0:9000"

# Wait for both background processes to finish (e.g., when you press Ctrl+C)
wait $BACKEND_PID $FRONTEND_PID

echo "All processes have been stopped."