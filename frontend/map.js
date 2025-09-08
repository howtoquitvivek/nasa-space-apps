// ========================================================
// CONFIGURATION
// ========================================================

const API_BASE = "http://localhost:8000";
let currentDataset;
let currentLayer;
const TOP_K = 5; // top similar tiles

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

map.on("zoomend moveend", () => {
  localStorage.setItem("mapZoom", map.getZoom());
  localStorage.setItem("mapCenter", JSON.stringify(map.getCenter()));
});

// Save zoom and center on move or zoom
map.on("zoomend moveend", () => {
  localStorage.setItem("mapZoom", map.getZoom());
  localStorage.setItem("mapCenter", JSON.stringify(map.getCenter()));
});

// ========================================================
// TILE LAYER LOADING
// ========================================================

function loadDataset(dataset) {
  if (currentLayer) map.removeLayer(currentLayer);

  currentLayer = L.tileLayer(`${API_BASE}/tiles/${dataset}/{z}/{x}/{y}.webp?ts=${Date.now()}`, {
    attribution: `&copy; ${dataset} dataset`,
    noWrap: true
  }).addTo(map);

  // Only fit bounds if no saved zoom/center
  if (!savedZoom || !savedCenter) {
    map.fitBounds([[-90, -180], [90, 180]]);
  }

  localStorage.setItem("currentDataset", dataset);
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
  const res = await fetch(`${API_BASE}/annotations`);
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
// CREATE ANNOTATION
// ========================================================

map.on(L.Draw.Event.CREATED, async (e) => {
  const layer = e.layer;
  const label = prompt("Enter label for this annotation:");
  if (label) {
    layer._label = label;
    layer.bindTooltip(label, { permanent: true, direction: "center" }).openTooltip();
  }

  drawnItems.addLayer(layer);

  const geojson = layer.toGeoJSON();
  const annotation = { id: String(Date.now()), dataset: currentDataset, geojson, label };

  await fetch(`${API_BASE}/annotations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(annotation)
  });

  layer._annotationId = annotation.id;
});

// ========================================================
// FIND SIMILAR TILES
// ========================================================

drawnItems.on("click", async (e) => {
  const layer = e.layer || e.target;

  if (findSimilarMode) {
    findSimilarMode = false;

    const geo = layer.toGeoJSON();
    const centroid = geo.geometry.type === "Point"
      ? geo.geometry.coordinates
      : geo.geometry.coordinates[0].reduce((acc, c) => [acc[0]+c[0], acc[1]+c[1]], [0,0]).map(v=>v/geo.geometry.coordinates[0].length);

    try {
      const url = `${API_BASE}/tiles/${currentDataset}/similar?lat=${centroid[1]}&lng=${centroid[0]}&zoom=${map.getZoom()}&top_k=${TOP_K}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();

      highlightLayer.clearLayers();

      data.similar_tiles.forEach(tile => {
        const bounds = [
          [tileYToLat(tile.y+1, tile.z), tileXToLng(tile.x, tile.z)],
          [tileYToLat(tile.y, tile.z), tileXToLng(tile.x+1, tile.z)]
        ];

        const rect = L.rectangle(bounds, { color: "red", weight: 2, fillOpacity: 0.3 });
        rect.bindTooltip(`Score: ${tile.score.toFixed(3)}`, { permanent: true, direction: "top" }).openTooltip();
        highlightLayer.addLayer(rect);
      });

      if (highlightLayer.getLayers().length) {
        map.fitBounds(highlightLayer.getBounds().pad(0.5));
      }

    } catch (err) {
      console.error(err);
      alert("Error fetching similar tiles.");
    }

  } else {
    const newLabel = prompt("Edit label:", layer._label || "");
    if (newLabel !== null) {
      layer._label = newLabel;
      layer.bindTooltip(newLabel, { permanent: true, direction: "top" }).openTooltip();
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

// Set dropdown to persisted dataset
document.getElementById("datasetSelect").value = currentDataset;

document.getElementById("datasetSelect").addEventListener("change", (e) => {
  currentDataset = e.target.value;
  localStorage.setItem("currentDataset", currentDataset); // persist
  loadDataset(currentDataset);
  loadAnnotations();
});

document.getElementById("resetView").addEventListener("click", () => {
  map.setZoom(2);
});

document.getElementById("findSimilar").addEventListener("click", () => {
  findSimilarMode = true;
  alert("Click on an annotation to find similar tiles.");
});

// ========================================================
// INITIAL LOAD
// ========================================================

loadDataset(currentDataset);
loadAnnotations();
