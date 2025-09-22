# Copilot Instructions for AI Coding Agents

## Project Overview
This repository is a planetary image analysis platform (Anveshak) for large-scale geospatial data, combining a FastAPI backend (Python) with Svelte and Vite-based frontends. It supports similarity search, feature extraction, and interactive map-based exploration of planetary imagery.

## Architecture & Key Components
- **Backend** (`backend/`): FastAPI app using `timm` (feature extraction), `faiss` (vector search), and `rasterio` (geospatial I/O). Main entry: `backend/main.py`.
- **Data Ingestion**: `fetch_footprints.py` fetches and processes metadata from NASA Trek APIs. Data and annotations are stored in `data/`.
- **Indexes & Embeddings**: Precomputed embeddings (`embeddings/`) and FAISS indexes (`faiss_indexes/`) enable fast similarity search.
- **Frontend**
  - `frontend/`: Svelte SPA using Leaflet.js for map UI. See `frontend/src/routes/` for page structure.
  - `newfrontend/`: Vite + Bootstrap, route-based HTML/JS/CSS. See `newfrontend/src/routes/` for modular pages.
- **Tile Maps**: `tile_maps/` contains JSON metadata for image tiles, used for map overlays and search.

## Developer Workflows
- **Backend**
  - Install Python deps: `uv sync`
  - Start server: `./run.sh` (runs FastAPI)
- **Frontend**
  - `frontend/`: `npm install` → `npm run dev`
  - `newfrontend/`: `npm install` → `npm run dev`
- **Data**
  - Extract `data.rar` before running backend or data scripts.
  - Use `fetch_footprints.py` to update tile metadata from NASA APIs.

## Project Conventions & Patterns
- **Data Flow**: Data ingested via scripts → stored in `data/` → indexed (embeddings/FAISS) → queried by backend → visualized in frontend.
- **Map Integration**: Frontends use Leaflet.js (Svelte) or Bootstrap (Vite) for map and UI; tile metadata is loaded from `tile_maps/`.
- **Route Structure**: Both frontends use route-based folders for modularity (`src/routes/`).
- **Cross-Component Communication**: Frontend queries backend via REST API (see `backend/main.py` for endpoints).
- **Custom Scripts**: `fetch_footprints.py` is the main entry for data ingestion/refresh.

## Examples
- To add a new planetary dataset: place data in `data/`, generate embeddings/indexes, update `tile_maps/`, and refresh via backend.
- To add a new frontend route: create a folder in `src/routes/` with `index.html`/`main.js`/`custom.css` (Vite) or Svelte files (Svelte SPA).

## References
- See `README.md` in root, `frontend/`, and `newfrontend/` for more details on setup and structure.
- Key files: `backend/main.py`, `fetch_footprints.py`, `tile_maps/*.json`, `embeddings/`, `faiss_indexes/`, `frontend/src/routes/`, `newfrontend/src/routes/`.

---
For AI agents: Follow these conventions for code generation, data flow, and modularity. When in doubt, reference the relevant README or key files above.