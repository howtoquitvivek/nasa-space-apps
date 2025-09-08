from fastapi import FastAPI, HTTPException, Body
from fastapi.responses import FileResponse,  Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, json, math
from typing import List
from PIL import Image
import torch
import torch.nn as nn
from torchvision.models import resnet18, ResNet18_Weights
import torchvision.transforms as transforms
from sklearn.metrics.pairwise import cosine_similarity

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

# -------------------------------
# PyTorch ResNet18 Feature Extractor
# -------------------------------
device = "cpu"  # CPU only for now
weights = ResNet18_Weights.DEFAULT
resnet = resnet18(weights=weights)
resnet = nn.Sequential(*list(resnet.children())[:-1])  # remove classifier
resnet.eval().to(device)

transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406], 
        std=[0.229, 0.224, 0.225]
    )
])

def extract_features(image: Image.Image):
    img_t = transform(image).unsqueeze(0).to(device)
    with torch.no_grad():
        feat = resnet(img_t).squeeze().cpu().numpy()
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
    if not os.path.exists(ANNOTATIONS_FILE):
        return []
    with open(ANNOTATIONS_FILE, "r") as f:
        return json.load(f)

def save_annotations(data):
    with open(ANNOTATIONS_FILE, "w") as f:
        json.dump(data, f, indent=2)

def latlng_to_tilexy(lat, lng, zoom):
    n = 2 ** zoom
    x = int((lng + 180.0) / 360.0 * n)
    y = int((1.0 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2.0 * n)
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
    # Compute centroid crop
    coords = annotation.geojson["geometry"]["coordinates"][0]  # polygon
    lats = [pt[1] for pt in coords]
    lngs = [pt[0] for pt in coords]
    centroid_lat = sum(lats) / len(lats)
    centroid_lng = sum(lngs) / len(lngs)

    tx, ty = latlng_to_tilexy(centroid_lat, centroid_lng, FIXED_ZOOM)
    tile_path = os.path.join(TILES_ROOT, annotation.dataset, str(FIXED_ZOOM), str(tx), f"{ty}.webp")
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
# Tile similarity search via GET
# -------------------------------
@app.get("/tiles/{dataset}/similar")
def find_similar_tile(
    dataset: str,
    lat: float,
    lng: float,
    zoom: int = FIXED_ZOOM,
    top_k: int = TOP_K
):
    tx, ty = latlng_to_tilexy(lat, lng, zoom)
    query_emb = get_tile_embedding(dataset, zoom, tx, ty)
    if query_emb is None:
        raise HTTPException(status_code=404, detail="Tile not found at given location")

    # Compare against all tiles at this zoom level
    similar_tiles = []
    zoom_dir = os.path.join(TILES_ROOT, dataset, str(zoom))
    if not os.path.exists(zoom_dir):
        raise HTTPException(status_code=404, detail="No tiles found for this zoom level")

    for x_str in os.listdir(zoom_dir):
        x_path = os.path.join(zoom_dir, x_str)
        if not os.path.isdir(x_path):
            continue
        for y_file in os.listdir(x_path):
            if not y_file.endswith(".webp"):
                continue
            y = int(y_file.split(".")[0])
            x = int(x_str)
            emb = get_tile_embedding(dataset, zoom, x, y)
            if emb is None:
                continue
            score = cosine_similarity(query_emb.reshape(1, -1), emb.reshape(1, -1))[0][0]
            similar_tiles.append({"z": zoom, "x": x, "y": y, "score": float(score)})

    similar_tiles.sort(key=lambda t: t["score"], reverse=True)
    return {"lat": lat, "lng": lng, "zoom": zoom, "similar_tiles": similar_tiles[:top_k]}
