<script>
  import { onMount } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import 'leaflet-draw';
  import 'leaflet-draw/dist/leaflet.draw.css';

  // This `onMount` function is a Svelte lifecycle function.
  // Code inside it only runs once the component is rendered to the screen,
  // which guarantees that the <div id="map"> exists. This solves our old timing issues.
  onMount(() => {
    // Fix for default Leaflet icon issues with bundlers
    const DefaultIcon = L.icon({
        iconUrl: '/src/lib/assets/marker-icon.png', // We'll add this image next
        shadowUrl: '/src/lib/assets/marker-shadow.png', // And this one
        iconSize: [25, 41],
        iconAnchor: [12, 41]
    });
    L.Marker.prototype.options.icon = DefaultIcon;

    const map = L.map('map', {
      center: [20, 0], // Centered on the world
      zoom: 2,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Add a base tile layer (using OpenStreetMap for now)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
        edit: { featureGroup: drawnItems },
        draw: {
            polygon: true,
            polyline: true,
            rectangle: true,
            circle: false,
            marker: true,
            circlemarker: false
        }
    });
    map.addControl(drawControl);

    // TODO: Add back the event listeners for drawing, etc.
  });
</script>

<div id="map" />

<style>
  #map {
    height: 100%;
    width: 100%;
    border-radius: var(--radius-md);
  }

  /* --- Leaflet Control Overrides --- */
  /* Make sure these styles are applied correctly */
  :global(.leaflet-control-container .leaflet-control) {
      background: rgba(10, 10, 10, 0.8);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(125, 156, 183, 0.2);
      box-shadow: var(--shadow-lg);
      border-radius: var(--radius-md);
      color: var(--color-light);
  }
  :global(.leaflet-control-zoom a) {
      background-color: transparent !important;
      color: var(--color-light) !important;
      border-bottom: 1px solid rgba(125, 156, 183, 0.2);
      transition: var(--transition-normal);
  }
  :global(.leaflet-draw-toolbar a) {
      background: transparent !important;
  }
  :global(.leaflet-popup-content-wrapper, .leaflet-popup-tip) {
      background: rgba(26, 26, 26, 0.9) !important;
      color: var(--color-light) !important;
  }
</style>