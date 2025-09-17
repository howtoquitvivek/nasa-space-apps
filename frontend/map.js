// ========================================================
// CONFIGURATION
// ========================================================

const API_BASE = "http://localhost:8000";
let currentDataset;
let currentLayer;
const TOP_K = 5; // Adjusted for potentially more results

// NEW: State variables for the two-stage search
let searchedZooms = [];
let currentQueryLayer = null;

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
  maxZoom: 5, // Make sure this matches the max zoom of your data
  zoomControl: false
});

L.control.zoom({ position: 'bottomright' }).addTo(map);

map.on("zoomend moveend", () => {
  localStorage.setItem("mapZoom", map.getZoom());
  localStorage.setItem("mapCenter", JSON.stringify(map.getCenter()));
  updateZoomInfo();
});

function updateZoomInfo() {
  const zoomInfo = document.getElementById("zoomInfo");
  if (zoomInfo) {
    zoomInfo.textContent = `Zoom: ${map.getZoom()} | Dataset: ${currentDataset}`;
  }
}

// ... (loadDataset, annotation setup, helpers, load/create annotations are the same) ...
// <editor-fold desc="Unchanged Setup Code">
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

  const savedZoom = localStorage.getItem("mapZoom");
  const savedCenter = JSON.parse(localStorage.getItem("mapCenter"));
  if (!savedZoom || !savedCenter) {
    map.fitBounds(bounds);
  }

  localStorage.setItem("currentDataset", dataset);
  updateZoomInfo();
  
  if (data.available_zooms) {
    console.log(`Available zoom levels for ${dataset}:`, data.available_zooms);
    window.availableZooms = data.available_zooms; // Store globally for later
  }
}

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

let highlightLayer = new L.FeatureGroup();
map.addLayer(highlightLayer);

let findSimilarMode = false;

const drawControl = new L.Control.Draw({
  edit: { featureGroup: drawnItems, edit: false, remove: true },
  draw: { polygon: true, polyline: true, rectangle: true, circle: false, circlemarker: false, marker: true }
});
map.addControl(drawControl);

function tileXToLng(x, zoom) {
  return (x / Math.pow(2, zoom)) * 360 - 180;
}

function tileYToLat(y, zoom) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

async function loadAnnotations() {
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

map.on(L.Draw.Event.CREATED, async (e) => {
  const layer = e.layer;
  const currentZoom = map.getZoom();
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
    zoom_created: currentZoom
  };
  try {
    await fetch(`${API_BASE}/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(annotation)
    });
  } catch (error) {
    console.error("Failed to save annotation:", error);
  }
  layer._annotationId = annotation.id;
});

function showLoading(show) {
  const loadingIndicator = document.getElementById("loadingIndicator");
  if (loadingIndicator) {
    loadingIndicator.style.display = show ? "flex" : "none";
  }
  document.body.style.cursor = show ? 'wait' : 'default';
}
// </editor-fold>

// ========================================================
// FIND SIMILAR TILES - MODIFIED FOR TWO-STAGE SEARCH
// ========================================================

// Helper function to draw results on the map
function drawResults(data, clearFirst = false) {
    if (clearFirst) {
        highlightLayer.clearLayers();
    }
    
    data.similar_tiles.forEach(tile => {
        const bounds = [
            [tileYToLat(tile.y + 1, tile.z), tileXToLng(tile.x, tile.z)],
            [tileYToLat(tile.y, tile.z), tileXToLng(tile.x + 1, tile.z)]
        ];
        const rect = L.rectangle(bounds, { color: "red", weight: 2, fillOpacity: 0.3 });
        const tooltipText = `Score: ${tile.score.toFixed(3)}\nZoom: ${tile.z}`;
        rect.bindTooltip(tooltipText, { permanent: true, direction: "top" }).openTooltip();
        highlightLayer.addLayer(rect);
    });
}

drawnItems.on("click", async (e) => {
  const layer = e.layer || e.target;
  if (!layer._annotationId) return;

  if (findSimilarMode) {
    findSimilarMode = false;
    showLoading(true);
    
    // Reset state for a new search
    searchedZooms = [];
    currentQueryLayer = layer;
    document.getElementById('searchDeeper').style.display = 'none';

    const currentZoom = map.getZoom();
    const geojson = layer.toGeoJSON();

    try {
      const url = `${API_BASE}/annotations/similar?top_k=${TOP_K}&zoom=${currentZoom}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          annotation_id: layer._annotationId,
          dataset: currentDataset,
          geojson: geojson
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || `HTTP ${res.status}`);
      }
      
      const data = await res.json();
      drawResults(data, true); // Draw results, clearing previous ones
      searchedZooms.push(currentZoom); // Mark this zoom as searched

      if (highlightLayer.getLayers().length > 0) {
        map.fitBounds(highlightLayer.getBounds().pad(0.1));
      }

      // Show the 'Search Deeper' button if there are other zooms to search
      if (window.availableZooms && window.availableZooms.length > 1) {
        document.getElementById('searchDeeper').style.display = 'inline-flex';
      }

    } catch (err) {
      console.error("Similarity search error:", err);
      alert(`An error occurred during search: ${err.message}`);
    } finally {
      showLoading(false);
    }
  } else {
    // Edit label logic (unchanged)
    const newLabel = prompt("Edit label:", layer._label || "");
    if (newLabel !== null && layer._annotationId) {
      layer._label = newLabel;
      layer.bindTooltip(newLabel, { permanent: true, direction: "top" }).openTooltip();
      await fetch(`${API_BASE}/annotations/${layer._annotationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel })
      });
    }
  }
});


// ========================================================
// NEW: "SEARCH DEEPER" BUTTON LOGIC
// ========================================================

document.getElementById('searchDeeper').addEventListener('click', async () => {
    if (!currentQueryLayer) {
        alert("Please perform an initial search first.");
        return;
    }

    showLoading(true);
    document.getElementById('searchDeeper').style.display = 'none'; // Hide button after click

    const geojson = currentQueryLayer.toGeoJSON();

    try {
        const url = `${API_BASE}/annotations/similar/more?top_k=${TOP_K}`;
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                annotation_id: currentQueryLayer._annotationId,
                dataset: currentDataset,
                geojson: geojson,
                exclude_zooms: searchedZooms // Send zooms we've already searched
            })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.detail || `HTTP ${res.status}`);
        }
        
        const data = await res.json();
        drawResults(data, false); // Add new results without clearing old ones
        
        // Update searched zooms to prevent searching again
        searchedZooms.push(...window.availableZooms.filter(z => !searchedZooms.includes(z)));

        if (highlightLayer.getLayers().length > 0) {
            map.fitBounds(highlightLayer.getBounds().pad(0.1));
        } else {
            alert("No additional similar tiles found in other zoom levels.");
        }

    } catch (err) {
        console.error("Deeper search error:", err);
        alert(`An error occurred during deeper search: ${err.message}`);
        document.getElementById('searchDeeper').style.display = 'inline-flex'; // Show button again on error
    } finally {
        showLoading(false);
    }
});


// ... (Delete annotations, UI Controls, and Keyboard shortcuts are the same) ...
// <editor-fold desc="Unchanged UI and Event Handlers">
map.on("draw:deleted", async (e) => {
  e.layers.eachLayer(async (layer) => {
    if (layer._annotationId) {
      await fetch(`${API_BASE}/annotations/${layer._annotationId}`, { method: "DELETE" });
    }
  });
});

document.getElementById("datasetSelect").value = currentDataset;
document.getElementById("datasetSelect").addEventListener("change", (e) => {
  currentDataset = e.target.value;
  localStorage.setItem("currentDataset", currentDataset);
  loadDataset(currentDataset);
  loadAnnotations();
  highlightLayer.clearLayers();
  document.getElementById('searchDeeper').style.display = 'none';
});

document.getElementById("resetView").addEventListener("click", () => {
  map.setZoom(2);
  map.setView([0, 0], 2);
});

document.getElementById("findSimilar").addEventListener("click", () => {
  findSimilarMode = true;
  const currentZoom = map.getZoom();
  alert(`Find Similar Mode Activated!\n\nClick on an annotation to find similar tiles at this zoom level.`);
});

const clearHighlightsBtn = document.getElementById("clearHighlights");
if (clearHighlightsBtn) {
  clearHighlightsBtn.addEventListener("click", () => {
    highlightLayer.clearLayers();
    console.log("Cleared all similarity highlights");
  });
}

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

// </editor-fold>

// ========================================================
// INITIAL LOAD
// ========================================================

loadDataset(currentDataset);
loadAnnotations();
updateZoomInfo();