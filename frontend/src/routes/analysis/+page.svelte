<script>
    import { onMount } from 'svelte';

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
    let currentDataset = 'hirise'; // Default dataset
    let currentFootprint = 'test_data'; // Default footprint
    let isLoading = false;
    let statusMessage = '';
    let zoomInfo = '';

    const API_BASE = 'http://localhost:8000';
    const TOP_K = 5;

    // Persistent storage keys
    const STORAGE_KEYS = {
        dataset: 'currentDataset',
        footprint: 'currentFootprint', 
        zoom: 'mapZoom',
        center: 'mapCenter'
    };

    // --- LIFECYCLE ---
    onMount(async () => {
        // Load saved values from localStorage
        currentDataset = localStorage.getItem(STORAGE_KEYS.dataset) || 'hirise';
        currentFootprint = localStorage.getItem(STORAGE_KEYS.footprint) || 'test_data';
        
        const savedZoom = localStorage.getItem(STORAGE_KEYS.zoom);
        const savedCenter = JSON.parse(localStorage.getItem(STORAGE_KEYS.center)) || [0, 0];

        // Import Leaflet and make global
        L = (await import('leaflet')).default;
        window.L = L;

        // Import Leaflet Draw
        await import('leaflet-draw');

        // Icons
        const markerIcon = (await import('$lib/assets/marker-icon.png')).default;
        const markerShadow = (await import('$lib/assets/marker-shadow.png')).default;

        const DefaultIcon = L.icon({
            iconUrl: markerIcon,
            shadowUrl: markerShadow,
            iconSize: [25, 41],
            iconAnchor: [12, 41]
        });
        L.Marker.prototype.options.icon = DefaultIcon;

        // Initialize map with saved center and zoom
        map = L.map('map-container', {
            center: savedCenter,
            zoom: savedZoom ? parseInt(savedZoom) : 2,
            minZoom: 1,
            maxZoom: 5,
            zoomControl: false
        });

        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Map event listeners for persistence
        map.on('zoomend moveend', () => {
            localStorage.setItem(STORAGE_KEYS.zoom, map.getZoom());
            localStorage.setItem(STORAGE_KEYS.center, JSON.stringify(map.getCenter()));
            updateZoomInfo();
        });

        drawnItems = new L.FeatureGroup().addTo(map);
        highlightLayer = new L.FeatureGroup().addTo(map);

        const drawControl = new L.Control.Draw({
            edit: { featureGroup: drawnItems, edit: false, remove: true },
            draw: { polygon: true, polyline: true, rectangle: { showArea: false }, circle: false, circlemarker: false, marker: true }
        });
        map.addControl(drawControl);

        // Event Listeners
        map.on(L.Draw.Event.CREATED, handleCreateAnnotation);
        map.on('draw:deleted', handleDeleteAnnotation);
        drawnItems.on('click', handleAnnotationClick);

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeydown);

        await loadDataset(currentDataset, currentFootprint);
        await loadAnnotations();
        updateZoomInfo();
    });

    // --- HELPER FUNCTIONS ---
    function updateZoomInfo() {
        zoomInfo = `Zoom: ${map?.getZoom() || 'N/A'} | Dataset: ${currentDataset}/${currentFootprint}`;
    }

    function tileXToLng(x, z) {
        return (x / Math.pow(2, z)) * 360 - 180;
    }

    function tileYToLat(y, z) {
        const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
        return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    }

    // --- CORE FUNCTIONS ---
    async function loadDataset(dataset, footprint) {
        if (currentLayer) map.removeLayer(currentLayer);

        try {
            const res = await fetch(`${API_BASE}/datasets/${dataset}/${footprint}/bounds`);
            if (!res.ok) {
                alert('Failed to load dataset bounds');
                return;
            }
            const data = await res.json();
            const { bounds } = data;

            currentLayer = L.tileLayer(`${API_BASE}/tiles/${dataset}/${footprint}/{z}/{x}/{y}.webp`, {
                attribution: `&copy; ${dataset}/${footprint} dataset`,
                noWrap: true,
                bounds: bounds,
                errorTileUrl: ""
            }).addTo(map);

            map.setMaxBounds(bounds);

            const savedZoom = localStorage.getItem(STORAGE_KEYS.zoom);
            const savedCenter = JSON.parse(localStorage.getItem(STORAGE_KEYS.center));
            if (!savedZoom || !savedCenter) {
                map.fitBounds(bounds);
            }

            localStorage.setItem(STORAGE_KEYS.dataset, dataset);
            localStorage.setItem(STORAGE_KEYS.footprint, footprint);
            updateZoomInfo();
            
            if (data.available_zooms) {
                console.log(`Available zoom levels for ${dataset}:`, data.available_zooms);
                availableZooms = data.available_zooms;
            }

        } catch (error) {
            console.error('Error loading dataset:', error);
            alert(`Failed to load dataset: ${error.message}`);
        }
    }

    async function loadAnnotations() {
        try {
            // CHANGED: Pass dataset and footprint as query parameters
            const params = new URLSearchParams({
                dataset: currentDataset,
                footprint: currentFootprint
            });
            const res = await fetch(`${API_BASE}/annotations?${params.toString()}`);
            const data = await res.json();
            drawnItems.clearLayers();
            
            // NOTE: The .filter() is no longer needed as the backend does it now
            data.forEach(a => {
                const layer = L.geoJSON(a.geojson).getLayers()[0];
                if (a.label) {
                    layer._label = a.label;
                    layer.bindTooltip(a.label, { permanent: true, direction: "top" }).openTooltip();
                }
                layer._annotationId = a.id;
                // Store dataset and footprint info on the layer for easy access later
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
        const currentZoom = map.getZoom();
        const label = prompt(`Enter label for this annotation:\n(Current zoom level: ${currentZoom})`);
        
        if (label) {
            layer._label = label;
            layer.bindTooltip(label, { permanent: true, direction: "center" }).openTooltip();
        }
        drawnItems.addLayer(layer);
        
        const geojson = layer.toGeoJSON();
        // CHANGED: Added footprint to the annotation payload
        const annotation = { 
            id: String(Date.now()), 
            dataset: currentDataset, 
            footprint: currentFootprint,
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
            layer._annotationId = annotation.id;
            layer._dataset = annotation.dataset;
            layer._footprint = annotation.footprint;
        } catch (error) {
            console.error("Failed to save annotation:", error);
        }
    }

    async function handleDeleteAnnotation(e) {
        e.layers.eachLayer(async (layer) => {
            if (layer._annotationId) {
                // CHANGED: Pass dataset and footprint as query parameters for deletion
                const params = new URLSearchParams({
                    dataset: layer._dataset || currentDataset,
                    footprint: layer._footprint || currentFootprint
                });
                await fetch(`${API_BASE}/annotations/${layer._annotationId}?${params.toString()}`, { 
                    method: "DELETE" 
                });
            }
        });
    }

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

    async function handleAnnotationClick(e) {
        const layer = e.layer || e.target;
        if (!layer._annotationId) return;

        if (findSimilarMode) {
            findSimilarMode = false;
            isLoading = true;
            statusMessage = 'Searching for similar tiles...';
            
            searchedZooms = [];
            currentQueryLayer = layer;

            const currentZoom = map.getZoom();
            const geojson = layer.toGeoJSON();

            try {
                // This will need a similar update if/when your similarity search
                // becomes footprint-aware. For now, it sends the main dataset.
                const url = `${API_BASE}/annotations/similar?top_k=${TOP_K}&zoom=${currentZoom}`;
                const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        annotation_id: layer._annotationId,
                        dataset: currentDataset,
                        footprint: currentFootprint, // Also good to send this
                        geojson: geojson
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
                }

            } catch (err) {
                console.error("Similarity search error:", err);
                alert(`An error occurred during search: ${err.message}`);
            } finally {
                isLoading = false;
            }
        } else {
            // Edit label logic
            const newLabel = prompt("Edit label:", layer._label || "");
            if (newLabel !== null && layer._annotationId) {
                layer._label = newLabel;
                layer.bindTooltip(newLabel, { permanent: true, direction: "top" }).openTooltip();

                // CHANGED: Pass dataset and footprint as query parameters for updating
                const params = new URLSearchParams({
                    dataset: layer._dataset || currentDataset,
                    footprint: layer._footprint || currentFootprint
                });

                await fetch(`${API_BASE}/annotations/${layer._annotationId}?${params.toString()}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ label: newLabel })
                });
            }
        }
    }

    async function handleSearchDeeper() {
        if (!currentQueryLayer) {
            alert("Please perform an initial search first.");
            return;
        }

        isLoading = true;
        statusMessage = 'Searching other zoom levels...';

        const geojson = currentQueryLayer.toGeoJSON();

        try {
            const url = `${API_BASE}/annotations/similar/more?top_k=${TOP_K}`;
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    annotation_id: currentQueryLayer._annotationId,
                    dataset: currentDataset,
                    footprint: currentFootprint,
                    geojson: geojson,
                    exclude_zooms: searchedZooms
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.detail || `HTTP ${res.status}`);
            }
            
            const data = await res.json();
            drawResults(data, false);
            
            searchedZooms.push(...availableZooms.filter(z => !searchedZooms.includes(z)));

            if (highlightLayer.getLayers().length > 0) {
                map.fitBounds(highlightLayer.getBounds().pad(0.1));
            } else {
                alert("No additional similar tiles found in other zoom levels.");
            }

        } catch (err) {
            console.error("Deeper search error:", err);
            alert(`An error occurred during deeper search: ${err.message}`);
        } finally {
            isLoading = false;
        }
    }

    function handleKeydown(e) {
        if (e.key === 'Escape') {
            findSimilarMode = false;
            isLoading = false;
            console.log("Find similar mode cancelled");
        }
        if (e.key === 'c' && e.ctrlKey) {
            highlightLayer.clearLayers();
            console.log("Cleared highlights (Ctrl+C)");
        }
    }

    // --- UI EVENT HANDLERS ---
    function handleFindSimilar() {
        findSimilarMode = true;
        alert(`Find Similar Mode Activated!\n\nClick on an annotation to find similar tiles.`);
    }

    function clearHighlights() {
        highlightLayer.clearLayers();
        searchedZooms = [];
        currentQueryLayer = null;
        console.log("Cleared all similarity highlights");
    }

    function resetView() {
        map.setZoom(2);
        map.setView([0, 0], 2);
    }

    async function handleDatasetChange(event) {
        const newDataset = event.target.value;
        currentDataset = newDataset;
        // NOTE: We are still using a hardcoded footprint. This is the next thing to fix.
        await loadDataset(currentDataset, currentFootprint);
        await loadAnnotations();
        clearHighlights();
    }
</script>
<div class="page-container">
	{#if isLoading}
		<div class="loading-overlay">
			<div class="spinner"></div>
			<p>{statusMessage}</p>
		</div>
	{/if}

	<!-- Top Controls Bar -->
	<div class="top-controls">
		<div class="dataset-controls">
			<label for="dataset-select">Dataset:</label>
			<select id="dataset-select" bind:value={currentDataset} on:change={handleDatasetChange}>
				<option value="hirise">HiRISE</option>
				<option value="mars">Mars</option>
				<option value="ctx">CTX</option>
			</select>
		</div>
		
		<div class="zoom-info">{zoomInfo}</div>
	</div>

	<!-- Main Controls -->
	<div class="controls">
		<button on:click={handleFindSimilar} class="btn-primary">
			🔬 Find Similar
		</button>
		
		<button 
			on:click={handleSearchDeeper} 
			disabled={!currentQueryLayer || searchedZooms.length === 0}
			class="btn-secondary"
		>
			🔭 Search Deeper
		</button>
		
		<button on:click={clearHighlights} class="btn-danger">
			❌ Clear Results
		</button>
		
		<button on:click={resetView} class="btn-secondary">
			🏠 Reset View
		</button>
	</div>

	<div id="map-container" class="map-instance"></div>

	<!-- Instructions -->
	<div class="instructions">
		<p><strong>Instructions:</strong></p>
		<ul>
			<li>Draw annotations using the tools on the map</li>
			<li>Click "Find Similar" then click an annotation to search</li>
			<li>Use "Search Deeper" to find results in other zoom levels</li>
			<li>Press ESC to cancel find mode, Ctrl+C to clear highlights</li>
		</ul>
	</div>
</div>

<style>
	@import 'leaflet/dist/leaflet.css';
	@import 'leaflet-draw/dist/leaflet.draw.css';

	.page-container {
		position: relative;
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.top-controls {
		position: absolute;
		top: 1rem;
		left: 1rem;
		right: 1rem;
		z-index: 1000;
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(10px);
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	}

	.dataset-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.dataset-controls label {
		font-weight: 600;
		color: #374151;
	}

	.dataset-controls select {
		padding: 0.25rem 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		background: white;
		font-size: 0.875rem;
	}

	.zoom-info {
		font-family: monospace;
		font-size: 0.875rem;
		color: #6b7280;
		background: rgba(243, 244, 246, 0.8);
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
	}

	.controls {
		position: absolute;
		top: 5rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 1000;
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(10px);
		padding: 0.75rem;
		border-radius: 0.5rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.map-instance {
		height: 100%;
		width: 100%;
	}

	button {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 0.375rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 0.875rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.btn-primary {
		background-color: #3b82f6;
		color: white;
	}
	.btn-primary:hover {
		background-color: #2563eb;
	}

	.btn-secondary {
		background-color: #6b7280;
		color: white;
	}
	.btn-secondary:hover {
		background-color: #4b5563;
	}

	.btn-danger {
		background-color: #ef4444;
		color: white;
	}
	.btn-danger:hover {
		background-color: #dc2626;
	}

	button:disabled {
		background-color: #f3f4f6;
		color: #9ca3af;
		cursor: not-allowed;
	}
	button:disabled:hover {
		background-color: #f3f4f6;
	}

	.loading-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		z-index: 2000;
		color: white;
	}

	.spinner {
		border: 4px solid rgba(255, 255, 255, 0.3);
		border-radius: 50%;
		border-top: 4px solid #fff;
		width: 50px;
		height: 50px;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.instructions {
		position: absolute;
		bottom: 1rem;
		left: 1rem;
		z-index: 1000;
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(10px);
		padding: 1rem;
		border-radius: 0.5rem;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
		max-width: 300px;
		font-size: 0.875rem;
	}

	.instructions p {
		margin: 0 0 0.5rem 0;
		color: #374151;
	}

	.instructions ul {
		margin: 0;
		padding-left: 1.25rem;
		color: #6b7280;
		line-height: 1.4;
	}

	.instructions li {
		margin-bottom: 0.25rem;
	}
</style>