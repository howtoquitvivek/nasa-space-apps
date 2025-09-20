import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TILES_ROOT = os.path.join(BASE_DIR, "data")
dataset = "mars"

dataset_path = os.path.join(TILES_ROOT, dataset)
print("Looking for:", dataset_path)
print("Exists:", os.path.exists(dataset_path))
print("Contents:", os.listdir(dataset_path) if os.path.exists(dataset_path) else "Not found")
