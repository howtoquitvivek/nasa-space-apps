#!/bin/bash

# Define the file to check
PYPROJECT_FILE="pyproject.toml"

# Check if the file exists
if [ -f "$PYPROJECT_FILE" ]; then
    echo "Found $PYPROJECT_FILE. Running uv sync..."
    uv sync
    echo "uv sync completed successfully."
else
    echo "Error: $PYPROJECT_FILE not found in the current directory. Aborting."
    exit 1
fi