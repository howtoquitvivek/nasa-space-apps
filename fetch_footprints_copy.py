import requests
import json
import os
import time
import xml.etree.ElementTree as ET

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

def get_capabilities_url_from_tile_url(tile_url):
    base_url = tile_url.split('/default/')[0]
    return f"{base_url}/WMTSCapabilities.xml"

def safe_int(value):
    try:
        return int(float(value))
    except Exception:
        return 0

def extract_zoom_levels(xml_root):
    if xml_root is None:
        return []
    namespaces = {"wmts": "http://www.opengis.net/wmts/1.0", "ows": "http://www.opengis.net/ows/1.1"}
    contents = xml_root.find("wmts:Contents", namespaces)
    if contents is None:
        return []
    zoom_levels = []
    for tms in contents.findall("wmts:TileMatrixSet", namespaces):
        for tm in tms.findall("wmts:TileMatrix", namespaces):
            zoom_info = {
                "zoomLevel": safe_int(tm.findtext("ows:Identifier", default="0", namespaces=namespaces)),
                "matrixWidth": safe_int(tm.findtext("wmts:MatrixWidth", default="0", namespaces=namespaces)),
                "matrixHeight": safe_int(tm.findtext("wmts:MatrixHeight", default="0", namespaces=namespaces))
            }
            zoom_levels.append(zoom_info)
        break  # only take first TMS
    # Force zoom levels to 6–13
    return [z for z in sorted(zoom_levels, key=lambda x: x["zoomLevel"]) if 6 <= z["zoomLevel"] <= 13]

def lonlat_to_tile(x, y, zoom, bbox_full):
    minx, miny, maxx, maxy = bbox_full
    xt = (x - minx) / (maxx - minx)
    yt = (maxy - y) / (maxy - miny)  # flip Y
    tiles = 2 ** zoom
    return int(xt * tiles), int(yt * tiles)

def calculate_tiles_per_zoom(zoom_levels, bbox, bbox_full):
    minx, miny, maxx, maxy = bbox
    tiles_per_zoom = {}
    for zoom in zoom_levels:
        zl = zoom["zoomLevel"]
        tx_min, ty_max = lonlat_to_tile(minx, miny, zl, bbox_full)
        tx_max, ty_min = lonlat_to_tile(maxx, maxy, zl, bbox_full)
        # Clamp
        tx_min = max(0, tx_min)
        ty_min = max(0, ty_min)
        tx_max = min((2 ** zl) - 1, tx_max)
        ty_max = min((2 ** zl) - 1, ty_max)
        tile_count = (tx_max - tx_min + 1) * (ty_max - ty_min + 1)
        tiles_per_zoom[zl] = {
            "xRange": [tx_min, tx_max],
            "yRange": [ty_min, ty_max],
            "count": tile_count
        }
    return tiles_per_zoom

def fetch_and_process_footprints(limit=None):
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
            print(f"  ({i+1}) Skipping invalid item.")
            continue

        print(f"  ({i+1}) Processing: {title}")

        try:
            layer_url = LAYER_SERVICE_API_TEMPLATE.format(uuid)
            layer_data = requests.get(layer_url).json()
            tile_endpoint = layer_data.get("response", {}).get("docs", [{}])[0].get("endPoint")
            if not tile_endpoint:
                print("    - No tile endpoint found. Skipping.")
                continue

            bbox = [float(c) for c in bbox_str.split(",")]
            dataset_name = DATASET_MAP.get(title)
            if dataset_name:
                tile_url_template = f"https://trek.nasa.gov/tiles/Mars/EQ/{dataset_name}/1.0.0//default/default028mm/{{z}}/{{x}}/{{y}}.png"
                capabilities_url = f"https://trek.nasa.gov/tiles/Mars/EQ/{dataset_name}/1.0.0/WMTSCapabilities.xml"
            else:
                tile_url_template = f"{tile_endpoint}/1.0.0/default/default028mm/{{z}}/{{x}}/{{y}}.png"
                capabilities_url = f"{tile_endpoint}/1.0.0/WMTSCapabilities.xml"

            footprint = {
                "id": uuid,
                "title": title,
                "bbox": bbox,
                "tileUrl": tile_url_template,
                "capabilitiesUrl": capabilities_url
            }

            xml_root = ET.fromstring(requests.get(capabilities_url).content)
            zoom_levels = extract_zoom_levels(xml_root)
            if zoom_levels:
                zoom_levels = [
                    {
                        **z,
                        "zoomLevel": z["zoomLevel"] + 1
                    }
                    for z in zoom_levels if 6 <= z["zoomLevel"] <= 12
                ]
                bbox_full = [-180, -90, 180, 90]  # Mars global extent
                tiles_per_zoom = calculate_tiles_per_zoom(zoom_levels, bbox, bbox_full)
                footprint["downloadInfo"] = {"tilesPerZoom": tiles_per_zoom}
            else:
                footprint["downloadInfo"] = {"error": "No zoom levels found"}

            processed.append(footprint)
            time.sleep(0.1)

        except Exception as e:
            print(f"    - Error: {e}")

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(processed, f, indent=2)
    print(f"\n✅ Done. Saved {len(processed)} footprints to {OUTPUT_PATH}")


if __name__ == "__main__":
    fetch_and_process_footprints(limit=2)
