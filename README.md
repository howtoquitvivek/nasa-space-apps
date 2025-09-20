# Anveshak - Planetary Image Analysis Tool

## Project Overview

Anveshak is a powerful tool for researchers and scientists to explore and analyze large-scale planetary image datasets. It allows users to ingest vast amounts of image tiles, process them into a searchable index, and then perform sophisticated similarity searches to find geographical features of interest. The application has a machine learning-powered backend that uses computer vision to identify and compare features within the images, and a frontend with an intuitive map-based interface.

The backend is built with **FastAPI** and uses libraries such as `timm` for feature extraction, `faiss` for efficient similarity search, and `rasterio` for geospatial data processing. The frontend is a single-page application built with **Svelte**, utilizing `Leaflet.js` for interactive maps. The project also includes a data ingestion pipeline handled by a separate Python script, `fetch_footprints.py`, which fetches metadata from NASA's Trek APIs.

-----

## Getting Started

### Prerequisites

  - Python 3.12 or newer
  - Node.js and npm
  - uv (a Python dependency management tool)

### Installation and Setup

1.  **Extract Data**: Extract the `data.rar` file into the current directory.

2.  **Backend Setup**:

      - Run `uv sync` to install backend dependencies.
      - Run `./run.sh` to start the backend server.

3.  **Frontend Setup**:

      - Navigate to the frontend directory: `cd frontend`
      - Install dependencies: `npm install`
      - Start the development server: `npm run dev`

