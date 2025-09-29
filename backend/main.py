from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, json, math, shutil
from typing import List, Dict, Union
from PIL import Image, ImageOps
import torch
import torch.nn as nn
import numpy as np
import timm
from timm.data import resolve_model_data_config
from timm.data.transforms_factory import create_transform
import faiss
from rasterio.transform import from_bounds
from shapely.geometry import shape, box
import requests

# ===================================================================
# FastAPI App Setup
# ===================================================================

app = FastAPI(title="Anveshak API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===================================================================
# Global Configuration and Paths
# ===================================================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES_ROOT = os.path.join(BASE_DIR, "data")
ANNOTATIONS_DIR = os.path.join(BASE_DIR, "database/annotations")
FAISS_INDEX_ROOT = os.path.join(BASE_DIR, "database/faiss_indexes")
TILE_MAP_ROOT = os.path.join(BASE_DIR, "database/tile_maps")
EMBEDDINGS_ROOT = os.path.join(BASE_DIR, "database/embeddings")

# Create necessary directories on startup
os.makedirs(ANNOTATIONS_DIR, exist_ok=True)
os.makedirs(FAISS_INDEX_ROOT, exist_ok=True)
os.makedirs(TILE_MAP_ROOT, exist_ok=True)
os.makedirs(EMBEDDINGS_ROOT, exist_ok=True)

ingestion_jobs: Dict[str, Dict] = {}
faiss_indexes: Dict[tuple, "FaissIndex"] = {}

# ===================================================================
# Data Models (Pydantic)
# ===================================================================

class IngestRequest(BaseModel):
    footprintId: str
    datasetId: str
    tileUrl: str
    tilesPerZoom: Dict[str, Dict[str, Union[List[int], int]]]
    minZoom: int
    maxZoom: int

class CancelRequest(BaseModel):
    datasetId: str
    footprintId: str

class Annotation(BaseModel):
    id: str
    dataset: str
    footprint: str
    geojson: dict
    label: str
    embedding: List[float] = []

class SimilarRequest(BaseModel):
    annotation_id: str
    dataset: str
    footprint: str
    geojson: dict

class SimilarMoreRequest(BaseModel):
    annotation_id: str
    dataset: str
    footprint: str
    geojson: dict
    exclude_zooms: List[int]

# ===================================================================
# Feature Extraction (PyTorch & Timm)
# ===================================================================

device = "cpu"
model_name = "efficientnet_b0"

# Initialize model and transformations once on startup
model = timm.create_model(model_name, pretrained=True)
config = resolve_model_data_config(model)
transform = create_transform(**config)
model.eval().to(device)

features = {}

def get_features_hook(name: str):
    """Creates a hook to capture layer features."""
    def hook(model, input, output):
        features[name] = output.detach()
    return hook

# Register hooks for feature extraction
handle3 = model.blocks[3].register_forward_hook(get_features_hook('blocks[3]'))
handle5 = model.blocks[5].register_forward_hook(get_features_hook('blocks[5]'))

def extract_features(image: Image.Image) -> np.ndarray:
    """Extracts concatenated features from an image."""
    rgb_image = image.convert("RGB")
    img_t = transform(rgb_image).unsqueeze(0).to(device)
    with torch.no_grad():
        _ = model(img_t)
        features_b3 = features['blocks[3]']
        features_b5 = features['blocks[5]']
        pool = nn.AdaptiveAvgPool2d((1, 1))
        pooled_b3 = pool(features_b3).squeeze().cpu().numpy()
        pooled_b5 = pool(features_b5).squeeze().cpu().numpy()
        concatenated_features = np.concatenate((pooled_b3, pooled_b5))
    return concatenated_features

# ===================================================================
# Faiss Indexing
# ===================================================================

class FaissIndex:
    """Manages Faiss index and its metadata."""
    def __init__(self, d: int):
        self.d = d
        self.index = None
        self.tile_map = []
        self.embeddings = None

    def build_index(self, embeddings, tile_info):
        self.index = faiss.IndexFlatIP(self.d)
        embeddings_np = np.array(embeddings, dtype="float32")
        faiss.normalize_L2(embeddings_np)
        self.index.add(embeddings_np)
        self.tile_map = tile_info
        self.embeddings = embeddings_np

    def search(self, query_embedding: np.ndarray, k: int):
        query_embedding_np = np.array([query_embedding], dtype="float32")
        faiss.normalize_L2(query_embedding_np)
        distances, indices = self.index.search(query_embedding_np, k)

        results = []
        for i in range(len(indices[0])):
            idx = indices[0][i]
            if idx == -1:
                continue
            tile_info = self.tile_map[idx]
            score = distances[0][i]
            results.append({
                "dataset": tile_info[0],
                "footprint": tile_info[1],
                "z": tile_info[2],
                "x": tile_info[3],
                "y": tile_info[4],
                "score": float(score),
            })
        return results

def save_faiss_index(faiss_index: FaissIndex, name: str, zoom: int):
    """Saves a Faiss index and its metadata to disk."""
    index_file = os.path.join(FAISS_INDEX_ROOT, f"{name}_{zoom}.index")
    tile_map_file = os.path.join(TILE_MAP_ROOT, f"{name}_{zoom}.json")
    embeddings_file = os.path.join(EMBEDDINGS_ROOT, f"{name}_{zoom}.npy")
    faiss.write_index(faiss_index.index, index_file)
    with open(tile_map_file, "w") as f:
        json.dump(faiss_index.tile_map, f)
    if faiss_index.embeddings is not None:
        np.save(embeddings_file, faiss_index.embeddings)

def load_faiss_index(name: str, zoom: int) -> Union[FaissIndex, None]:
    """Loads a Faiss index and its metadata from disk."""
    index_file = os.path.join(FAISS_INDEX_ROOT, f"{name}_{zoom}.index")
    tile_map_file = os.path.join(TILE_MAP_ROOT, f"{name}_{zoom}.json")
    embeddings_file = os.path.join(EMBEDDINGS_ROOT, f"{name}_{zoom}.npy")
    if os.path.exists(index_file) and os.path.exists(tile_map_file) and os.path.exists(embeddings_file):
        try:
            index = faiss.read_index(index_file)
            with open(tile_map_file, "r") as f:
                tile_map = json.load(f)
            embeddings = np.load(embeddings_file)
            fi = FaissIndex(index.d)
            fi.index = index
            fi.tile_map = [tuple(x) for x in tile_map]
            fi.embeddings = embeddings
            return fi
        except Exception as e:
            print(f"Error loading Faiss index {name}_{zoom}: {e}")
            return None
    return None

def build_faiss_index_for_footprint_zoom(dataset_id: str, footprint_id: str, zoom: int):
    """
    Builds and loads an in-memory Faiss index for a specific
    dataset, footprint, and zoom level.
    """
    global faiss_indexes
    zoom_path = os.path.join(TILES_ROOT, dataset_id, footprint_id, str(zoom))
    if not os.path.isdir(zoom_path):
        print(f"Zoom directory not found: {zoom_path}")
        return
        
    all_embeddings = []
    all_tile_info = []

    for x_str in os.listdir(zoom_path):
        x_path = os.path.join(zoom_path, x_str)
        if not os.path.isdir(x_path): continue
        for y_file in os.listdir(x_path):
            try:
                tile_path = os.path.join(x_path, y_file)
                img = Image.open(tile_path).convert("RGB")
                emb = extract_features(img)
                all_embeddings.append(emb)
                y = int(y_file.split('.')[0])
                x = int(x_str)
                all_tile_info.append((dataset_id, footprint_id, zoom, x, y))
            except Exception as e:
                print(f"Warning: Could not process tile {tile_path}. {e}")
    
    if all_embeddings:
        d = all_embeddings[0].shape[0]
        fi = FaissIndex(d)
        fi.build_index(all_embeddings, all_tile_info)
        index_name = f"{dataset_id}_{footprint_id}"
        save_faiss_index(fi, index_name, zoom)
        faiss_indexes[(dataset_id, footprint_id, zoom)] = fi
        print(f"Index built & saved for '{index_name}' zoom {zoom} with {len(all_embeddings)} vectors ✅")

# ===================================================================
# Helper Classes and Functions
# ===================================================================

class MercatorProjection:
    """Utility class for Mercator projection calculations."""
    def __init__(self, tile_size=256):
        self.tile_size = tile_size

    @staticmethod
    def tileXToLng(x, z):
        return (x / 2**z) * 360.0 - 180.0

    @staticmethod
    def tileYToLat(y, z):
        n = math.pi - (2.0 * math.pi * y) / (2**z)
        return (180.0 / math.pi) * math.atan(math.sinh(n))

    def get_pixel_bbox_on_tile(self, geojson, z, tile_x, tile_y):
        feature_shape = shape(geojson['geometry'])
        tile_lng_min = self.tileXToLng(tile_x, z)
        tile_lat_max = self.tileYToLat(tile_y, z)
        tile_lng_max = self.tileXToLng(tile_x + 1, z)
        tile_lat_min = self.tileYToLat(tile_y + 1, z)
        
        tile_bbox_geom = box(tile_lng_min, tile_lat_min, tile_lng_max, tile_lat_max)
        clipped_shape = feature_shape.intersection(tile_bbox_geom)

        if clipped_shape.is_empty:
            return None

        tile_transform = from_bounds(tile_lng_min, tile_lat_min, tile_lng_max, tile_lat_max, 256, 256)
        
        try:
            from rasterio.windows import from_bounds as window_from_bounds
            window = window_from_bounds(*clipped_shape.bounds, transform=tile_transform)
            col_start, col_stop = window.col_off, window.col_off + window.width
            row_start, row_stop = window.row_off, window.row_off + window.height
            
            return (max(0, int(col_start)), max(0, int(row_start)), min(256, int(col_stop)), min(256, int(row_stop)))
        except Exception as e:
            print(f"Error calculating pixel bbox: {e}")
            return None

projection = MercatorProjection()

def latlng_to_tilexy(lat: float, lng: float, zoom: int):
    """Converts lat/lng to tile x/y coordinates."""
    n = 2**zoom
    x = int((lng + 180.0) / 360.0 * n)
    y = int((1.0 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2.0 * n)
    return x, y

def get_annotation_path(dataset: str, footprint: str) -> str:
    """Generates the file path for a specific footprint's annotations."""
    return os.path.join(ANNOTATIONS_DIR, dataset, f"{footprint}.json")

def load_annotations(dataset: str, footprint: str) -> List[Dict]:
    """Loads annotations for a specific dataset and footprint."""
    filepath = get_annotation_path(dataset, footprint)
    if not os.path.exists(filepath):
        return []
    try:
        with open(filepath, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []

def save_annotations(dataset: str, footprint: str, data: List[Dict]):
    """Saves annotations for a specific dataset and footprint."""
    filepath = get_annotation_path(dataset, footprint)
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2)

def download_tile(session, url: str, path: str) -> bool:
    """Downloads a single tile from a URL and saves it."""
    try:
        response = session.get(url, timeout=10)
        response.raise_for_status()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            f.write(response.content)
        return True
    except requests.exceptions.RequestException:
        return False

def ingest_dataset(dataset_id: str, req: IngestRequest):
    """
    Starts the tile ingestion process with the corrected logic from the frontend viewer.
    This version gracefully handles all download errors and continues.
    """
    job_key = f"{dataset_id}_{req.footprintId}"
    ingestion_jobs[job_key] = {"cancelled": False}
    print(f"Starting ingestion for new dataset: {dataset_id}/{req.footprintId}")
    session = requests.Session()
    
    successfully_downloaded_zooms = []
    
    for z in range(req.minZoom, req.maxZoom + 1):
        zoom_path = os.path.join(TILES_ROOT, dataset_id, req.footprintId, str(z))
        os.makedirs(zoom_path, exist_ok=True)
        
        if ingestion_jobs[job_key]["cancelled"]:
            print(f"Ingestion cancelled at zoom {z}")
            if os.path.exists(zoom_path):
                shutil.rmtree(zoom_path)
            break
        
        zoom_str = str(z)
        if zoom_str not in req.tilesPerZoom:
            print(f"No tile ranges for zoom {z}. Skipping.")
            continue
        
        zoom_data = req.tilesPerZoom[zoom_str]
        x_range = zoom_data['xRange']
        y_range = zoom_data['yRange']
        
        for x in range(x_range[0], x_range[1] + 1):
            for y in range(y_range[0], y_range[1] + 1):
                if ingestion_jobs[job_key]["cancelled"]:
                    print(f"Ingestion cancelled at tile {z}/{x}/{y}")
                    if os.path.exists(zoom_path):
                        shutil.rmtree(zoom_path)
                    break
                
                # --- CORRECTED LOGIC FROM THE FRONTEND VIEWER ---
                # This logic is now a simple loop, and the error handling
                # will gracefully skip tiles that are not found.
                
                tile_url = req.tileUrl.format(z=z, y=y, x=x)
                local_path = os.path.join(zoom_path, str(x), f"{y}.png")
                os.makedirs(os.path.dirname(local_path), exist_ok=True)
                
                try:
                    print(f"  Attempting to download: {tile_url}")
                    response = session.get(tile_url, timeout=10)
                    response.raise_for_status() # Raise an exception for bad status codes
                    
                    if response.content:
                        with open(local_path, 'wb') as f:
                            f.write(response.content)
                        # print(f"  Successfully downloaded tile {z}/{x}/{y}")
                    else:
                        print(f"  Warning: Empty response for tile {z}/{x}/{y}")
                
                except requests.exceptions.HTTPError as e:
                    # Log the error but do not stop the loop
                    print(f"  Error downloading tile {z}/{x}/{y}: {e}. Continuing...")
                except requests.exceptions.RequestException as e:
                    # Handle other requests exceptions (e.g., timeout, connection issues) gracefully
                    print(f"  Network error for tile {z}/{x}/{y}: {e}. Continuing...")
                except Exception as e:
                    print(f"  Unexpected error for tile {z}/{x}/{y}: {e}. Continuing...")
                
            if ingestion_jobs[job_key]["cancelled"]:
                break
        
        if not ingestion_jobs[job_key]["cancelled"]:
            successfully_downloaded_zooms.append(z)
        else:
            break
            
    ingestion_jobs.pop(job_key, None)
    
    if successfully_downloaded_zooms:
        for zoom in successfully_downloaded_zooms:
            build_faiss_index_for_footprint_zoom(dataset_id, req.footprintId, zoom)
    
    print(f"Ingestion finished or cancelled for dataset: {dataset_id}/{req.footprintId}")

# ===================================================================
# Startup Event
# ===================================================================
@app.on_event("startup")
async def startup_event():
    """Builds Faiss indexes for existing tiles on startup."""
    global faiss_indexes
    print("Checking for cached Faiss indexes...")
    for dataset_id in os.listdir(TILES_ROOT):
        dataset_path = os.path.join(TILES_ROOT, dataset_id)
        if not os.path.isdir(dataset_path): continue
        for footprint_id in os.listdir(dataset_path):
            footprint_path = os.path.join(dataset_path, footprint_id)
            if not os.path.isdir(footprint_path): continue
            for zoom_str in os.listdir(footprint_path):
                zoom_path = os.path.join(footprint_path, zoom_str)
                if not os.path.isdir(zoom_path) or not zoom_str.isdigit(): continue
                zoom = int(zoom_str)
                index_key = (dataset_id, footprint_id, zoom)
                
                fi = load_faiss_index(f"{dataset_id}_{footprint_id}", zoom)
                if fi:
                    faiss_indexes[index_key] = fi
                    print(f"Loaded Faiss index for '{dataset_id}_{footprint_id}' zoom {zoom} with {fi.index.ntotal} vectors ✅")
                    continue
                
                print(f"No cached index for '{dataset_id}_{footprint_id}' zoom {zoom}. Building...")
                build_faiss_index_for_footprint_zoom(dataset_id, footprint_id, zoom)


# ===================================================================
# Endpoints
# ===================================================================

@app.get("/")
def check():
    return {"status": "api healthy"}

@app.get("/favicon.ico")
async def favicon():
    return Response(content=b"", media_type="image/x-icon")

@app.get("/tiles/{dataset}/{footprint}/{z}/{x}/{y}.{ext}")
def get_tile(dataset: str, footprint: str, z: int, x: int, y: int, ext: str):
    """Retrieves a specific tile image."""
    path = os.path.join(TILES_ROOT, dataset, footprint, str(z), str(x), f"{y}.{ext}")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Tile not found: {path}")
    media_type = f"image/{ext}" if ext in ["png", "jpeg", "jpg", "webp"] else "application/octet-stream"
    return FileResponse(path, media_type=media_type)

@app.get("/datasets/downloaded")
def get_downloaded_footprints():
    """Lists all datasets and their downloaded footprints."""
    downloaded_data = {}
    if not os.path.exists(TILES_ROOT) or not os.path.isdir(TILES_ROOT):
        return {}
    for dataset_id in os.listdir(TILES_ROOT):
        dataset_path = os.path.join(TILES_ROOT, dataset_id)
        if os.path.isdir(dataset_path):
            footprints = []
            for footprint_id in os.listdir(dataset_path):
                footprint_path = os.path.join(dataset_path, footprint_id)
                if os.path.isdir(footprint_path):
                    footprints.append(footprint_id)
            if footprints:
                downloaded_data[dataset_id] = footprints
    return downloaded_data

@app.get("/datasets/{dataset_id}/footprints")
def get_dataset_footprints(dataset_id: str):
    """Lists all downloaded footprints for a given dataset ID."""
    dataset_path = os.path.join(TILES_ROOT, dataset_id)
    if not os.path.exists(dataset_path) or not os.path.isdir(dataset_path):
        raise HTTPException(status_code=404, detail="Dataset not found.")
    footprints = [
        item for item in os.listdir(dataset_path)
        if os.path.isdir(os.path.join(dataset_path, item)) and not item.isdigit()
    ]
    return {"footprints": sorted(footprints)}

@app.get("/datasets/{dataset}/{footprint}/bounds")
def get_dataset_bounds(dataset: str, footprint: str):
    """Calculates the geographic bounds and available zoom levels for a dataset footprint."""
    dataset_path = os.path.join(TILES_ROOT, dataset, footprint)
    if not os.path.exists(dataset_path):
        raise HTTPException(status_code=404, detail="Dataset or footprint not found")
    zoom_levels = {}
    for root, dirs, files in os.walk(dataset_path):
        for file in files:
            if not file.endswith(".png"): continue
            path_parts = root.replace(dataset_path, '').strip(os.sep).split(os.sep)
            if len(path_parts) < 2: continue
            try:
                z, x, y = int(path_parts[-2]), int(path_parts[-1]), int(os.path.splitext(file)[0])
                if z not in zoom_levels:
                    zoom_levels[z] = {"min_x": x, "max_x": x, "min_y": y, "max_y": y}
                else:
                    zoom_levels[z]["min_x"] = min(zoom_levels[z]["min_x"], x)
                    zoom_levels[z]["max_x"] = max(zoom_levels[z]["max_x"], x)
                    zoom_levels[z]["min_y"] = min(zoom_levels[z]["min_y"], y)
                    zoom_levels[z]["max_y"] = max(zoom_levels[z]["max_y"], y)
            except (ValueError, IndexError):
                continue
    if not zoom_levels:
        raise HTTPException(status_code=404, detail="No tiles found for this dataset/footprint")
    
    max_z = max(zoom_levels.keys())
    bounds_info = zoom_levels[max_z]
    south = MercatorProjection.tileYToLat(bounds_info["max_y"] + 1, max_z)
    north = MercatorProjection.tileYToLat(bounds_info["min_y"], max_z)
    west = MercatorProjection.tileXToLng(bounds_info["min_x"], max_z)
    east = MercatorProjection.tileXToLng(bounds_info["max_x"] + 1, max_z)
    return {
        "bounds": [[south, west], [north, east]],
        "available_zooms": sorted(list(zoom_levels.keys()))
    }

# --- Ingestion Endpoints ---

@app.post("/ingest")
def create_ingestion_job(req: IngestRequest):
    """Starts a new tile ingestion job."""
    ingest_dataset(req.datasetId, req)
    return {"message": "Ingestion complete!", "dataset_id": req.datasetId, "footprint_id": req.footprintId}

@app.post("/ingest/cancel")
def cancel_ingestion(req: CancelRequest):
    """Cancels an ongoing ingestion job."""
    job_key = f"{req.datasetId}_{req.footprintId}"
    if job_key in ingestion_jobs:
        ingestion_jobs[job_key]["cancelled"] = True
        return {"status": "cancelling", "datasetId": req.datasetId, "footprintId": req.footprintId}
    return {"status": "no_active_job", "datasetId": req.datasetId, "footprintId": req.footprintId}

@app.get("/ingest/status/{dataset_id}/{footprint_id}")
def get_ingestion_status(dataset_id: str, footprint_id: str):
    """Checks for downloaded zoom levels for a given dataset footprint."""
    footprint_path = os.path.join(TILES_ROOT, dataset_id, footprint_id)
    existing_zooms = [
        int(item) for item in os.listdir(footprint_path)
        if os.path.isdir(os.path.join(footprint_path, item)) and item.isdigit()
    ] if os.path.exists(footprint_path) else []
    return {"existingZooms": sorted(existing_zooms)}

# --- Annotation Endpoints ---

@app.get("/annotations")
def get_annotations(dataset: str, footprint: str):
    """Get all annotations for a specific dataset and footprint."""
    return load_annotations(dataset, footprint)

@app.post("/annotations")
def create_annotation(annotation: Annotation):
    """Create a new annotation and extract its feature embedding."""
    coords = annotation.geojson["geometry"]["coordinates"]
    if annotation.geojson['geometry']['type'] == "Point":
        lng, lat = coords
    else:
        lats = [pt[1] for poly in coords for pt in poly]
        lngs = [pt[0] for poly in coords for pt in poly]
        lat, lng = sum(lats) / len(lats), sum(lngs) / len(lngs)
    
    tile_path, zoom_found = None, None
    for z in range(1, 16):
        tx, ty = latlng_to_tilexy(lat, lng, z)
        path = os.path.join(TILES_ROOT, annotation.dataset, annotation.footprint, str(z), str(tx), f"{ty}.png")
        if os.path.exists(path):
            tile_path, zoom_found = path, z
            break
    if not tile_path:
        raise HTTPException(status_code=404, detail="No source tile found for this annotation.")
    
    img = Image.open(tile_path).convert("RGB")
    bbox = projection.get_pixel_bbox_on_tile(annotation.geojson, zoom_found, tx, ty)
    if bbox is None:
        raise HTTPException(status_code=400, detail="Annotation does not overlap with the tile.")
    cropped_img = img.crop(bbox)
    if cropped_img.size[0] > 0 and cropped_img.size[1] > 0:
        annotation.embedding = extract_features(cropped_img).tolist()
    
    annotations = load_annotations(annotation.dataset, annotation.footprint)
    annotations.append(annotation.dict())
    save_annotations(annotation.dataset, annotation.footprint, annotations)
    return {"status": "created", "id": annotation.id}

@app.put("/annotations/{annotation_id}")
def update_annotation(annotation_id: str, dataset: str, footprint: str, update_data: dict = Body(...)):
    """Update an annotation's label (or other fields)."""
    annotations = load_annotations(dataset, footprint)
    for i, ann in enumerate(annotations):
        if ann["id"] == annotation_id:
            annotations[i].update(update_data)
            save_annotations(dataset, footprint, annotations)
            return {"status": "updated", "annotation": annotations[i]}
    raise HTTPException(status_code=404, detail="Annotation not found in the specified dataset/footprint.")

@app.delete("/annotations/{annotation_id}")
def delete_annotation(annotation_id: str, dataset: str, footprint: str):
    """Delete an annotation."""
    annotations = load_annotations(dataset, footprint)
    initial_count = len(annotations)
    annotations_to_keep = [ann for ann in annotations if ann["id"] != annotation_id]
    if len(annotations_to_keep) == initial_count:
        raise HTTPException(status_code=404, detail="Annotation not found.")
    save_annotations(dataset, footprint, annotations_to_keep)
    return {"status": "deleted"}

# --- Similar Feature Search Endpoints ---

@app.post("/annotations/similar")
def find_similar_by_feature(req: SimilarRequest, zoom: int, top_k: int):
    """Finds tiles similar to a given annotation feature at a specific zoom level."""
    index_key = (req.dataset, req.footprint, zoom)
    if index_key not in faiss_indexes:
        raise HTTPException(status_code=404, detail=f"No Faiss index for '{req.dataset}/{req.footprint}' at zoom {zoom}.")
    
    faiss_index = faiss_indexes[index_key]
    feature_shape = shape(req.geojson['geometry'])
    min_lng, min_lat, max_lng, max_lat = feature_shape.bounds
    min_tx, min_ty = latlng_to_tilexy(max_lat, min_lng, zoom)
    max_tx, max_ty = latlng_to_tilexy(min_lat, max_lng, zoom)
    
    # Stitching logic
    cropped_pieces = []
    for tx in range(min_tx, max_tx + 1):
        for ty in range(min_ty, max_ty + 1):
            tile_path = os.path.join(TILES_ROOT, req.dataset, req.footprint, str(zoom), str(tx), f"{ty}.png")
            if not os.path.exists(tile_path): continue
            bbox = projection.get_pixel_bbox_on_tile(req.geojson, zoom, tx, ty)
            if bbox is None: continue
            tile_img = Image.open(tile_path)
            cropped_piece = tile_img.crop(bbox)
            relative_x, relative_y = (tx - min_tx) * 256, (ty - min_ty) * 256
            cropped_pieces.append({"image": cropped_piece, "paste_x": relative_x + bbox[0], "paste_y": relative_y + bbox[1]})
    
    if not cropped_pieces:
        raise HTTPException(status_code=404, detail="Could not find any tiles overlapping the annotation.")
    
    min_paste_x = min(p['paste_x'] for p in cropped_pieces)
    min_paste_y = min(p['paste_y'] for p in cropped_pieces)
    max_paste_x = max(p['paste_x'] + p['image'].width for p in cropped_pieces)
    max_paste_y = max(p['paste_y'] + p['image'].height for p in cropped_pieces)
    composite_width, composite_height = max_paste_x - min_paste_x, max_paste_y - min_paste_y
    if composite_width <= 0 or composite_height <= 0:
        raise HTTPException(status_code=400, detail="Composite image has invalid dimensions.")
    composite_img = Image.new("RGB", (composite_width, composite_height))
    for p in cropped_pieces:
        composite_img.paste(p['image'], (p['paste_x'] - min_paste_x, p['paste_y'] - min_paste_y))
    model_input_size = config['input_size'][1:]
    padded_img = ImageOps.pad(composite_img, model_input_size, color='gray')
    
    query_emb = extract_features(padded_img)
    initial_search_k = max(50, top_k * 5)
    initial_results = faiss_index.search(query_emb, initial_search_k)
    high_confidence_results = [res for res in initial_results if res["score"] > 0.75]
    medium_confidence_results = [res for res in initial_results if 0.60 < res["score"] <= 0.75]
    final_results = (high_confidence_results + medium_confidence_results)[:top_k]
    
    return {
        "query_feature_bounds": [min_lng, min_lat, max_lng, max_lat],
        "similar_tiles": final_results,
    }

@app.post("/annotations/similar/more")
def find_similar_by_feature_more(req: SimilarMoreRequest, top_k: int):
    """Finds similar tiles across different zoom levels of a dataset footprint."""
    QUERY_ZOOM_LEVEL = 5 
    feature_shape = shape(req.geojson['geometry'])
    min_lng, min_lat, max_lng, max_lat = feature_shape.bounds
    min_tx, min_ty = latlng_to_tilexy(max_lat, min_lng, QUERY_ZOOM_LEVEL)
    max_tx, max_ty = latlng_to_tilexy(min_lat, max_lng, QUERY_ZOOM_LEVEL)
    
    # Stitching logic
    cropped_pieces = []
    for tx in range(min_tx, max_tx + 1):
        for ty in range(min_ty, max_ty + 1):
            tile_path = os.path.join(TILES_ROOT, req.dataset, req.footprint, str(QUERY_ZOOM_LEVEL), str(tx), f"{ty}.png")
            if not os.path.exists(tile_path): continue
            bbox = projection.get_pixel_bbox_on_tile(req.geojson, QUERY_ZOOM_LEVEL, tx, ty)
            if bbox is None: continue
            tile_img = Image.open(tile_path)
            cropped_piece = tile_img.crop(bbox)
            relative_x, relative_y = (tx - min_tx) * 256, (ty - min_ty) * 256
            cropped_pieces.append({"image": cropped_piece, "paste_x": relative_x + bbox[0], "paste_y": relative_y + bbox[1]})
    
    if not cropped_pieces:
        raise HTTPException(status_code=404, detail=f"Could not find tiles for query at zoom {QUERY_ZOOM_LEVEL}.")
    
    min_paste_x = min(p['paste_x'] for p in cropped_pieces)
    min_paste_y = min(p['paste_y'] for p in cropped_pieces)
    max_paste_x = max(p['paste_x'] + p['image'].width for p in cropped_pieces)
    max_paste_y = max(p['paste_y'] + p['image'].height for p in cropped_pieces)
    composite_width, composite_height = max_paste_x - min_paste_x, max_paste_y - min_paste_y
    if composite_width <= 0 or composite_height <= 0:
        raise HTTPException(status_code=400, detail="Composite image has invalid dimensions.")
    composite_img = Image.new("RGB", (composite_width, composite_height))
    for p in cropped_pieces:
        composite_img.paste(p['image'], (p['paste_x'] - min_paste_x, p['paste_y'] - min_paste_y))
    model_input_size = config['input_size'][1:]
    padded_img = ImageOps.pad(composite_img, model_input_size, color='gray')
    query_emb = extract_features(padded_img)
    
    all_results = []
    initial_search_k = max(50, top_k * 5)
    for index_key, faiss_index in faiss_indexes.items():
        dataset_name, footprint_name, zoom_level = index_key
        if dataset_name == req.dataset and footprint_name == req.footprint and zoom_level not in req.exclude_zooms:
            print(f"Searching deeper in index for zoom level {zoom_level}...")
            results_from_zoom = faiss_index.search(query_emb, initial_search_k)
            all_results.extend(results_from_zoom)
    
    all_results.sort(key=lambda x: x["score"], reverse=True)
    high_confidence_results = [res for res in all_results if res["score"] > 0.75]
    medium_confidence_results = [res for res in all_results if 0.65 < res["score"] <= 0.75]
    final_results = (high_confidence_results + medium_confidence_results)[:top_k]
    
    return {"similar_tiles": final_results}