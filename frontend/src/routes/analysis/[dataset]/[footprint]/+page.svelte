<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';

	// --- CONSTANTS ---
	const API_BASE = 'http://localhost:8000';
	const TOP_K = 10;

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
	let isLoading = false;
	let statusMessage = '';
	let zoomInfo = '';
	let currentMinZoom = 1; // Holds the min zoom of the currently loaded dataset
	let deleteIcon;

	// New state for toggles
	let showAnnotations = true;
	let showLabels = true;

	const { dataset: currentDataset, footprint: currentFootprint } = $page.params;

	// --- LIFECYCLE ---
	onMount(async () => {
		L = (await import('leaflet')).default;
		window.L = L;
		await import('leaflet-draw');

		const markerIcon = (await import('$lib/assets/marker-icon.png')).default;
		const markerShadow = (await import('$lib/assets/marker-shadow.png')).default;
		const DefaultIcon = L.icon({
			iconUrl: markerIcon,
			shadowUrl: markerShadow,
			iconSize: [25, 41],
			iconAnchor: [12, 41]
		});
		L.Marker.prototype.options.icon = DefaultIcon;
		// Define the custom icon here
		deleteIcon = L.icon({
			iconUrl:
				'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0iI2RjMjYyNiI+PHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNMTAgMThhOCA4IDAgMTAwLTE2IDggOCAwIDAwMCAxNnpNOC4yOCA3LjIyYS43NS43NSAwIDAwLTEuMDYgMS4wNkw4Ljk0IDEwbC0xLjcyIDEuNzJhLjc1Ljc1IDAgMTAxLjA2IDEuMDZMMTAgMTEuMDZsMS43MiAxLjcyYS43NS43NSAwIDEwMS4wNi0xLjA2TDExLjA2IDEwbDEuNzItMS43MmEuNzNS43NSAwIDAwLTEuMDYtMS4wNkwxMCA4Ljk0IDguMjggNy4yMnoiIGNsaXAtcnVsZT0iZXZlbm9kZCIgLz48L3N2Zz4=',
			iconSize: [20, 20],
			iconAnchor: [10, 10]
		});

		map = L.map('map-container', {
			center: [0, 0],
			zoom: 1,
			zoomControl: false
		});

		L.control.zoom({ position: 'bottomright' }).addTo(map);

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

		document.addEventListener('keydown', handleKeydown);

		await loadDataset(currentDataset, currentFootprint);
		await loadAnnotations();
	});

	// --- HELPER FUNCTIONS ---
	function updateZoomInfo() {
		if (!map) return;
		const displayZoom = map.getZoom() - currentMinZoom;
		zoomInfo = `Zoom Level: ${displayZoom} | Analyzing: ${currentDataset}/${currentFootprint}`;
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
		} else {
			map.removeLayer(drawnItems);
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
		if (currentLayer) map.removeLayer(currentLayer);
		isLoading = true;
		statusMessage = `Loading dataset: ${dataset}/${footprint}...`;

		try {
			const res = await fetch(`${API_BASE}/datasets/${dataset}/${footprint}/bounds`);
			if (!res.ok) {
				throw new Error(`Failed to load dataset bounds. Status: ${res.status}`);
			}
			const data = await res.json();
			const { bounds } = data;

			console.log(`Loading dataset: ${dataset}/${footprint}`, {
				bounds: data.bounds,
				available_zooms: data.available_zooms
			});

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
				currentMinZoom = 1;
				map.setMinZoom(1);
				map.setMaxZoom(18);
			}

			currentLayer = L.tileLayer(`${API_BASE}/tiles/${dataset}/${footprint}/{z}/{x}/{y}.png`, {
				attribution: `&copy; ${dataset}/${footprint}`,
				noWrap: true,
				errorTileUrl: '',
				bounds: bounds // This line prevents unnecessary 404s
			}).addTo(map);

			map.setMaxBounds(bounds);

			const mapBounds = L.latLngBounds(bounds);
			map.setView(mapBounds.getCenter(), minApiZoom);

			updateZoomInfo();
		} catch (error) {
			console.error('Error loading dataset:', error);
			alert(`Failed to load dataset: ${error.message}`);
		} finally {
			isLoading = false;
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
			isLoading = true;
			statusMessage = 'Searching for similar features...';
			searchedZooms = [];
			currentQueryLayer = layer;

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
				}
			} catch (err) {
				console.error('Similarity search error:', err);
				alert(`An error occurred during search: ${err.message}`);
			} finally {
				isLoading = false;
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
		isLoading = true;
		statusMessage = 'Searching other zoom levels...';
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
			isLoading = false;
		}
	}

	function handleKeydown(e) {
		if (e.key === 'Escape') {
			findSimilarMode = false;
			isLoading = false;
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
	}
</script>

<div class="page-container">
	{#if isLoading}
		<div class="loading-overlay">
			<div class="spinner-card">
				<div class="spinner"> </div>
				<p>{statusMessage}</p>
			</div>
		</div>
	{/if}

	<a href="/home" class="home-link-standalone"> &larr; Back to Home </a>

	<div class="top-bar">
		<div class="zoom-info">{zoomInfo}</div>
	</div>

	<div class="vertical-controls">
		<button on:click={handleFindSimilar} class="btn btn-primary" title="Find Similar">🔬</button>
		<button
			on:click={handleSearchDeeper}
			disabled={!currentQueryLayer || searchedZooms.length === 0}
			class="btn btn-secondary"
			title="Search Deeper"
		>
			🔭
		</button>
		<button on:click={toggleAnnotations} class="btn btn-secondary" title="Show/Hide Annotations">
			{#if showAnnotations}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					width="18"
					height="18"
				>
					<path
						d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
					/>
					<path
						fill-rule="evenodd"
						d="M.664 10.59a1.651 1.651 0 010-1.18l.88-1.84a.25.25 0 01.447.113l.491 1.023A24.75 24.75 0 0010 8.5c1.24 0 2.454.126 3.633.368l.49-1.023a.25.25 0 01.448-.113l.88 1.84c.196.41.196.87 0 1.18l-.88 1.84a.25.25 0 01-.447-.113l-.491-1.023A24.75 24.75 0 0010 11.5c-1.24 0-2.454-.126-3.633-.368l-.49 1.023a.25.25 0 01-.448.113l-.88-1.84z"
						clip-rule="evenodd"
					/>
				</svg>
			{:else}
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 20 20"
					fill="currentColor"
					width="18"
					height="18"
				>
					<path
						fill-rule="evenodd"
						d="M3.28 2.22a.75.75 0 00-1.06 1.06l14.5 14.5a.75.75 0 101.06-1.06l-1.745-1.745a10.029 10.029 0 003.3-4.38c.351-.744.351-1.558 0-2.302-1.242-2.639-4.03-6.25-8.078-6.25a15.24 15.24 0 00-2.066.24l-1.312-1.312A.75.75 0 003.28 2.22zM10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
						clip-rule="evenodd"
					/>
					<path
						d="M10 4.5c2.903 0 5.404 2.29 7.214 5.093a.75.75 0 01-.42 1.053l-.88 1.84a.25.25 0 01-.447-.113l-.49-1.023A24.75 24.75 0 0010 11.5c-1.24 0-2.454-.126-3.633-.368l-.49 1.023a.25.25 0 01-.448.113l-.88-1.84a.75.75 0 01-.42-1.053C4.596 6.79 7.097 4.5 10 4.5z"
					/>
				</svg>
			{/if}
		</button>
		<button on:click={toggleLabels} class="btn btn-secondary" title="Show/Hide Labels">[T]</button>
		<button on:click={clearHighlights} class="btn btn-danger" title="Clear Results">❌</button>
	</div>

	<div id="map-container" class="map-instance" > </div>
</div>

<style>
	@import 'leaflet/dist/leaflet.css';
	@import 'leaflet-draw/dist/leaflet.draw.css';

	:global(:root) {
		--bg-primary: #f8fafc;
		--text-primary: #1e293b;
		--text-secondary: #475569;
		--text-accent: #3b82f6;
		--text-danger: #ef4444;
		--border-color: #e2e8f0;
		--card-bg: #ffffff;
		--shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
	}

	:global(body) {
		font-family: 'Inter', sans-serif;
		background: var(--bg-primary);
		color: var(--text-primary);
		margin: 0;
	}

	.page-container {
		position: relative;
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.map-instance {
		height: 100%;
		width: 100%;
		background: #e2e8f0;
	}

	.home-link-standalone {
		position: absolute;
		bottom: 1rem;
		left: 1rem;
		z-index: 1000;
		background: rgba(255, 255, 255, 0.516);
		backdrop-filter: blur(8px);
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		box-shadow: var(--shadow);
		border: 1px solid var(--border-color);
		color: var(--text-accent);
		text-decoration: none;
		font-weight: 500;
		white-space: nowrap;
		font-size: 0.8rem; /* Added this line */
	}
	.home-link-standalone:hover {
		text-decoration: underline;
	}

	.top-bar {
		position: absolute;
		z-index: 1000;
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(8px);
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		box-shadow: var(--shadow);
		border: 1px solid var(--border-color);
		display: flex;
		align-items: center;
		top: 1rem;
		right: 1.4rem;
	}

	.vertical-controls {
		position: absolute;
		top: 50%;
		right: 1.4rem;
		transform: translateY(-50%);
		z-index: 1000;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		background: rgba(255, 255, 255, 0.9);
		backdrop-filter: blur(8px);
		padding: 0.5rem;
		border-radius: 0.5rem;
		box-shadow: var(--shadow);
		border: 1px solid var(--border-color);
	}

	.zoom-info {
		font-family: monospace;
		font-size: 0.9rem;
		color: var(--text-secondary);
		white-space: nowrap;
	}

	.btn {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 0.375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		display: inline-flex;
		align-items: center;
		justify-content: center; /* Center content for icon buttons */
		gap: 0.5rem;
		width: 40px; /* Set fixed width for vertical buttons */
		height: 40px; /* Set fixed height */
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background-color: var(--text-accent);
		color: white;
	}
	.btn-primary:hover:not(:disabled) {
		background-color: #2563eb;
		transform: translateY(-1px);
	}

	.btn-secondary {
		background-color: var(--card-bg);
		color: var(--text-secondary);
		border: 1px solid var(--border-color);
	}
	.btn-secondary:hover:not(:disabled) {
		border-color: #94a3b8;
		color: var(--text-primary);
	}

	.btn-danger {
		background-color: var(--text-danger);
		color: white;
	}
	.btn-danger:hover:not(:disabled) {
		background-color: #dc2626;
	}

	.loading-overlay {
		position: absolute;
		inset: 0;
		background-color: rgba(255, 255, 255, 0.7);
		backdrop-filter: blur(4px);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 2000;
		color: var(--text-primary);
	}
	.spinner-card {
		background: var(--card-bg);
		padding: 1.5rem 2rem;
		border-radius: 0.5rem;
		box-shadow: var(--shadow);
		display: flex;
		align-items: center;
		gap: 1rem;
	}
	.spinner {
		border: 4px solid var(--border-color);
		border-radius: 50%;
		border-top: 4px solid var(--text-accent);
		width: 24px;
		height: 24px;
		animation: spin 1s linear infinite;
	}

	:global(.leaflet-draw-section .leaflet-draw-toolbar a) {
		background-color: var(--card-bg) !important;
		border-bottom: 1px solid var(--border-color) !important;
	}
	:global(.leaflet-control-container .leaflet-bar) {
		background-color: var(--card-bg) !important;
		border: 1px solid var(--border-color) !important;
		box-shadow: var(--shadow) !important;
		border-radius: 0.5rem !important;
	}
	:global(.leaflet-control-container .leaflet-bar a) {
		background-color: var(--card-bg) !important;
		color: var(--text-primary) !important;
		border-bottom: 1px solid var(--border-color) !important;
		width: 32px !important;
		height: 32px !important;
		line-height: 32px !important;
	}
	:global(.leaflet-control-container .leaflet-bar a:hover) {
		background-color: #f1f5f9 !important;
	}
	:global(.leaflet-control-container .leaflet-bar a:first-child) {
		border-top-left-radius: 0.5rem !important;
		border-top-right-radius: 0.5rem !important;
	}
	:global(.leaflet-control-container .leaflet-bar a:last-child) {
		border-bottom-left-radius: 0.5rem !important;
		border-bottom-right-radius: 0.5rem !important;
		border-bottom: none !important;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
</style>