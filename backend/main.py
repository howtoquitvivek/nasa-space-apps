from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, json, math
from typing import List
from PIL import Image
import torch
import torch.nn as nn
import numpy as np
import timm
from timm.data import resolve_model_data_config
from timm.data.transforms_factory import create_transform
import faiss

app = FastAPI()

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
FIXED_ZOOM = 4
TOP_K = 5  # default top-K similar tiles

FAISS_INDEX_FILE = os.path.join(BASE_DIR, "faiss.index")
TILE_MAP_FILE = os.path.join(BASE_DIR, "tile_map.json")
EMBEDDINGS_FILE = os.path.join(BASE_DIR, "embeddings.npy")

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


# Global Faiss index
faiss_index: FaissIndex | None = None


# -------------------------------
# Save/Load Faiss Index
# -------------------------------
def save_faiss_index(faiss_index: "FaissIndex"):
    faiss.write_index(faiss_index.index, FAISS_INDEX_FILE)
    with open(TILE_MAP_FILE, "w") as f:
        json.dump(faiss_index.tile_map, f)
    if faiss_index.embeddings is not None:
        np.save(EMBEDDINGS_FILE, faiss_index.embeddings)


def load_faiss_index():
    if (
        os.path.exists(FAISS_INDEX_FILE)
        and os.path.exists(TILE_MAP_FILE)
        and os.path.exists(EMBEDDINGS_FILE)
    ):
        index = faiss.read_index(FAISS_INDEX_FILE)
        with open(TILE_MAP_FILE, "r") as f:
            tile_map = json.load(f)
        embeddings = np.load(EMBEDDINGS_FILE)
        fi = FaissIndex(index.d)
        fi.index = index
        fi.tile_map = [tuple(x) for x in tile_map]
        fi.embeddings = embeddings
        return fi
    return None



# -------------------------------
# PyTorch EfficientNet Feature Extractor
# -------------------------------
device = "cpu"  # CPU only
model_name = "efficientnet_b0"

model = timm.create_model(model_name, pretrained=True)
config = resolve_model_data_config(model)
transform = create_transform(**config)
model = nn.Sequential(*list(model.children())[:-1])
model.eval().to(device)


def extract_features(image: Image.Image):
    img_t = transform(image.convert("RGB")).unsqueeze(0).to(device)
    with torch.no_grad():
        feat = model(img_t).squeeze().cpu().numpy()
    return feat


# -------------------------------
# Tile embedding cache
# -------------------------------
tile_embeddings_cache = {}  # { zoom_level: { (x, y): embedding } }


def get_tile_embedding(dataset: str, z: int, x: int, y: int):
    if z not in tile_embeddings_cache:
        tile_embeddings_cache[z] = {}
    key = (x, y)
    if key in tile_embeddings_cache[z]:
        return tile_embeddings_cache[z][key]

    tile_path = os.path.join(TILES_ROOT, dataset, str(z), str(x), f"{y}.webp")
    if not os.path.exists(tile_path):
        return None

    img = Image.open(tile_path).convert("RGB")
    emb = extract_features(img)
    tile_embeddings_cache[z][key] = emb
    return emb


# -------------------------------
# Helper Functions
# -------------------------------
def load_annotations():
    """Load annotations from file, return [] if missing or invalid"""
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


def latlng_to_tilexy(lat, lng, zoom):
    n = 2**zoom
    x = int((lng + 180.0) / 360.0 * n)
    y = int(
        (1.0 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat)))
         / math.pi) / 2.0 * n
    )
    return x, y


# -------------------------------
# Annotation Model
# -------------------------------
class Annotation(BaseModel):
    id: str
    dataset: str
    geojson: dict
    label: str
    embedding: List[float] = []


# -------------------------------
# API
# -------------------------------
@app.get("/")
def read_root():
    return {"message": "Welcome to my API 🚀"}


@app.get("/favicon.ico")
async def favicon():
    return Response(content=b"", media_type="image/x-icon")


# -------------------------------
# Tiles API
# -------------------------------
@app.get("/tiles/{dataset}/{z}/{x}/{y}.webp")
def get_tile(dataset: str, z: int, x: int, y: int):
    path = os.path.join(TILES_ROOT, dataset, str(z), str(x), f"{y}.webp")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Tile not found: {path}")
    return FileResponse(path, media_type="image/webp")


# -------------------------------
# CRUD for Annotations
# -------------------------------
@app.get("/annotations")
def get_annotations():
    return load_annotations()


@app.post("/annotations")
def save_annotation(annotation: Annotation):
    coords = annotation.geojson["geometry"]["coordinates"][0]  # polygon
    lats = [pt[1] for pt in coords]
    lngs = [pt[0] for pt in coords]
    centroid_lat = sum(lats) / len(lats)
    centroid_lng = sum(lngs) / len(lngs)

    tx, ty = latlng_to_tilexy(centroid_lat, centroid_lng, FIXED_ZOOM)
    tile_path = os.path.join(
        TILES_ROOT, annotation.dataset, str(FIXED_ZOOM), str(tx), f"{ty}.webp"
    )
    if not os.path.exists(tile_path):
        raise HTTPException(status_code=404, detail="Tile not found for crop")

    img = Image.open(tile_path).convert("RGB")
    annotation.embedding = extract_features(img).tolist()

    data = load_annotations()
    data.append(annotation.dict())
    save_annotations(data)
    return {"status": "saved"}


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


# -------------------------------
# Startup: build or load Faiss index
# -------------------------------
@app.on_event("startup")
async def startup_event():
    global faiss_index
    print("Checking for cached Faiss index...")

    faiss_index = load_faiss_index()
    if faiss_index:
        print(f"Loaded Faiss index with {faiss_index.index.ntotal} vectors from disk ✅")
        return

    print("No cached index found. Building from tiles...")
    all_embeddings = []
    all_tile_info = []

    dummy_img = Image.new("RGB", (224, 224), "white")
    d = extract_features(dummy_img).shape[0]
    fi = FaissIndex(d)

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
        fi.build_index(all_embeddings, all_tile_info)
        save_faiss_index(fi)
        faiss_index = fi
        print(f"Faiss index built & saved with {faiss_index.index.ntotal} vectors ✅")
    else:
        print("No tiles found to build Faiss index ❌")


# -------------------------------
# Find Similar Tiles
# -------------------------------
@app.get("/tiles/{dataset}/similar")
def find_similar_tile_with_faiss(
    dataset: str,
    lat: float,
    lng: float,
    zoom: int = FIXED_ZOOM,
    top_k: int = TOP_K,
):
    global faiss_index
    if faiss_index is None:
        raise HTTPException(status_code=503, detail="Faiss index not yet built.")

    tx, ty = latlng_to_tilexy(lat, lng, zoom)

    # Find index of this tile in the Faiss tile_map
    query_idx = None
    for i, info in enumerate(faiss_index.tile_map):
        if info == (dataset, zoom, tx, ty):
            query_idx = i
            break

    if query_idx is None:
        raise HTTPException(status_code=404, detail="Tile not found at given location.")

    query_emb = faiss_index.embeddings[query_idx]
    similar_tiles = faiss_index.search(query_emb, top_k + 1)

    # Remove the query tile itself
    similar_tiles = [
        t for t in similar_tiles if not (t["x"] == tx and t["y"] == ty)
    ]

    return {
        "lat": lat,
        "lng": lng,
        "zoom": zoom,
        "similar_tiles": similar_tiles[:top_k],
    }




@app.get("/datasets/{dataset}/bounds")
def get_dataset_bounds(dataset: str):
    dataset_path = os.path.join(TILES_ROOT, dataset)
    if not os.path.exists(dataset_path):
        raise HTTPException(status_code=404, detail="Dataset not found")

    zoom_levels = {}

    # Collect all tiles grouped by zoom
    for root, dirs, files in os.walk(dataset_path):
        for file in files:
            if not file.endswith(".webp"):
                continue

            parts = root.split(os.sep)
            y_file = os.path.splitext(file)[0]

            try:
                # If structure is dataset/zoom/x/y.webp
                z = int(parts[-2]) if len(parts) >= 2 and parts[-2].isdigit() else int(parts[-1])
                x = int(parts[-1]) if len(parts) >= 2 and parts[-2].isdigit() else 0
                y = int(y_file)
            except Exception:
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

    # Use highest zoom level
    zoom = max(zoom_levels.keys())
    min_x, max_x = zoom_levels[zoom]["min_x"], zoom_levels[zoom]["max_x"]
    min_y, max_y = zoom_levels[zoom]["min_y"], zoom_levels[zoom]["max_y"]

    def tileXToLng(x, z):
        return (x / 2**z) * 360.0 - 180.0

    def tileYToLat(y, z):
        n = math.pi - (2.0 * math.pi * y) / (2**z)
        return (180.0 / math.pi) * math.atan(math.sinh(n))

    south = tileYToLat(max_y + 1, zoom)
    north = tileYToLat(min_y, zoom)
    west = tileXToLng(min_x, zoom)
    east = tileXToLng(max_x + 1, zoom)

    return {"zoom": zoom, "bounds": [[south, west], [north, east]]}
