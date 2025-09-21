# Anveshak - Planetary Image Analysis Tool

## Project Overview

Anveshak is a powerful tool designed for researchers and scientists to explore and analyze large-scale planetary image datasets. The application allows users to ingest vast amounts of image tiles from sources like NASA's Trek APIs, process them into a searchable index, and then perform sophisticated similarity searches to find geographical features of interest.

The core functionality of the application is built around a machine learning-powered backend that uses computer vision to identify and compare features within the images. The frontend provides an intuitive map-based interface for users to interact with the data, draw annotations, and visualize the results of their analyses.

## System Architecture

Anveshak is built on a modern client-server architecture, with a Python backend powered by the FastAPI framework and a reactive frontend built with Svelte.

### Backend
The backend is responsible for all the heavy lifting, including data ingestion, image processing, and machine learning-based analysis. It uses a combination of powerful libraries such as:
- **timm** for feature extraction
- **faiss** for efficient similarity search  
- **rasterio** for geospatial data processing

The backend exposes a set of RESTful APIs that the frontend consumes to perform various operations.

### Frontend
The frontend is a single-page application (SPA) built with Svelte, a modern JavaScript framework known for its performance and ease of use. It uses Leaflet.js for rendering interactive maps and provides a user-friendly interface for data exploration and annotation.

### Data Ingestion
A key component of the system is the data ingestion pipeline, which is handled by a separate Python script (`fetch_footprints.py`). This script is responsible for fetching metadata about available image datasets from NASA's Trek APIs, calculating the required tile information, and preparing it for ingestion by the backend.

## Project Structure

The project is organized into a clear and logical directory structure, separating the backend, frontend, and data-related files.

```
anveshak-nasa-space-apps/
├── backend/
│   └── main.py              # The main FastAPI application file
├── frontend/
│   ├── src/
│   │   ├── routes/
│   │   │   └── +page.svelte # The main page of the Svelte application
│   │   └── lib/
│   │       ├── components/
│   │       │   └── Map.svelte   # The core map component
│   └── package.json         # Frontend dependencies and scripts
├── data/                      # Directory for storing downloaded image and annotation data
├── faiss_indexes/             # Storage for the generated FAISS indexes
├── embeddings/                # Stores the embeddings for the image tiles
└── tile_maps/                 # JSON files mapping tiles to their metadata
```

