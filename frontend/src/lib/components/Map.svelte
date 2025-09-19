<script>
  import { onMount, afterUpdate, createEventDispatcher } from 'svelte';
  import markerIcon from '$lib/assets/marker-icon.png';
  import markerShadow from '$lib/assets/marker-shadow.png';
  import ConfirmationModal from './ConfirmationModal.svelte';

  export let dataset;

  let mapContainer;
  let map;
  let currentLayer;
  let drawnItems;
  let footprintLayer;
  let L;

  let showConfirmationModal = false;
  let selectedFootprint = null;

  const dispatch = createEventDispatcher();
  let prevDatasetId = null;

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

    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    footprintLayer = new L.FeatureGroup();
    map.addLayer(footprintLayer);

    const drawControl = new L.Control.Draw({
      edit: { featureGroup: drawnItems },
      draw: { polygon: true, rectangle: true, marker: true, polyline: true, circle: false, circlemarker: false }
    });
    map.addControl(drawControl);

    loadTileLayer(dataset);
    loadFootprints();
    prevDatasetId = dataset ? dataset.id : null;

    return () => { if (map) map.remove(); };
  });

  afterUpdate(() => {
    if (map && dataset && dataset.id !== prevDatasetId) {
      loadTileLayer(dataset);
      prevDatasetId = dataset.id;
    }
  });

  function loadTileLayer(ds) {
    if (!ds || !map || !L) return;
    if (currentLayer) map.removeLayer(currentLayer);

    currentLayer = L.tileLayer(ds.tileUrl, {
      maxZoom: ds.maxZoom,
      noWrap: true,
      attribution: `&copy; ${ds.name}`
    }).addTo(map);

    map.setView([0, 0], 2);
  }

  async function loadFootprints() {
    try {
      const response = await fetch('/ctx_footprints.json');
      if (!response.ok) throw new Error('Footprint file not found');
      const footprints = await response.json();

      footprints.forEach((footprint) => {
        const [west, south, east, north] = footprint.bbox;
        const bounds = [[south, west], [north, east]];
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

  function handleIngestionConfirm(event) {
    showConfirmationModal = false;
    dispatch('startIngestion', {
      datasetId: dataset.id,
      footprint: selectedFootprint,
      zoomRange: event.detail
    });
  }
</script>

<div class="map-instance" bind:this={mapContainer}></div>

{#if showConfirmationModal}
  <ConfirmationModal 
    footprint={selectedFootprint}
    datasetId={dataset.id}
    on:confirm={handleIngestionConfirm}
    on:cancel={() => showConfirmationModal = false}
  />
{/if}

<style>
  @import 'leaflet/dist/leaflet.css';
  @import 'leaflet-draw/dist/leaflet.draw.css';
  .map-instance { height: 100%; width: 100%; }
</style>
