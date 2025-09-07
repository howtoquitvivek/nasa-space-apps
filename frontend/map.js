// ========================================================
// CONFIGURATION
// ========================================================

const API_BASE = "http://localhost:8000";
let currentDataset = "mars";
let currentLayer;

// ========================================================
// MAP INITIALIZATION WITH PERSISTENCE
// ========================================================

const savedZoom = localStorage.getItem("mapZoom");
const savedCenter = JSON.parse(localStorage.getItem("mapCenter")) || [0, 0];

const map = L.map("map", {
  center: savedCenter,
  zoom: savedZoom ? parseInt(savedZoom) : 2,
  minZoom: 1,
  maxZoom: 5,
  zoomControl: false
});

map.on("zoomend moveend", () => {
  localStorage.setItem("mapZoom", map.getZoom());
  localStorage.setItem("mapCenter", JSON.stringify(map.getCenter()));
});

// ========================================================
// TILE LAYER LOADING
// ========================================================

function loadDataset(dataset) {
  if (currentLayer) map.removeLayer(currentLayer);

  currentLayer = L.tileLayer(`${API_BASE}/tiles/${dataset}/{z}/{x}/{y}.webp`, {
    attribution: `&copy; ${dataset} dataset`,
    tms: false,
    detectRetina: false,
    noWrap: true,
    bounds: [[-90, -180], [90, 180]],
    errorTileUrl: ""
  }).addTo(map);

  map.setMaxBounds([[-90, -180], [90, 180]]);
}

loadDataset(currentDataset);

// ========================================================
// ANNOTATION SETUP
// ========================================================

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);


// Highlight Layer for Similar Annotations
let highlightLayer = new L.FeatureGroup();
map.addLayer(highlightLayer);

// Find Similar Mode
let findSimilarMode = false;

const drawControl = new L.Control.Draw({
  edit: {
    featureGroup: drawnItems,
    edit: false,   // shapes are not editable
    remove: true   // keep delete button
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
// LOAD ANNOTATIONS FROM BACKEND
// ========================================================

async function loadAnnotations() {
  const res = await fetch(`${API_BASE}/annotations`);
  const data = await res.json();
  drawnItems.clearLayers();

  data.filter(a => a.dataset === currentDataset).forEach(a => {
    const layer = L.geoJSON(a.geojson).getLayers()[0];

    // Restore label tooltip
    if (a.label) {
      layer._label = a.label;
      layer.bindTooltip(a.label, { permanent: true, direction: "top" }).openTooltip();
    }

    layer._annotationId = a.id;
    drawnItems.addLayer(layer);
  });
}

// ========================================================
// CREATE ANNOTATION
// ========================================================

map.on(L.Draw.Event.CREATED, async (e) => {
  const layer = e.layer;

  // Prompt for label
  const label = prompt("Enter label for this annotation:");
  if (label) {
    layer._label = label;
    layer.bindTooltip(label, { permanent: true, direction: "center" }).openTooltip();
  }

  drawnItems.addLayer(layer);

  // Save annotation to backend
  const geojson = layer.toGeoJSON();
  const annotation = {
    id: String(Date.now()),
    dataset: currentDataset,
    geojson,
    label,
  };

  await fetch(`${API_BASE}/annotations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(annotation)
  });

  layer._annotationId = annotation.id;
});

// ========================================================
// EDIT LABEL & SIMILARITY SEARCH
// ========================================================

drawnItems.on("click", async (e) => {
  const layer = e.layer || e.target;

  // Check if we're in Find Similar mode
  if (findSimilarMode) {
    findSimilarMode = false; // reset mode
    const annotationId = layer._annotationId;
    if (!annotationId) return;

    try {
      // Fetch similar annotations
      const res = await fetch(`${API_BASE}/annotations/${annotationId}/similar?top_k=5`);
      if (!res.ok) {
        alert("Failed to fetch similar annotations. Make sure the annotation has embeddings.");
        return;
      }

      const data = await res.json();
      const similar = data.similar;

      if (!similar.length) {
        alert("No similar annotations found.");
        return;
      }

      // Clear previous highlights
      highlightLayer.clearLayers();

      // Highlight similar annotations
      const allAnnotations = await fetch(`${API_BASE}/annotations`).then(r => r.json());
      similar.forEach(sim => {
        const ann = allAnnotations.find(a => a.id === sim.id);
        if (ann) {
          const highlight = L.geoJSON(ann.geojson, {
            style: { color: "red", weight: 3, dashArray: "5,5" }
          }).getLayers()[0];

          if (ann.label) {
            highlight.bindTooltip(`Similar: ${ann.label}`, { permanent: true, direction: "top" }).openTooltip();
          }

          highlightLayer.addLayer(highlight);
        }
      });

      // Zoom to show all highlighted annotations
      if (highlightLayer.getLayers().length) {
        map.fitBounds(highlightLayer.getBounds().pad(0.5));
      }

    } catch (err) {
      console.error(err);
      alert("Error fetching similar annotations.");
    }

  } else {
    // Existing label editing logic can stay here
    const newLabel = prompt("Edit label:", layer._label || "");
    if (newLabel !== null) {
      layer._label = newLabel;
      layer.bindTooltip(newLabel, { permanent: true, direction: "top" }).openTooltip();

      // Update backend
      if (layer._annotationId) {
        fetch(`${API_BASE}/annotations/${layer._annotationId}`, {
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
// UI CONTROLS
// ========================================================

document.getElementById("datasetSelect").addEventListener("change", (e) => {
  currentDataset = e.target.value;
  loadDataset(currentDataset);
  loadAnnotations();
});

document.getElementById("resetView").addEventListener("click", () => {
  map.setZoom(2);
});

document.getElementById("findSimilar").addEventListener("click", () => {
  findSimilarMode = true;
  alert("Click on an annotation to find similar ones.");
});


// ========================================================
// INITIAL LOAD
// ========================================================

loadAnnotations();


