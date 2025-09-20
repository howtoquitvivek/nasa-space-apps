import requests
import json
import os
import time
import xml.etree.ElementTree as ET
import math

# --- CONFIGURATION ---
CATALOG_API_URL = "https://trek.nasa.gov/mars/TrekServices/ws/index/eq/searchItems?proj=eq&start=0&rows=5000&facetKeys=instrument%7CproductCat1&facetValues=CTX%7CImagery&intersects=true"
LAYER_SERVICE_API_TEMPLATE = "https://trek.nasa.gov/mars/TrekServices/ws/index/getLayerServices?uuid={}"
OUTPUT_PATH = os.path.join("frontend", "static", "ctx_footprints.json")

# Mapping footprint titles → public mosaic dataset names
DATASET_MAP = {
    "MRO CTX, 22n048w Mosaic": "Viking_CTX_BlockAdj_dd",
    "MRO CTX, Acheron Fossae Mosaic": "Acheron_Fossae_CTX_BlockAdj_dd",
    # Add more mappings as needed
}

def safe_int(value):
    """Safely convert string to int"""
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return 0

def extract_zoom_levels(xml_root):
    """Extract all available zoom levels and their dimensions from WMTS capabilities"""
    if xml_root is None:
        return []
    namespaces = {"wmts": "http://www.opengis.net/wmts/1.0", "ows": "http://www.opengis.net/ows/1.1"}
    contents = xml_root.find("wmts:Contents", namespaces)
    if contents is None:
        return []
    
    zoom_levels = []
    # Assumes the first TileMatrixSet is the one we want
    tile_matrix_set = contents.find("wmts:TileMatrixSet", namespaces)
    if tile_matrix_set is not None:
        for tm in tile_matrix_set.findall("wmts:TileMatrix", namespaces):
            zoom_info = {
                "zoomLevel": safe_int(tm.findtext("ows:Identifier", default="0", namespaces=namespaces)),
                "matrixWidth": safe_int(tm.findtext("wmts:MatrixWidth", default="0", namespaces=namespaces)),
                "matrixHeight": safe_int(tm.findtext("wmts:MatrixHeight", default="0", namespaces=namespaces))
            }
            zoom_levels.append(zoom_info)
            
    # Filter to only include the zoom levels relevant for high-res imagery
    return [z for z in zoom_levels if 6 <= z["zoomLevel"] <= 13]

def deg2num(lat_deg, lon_deg, zoom):
    """Calculates tile x, y from lat/lon using Web Mercator math"""
    lat_rad = math.radians(lat_deg)
    n = 2.0 ** zoom
    xtile = int((lon_deg + 180.0) / 360.0 * n)
    ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
    return (xtile, ytile)

def calculate_tiles_per_zoom(zoom_levels, bbox):
    """Calculate bbox-specific tile ranges and counts for each zoom level"""
    min_lon, min_lat, max_lon, max_lat = bbox
    tiles_per_zoom = {}

    for zoom in zoom_levels:
        zl = zoom["zoomLevel"]
        
        # NOTE: We no longer need matrixWidth/Height as the formula is standard
        # tx_min, ty_max are from the bottom-left corner
        # tx_max, ty_min are from the top-right corner
        tx_min, ty_max = deg2num(min_lat, min_lon, zl)
        tx_max, ty_min = deg2num(max_lat, max_lon, zl)

        # Ensure min is not greater than max after calculation
        if tx_min > tx_max or ty_min > ty_max:
            continue
            
        tile_count = (tx_max - tx_min + 1) * (ty_max - ty_min + 1)
        tiles_per_zoom[str(zl)] = {
            "xRange": [tx_min, tx_max],
            "yRange": [ty_min, ty_max],
            "count": tile_count
        }
    return tiles_per_zoom



def fetch_and_process_footprints(limit=None):
    """Fetch CTX footprints and calculate correct tile download information"""
    print(f"STEP 1: Fetching master catalog from: {CATALOG_API_URL}")
    try:
        response = requests.get(CATALOG_API_URL)
        response.raise_for_status()
        catalog_data = response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error: Failed to fetch master catalog. {e}")
        return

    footprint_docs = catalog_data.get("response", {}).get("docs", [])
    print(f"Found {len(footprint_docs)} total footprints in the catalog.")
    if limit:
        footprint_docs = footprint_docs[:limit]
        print(f"Limiting to top {limit} footprints for processing.")

    processed = []
    for i, item in enumerate(footprint_docs):
        uuid = item.get("item_UUID")
        title = item.get("title")
        bbox_str = item.get("bbox")

        if not (uuid and title and bbox_str):
            print(f"  ({i+1}/{limit or len(footprint_docs)}) Skipping invalid item.")
            continue

        print(f"  ({i+1}/{limit or len(footprint_docs)}) Processing: {title}")

        try:
            layer_url = LAYER_SERVICE_API_TEMPLATE.format(uuid)
            layer_res = requests.get(layer_url)
            layer_res.raise_for_status()
            layer_data = layer_res.json()
            
            docs = layer_data.get("response", {}).get("docs", [])
            if not docs:
                print("    - No layer service docs found. Skipping.")
                continue
            
            tile_endpoint = docs[0].get("endPoint")
            if not tile_endpoint:
                print("    - No tile endpoint found. Skipping.")
                continue

            bbox = [float(c) for c in bbox_str.split(",")]
            dataset_name = DATASET_MAP.get(title)
            
            # Corrected URL format to {z}/{y}/{x}
            if dataset_name:
                tile_url_template = f"https://trek.nasa.gov/tiles/Mars/EQ/{dataset_name}/1.0.0//default/default028mm/{{z}}/{{y}}/{{x}}.png"
                capabilities_url = f"https://trek.nasa.gov/tiles/Mars/EQ/{dataset_name}/1.0.0/WMTSCapabilities.xml"
            else:
                tile_url_template = f"{tile_endpoint}/1.0.0/default/default028mm/{{z}}/{{y}}/{{x}}.png"
                capabilities_url = f"{tile_endpoint}/1.0.0/WMTSCapabilities.xml"

            footprint = {
                "id": uuid,
                "title": title,
                "bbox": bbox,
                "tileUrl": tile_url_template,
                "capabilitiesUrl": capabilities_url
            }

            cap_res = requests.get(capabilities_url)
            cap_res.raise_for_status()
            xml_root = ET.fromstring(cap_res.content)
            
            zoom_levels = extract_zoom_levels(xml_root)
            if zoom_levels:
                bbox_full = [-180, -90, 180, 90]  # Mars global extent
                tiles_per_zoom = calculate_tiles_per_zoom(zoom_levels, bbox)
                footprint["downloadInfo"] = {"tilesPerZoom": tiles_per_zoom}
                print(f"    - Calculated tile ranges for zoom levels: {list(tiles_per_zoom.keys())}")
            else:
                footprint["downloadInfo"] = {"error": "No relevant zoom levels found"}
                print("    - No relevant zoom levels (6-13) found in capabilities.")

            processed.append(footprint)
            time.sleep(0.2) # Be polite to the server

        except requests.exceptions.RequestException as e:
            print(f"    - Network Error for {title}: {e}")
        except Exception as e:
            print(f"    - An unexpected error occurred for {title}: {e}")

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(processed, f, indent=2)
    print(f"\n✅ Done. Saved {len(processed)} footprints to {OUTPUT_PATH}")

if __name__ == "__main__":
    fetch_and_process_footprints(limit=10)