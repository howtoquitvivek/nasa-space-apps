from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, json, math
from typing import List, Dict
from PIL import Image, ImageOps
import torch
import torch.nn as nn
import numpy as np
import timm
from timm.data import resolve_model_data_config
from timm.data.transforms_factory import create_transform
import faiss
from pyproj import Transformer
import tempfile
import rasterio
from rasterio.transform import from_bounds
from shapely.geometry import shape, box

app = FastAPI()

# <editor-fold desc="CORS, Paths, FaissIndex, Save/Load">
# -------------------------------
# CORS
# -------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------
# Paths and Config
# -------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES_ROOT = os.path.join(BASE_DIR, "data")
ANNOTATIONS_FILE = os.path.join(BASE_DIR, "annotations.json")

FAISS_INDEX_ROOT = os.path.join(BASE_DIR, "faiss_indexes")
TILE_MAP_ROOT = os.path.join(BASE_DIR, "tile_maps")
EMBEDDINGS_ROOT = os.path.join(BASE_DIR, "embeddings")

os.makedirs(FAISS_INDEX_ROOT, exist_ok=True)
os.makedirs(TILE_MAP_ROOT, exist_ok=True)
os.makedirs(EMBEDDINGS_ROOT, exist_ok=True)

# -------------------------------
# Faiss Indexing
# -------------------------------
class FaissIndex:
    def __init__(self, d):
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

    def search(self, query_embedding, k):
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
            results.append(
                {
                    "dataset": tile_info[0],
                    "z": tile_info[1],
                    "x": tile_info[2],
                    "y": tile_info[3],
                    "score": float(score),
                }
            )
        return results

faiss_indexes: Dict[tuple, FaissIndex] = {}

# -------------------------------
# Save/Load Faiss Index
# -------------------------------
def save_faiss_index(faiss_index: "FaissIndex", dataset: str, zoom: int):
    index_file = os.path.join(FAISS_INDEX_ROOT, f"{dataset}_{zoom}.index")
    tile_map_file = os.path.join(TILE_MAP_ROOT, f"{dataset}_{zoom}.json")
    embeddings_file = os.path.join(EMBEDDINGS_ROOT, f"{dataset}_{zoom}.npy")

    faiss.write_index(faiss_index.index, index_file)
    with open(tile_map_file, "w") as f:
        json.dump(faiss_index.tile_map, f)
    if faiss_index.embeddings is not None:
        np.save(embeddings_file, faiss_index.embeddings)

def load_faiss_index(dataset: str, zoom: int):
    index_file = os.path.join(FAISS_INDEX_ROOT, f"{dataset}_{zoom}.index")
    tile_map_file = os.path.join(TILE_MAP_ROOT, f"{dataset}_{zoom}.json")
    embeddings_file = os.path.join(EMBEDDINGS_ROOT, f"{dataset}_{zoom}.npy")
    
    if (
        os.path.exists(index_file)
        and os.path.exists(tile_map_file)
        and os.path.exists(embeddings_file)
    ):
        index = faiss.read_index(index_file)
        with open(tile_map_file, "r") as f:
            tile_map = json.load(f)
        embeddings = np.load(embeddings_file)
        fi = FaissIndex(index.d)
        fi.index = index
        fi.tile_map = [tuple(x) for x in tile_map]
        fi.embeddings = embeddings
        return fi
    return None
# </editor-fold>

# ===================================================================
# Multi-Layer Feature Extraction
# ===================================================================
device = "cpu"
model_name = "efficientnet_b0"

model = timm.create_model(model_name, pretrained=True)
config = resolve_model_data_config(model)
transform = create_transform(**config)
model.eval().to(device)

features = {}

def get_features_hook(name):
    def hook(model, input, output):
        features[name] = output.detach()
    return hook

handle3 = model.blocks[3].register_forward_hook(get_features_hook('blocks[3]'))
handle5 = model.blocks[5].register_forward_hook(get_features_hook('blocks[5]'))

def extract_features(image: Image.Image):
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

# <editor-fold desc="Helpers, Projections, Models, Basic Endpoints">
# -------------------------------
# Helper Functions
# -------------------------------
def load_annotations():
    if not os.path.exists(ANNOTATIONS_FILE):
        return []
    try:
        with open(ANNOTATIONS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []

def save_annotations(data):
    with open(ANNOTATIONS_FILE, "w") as f:
        json.dump(data, f, indent=2)

class MercatorProjection:
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

        tile_transform = from_bounds(
            tile_lng_min, tile_lat_min, tile_lng_max, tile_lat_max, 256, 256
        )
        
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

class Annotation(BaseModel):
    id: str
    dataset: str
    geojson: dict
    label: str
    embedding: List[float] = []

class SimilarRequest(BaseModel):
    annotation_id: str
    dataset: str
    geojson: dict

class SimilarMoreRequest(BaseModel):
    annotation_id: str
    dataset: str
    geojson: dict
    exclude_zooms: List[int] # New field to specify which zooms to skip

def latlng_to_tilexy(lat, lng, zoom):
    n = 2**zoom
    x = int((lng + 180.0) / 360.0 * n)
    y = int(
        (1.0 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat)))
         / math.pi) / 2.0 * n
    )
    return x, y
    
@app.get("/")
def read_root():
    return {"message": "Welcome to my API 🚀"}

@app.get("/favicon.ico")
async def favicon():
    return Response(content=b"", media_type="image/x-icon")

@app.get("/tiles/{dataset}/{z}/{x}/{y}.webp")
def get_tile(dataset: str, z: int, x: int, y: int):
    path = os.path.join(TILES_ROOT, dataset, str(z), str(x), f"{y}.webp")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Tile not found: {path}")
    return FileResponse(path, media_type="image/webp")

@app.get("/annotations")
def get_annotations():
    return load_annotations()
# </editor-fold>

# <editor-fold desc="Annotation CRUD and Startup Event">
@app.post("/annotations")
def save_annotation(annotation: Annotation):
    coords = annotation.geojson["geometry"]["coordinates"]
    if annotation.geojson['geometry']['type'] == "Point":
        lng, lat = coords
    else:
        all_coords = [p for poly in coords for p in poly]
        lats = [pt[1] for pt in all_coords]
        lngs = [pt[0] for pt in all_coords]
        lat = sum(lats) / len(lats)
        lng = sum(lngs) / len(lngs)
    
    zoom_found, tile_path, tx, ty = None, None, None, None
    
    for test_zoom in range(1, 8):
        temp_tx, temp_ty = latlng_to_tilexy(lat, lng, test_zoom)
        test_path = os.path.join(
            TILES_ROOT, annotation.dataset, str(test_zoom), str(temp_tx), f"{temp_ty}.webp"
        )
        if os.path.exists(test_path):
            zoom_found, tile_path, tx, ty = test_zoom, test_path, temp_tx, temp_ty
            break
    
    if not tile_path:
        raise HTTPException(status_code=404, detail="No tile found for annotation at any zoom level")

    img = Image.open(tile_path).convert("RGB")
    
    bbox = projection.get_pixel_bbox_on_tile(annotation.geojson, zoom_found, tx, ty)
    if bbox is None:
        raise HTTPException(status_code=400, detail="Annotation does not appear to be on the calculated tile.")
    
    cropped_img = img.crop(bbox)
    
    if cropped_img.size[0] > 0 and cropped_img.size[1] > 0:
        model_input_size = config['input_size'][1:]
        cropped_img = cropped_img.resize(model_input_size, Image.LANCZOS)
        annotation.embedding = extract_features(cropped_img).tolist()

    data = load_annotations()
    data.append(annotation.dict())
    save_annotations(data)
    return {"status": "saved", "zoom_used": zoom_found}


@app.put("/annotations/{annotation_id}")
def update_annotation(annotation_id: str, annotation: dict = Body(...)):
    data = load_annotations()
    for i, a in enumerate(data):
        if a["id"] == annotation_id:
            data[i].update(annotation)
            save_annotations(data)
            return {"status": "updated", "annotation": data[i]}
    raise HTTPException(status_code=404, detail="Annotation not found")

@app.delete("/annotations/{annotation_id}")
def delete_annotation(annotation_id: str):
    data = load_annotations()
    new_data = [a for a in data if a["id"] != annotation_id]
    save_annotations(new_data)
    return {"status": "deleted"}

@app.on_event("startup")
async def startup_event():
    global faiss_indexes
    print("Checking for cached Faiss indexes...")

    for dataset in os.listdir(TILES_ROOT):
        dataset_path = os.path.join(TILES_ROOT, dataset)
        if not os.path.isdir(dataset_path):
            continue
        
        for zoom_str in os.listdir(dataset_path):
            zoom_path = os.path.join(dataset_path, zoom_str)
            if not os.path.isdir(zoom_path):
                continue
            try:
                zoom = int(zoom_str)
            except ValueError:
                continue
            
            index_key = (dataset, zoom)
            fi = load_faiss_index(dataset, zoom)
            if fi:
                faiss_indexes[index_key] = fi
                print(f"Loaded Faiss index for dataset '{dataset}' at zoom {zoom} with {fi.index.ntotal} vectors ✅")
                continue

            print(f"No cached index found for '{dataset}' at zoom {zoom}. Building from tiles...")
            all_embeddings = []
            all_tile_info = []

            for x_str in os.listdir(zoom_path):
                x_path = os.path.join(zoom_path, x_str)
                if not os.path.isdir(x_path):
                    continue
                for y_file in os.listdir(x_path):
                    if not y_file.endswith(".webp"):
                        continue
                    try:
                        y = int(y_file.split(".")[0])
                        x = int(x_str)
                        tile_path = os.path.join(zoom_path, x_str, y_file)

                        img = Image.open(tile_path).convert("RGB")
                        emb = extract_features(img)
                        all_embeddings.append(emb)
                        all_tile_info.append((dataset, zoom, x, y))
                    except Exception as e:
                        print(f"Error processing tile {tile_path}: {e}")
            
            if all_embeddings:
                dummy_img = Image.new("RGB", (224, 224), "white")
                d = extract_features(dummy_img).shape[0]
                fi = FaissIndex(d)
                fi.build_index(all_embeddings, all_tile_info)
                save_faiss_index(fi, dataset, zoom)
                faiss_indexes[index_key] = fi
                print(f"Faiss index built & saved for dataset '{dataset}' at zoom {zoom} with {fi.index.ntotal} vectors ✅")
            else:
                print(f"No tiles found to build Faiss index for '{dataset}' at zoom {zoom} ❌")
# </editor-fold>

# ===================================================================
# Final Search Endpoint: Multi-Layer Features + Single-Zoom Search
# ===================================================================
@app.post("/annotations/similar")
def find_similar_by_feature(
    req: SimilarRequest,
    zoom: int,
    top_k: int
):
    global faiss_indexes
    # Reverted to single-zoom: use the zoom level from the user's viewport
    index_key = (req.dataset, zoom)

    if index_key not in faiss_indexes:
        raise HTTPException(status_code=404, detail=f"No Faiss index for dataset '{req.dataset}' at zoom {zoom}.")
    
    faiss_index = faiss_indexes[index_key]
    feature_shape = shape(req.geojson['geometry'])
    
    # Stitch the query image from the user's current zoom level
    min_lng, min_lat, max_lng, max_lat = feature_shape.bounds
    min_tx, min_ty = latlng_to_tilexy(max_lat, min_lng, zoom)
    max_tx, max_ty = latlng_to_tilexy(min_lat, max_lng, zoom)

    cropped_pieces = []
    for tx in range(min_tx, max_tx + 1):
        for ty in range(min_ty, max_ty + 1):
            tile_path = os.path.join(TILES_ROOT, req.dataset, str(zoom), str(tx), f"{ty}.webp")
            if not os.path.exists(tile_path):
                continue
            bbox = projection.get_pixel_bbox_on_tile(req.geojson, zoom, tx, ty)
            if bbox is None:
                continue
            tile_img = Image.open(tile_path)
            cropped_piece = tile_img.crop(bbox)
            relative_x, relative_y = (tx - min_tx) * 256, (ty - min_ty) * 256
            cropped_pieces.append({
                "image": cropped_piece, "paste_x": relative_x + bbox[0], "paste_y": relative_y + bbox[1]
            })

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

    with tempfile.NamedTemporaryFile(suffix=".webp", delete=False) as tmp_file:
        padded_img.save(tmp_file.name)
        print(f"Saved stitched query image to: {tmp_file.name}")

    # Use the multi-layer feature extractor
    query_emb = extract_features(padded_img)

    # Perform a wider search and apply thresholding
    initial_search_k = max(50, top_k * 5)
    initial_results = faiss_index.search(query_emb, initial_search_k)

    high_confidence_results = []
    medium_confidence_results = []
    for res in initial_results:
        if res["score"] > 0.75:
            high_confidence_results.append(res)
        elif res["score"] > 0.70:
            medium_confidence_results.append(res)
    
    final_results = high_confidence_results + medium_confidence_results[:top_k]
    
    return {
        "query_feature_bounds": [min_lng, min_lat, max_lng, max_lat],
        "similar_tiles": final_results,
    }


@app.post("/annotations/similar/more")
def find_similar_by_feature_more(
    req: SimilarMoreRequest, # Use the new request model
    top_k: int
):
    global faiss_indexes
    
    # Create the query vector using the same robust method as before
    QUERY_ZOOM_LEVEL = 5 
    feature_shape = shape(req.geojson['geometry'])
    min_lng, min_lat, max_lng, max_lat = feature_shape.bounds
    min_tx, min_ty = latlng_to_tilexy(max_lat, min_lng, QUERY_ZOOM_LEVEL)
    max_tx, max_ty = latlng_to_tilexy(min_lat, max_lng, QUERY_ZOOM_LEVEL)

    # ... (The entire stitching logic to create the query image is the same) ...
    # <editor-fold desc="Stitching Logic">
    cropped_pieces = []
    for tx in range(min_tx, max_tx + 1):
        for ty in range(min_ty, max_ty + 1):
            tile_path = os.path.join(TILES_ROOT, req.dataset, str(QUERY_ZOOM_LEVEL), str(tx), f"{ty}.webp")
            if not os.path.exists(tile_path):
                continue
            bbox = projection.get_pixel_bbox_on_tile(req.geojson, QUERY_ZOOM_LEVEL, tx, ty)
            if bbox is None:
                continue
            tile_img = Image.open(tile_path)
            cropped_piece = tile_img.crop(bbox)
            relative_x, relative_y = (tx - min_tx) * 256, (ty - min_ty) * 256
            cropped_pieces.append({
                "image": cropped_piece, "paste_x": relative_x + bbox[0], "paste_y": relative_y + bbox[1]
            })
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
    # </editor-fold>
    
    query_emb = extract_features(padded_img)

    # Search all zoom levels, but EXCLUDE the ones specified by the frontend
    all_results = []
    initial_search_k = max(50, top_k * 5)

    for index_key, faiss_index in faiss_indexes.items():
        dataset_name, zoom_level = index_key
        # THE KEY CHANGE: Skip zooms that have already been searched
        if dataset_name == req.dataset and zoom_level not in req.exclude_zooms:
            print(f"Searching deeper in index for zoom level {zoom_level}...")
            results_from_zoom = faiss_index.search(query_emb, initial_search_k)
            all_results.extend(results_from_zoom)
    
    # Sort and filter the new results
    all_results.sort(key=lambda x: x["score"], reverse=True)

    high_confidence_results = []
    medium_confidence_results = []
    for res in all_results:
        if res["score"] > 0.75:
            high_confidence_results.append(res)
        elif res["score"] > 0.65:
            medium_confidence_results.append(res)
    
    final_results = high_confidence_results + medium_confidence_results[:top_k]
    
    return {"similar_tiles": final_results}

# <editor-fold desc="Get Dataset Bounds">
@app.get("/datasets/{dataset}/bounds")
def get_dataset_bounds(dataset: str):
    dataset_path = os.path.join(TILES_ROOT, dataset)
    if not os.path.exists(dataset_path):
        raise HTTPException(status_code=404, detail="Dataset not found")

    zoom_levels = {}
    for root, dirs, files in os.walk(dataset_path):
        for file in files:
            if not file.endswith(".webp"):
                continue
            parts = root.split(os.sep)
            y_file = os.path.splitext(file)[0]
            try:
                z, x, y = int(parts[-2]), int(parts[-1]), int(y_file)
            except (ValueError, IndexError):
                continue

            if z not in zoom_levels:
                zoom_levels[z] = {"min_x": x, "max_x": x, "min_y": y, "max_y": y}
            else:
                zoom_levels[z]["min_x"] = min(zoom_levels[z]["min_x"], x)
                zoom_levels[z]["max_x"] = max(zoom_levels[z]["max_x"], x)
                zoom_levels[z]["min_y"] = min(zoom_levels[z]["min_y"], y)
                zoom_levels[z]["max_y"] = max(zoom_levels[z]["max_y"], y)

    if not zoom_levels:
        raise HTTPException(status_code=404, detail="No tiles found")

    zoom = max(zoom_levels.keys())
    bounds_info = zoom_levels[zoom]
    
    south = MercatorProjection.tileYToLat(bounds_info["max_y"] + 1, zoom)
    north = MercatorProjection.tileYToLat(bounds_info["min_y"], zoom)
    west = MercatorProjection.tileXToLng(bounds_info["min_x"], zoom)
    east = MercatorProjection.tileXToLng(bounds_info["max_x"] + 1, zoom)

    return {
        "zoom": zoom, 
        "bounds": [[south, west], [north, east]],
        "available_zooms": sorted(zoom_levels.keys())
    }
# </editor-fold>