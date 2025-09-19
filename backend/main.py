from fastapi import FastAPI, HTTPException, Body, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os, json, math, pickle, uuid
from typing import List, Dict, Optional
from PIL import Image
import torch
import torch.nn as nn
from torchvision.models import resnet18, ResNet18_Weights
import torchvision.transforms as transforms
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from datetime import datetime

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
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
TILES_ROOT = os.path.join(PROJECT_ROOT, "data")
ANNOTATIONS_FILE = os.path.join(PROJECT_ROOT, "annotations.json")
PROJECTS_FILE = os.path.join(PROJECT_ROOT, "projects.json")
FIXED_ZOOM = 4
TOP_K = 5

# -------------------------------
# Helper Functions
# -------------------------------
def load_json(file_path, default_data):
    if not os.path.exists(file_path): return default_data
    try:
        with open(file_path, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return default_data

def save_json(file_path, data):
    with open(file_path, "w") as f:
        json.dump(data, f, indent=2)

def latlng_to_tilexy(lat, lng, zoom):
    n = 2 ** zoom
    x = int((lng + 180.0) / 360.0 * n)
    y = int((1.0 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2.0 * n)
    return x, y

# -------------------------------
# In-memory Storage
# -------------------------------
projects_db = load_json(PROJECTS_FILE, {})
active_users = {}

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, Dict[str, WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, project_id: str, user_id: str):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = {}
        self.active_connections[project_id][user_id] = websocket
    
    def disconnect(self, project_id: str, user_id: str):
        if project_id in self.active_connections:
            if user_id in self.active_connections[project_id]:
                del self.active_connections[project_id][user_id]
            if not self.active_connections[project_id]:
                del self.active_connections[project_id]
        if project_id in active_users and user_id in active_users[project_id]:
            del active_users[project_id][user_id]
    
    async def broadcast_to_project(self, project_id: str, message: dict, exclude_user: str = None):
        if project_id not in self.active_connections: return
        
        # Use a list to avoid issues with modifying the dictionary while iterating
        for user_id, connection in list(self.active_connections.get(project_id, {}).items()):
            if user_id != exclude_user:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception:
                    # Handle disconnection gracefully
                    self.disconnect(project_id, user_id)
    
    def get_active_users(self, project_id: str) -> List[dict]:
        return list(active_users.get(project_id, {}).values())

manager = ConnectionManager()



# -------------------------------
# Pydantic Models
# -------------------------------
class Annotation(BaseModel):
    id: str; dataset: str; geojson: dict; label: str
    embedding: List[float] = []; project_id: Optional[str] = None

class ProjectCreate(BaseModel):
    name: str; description: Optional[str] = None

class WorkspaceUpdate(BaseModel):
    dataset: str; lat: float; lng: float; zoom: int

# -------------------------------
# API Endpoints
# -------------------------------
@app.post("/api/projects")
async def create_project(project: ProjectCreate):
    project_id = str(uuid.uuid4())[:8]
    project_data = {
        "id": project_id, "name": project.name, "description": project.description or "",
        "created_at": datetime.now().isoformat(),
        # NEW: Default workspace state
        "workspace": {"dataset": "mars", "lat": 0, "lng": 0, "zoom": 2}
    }
    projects_db[project_id] = project_data
    save_json(PROJECTS_FILE, projects_db)
    return {"project": project_data, "join_url": f"?project={project_id}"}

@app.get("/api/projects/{project_id}")
async def get_project(project_id: str):
    if project_id not in projects_db: raise HTTPException(404, "Project not found")
    return {"project": projects_db[project_id], "active_users": manager.get_active_users(project_id)}

# NEW: Endpoint to save the workspace state
@app.put("/api/projects/{project_id}/workspace")
async def update_workspace(project_id: str, workspace: WorkspaceUpdate):
    if project_id not in projects_db: raise HTTPException(404, "Project not found")
    projects_db[project_id]["workspace"] = workspace.dict()
    save_json(PROJECTS_FILE, projects_db)
    # Notify other users about the workspace change
    await manager.broadcast_to_project(project_id, {"type": "workspace_updated", "workspace": workspace.dict()})
    return {"status": "workspace saved"}

@app.websocket("/ws/{project_id}/{user_id}")
async def websocket_endpoint(websocket: WebSocket, project_id: str, user_id: str):
    await manager.connect(websocket, project_id, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Add user_id to every message for context
            message_to_broadcast = {"user_id": user_id, **message}

            # Handle different message types
            if message.get("type") == "user_info":
                if project_id not in active_users: active_users[project_id] = {}
                active_users[project_id][user_id] = {"id": user_id, **message}
                await manager.broadcast_to_project(project_id, {"type": "user_joined", "user": active_users[project_id][user_id]}, exclude_user=user_id)
                await websocket.send_text(json.dumps({"type": "active_users", "users": manager.get_active_users(project_id)}))
            else:
                # General broadcast for other message types (cursor_update, view_sync etc.)
                await manager.broadcast_to_project(project_id, message_to_broadcast, exclude_user=user_id)
                
    except WebSocketDisconnect:
        manager.disconnect(project_id, user_id)
        await manager.broadcast_to_project(project_id, {"type": "user_left", "user_id": user_id})

@app.get("/")
def read_root(): return {"message": "Welcome to Anveshak API 🚀"}

@app.get("/tiles/{dataset}/{z}/{x}/{y}.webp")
def get_tile(dataset: str, z: int, x: int, y: int):
    path = os.path.join(TILES_ROOT, dataset, str(z), str(x), f"{y}.webp")
    if not os.path.exists(path): raise HTTPException(status_code=404)
    return FileResponse(path)

@app.get("/annotations")
def get_annotations(): return load_json(ANNOTATIONS_FILE, [])

@app.post("/annotations")
async def save_annotation(annotation: Annotation):
    coords = annotation.geojson["geometry"]["coordinates"][0]
    clat = sum(p[1] for p in coords) / len(coords)
    clng = sum(p[0] for p in coords) / len(coords)
    tx, ty = latlng_to_tilexy(clat, clng, FIXED_ZOOM)
    tpath = os.path.join(TILES_ROOT, annotation.dataset, str(FIXED_ZOOM), str(tx), f"{ty}.webp")
    if AI_FEATURES_ENABLED and os.path.exists(tpath):
        annotation.embedding = extract_features(Image.open(tpath).convert("RGB")).tolist()
    
    annotations = load_json(ANNOTATIONS_FILE, [])
    annotations.append(annotation.dict())
    save_json(ANNOTATIONS_FILE, annotations)

    if annotation.project_id:
        await manager.broadcast_to_project(annotation.project_id, {"type": "annotation_created", "annotation": annotation.dict()})
    return {"status": "saved", "annotation": annotation.dict()}

@app.delete("/annotations/{annotation_id}")
async def delete_annotation(annotation_id: str, project_id: Optional[str] = None):
    annotations = load_json(ANNOTATIONS_FILE, [])
    new_annotations = [a for a in annotations if a["id"] != annotation_id]
    save_json(ANNOTATIONS_FILE, new_annotations)
    if project_id:
        await manager.broadcast_to_project(project_id, {"type": "annotation_deleted", "annotation_id": annotation_id})
    return {"status": "deleted"}