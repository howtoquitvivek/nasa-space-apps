// ========================================================
// CONFIGURATION
// ========================================================

// Backend API base URL
const API_BASE = "http://localhost:8000";

// Default dataset
let currentDataset = "mars";
let currentLayer;


// ========================================================
// MAP INITIALIZATION WITH PERSISTENCE
// ========================================================

// Load saved zoom & center or use defaults
const savedZoom = localStorage.getItem("mapZoom");
const savedCenter = JSON.parse(localStorage.getItem("mapCenter")) || [0, 0];

const map = L.map("map", {
  center: savedCenter,
  zoom: savedZoom ? parseInt(savedZoom) : 2,
  minZoom: 1,
  maxZoom: 5,
  zoomControl: false
});

// Save zoom & center on move/zoom
map.on("zoomend moveend", () => {
  localStorage.setItem("mapZoom", map.getZoom());
  localStorage.setItem("mapCenter", JSON.stringify(map.getCenter()));
});

// ========================================================
// TILE LAYER LOADING
// ========================================================

// Load tiles for a selected dataset
function loadDataset(dataset) {
  if (currentLayer) {
    map.removeLayer(currentLayer);
  }

  currentLayer = L.tileLayer(`${API_BASE}/tiles/${dataset}/{z}/{x}/{y}.webp`, {
    attribution: `&copy; ${dataset} dataset`,
    tms: false,
    detectRetina: false,
    noWrap: true,                       // prevents repeating tiles
    bounds: [[-90, -180], [90, 180]],   // constrain dataset coverage
    errorTileUrl: ""                    // blank instead of broken tiles
  });

  currentLayer.addTo(map);

  // Restrict panning to dataset bounds
  map.setMaxBounds([[-90, -180], [90, 180]]);
}

// Initial dataset load
loadDataset(currentDataset);


// ========================================================
// ANNOTATION SETUP
// ========================================================

// Create a layer group to store drawn annotations
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Add drawing/edit controls
const drawControl = new L.Control.Draw({
  edit: {
    featureGroup: drawnItems,
    edit: false,      // disable editing shapes
    remove: true      // keep the delete button
  },
  draw: {
    polygon: true,
    polyline: true,
    rectangle: true,
    circle: false,
    circlemarker: false,
    marker: true
  }
});
map.addControl(drawControl);


// ========================================================
// ANNOTATION PERSISTENCE (Backend API)
// ========================================================

// Load saved annotations for current dataset
async function loadAnnotations() {
  const res = await fetch(`${API_BASE}/annotations`);
  const data = await res.json();
  drawnItems.clearLayers();

  // Only load annotations for the active dataset
  data.filter(a => a.dataset === currentDataset).forEach(a => {
    const layer = L.geoJSON(a.geojson).getLayers()[0];

    // Restore label
    if (a.label) {
      layer._label = a.label;
      layer.bindTooltip(a.label, { permanent: true, direction: "top" }).openTooltip();
    }

    layer._annotationId = a.id;
    drawnItems.addLayer(layer);
  });
}

// Save newly created annotations
map.on(L.Draw.Event.CREATED, async (e) => {
  const layer = e.layer;

  // Ask for label text
  const label = prompt("Enter label for this annotation:");
  if (label) {
    layer.bindTooltip(label, { permanent: true, direction: "center" }).openTooltip();
    layer._label = label;  // store label in the layer for editing
  }

  drawnItems.addLayer(layer);

  // Save to backend
  const geojson = layer.toGeoJSON();
  const annotation = {
    id: String(Date.now()),
    dataset: currentDataset,
    geojson,
    label
  };

  await fetch(`${API_BASE}/annotations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(annotation)
  });

  layer._annotationId = annotation.id;
});

// Edit Annotation Label
drawnItems.on("click", (e) => {
  const layer = e.layer || e.target;
  const newLabel = prompt("Edit label:", layer._label || "");
  if (newLabel !== null) {
    layer._label = newLabel;
    layer.bindTooltip(newLabel, { permanent: true, direction: "top" }).openTooltip();

    // Optional: update backend
    if (layer._annotationId) {
      fetch(`${API_BASE}/annotations/${layer._annotationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel })
      });
    }
  }
});

// Delete annotations from backend
map.on("draw:deleted", async (e) => {
  e.layers.eachLayer(async (layer) => {
    if (layer._annotationId) {
      await fetch(`${API_BASE}/annotations/${layer._annotationId}`, {
        method: "DELETE"
      });
    }
  });
});


// ========================================================
// UI CONTROLS
// ========================================================

// Dataset switcher dropdown
document.getElementById("datasetSelect").addEventListener("change", (e) => {
  currentDataset = e.target.value;
  loadDataset(currentDataset);
  loadAnnotations();
});

// Reset zoom button
document.getElementById("resetView").addEventListener("click", () => {
  map.setZoom(2);
});


// ========================================================
// INITIAL DATA LOAD
// ========================================================

// Load annotations for the initial dataset
loadAnnotations();
