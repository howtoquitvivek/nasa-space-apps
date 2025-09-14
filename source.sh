#!/bin/bash

echo "Synchronizing Python environment with uv..."
uv sync

echo "Activating virtual environment..."
source .venv/bin/activate

echo "Virtual environment activated."