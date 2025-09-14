# --- Stop Servers ---
echo "Stopping servers..."

# Find and kill the process running on port 8000 (Uvicorn's default)
BACKEND_PORT=8000
BACKEND_KILL_PID=$(lsof -t -i:$BACKEND_PORT)
if [ -n "$BACKEND_KILL_PID" ]; then
    kill -9 $BACKEND_KILL_PID
    echo "Killed backend process on port $BACKEND_PORT"
else
    echo "No process found on port $BACKEND_PORT"
fi

# Find and kill the process running on port 9000
FRONTEND_PORT=9000
FRONTEND_KILL_PID=$(lsof -t -i:$FRONTEND_PORT)
if [ -n "$FRONTEND_KILL_PID" ]; then
    kill -9 $FRONTEND_KILL_PID
    echo "Killed frontend process on port $FRONTEND_PORT"
else
    echo "No process found on port $FRONTEND_PORT"
fi

echo "Servers stopped.