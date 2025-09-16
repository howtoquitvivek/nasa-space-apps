// ========================================================
// CONFIGURATION
// ========================================================

const API_BASE = "http://localhost:8000";
let currentDataset;
let currentLayer;
const TOP_K = 2; // top similar tiles

// ========================================================
// Load map with persistent zoom/center
// ========================================================

const savedDataset = localStorage.getItem("currentDataset") || "mars";
currentDataset = savedDataset;

const savedZoom = localStorage.getItem("mapZoom");
const savedCenter = JSON.parse(localStorage.getItem("mapCenter")) || [0, 0];

const map = L.map("map", {
  center: savedCenter,
  zoom: savedZoom ? parseInt(savedZoom) : 2,
  minZoom: 1,
  maxZoom: 5,
  zoomControl: false
});

// Add zoom control to bottom right
L.control.zoom({ position: 'bottomright' }).addTo(map);

// Save zoom and center on move or zoom
map.on("zoomend moveend", () => {
  localStorage.setItem("mapZoom", map.getZoom());
  localStorage.setItem("mapCenter", JSON.stringify(map.getCenter()));
  updateZoomInfo(); // Update zoom display
});

// Update zoom info display
function updateZoomInfo() {
  const zoomInfo = document.getElementById("zoomInfo");
  if (zoomInfo) {
    zoomInfo.textContent = `Zoom: ${map.getZoom()} | Dataset: ${currentDataset}`;
  }
}

// ========================================================
// TILE LAYER LOADING
// ========================================================
async function loadDataset(dataset) {
  if (currentLayer) map.removeLayer(currentLayer);

  const res = await fetch(`${API_BASE}/datasets/${dataset}/bounds`);
  if (!res.ok) {
    alert("Failed to load dataset bounds");
    return;
  }
  const data = await res.json();
  const { bounds } = data;

  currentLayer = L.tileLayer(`${API_BASE}/tiles/${dataset}/{z}/{x}/{y}.webp`, {
    attribution: `&copy; ${dataset} dataset`,
    noWrap: true,
    bounds: bounds,
    errorTileUrl: ""
  }).addTo(map);

  map.setMaxBounds(bounds);

  // Only fit bounds if no saved zoom/center
  const savedZoom = localStorage.getItem("mapZoom");
  const savedCenter = JSON.parse(localStorage.getItem("mapCenter"));
  if (!savedZoom || !savedCenter) {
    map.fitBounds(bounds);
  }

  localStorage.setItem("currentDataset", dataset);
  updateZoomInfo(); // Update zoom display
  
  // Log available zoom levels
  if (data.available_zooms) {
    console.log(`Available zoom levels for ${dataset}:`, data.available_zooms);
  }
}

// ========================================================
// ANNOTATION SETUP
// ========================================================

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Highlight Layer for Similar Tiles
let highlightLayer = new L.FeatureGroup();
map.addLayer(highlightLayer);

let findSimilarMode = false;

const drawControl = new L.Control.Draw({
  edit: { featureGroup: drawnItems, edit: false, remove: true },
  draw: { polygon: true, polyline: true, rectangle: true, circle: false, circlemarker: false, marker: true }
});
map.addControl(drawControl);

// ========================================================
// TILE <-> LATLNG HELPERS
// ========================================================

function tileXToLng(x, zoom) {
  return (x / Math.pow(2, zoom)) * 360 - 180;
}

function tileYToLat(y, zoom) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

// ========================================================
// LOAD ANNOTATIONS
// ========================================================

async function loadAnnotations() {
  // cache-busting to avoid stale results
  const res = await fetch(`${API_BASE}/annotations?ts=${Date.now()}`);
  const data = await res.json();

  drawnItems.clearLayers();

  data.filter(a => a.dataset === currentDataset).forEach(a => {
    const layer = L.geoJSON(a.geojson).getLayers()[0];

    if (a.label) {
      layer._label = a.label;
      layer.bindTooltip(a.label, { permanent: true, direction: "top" }).openTooltip();
    }

    layer._annotationId = a.id;
    drawnItems.addLayer(layer);
  });
}

// ========================================================
// CREATE ANNOTATION - ENHANCED WITH ZOOM INFO
// ========================================================

map.on(L.Draw.Event.CREATED, async (e) => {
  const layer = e.layer;
  const currentZoom = map.getZoom();
  
  // Show current zoom in the prompt
  const label = prompt(`Enter label for this annotation:\n(Current zoom level: ${currentZoom})`);
  if (label) {
    layer._label = label;
    layer.bindTooltip(label, { permanent: true, direction: "center" }).openTooltip();
  }

  drawnItems.addLayer(layer);

  const geojson = layer.toGeoJSON();
  const annotation = { 
    id: String(Date.now()), 
    dataset: currentDataset, 
    geojson, 
    label,
    zoom_created: currentZoom  // Track zoom level when annotation was created
  };

  try {
    const response = await fetch(`${API_BASE}/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(annotation)
    });
    
    const result = await response.json();
    if (result.zoom_used) {
      console.log(`Annotation saved using zoom level: ${result.zoom_used}`);
    }
  } catch (error) {
    console.error("Failed to save annotation:", error);
    alert("Failed to save annotation. Please try again.");
  }

  layer._annotationId = annotation.id;
});

// ========================================================
// LOADING INDICATOR HELPERS
// ========================================================

function showLoading(show) {
  const loadingIndicator = document.getElementById("loadingIndicator");
  if (loadingIndicator) {
    loadingIndicator.style.display = show ? "block" : "none";
  }
  document.body.style.cursor = show ? 'wait' : 'default';
}

// ========================================================
// FIND SIMILAR TILES - ENHANCED WITH FEATURE-LEVEL MATCHING
// ========================================================

drawnItems.on("click", async (e) => {
    const layer = e.layer || e.target;
    
    // Check if the clicked layer has a valid annotation ID
    if (!layer._annotationId) {
        console.warn("Clicked layer does not have an annotation ID. Skipping similarity search.");
        return;
    }

    if (findSimilarMode) {
        findSimilarMode = false;
        
        showLoading(true);
        const currentZoom = map.getZoom();

        const geojson = layer.toGeoJSON();

        console.log("GeoJSON object being sent to backend:", JSON.stringify(geojson, null, 2));
        
        try {
            // New endpoint and POST request to send the full geojson
            const url = `${API_BASE}/annotations/similar?top_k=${TOP_K}&zoom=${currentZoom}`;
            console.log(`Searching for similar features using annotation ID: ${layer._annotationId}`);
            
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    annotation_id: layer._annotationId,
                    dataset: currentDataset,
                    geojson: geojson
                })
            });

            if (res.status === 404) {
                const errorData = await res.json();
                alert(`Error: ${errorData.detail}`);
                return;
            }

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            const data = await res.json();
            highlightLayer.clearLayers();

            console.log(`Found ${data.similar_tiles.length} similar tiles:`, data);

            data.similar_tiles.forEach(tile => {
                const bounds = [
                    [tileYToLat(tile.y + 1, tile.z), tileXToLng(tile.x, tile.z)],
                    [tileYToLat(tile.y, tile.z), tileXToLng(tile.x + 1, tile.z)]
                ];
                const rect = L.rectangle(bounds, { color: "red", weight: 2, fillOpacity: 0.3 });
                
                const tooltipText = `Score: ${tile.score.toFixed(3)}\nZoom: ${tile.z}\nTile: (${tile.x}, ${tile.y})`;
                rect.bindTooltip(tooltipText, { permanent: true, direction: "top" }).openTooltip();
                highlightLayer.addLayer(rect);
            });

            if (highlightLayer.getLayers().length > 0) {
                map.fitBounds(highlightLayer.getBounds().pad(0.1));
                
                setTimeout(() => {
                    alert(`Found ${data.similar_tiles.length} similar tiles at zoom level ${currentZoom}!`);
                }, 500);
            } else {
                alert(`No similar tiles found at zoom level ${currentZoom}. Try a different zoom level or location.`);
            }

        } catch (err) {
            console.error("Similarity search error:", err);
            alert(`An unexpected error occurred while fetching similar tiles:\n${err.message}`);
        } finally {
            showLoading(false);
        }

    } else {
        // ... (existing edit label logic remains here)
        const newLabel = prompt("Edit label:", layer._label || "");
        if (newLabel !== null) {
            layer._label = newLabel;
            layer.bindTooltip(newLabel, { permanent: true, direction: "top" }).openTooltip();
            if (layer._annotationId) {
                await fetch(`${API_BASE}/annotations/${layer._annotationId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ label: newLabel })
                });
            }
        }
    }
});

// ========================================================
// DELETE ANNOTATIONS
// ========================================================

map.on("draw:deleted", async (e) => {
  e.layers.eachLayer(async (layer) => {
    if (layer._annotationId) {
      await fetch(`${API_BASE}/annotations/${layer._annotationId}`, { method: "DELETE" });
    }
  });
});

// ========================================================
// UI CONTROLS - ENHANCED
// ========================================================

document.getElementById("datasetSelect").value = currentDataset;

document.getElementById("datasetSelect").addEventListener("change", (e) => {
  currentDataset = e.target.value;
  localStorage.setItem("currentDataset", currentDataset);
  loadDataset(currentDataset);
  loadAnnotations();
  highlightLayer.clearLayers(); // Clear highlights when switching datasets
});

document.getElementById("resetView").addEventListener("click", () => {
  map.setZoom(2);
  map.setView([0, 0], 2);
});

document.getElementById("findSimilar").addEventListener("click", () => {
  findSimilarMode = true;
  const currentZoom = map.getZoom();
  alert(`Find Similar Mode Activated!\n\nCurrent zoom: ${currentZoom}\nClick on an annotation to find similar tiles at this zoom level.`);
});

// Clear highlights button (if it exists)
const clearHighlightsBtn = document.getElementById("clearHighlights");
if (clearHighlightsBtn) {
  clearHighlightsBtn.addEventListener("click", () => {
    highlightLayer.clearLayers();
    console.log("Cleared all similarity highlights");
  });
}

// ========================================================
// KEYBOARD SHORTCUTS
// ========================================================

document.addEventListener("keydown", (e) => {
  if (e.key === 'Escape') {
    findSimilarMode = false;
    showLoading(false);
    console.log("Find similar mode cancelled");
  }
  if (e.key === 'c' && e.ctrlKey) {
    highlightLayer.clearLayers();
    console.log("Cleared highlights (Ctrl+C)");
  }
});

// ========================================================
// INITIAL LOAD
// ========================================================

loadDataset(currentDataset);
loadAnnotations();
updateZoomInfo(); // Initialize zoom display

// Log initial state
console.log("Map initialized with:", {
  dataset: currentDataset,
  zoom: map.getZoom(),
  center: map.getCenter()
});