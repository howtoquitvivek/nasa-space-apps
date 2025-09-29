import requests
import json
import os
import time
import xml.etree.ElementTree as ET

# --- CONFIGURATION ---
CATALOG_API_URL = (
    "https://trek.nasa.gov/mars/TrekServices/ws/index/eq/searchItems"
    "?proj=eq&start=0&rows=5000&facetKeys=instrument%7CproductCat1"
    "&facetValues=CTX%7CImagery&intersects=true"
)
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "ctx_footprints_new.json")


def latlon_to_tile(lat, lon, zoom, matrix_width, matrix_height):
    """
    Convert lat/lon to Trek WMTS tile indices for given zoom.
    """
    col = int((lon + 180.0) / 360.0 * matrix_width)
    row = int((90.0 - lat) / 180.0 * matrix_height)
    return col, row

def calculate_tiles_per_zoom(bbox, matrix_info):
    """
    Calculate bbox-specific tile ranges for each zoom level
    using matrix width/height from WMTS capabilities.
    Only process zoom levels 6–12.
    """
    min_lon, min_lat, max_lon, max_lat = bbox
    tiles_per_zoom = {}

    for zl, (matrix_width, matrix_height) in matrix_info.items():
        if zl < 6 or zl > 12:  # ✅ filter zooms outside 6–12
            continue

        tx_min, ty_max = latlon_to_tile(min_lat, min_lon, zl, matrix_width, matrix_height)
        tx_max, ty_min = latlon_to_tile(max_lat, max_lon, zl, matrix_width, matrix_height)

        if ty_min > ty_max:
            ty_min, ty_max = ty_max, ty_min
        if tx_min > tx_max:
            tx_min, tx_max = tx_max, tx_min

        x_count = tx_max - tx_min + 1
        y_count = ty_max - ty_min + 1

        if x_count > 0 and y_count > 0:
            tiles_per_zoom[str(zl)] = {
                "xRange": [tx_min, tx_max],
                "yRange": [ty_min, ty_max],
                "count": x_count * y_count,
            }
    return tiles_per_zoom


def fetch_matrix_info(xml_root):
    """
    Parse WMTS Capabilities and extract MatrixWidth/Height for each zoom level.
    Only keep zoom levels 6–12.
    """
    matrix_info = {}
    ns = {"wmts": "http://www.opengis.net/wmts/1.0", "ows": "http://www.opengis.net/ows/1.1"}

    for matrix in xml_root.findall(".//wmts:TileMatrix", ns):
        zoom_id = matrix.findtext("ows:Identifier", namespaces=ns)
        width = matrix.findtext("wmts:MatrixWidth", namespaces=ns)
        height = matrix.findtext("wmts:MatrixHeight", namespaces=ns)

        if zoom_id and width and height:
            zl = int(float(zoom_id))
            if 6 <= zl <= 12:  # ✅ keep only zoom 6–12
                matrix_info[zl] = (int(float(width)), int(float(height)))

    return matrix_info

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
        product_label = item.get("productLabel")
        title = item.get("title")

        if not (product_label and title):
            print(f"  ({i+1}/{limit or len(footprint_docs)}) Skipping invalid item.")
            continue

        print(f"  ({i+1}/{limit or len(footprint_docs)}) Processing: {title}")

        try:
            tile_url_template = (
                f"https://trek.nasa.gov/tiles/Mars/EQ/{product_label}/1.0.0/"
                f"default/default028mm/{{z}}/{{y}}/{{x}}.png"
            )
            capabilities_url = (
                f"https://trek.nasa.gov/tiles/Mars/EQ/{product_label}/1.0.0/WMTSCapabilities.xml"
            )

            cap_res = requests.get(capabilities_url)
            cap_res.raise_for_status()
            xml_root = ET.fromstring(cap_res.content)

            # --- Extract WGS84BoundingBox ---
            ns = {"ows": "http://www.opengis.net/ows/1.1"}
            wgs84_bbox_element = xml_root.find(".//ows:WGS84BoundingBox", ns)
            if wgs84_bbox_element is not None:
                lower_corner_text = wgs84_bbox_element.findtext("ows:LowerCorner", namespaces=ns)
                upper_corner_text = wgs84_bbox_element.findtext("ows:UpperCorner", namespaces=ns)
                if lower_corner_text and upper_corner_text:
                    min_lon, min_lat = map(float, lower_corner_text.split())
                    max_lon, max_lat = map(float, upper_corner_text.split())
                    bbox = [min_lon, min_lat, max_lon, max_lat]
                else:
                    print("    - Warning: Could not find bounding box corners. Skipping.")
                    continue
            else:
                print("    - Warning: No WGS84BoundingBox found. Skipping.")
                continue

            # --- Extract matrix info (MatrixWidth/Height) ---
            matrix_info = fetch_matrix_info(xml_root)

            # --- Calculate tiles ---
            tiles_per_zoom = calculate_tiles_per_zoom(bbox, matrix_info)

            footprint = {
                "id": product_label,
                "title": title,
                "bbox": bbox,
                "tileUrl": tile_url_template,
                "capabilitiesUrl": capabilities_url,
                "downloadInfo": {"tilesPerZoom": tiles_per_zoom},
            }

            processed.append(footprint)
            time.sleep(0.2)

        except requests.exceptions.RequestException as e:
            print(f"    - Network Error for {title}: {e}")
        except Exception as e:
            print(f"    - An unexpected error occurred for {title}: {e}")

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(processed, f, indent=2)
    print(f"\n✅ Done. Saved {len(processed)} footprints to {OUTPUT_PATH}")


if __name__ == "__main__":
    # fetch_and_process_footprints(limit=3)
    fetch_and_process_footprints()
