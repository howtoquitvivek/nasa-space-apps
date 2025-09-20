<script>
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { selectedDataset } from '$lib/store.js';
  import markerIcon from '$lib/assets/marker-icon.png';
  import DownloadsPanel from '$lib/components/DownloadsPanel.svelte';
  import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';

  let isLoading = false;
  let statusMessage = '';
  let isSidebarOpen = true;
  let showConfirmationModal = false;
  let selectedFootprint = null;

  let mapContainer;
  let map;
  let L;
  let currentLayer;
  let footprintLayer;

  // Datasets stub
  const datasets = {
    mars_viking_vis: {
      id: 'mars_viking_vis',
      name: 'Mars: Viking VIS Global Color Mosaic',
      tileUrl:
        'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0//default/default028mm/{z}/{y}/{x}.jpg',
      maxZoom: 7
    },
    venus_magellan_gt: {
      id: 'venus_magellan_gt',
      name: 'Venus: Magellan Global Topography',
      tileUrl:
        'https://trek.nasa.gov/tiles/Venus/EQ/Venus_Magellan_C3-MDIR_Global_Mosaic_2025m/1.0.0/default/default028mm/{z}/{y}/{x}.png',
      maxZoom: 7
    },
    mercury_messenger_mds: {
      id: 'mercury_messenger_mds',
      name: 'Mercury: MESSENGER Global Mosaic',
      tileUrl:
        'https://trek.nasa.gov/tiles/Mercury/EQ/Mercury_MESSENGER_MDIS_Basemap_BDR_Mosaic_Global_166m/1.0.0//default/default028mm/{z}/{y}/{x}.jpg',
      maxZoom: 8
    }
  };

  // Reactive dataset from URL
  $: datasetId = $page.params.id;
  $: currentDataset = datasets[datasetId] || null;

  // Sync store
  $: if (currentDataset) selectedDataset.set(currentDataset);

  // Load footprints JSON
  async function loadFootprints() {
    if (!currentDataset) return;

    try {
      isLoading = true;
      statusMessage = 'Loading footprints...';

      const url = `/${datasetId}_footprints.json`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load footprints');

      const data = await res.json();
      footprintLayer.clearLayers();

      data.forEach((footprint) => {
        const [minLng, minLat, maxLng, maxLat] = footprint.bbox;

        const rect = L.rectangle(
          [
            [minLat, minLng],
            [maxLat, maxLng]
          ],
          {
            color: 'white',
            weight: 0.7,
            fillOpacity: 0.1
          }
        ).addTo(footprintLayer);

        rect.on('click', () => {
          selectedFootprint = footprint;
          showConfirmationModal = true;
        });
      });

      if (footprintLayer.getLayers().length > 0) {
        map.fitBounds(footprintLayer.getBounds(), { padding: [50, 50] });
      }
    } catch (err) {
      console.error('Error loading footprints:', err);
      alert('Failed to load footprint data.');
    } finally {
      isLoading = false;
      statusMessage = '';
    }
  }

  onMount(async () => {
    if (!currentDataset) return;

    L = (await import('leaflet')).default;

    const DefaultIcon = L.icon({
      iconUrl: markerIcon,
      iconSize: [25, 41],
      iconAnchor: [12, 41]
    });
    L.Marker.prototype.options.icon = DefaultIcon;

    map = L.map(mapContainer, {
      crs: L.CRS.EPSG4326,
      center: [0, 0],
      zoom: 1,
      maxZoom: currentDataset.maxZoom,
      zoomControl: false
    });

    currentLayer = L.tileLayer(currentDataset.tileUrl, {
      maxZoom: currentDataset.maxZoom,
      noWrap: true,
      attribution: currentDataset.name
    }).addTo(map);

    footprintLayer = new L.FeatureGroup().addTo(map);

    await loadFootprints();
  });

  function handleFootprintSelect(event) {
    alert('Footprint selected: ' + event.detail);
  }

  // --- INGESTION LOGIC (INTEGRATED FROM OLD PAGE) ---

  function handleIngestionConfirm(event) {
    showConfirmationModal = false;
    const { footprint, datasetId, zoomRange } = {
      footprint: selectedFootprint,
      datasetId: currentDataset.id,
      zoomRange: event.detail
    };

    const payload = {
      footprintId: footprint.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, ''),
      datasetId: datasetId,
      tileUrl: footprint.tileUrl,
      tilesPerZoom: footprint.downloadInfo.tilesPerZoom,
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

      setTimeout(() => {
        isLoading = false;
      }, 5000);
    } catch (err) {
      statusMessage = `❌ Error: ${err.message}`;
      console.error(err);
      setTimeout(() => {
        isLoading = false;
      }, 5000);
    }
  }
</script>

{#if isLoading}
  <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[2000]">
    <div class="text-center text-white p-8 bg-gray-800 rounded-lg shadow-lg">
      <div class="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-blue-500 mx-auto"></div>
      <h2 class="text-2xl font-semibold mt-4">Processing Data</h2>
      <p class="mt-2 max-w-sm">{statusMessage}</p>
    </div>
  </div>
{/if}

<div class="workspace-layout">
  <div class="sidebar-container" class:collapsed={!isSidebarOpen}>
    <DownloadsPanel datasetId={$selectedDataset?.id} on:select={handleFootprintSelect} />
  </div>

  <div class="main-content">
    <button class="toggle-btn" on:click={() => (isSidebarOpen = !isSidebarOpen)}>
      {isSidebarOpen ? '⏴' : '⏵'}
    </button>

    {#if $selectedDataset}
      <div class="map-instance" bind:this={mapContainer}></div>
    {:else}
      <div class="empty-state-container">
        <div class="empty-state-card">
          <h2 class="empty-state-title">No Project Selected</h2>
          <p class="empty-state-text">
            Go to the <a href="/home" class="empty-state-link">Home Dashboard</a> to start a project.
          </p>
        </div>
      </div>
    {/if}

    {#if showConfirmationModal}
      <ConfirmationModal
        footprint={selectedFootprint}
        datasetId={currentDataset.id}
        on:confirm={handleIngestionConfirm}
        on:cancel={() => (showConfirmationModal = false)}
      />
    {/if}
  </div>
</div>

<style>
  @import 'leaflet/dist/leaflet.css';
  @import 'leaflet-draw/dist/leaflet.draw.css';

  .workspace-layout {
    display: flex;
    height: 100vh;
    background-color: #f8fafc;
  }
  .sidebar-container {
    width: 280px;
    background: #fff;
    border-right: 1px solid #e2e8f0;
    transition: width 0.3s;
  }
  .sidebar-container.collapsed {
    width: 0;
  }
  .main-content {
    flex-grow: 1;
    position: relative;
    padding: 0.3rem;
    box-sizing: border-box;
  }
  .map-instance {
    width: 100%;
    height: 100%;
    border-radius: 12px;
    overflow: hidden;
    background-color: #e2e8f0;
  }
  .toggle-btn {
    position: absolute;
    top: 1rem;
    left: 0;
    transform: translateX(-50%);
    width: 32px;
    height: 32px;
    background: #ffffffcc;
    border-radius: 50%;
    border: 1px solid #e2e8f0;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    color: #475569;
    transition: background 0.2s, transform 0.2s;
  }
  .toggle-btn:hover {
    background: #ffffff;
    transform: translateX(-50%) scale(1.1);
  }
</style>