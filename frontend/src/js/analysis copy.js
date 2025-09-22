document.addEventListener('DOMContentLoaded', () => {
    // --- CONSTANTS ---
    const API_BASE = 'http://localhost:8000';
    const TOP_K = 10;
    const AVG_TILE_SIZE_KB = 30; // A reasonable guess for estimation

    // --- STATE ---
    let map;
    let L;
    let currentLayer;
    let drawnItems;
    let highlightLayer;
    let findSimilarMode = false;
    let searchedZooms = [];
    let currentQueryLayer = null;
    let availableZooms = [];
    let currentMinZoom = 1;
    let deleteIcon;
    let showAnnotations = true;
    let showLabels = true;

    // --- DOM Elements ---
    const zoomInfoElement = document.getElementById('zoom-info');
    const loadingOverlay = document.getElementById('loading-overlay');
    const statusMessageElement = document.getElementById('status-message');
    const findSimilarBtn = document.getElementById('find-similar-btn');
    const searchDeeperBtn = document.getElementById('search-deeper-btn');
    const toggleAnnotationsBtn = document.getElementById('toggle-annotations-btn');
    const toggleLabelsBtn = document.getElementById('toggle-labels-btn');
    const clearHighlightsBtn = document.getElementById('clear-highlights-btn');
    const annotationsOnIcon = document.getElementById('annotations-on-icon');
    const annotationsOffIcon = document.getElementById('annotations-off-icon');

    // Get dataset and footprint from URL query parameters
    const urlParams = new URLSearchParams(window.location.search);
    const currentDataset = urlParams.get('dataset');
    const currentFootprint = urlParams.get('footprint');

    if (!currentDataset || !currentFootprint) {
        document.getElementById('map-container').innerHTML = `<p style="padding: 2rem; text-align: center;">Invalid URL. Please go back to the <a href="home.html">Home Dashboard</a>.</p>`;
        return;
    }

    // --- LIFECYCLE ---
    import('leaflet-draw').then(() => {
        L = window.L; // Assuming Leaflet is already globally available
        const markerIcon = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
        const markerShadow = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
        const DefaultIcon = L.icon({
            iconUrl: markerIcon,
            shadowUrl: markerShadow,
            iconSize: [25, 41],
            iconAnchor: [12, 41]
        });
        L.Marker.prototype.options.icon = DefaultIcon;

        // Define the custom delete icon
        deleteIcon = L.icon({
            iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0iI2RjMjYyNiI+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNMTAgMThhOCA4IDAgMTAwLTE2IDggOCAwIDAwMCAxNnpNOC4yOCA3LjIyYS43NS43NSAwIDAwLTEuMDYgMS4wNkw4Ljk0IDEwbC0xLjcyIDEuNzJhLjc1Ljc1IDAgMTAxLjA2IDEuMDZMMTAgMTEuMDZsMS43MiAxLjcyYS43NS43NSAwIDEwMS4wNi0xLjA2TDExLjA2IDEwbDEuNzItMS43MmEuNzNS43NSAwIDAwLTEuMDYtMS4wNkwxMCA4Ljk0IDguMjggNy4yMnoiIGNsaXAtcnVsZT0iZXZlbm9kZCIgLz48L3N2Zz4=',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        map = L.map('map-container', {
            center: [0, 0],
            zoom: 0,
            zoomControl: false
        });

        // L.control.zoom({ position: 'bottomright' }).addTo(map);

        drawnItems = new L.FeatureGroup().addTo(map);
        highlightLayer = new L.FeatureGroup().addTo(map);

        const drawControl = new L.Control.Draw({
            edit: { featureGroup: drawnItems, edit: false, remove: true },
            draw: {
                polygon: true,
                polyline: true,
                rectangle: { showArea: false },
                circle: false,
                circlemarker: false,
                marker: true
            }
        });
        map.addControl(drawControl);

        map.on(L.Draw.Event.CREATED, handleCreateAnnotation);
        map.on('draw:deleted', handleDeleteAnnotation);
        drawnItems.on('click', handleAnnotationClick);
        map.on('zoomend', updateZoomInfo);

        // Add event listeners for the control buttons
        findSimilarBtn.addEventListener('click', handleFindSimilar);
        searchDeeperBtn.addEventListener('click', handleSearchDeeper);
        toggleAnnotationsBtn.addEventListener('click', toggleAnnotations);
        toggleLabelsBtn.addEventListener('click', toggleLabels);
        clearHighlightsBtn.addEventListener('click', clearHighlights);
        document.addEventListener('keydown', handleKeydown);

        loadDataset(currentDataset, currentFootprint);
        loadAnnotations();
    });

    // --- HELPER FUNCTIONS ---
    function showLoading(message) {
        statusMessageElement.textContent = message;
        loadingOverlay.classList.remove('hidden');
    }

    function hideLoading() {
        loadingOverlay.classList.add('hidden');
    }

    function updateZoomInfo() {
        if (!map) return;
        const displayZoom = map.getZoom() - currentMinZoom;
        zoomInfoElement.textContent = `Zoom Level: ${displayZoom} | Analyzing: ${currentDataset}/${currentFootprint}`;
    }

    function tileXToLng(x, z) {
        return (x / Math.pow(2, z)) * 360 - 180;
    }

    function tileYToLat(y, z) {
        const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
        return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    }

    // --- NEW UI TOGGLE FUNCTIONS ---
    function toggleAnnotations() {
        showAnnotations = !showAnnotations;
        if (showAnnotations) {
            map.addLayer(drawnItems);
            annotationsOnIcon.classList.remove('hidden');
            annotationsOffIcon.classList.add('hidden');
        } else {
            map.removeLayer(drawnItems);
            annotationsOnIcon.classList.add('hidden');
            annotationsOffIcon.classList.remove('hidden');
        }
    }

    function toggleLabels() {
        showLabels = !showLabels;
        // Iterate over user-drawn annotations
        drawnItems.eachLayer((layer) => {
            const tooltip = layer.getTooltip();
            if (tooltip) {
                if (showLabels) {
                    layer.openTooltip();
                } else {
                    layer.closeTooltip();
                }
            }
        });
        // Iterate over search results (highlighted layers)
        highlightLayer.eachLayer((layer) => {
            const tooltip = layer.getTooltip();
            if (tooltip) {
                if (showLabels) {
                    layer.openTooltip();
                } else {
                    layer.closeTooltip();
                }
            }
        });
    }

    // --- CORE FUNCTIONS ---
    async function loadDataset(dataset, footprint) {
        showLoading(`Loading dataset: ${dataset}/${footprint}...`);
        try {
            const res = await fetch(`${API_BASE}/datasets/${dataset}/${footprint}/bounds`);
            if (!res.ok) {
                throw new Error(`Failed to load dataset bounds. Status: ${res.status}`);
            }
            const data = await res.json();
            const { bounds } = data;

            let minApiZoom = 1;

            if (Array.isArray(data.available_zooms) && data.available_zooms.length > 0) {
                availableZooms = data.available_zooms;
                minApiZoom = Math.min(...availableZooms);
                const maxApiZoom = Math.max(...availableZooms);
                currentMinZoom = minApiZoom;
                map.setMinZoom(minApiZoom);
                map.setMaxZoom(maxApiZoom);
            } else {
                console.warn('Warning: `available_zooms` is missing or invalid. Falling back to default zooms.');
                currentMinZoom = 0;
                map.setMinZoom(1);
                map.setMaxZoom(10);
            }

            currentLayer = L.tileLayer(`${API_BASE}/tiles/${dataset}/${footprint}/{z}/{x}/{y}.png`, {
                attribution: `&copy; ${dataset}/${footprint}`,
                noWrap: true,
                // bounds: bounds
            }).addTo(map);
            map.setMaxBounds();

            const mapBounds = L.latLngBounds(bounds);
            map.setView(mapBounds.getCenter(), minApiZoom);
            updateZoomInfo();
        } catch (error) {
            console.error('Error loading dataset:', error);
            alert(`Failed to load dataset: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    async function loadAnnotations() {
        try {
            const params = new URLSearchParams({ dataset: currentDataset, footprint: currentFootprint });
            const res = await fetch(`${API_BASE}/annotations?${params.toString()}`);
            const data = await res.json();
            drawnItems.clearLayers();
            data.forEach((a) => {
                const layer = L.geoJSON(a.geojson).getLayers()[0];
                if (a.label) {
                    layer._label = a.label;
                    layer.bindTooltip(a.label, { permanent: true, direction: 'top' }).openTooltip();
                }
                layer._annotationId = a.id;
                layer._dataset = a.dataset;
                layer._footprint = a.footprint;
                drawnItems.addLayer(layer);
            });
        } catch (error) {
            console.error('Failed to load annotations:', error);
        }
    }

    async function handleCreateAnnotation(e) {
        const layer = e.layer;
        const label = prompt(`Enter label for this annotation:`);
        if (label) {
            layer._label = label;
            layer.bindTooltip(label, { permanent: true, direction: 'center' }).openTooltip();
        }
        drawnItems.addLayer(layer);
        const annotation = {
            id: String(Date.now()),
            dataset: currentDataset,
            footprint: currentFootprint,
            geojson: layer.toGeoJSON(),
            label: label
        };
        try {
            await fetch(`${API_BASE}/annotations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(annotation)
            });
            layer._annotationId = annotation.id;
        } catch (error) {
            console.error('Failed to save annotation:', error);
        }
    }

    async function handleDeleteAnnotation(e) {
        e.layers.eachLayer(async (layer) => {
            if (layer._annotationId) {
                const params = new URLSearchParams({
                    dataset: currentDataset,
                    footprint: currentFootprint
                });
                await fetch(`${API_BASE}/annotations/${layer._annotationId}?${params.toString()}`, {
                    method: 'DELETE'
                });
            }
        });
    }

    function drawResults(data, clearFirst = false) {
        if (clearFirst) {
            highlightLayer.clearLayers();
        }
        data.similar_tiles.forEach((tile) => {
            const bounds = [
                [tileYToLat(tile.y + 1, tile.z), tileXToLng(tile.x, tile.z)],
                [tileYToLat(tile.y, tile.z), tileXToLng(tile.x + 1, tile.z)]
            ];
            const rect = L.rectangle(bounds, { color: '#80ef80', weight: 2, fillOpacity: 0.3 });
            const tooltipText = `Score: ${tile.score.toFixed(3)} Zoom: ${tile.z}`;
            rect.bindTooltip(tooltipText, { permanent: true, direction: 'top' }).openTooltip();
            highlightLayer.addLayer(rect);
        });
    }

    async function handleAnnotationClick(e) {
        const layer = e.layer || e.target;
        if (!layer._annotationId) return;

        if (findSimilarMode) {
            findSimilarMode = false;
            showLoading('Searching for similar features...');
            searchedZooms = [];
            currentQueryLayer = layer;
            searchDeeperBtn.disabled = true;

            const currentZoom = map.getZoom();
            try {
                const url = `${API_BASE}/annotations/similar?top_k=${TOP_K}&zoom=${currentZoom}`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        annotation_id: layer._annotationId,
                        dataset: currentDataset,
                        footprint: currentFootprint,
                        geojson: layer.toGeoJSON()
                    })
                });
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.detail || `HTTP ${res.status}`);
                }
                const data = await res.json();
                drawResults(data, true);
                searchedZooms.push(currentZoom);
                if (highlightLayer.getLayers().length > 0) {
                    map.fitBounds(highlightLayer.getBounds().pad(0.1));
                    searchDeeperBtn.disabled = false;
                }
            } catch (err) {
                console.error('Similarity search error:', err);
                alert(`An error occurred during search: ${err.message}`);
            } finally {
                hideLoading();
            }
        } else {
            const newLabel = prompt('Edit label:', layer._label || '');
            if (newLabel !== null) {
                layer._label = newLabel;
                layer.getTooltip().setContent(newLabel);
                const params = new URLSearchParams({
                    dataset: currentDataset,
                    footprint: currentFootprint
                });
                await fetch(`${API_BASE}/annotations/${layer._annotationId}?${params.toString()}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ label: newLabel })
                });
            }
        }
    }

    async function handleSearchDeeper() {
        if (!currentQueryLayer) {
            alert('Please perform an initial search first.');
            return;
        }
        showLoading('Searching other zoom levels...');
        searchDeeperBtn.disabled = true;

        try {
            const url = `${API_BASE}/annotations/similar/more?top_k=${TOP_K}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    annotation_id: currentQueryLayer._annotationId,
                    dataset: currentDataset,
                    footprint: currentFootprint,
                    geojson: currentQueryLayer.toGeoJSON(),
                    exclude_zooms: searchedZooms
                })
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.detail || `HTTP ${res.status}`);
            }
            const data = await res.json();
            drawResults(data, false);
            searchedZooms.push(...availableZooms.filter((z) => !searchedZooms.includes(z)));
            if (highlightLayer.getLayers().length > 0) {
                map.fitBounds(highlightLayer.getBounds().pad(0.1));
            } else {
                alert('No additional similar tiles found in other zoom levels.');
            }
        } catch (err) {
            console.error('Deeper search error:', err);
            alert(`An error occurred during deeper search: ${err.message}`);
        } finally {
            hideLoading();
        }
    }

    function handleKeydown(e) {
        if (e.key === 'Escape') {
            findSimilarMode = false;
            hideLoading();
        }
        if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
            clearHighlights();
        }
    }

    function handleFindSimilar() {
        findSimilarMode = true;
        alert(`Find Similar Mode Activated!\n\nClick an annotation to find similar features.`);
    }

    function clearHighlights() {
        highlightLayer.clearLayers();
        searchedZooms = [];
        currentQueryLayer = null;
        searchDeeperBtn.disabled = true;
    }

    // ---------- PARTICLES BACKGROUND ----------
    const container = document.getElementById("particles");
    if (container) {
        const count = 50;
        for (let i = 0; i < count; i++) {
            const p = document.createElement("div");
            p.className = "particle";
            p.style.left = Math.random() * 100 + "%";
            p.style.top = Math.random() * 100 + "%";
            p.style.animationDelay = Math.random() * 6 + "s";
            p.style.animationDuration = Math.random() * 3 + 3 + "s";
            container.appendChild(p);
        }
    }
});