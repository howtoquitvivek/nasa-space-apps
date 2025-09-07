from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Body
from pydantic import BaseModel
import os, json

app = FastAPI()

# Allow frontend (localhost:5500) to access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tiles path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES_ROOT = os.path.join(BASE_DIR, "data")

ANNOTATIONS_FILE = os.path.join(BASE_DIR, "annotations.json")

class Annotation(BaseModel):
    id: str
    dataset: str
    geojson: dict
    label: str

# --- Tile Serving ---
@app.get("/tiles/{dataset}/{z}/{x}/{y}.webp")
def get_tile(dataset: str, z: int, x: int, y: int):
    path = os.path.join(TILES_ROOT, dataset, str(z), str(x), f"{y}.webp")
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Tile not found: {path}")
    return FileResponse(path, media_type="image/webp")

# --- Annotations API ---
@app.get("/annotations")
def get_annotations():
    if not os.path.exists(ANNOTATIONS_FILE):
        return []
    with open(ANNOTATIONS_FILE, "r") as f:
        return json.load(f)

@app.post("/annotations")
def save_annotation(annotation: Annotation):
    data = []
    if os.path.exists(ANNOTATIONS_FILE):
        with open(ANNOTATIONS_FILE, "r") as f:
            data = json.load(f)
    data.append(annotation.dict())
    with open(ANNOTATIONS_FILE, "w") as f:
        json.dump(data, f, indent=2)
    return {"status": "saved"}

@app.put("/annotations/{annotation_id}")
def update_annotation(annotation_id: str, annotation: dict = Body(...)):
    """
    Update an annotation by ID. Expects a JSON body with the fields to update,
    e.g., {"label": "New label"}.
    """
    if not os.path.exists(ANNOTATIONS_FILE):
        raise HTTPException(status_code=404, detail="No annotations found")

    with open(ANNOTATIONS_FILE, "r") as f:
        data = json.load(f)

    for i, a in enumerate(data):
        if a["id"] == annotation_id:
            # Update only the fields provided in request body
            data[i].update(annotation)
            with open(ANNOTATIONS_FILE, "w") as f:
                json.dump(data, f, indent=2)
            return {"status": "updated", "annotation": data[i]}

    raise HTTPException(status_code=404, detail="Annotation not found")

@app.delete("/annotations/{annotation_id}")
def delete_annotation(annotation_id: str):
    if not os.path.exists(ANNOTATIONS_FILE):
        return {"status": "not_found"}
    with open(ANNOTATIONS_FILE, "r") as f:
        data = json.load(f)
    new_data = [a for a in data if a["id"] != annotation_id]
    with open(ANNOTATIONS_FILE, "w") as f:
        json.dump(new_data, f, indent=2)
    return {"status": "deleted"}
