<script>
	// --- IMPORTS ---
	import { onMount } from 'svelte';
	import { selectedDataset } from '$lib/store.js';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';
	import DownloadsPanel from '$lib/components/DownloadsPanel.svelte';
	import markerIcon from '$lib/assets/marker-icon.png';
	import markerShadow from '$lib/assets/marker-shadow.png';

	// --- STATE ---
	let isLoading = false;
	let statusMessage = '';

	// Map-related state
	let mapContainer;
	let map;
	let L;
	let baseLayer; // The main explorable map layer (e.g., Viking mosaic)
	let analysisLayer; // The layer for a specific downloaded footprint
	let footprintLayer; // Layer for showing clickable footprint outlines for download
	let showConfirmationModal = false;
	let selectedFootprint = null;
	let prevDatasetId = null;

	// --- LIFECYCLE & MAP SETUP ---
	onMount(async () => {
		L = (await import('leaflet')).default;
		await import('leaflet-draw');

		const DefaultIcon = L.icon({
			iconUrl: markerIcon,
			shadowUrl: markerShadow,
			iconSize: [25, 41],
			iconAnchor: [12, 41]
		});
		L.Marker.prototype.options.icon = DefaultIcon;

		map = L.map(mapContainer, {
			crs: L.CRS.EPSG4326,
			center: [0, 0],
			zoom: 2,
			zoomControl: false,
			maxZoom: 16
		});

		L.control.zoom({ position: 'bottomright' }).addTo(map);

		footprintLayer = new L.FeatureGroup();
		map.addLayer(footprintLayer);

		if ($selectedDataset) {
			loadBaseLayer($selectedDataset);
			loadDownloadableFootprints();
			prevDatasetId = $selectedDataset.id;
		}

		return () => {
			if (map) map.remove();
		};
	});

	// Reactive statement to reload when the selected dataset changes
	$: if (map && $selectedDataset && $selectedDataset.id !== prevDatasetId) {
		loadBaseLayer($selectedDataset);
		loadDownloadableFootprints();
		prevDatasetId = $selectedDataset.id;
	}

	// --- MAP FUNCTIONS ---
	function loadBaseLayer(ds) {
		if (!ds || !map || !L) return;
		if (baseLayer) map.removeLayer(baseLayer);
		if (analysisLayer) map.removeLayer(analysisLayer); // Clear analysis layer when base changes

		baseLayer = L.tileLayer(ds.tileUrl, {
			maxZoom: ds.maxZoom,
			noWrap: true,
			attribution: `&copy; ${ds.name}`
		}).addTo(map);

		map.setView([0, 0], 2);
	}

	async function loadDownloadableFootprints() {
		try {
			const response = await fetch('/ctx_footprints.json');
			if (!response.ok) throw new Error('Footprint file not found');
			const footprints = await response.json();
			
			footprintLayer.clearLayers();
			footprints.forEach((footprint) => {
				const [west, south, east, north] = footprint.bbox;
				const bounds = [[south, west],[north, east]];
				const rect = L.rectangle(bounds, { color: '#ff7800', weight: 1, fillOpacity: 0.1 });
				rect.bindTooltip(footprint.title);
				rect.on('click', () => {
					selectedFootprint = footprint;
					showConfirmationModal = true;
				});
				footprintLayer.addLayer(rect);
			});
		} catch (error) {
			console.error('Failed to load footprints:', error);
		}
	}

    // --- NEW ---
    // This function loads a specific, already-downloaded footprint onto the map
	async function handleFootprintSelect(event) {
		const footprintId = event.detail;
		const datasetId = $selectedDataset.id;
		console.log(`Loading analysis area: ${datasetId}/${footprintId}`);

		// Remove any previous analysis layer and hide the base layer for clarity
		if (analysisLayer) map.removeLayer(analysisLayer);
		if (baseLayer) baseLayer.setOpacity(0.3); // Fade out the base layer
        if (footprintLayer) footprintLayer.setOpacity(0); // Hide download outlines

		const res = await fetch(`http://localhost:8000/datasets/${datasetId}/${footprintId}/bounds`);
		if (!res.ok) {
			alert('Could not load bounds for this analysis area.');
			if (baseLayer) baseLayer.setOpacity(1); // Restore base layer on error
            if (footprintLayer) footprintLayer.setOpacity(1);
			return;
		}
		const data = await res.json();
		const { bounds } = data;

		analysisLayer = L.tileLayer(
			`http://localhost:8000/tiles/${datasetId}/${footprintId}/{z}/{x}/{y}.png`,
			{
				attribution: `Analysis Area: ${footprintId}`,
				tms: false
			}
		).addTo(map);

		map.flyToBounds(bounds);
	}

	// --- INGESTION LOGIC ---
	function handleIngestionConfirm(event) {
		showConfirmationModal = false;
		const { zoomRange } = event.detail;
		const payload = {
			footprintId: selectedFootprint.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
			datasetId: $selectedDataset.id,
			tileUrl: selectedFootprint.tileUrl,
			tilesPerZoom: selectedFootprint.downloadInfo.tilesPerZoom,
			minZoom: zoomRange.minZoom,
			maxZoom: zoomRange.maxZoom
		};
		startIngestionRequest(payload);
	}

	async function startIngestionRequest(payload) {
		isLoading = true;
		statusMessage = 'Sending request to backend...';
		try {
			const res = await fetch('http://localhost:8000/ingest', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.detail || 'Ingestion failed on the server.');
			}
			const result = await res.json();
			statusMessage = `✅ Success! New data for '${result.dataset_id}' is ready.`;
			setTimeout(() => { isLoading = false; }, 5000);
		} catch (err) {
			statusMessage = `❌ Error: ${err.message}`;
			console.error(err);
			setTimeout(() => { isLoading = false; }, 5000);
		}
	}
</script>









<div class="workspace-container flex">
	{#if $selectedDataset}
		<!-- Downloads sidebar -->
		<aside class="w-72 bg-white border-r border-gray-200 shadow-lg z-20">
			<DownloadsPanel datasetId={$selectedDataset.id} on:select={handleFootprintSelect} />
		</aside>

		<!-- Map area -->
		<div class="map-wrapper flex-grow relative">
			<div class="map-instance" bind:this={mapContainer}></div>

			<!-- Status overlay in corner -->
			{#if statusMessage && !isLoading}
				<div class="absolute bottom-4 left-4 bg-gray-900 bg-opacity-80 text-white px-4 py-2 rounded-lg shadow-md text-sm">
					{statusMessage}
				</div>
			{/if}
		</div>
	{:else}
		<!-- Empty state -->
		<div class="flex items-center justify-center h-full w-full">
			<div class="text-center max-w-md">
				<div class="mx-auto w-16 h-16 bg-blue-100 text-blue-600 flex items-center justify-center rounded-full mb-4">
					<svg class="w-8 h-8" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
					</svg>
				</div>
				<h2 class="text-2xl font-bold text-gray-800">No Project Selected</h2>
				<p class="text-gray-500 mt-2">
					Go to the
					<a href="/home" class="text-blue-600 font-medium hover:underline">Home Dashboard</a>
					to start a project.
				</p>
			</div>
		</div>
	{/if}
</div>

<!-- Modal -->
{#if showConfirmationModal}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000]">
		<ConfirmationModal
			footprint={selectedFootprint}
			datasetId={$selectedDataset.id}
			on:confirm={handleIngestionConfirm}
			on:cancel={() => (showConfirmationModal = false)}
			class="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg transform transition-all"
		/>
	</div>
{/if}

<!-- Loading overlay -->
{#if isLoading}
	<div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[3000]">
		<div class="text-center text-white p-8 bg-gray-800 rounded-2xl shadow-2xl">
			<div class="w-16 h-16 border-4 border-t-transparent border-blue-500 rounded-full animate-spin mx-auto"></div>
			<h2 class="text-2xl font-semibold mt-4">Processing Data</h2>
			<p class="mt-2 max-w-sm">{statusMessage}</p>
		</div>
	</div>
{/if}





<style>
	@import 'leaflet/dist/leaflet.css';
	@import 'leaflet-draw/dist/leaflet.draw.css';

	.workspace-container {
		position: relative;
		width: 100%;
		height: calc(100vh - 80px); /* Adjust based on your header */
		display: flex;
		background-color: #f9fafb;
	}

	.map-wrapper {
		flex-grow: 1;
		height: 100%;
	}

	.map-instance {
		height: 100%;
		width: 100%;
	}
</style>