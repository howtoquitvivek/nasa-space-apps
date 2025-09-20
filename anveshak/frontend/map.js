
// CONFIGURATION

const API_BASE = "http://localhost:8000";
let currentDataset;
let currentLayer;
const TOP_K = 5; // Adjusted for potentially more results


// Load map with persistent zoom/center
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

// ... (Delete annotations, UI Controls, and Keyboard shortcuts are the same) ...
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
});

document.getElementById("resetView").addEventListener("click", () => {
  map.setZoom(2);
  map.setView([0, 0], 2);
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

// INITIAL LOAD
loadDataset(currentDataset);
loadAnnotations();
updateZoomInfo();