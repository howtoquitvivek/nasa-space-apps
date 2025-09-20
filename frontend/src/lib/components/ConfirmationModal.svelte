<script>
  import { createEventDispatcher, onMount } from 'svelte';

  export let footprint;
  export let datasetId;

  const dispatch = createEventDispatcher();
  let dialogElement;

  let availableZooms = [];
  let minZoomAvailable = 0;
  let maxZoomAvailable = 0;
  let selectedMaxZoom = 0;
  let calculatedSize = { mb: 0, count: 0 };
  let existingZooms = [];

  const AVG_TILE_SIZE_KB = 30;

  onMount(async () => {
    if (!footprint || !footprint.downloadInfo) return;

    const footprintId = footprint.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');

    // Fetch existing zooms
    try {
      const res = await fetch(`http://localhost:8000/ingest/status/${datasetId}/${footprintId}`);
      if (res.ok) {
        const data = await res.json();
        existingZooms = data.existingZooms || [];
      } else {
        existingZooms = [];
      }
    } catch (err) {
      console.error('Could not fetch status:', err);
      existingZooms = [];
    }

    availableZooms = Object.keys(footprint.downloadInfo.tilesPerZoom)
      .map(Number)
      .sort((a, b) => a - b);

    if (availableZooms.length > 0) {
      const lastDownloaded = existingZooms.length ? Math.max(...existingZooms) : -1;
      minZoomAvailable = Math.max(availableZooms[0], lastDownloaded + 1);
      maxZoomAvailable = availableZooms[availableZooms.length - 1];
      selectedMaxZoom = maxZoomAvailable;
    }

    dialogElement.showModal();
  });

  $: if (footprint && selectedMaxZoom) {
    calculatedSize = calculateTotalSize(
      footprint.downloadInfo.tilesPerZoom,
      selectedMaxZoom,
      minZoomAvailable
    );
  }

  function calculateTotalSize(tilesPerZoom, maxZoom, minZoom) {
    let totalTiles = 0;
    for (const zoom of availableZooms) {
      if (zoom >= minZoom && zoom <= maxZoom) {
        totalTiles += tilesPerZoom[zoom].count;
      }
    }
    return { count: totalTiles, mb: (totalTiles * AVG_TILE_SIZE_KB) / 1024 };
  }

  function confirm() {
    dispatch('confirm', {
      minZoom: minZoomAvailable,
      maxZoom: selectedMaxZoom
    });
  }

  function cancel() {
    dispatch('cancel');
  }
</script>

<div class="confirmation-modal-overlay">
  <dialog bind:this={dialogElement} on:close={cancel} class="rounded-lg shadow-xl p-0 w-full max-w-lg">
    <div class="p-6">
      <div class="text-center">
        <h2 class="text-2xl font-bold text-gray-800">Configure Analysis Area</h2>
        <p class="text-gray-600 my-2">
          You have selected:
          <strong class="block text-lg text-gray-900 mt-1">{footprint.title}</strong>
        </p>
      </div>

      {#if existingZooms.length > 0}
        <div class="bg-green-50 border border-green-200 rounded-md p-3 text-center my-4">
          <p class="text-sm font-medium text-green-800">
            Already downloaded zooms: {Math.min(...existingZooms)}-{Math.max(...existingZooms)}
          </p>
        </div>
      {/if}

      {#if minZoomAvailable > maxZoomAvailable}
        <div class="text-center my-4 text-gray-700 font-semibold">
          ✅ All available zooms have already been downloaded!
        </div>
      {:else}
        <div class="bg-gray-100 border rounded-md p-4 my-4">
          <label for="zoom-slider" class="block font-semibold text-gray-700">
            Select Max Zoom to Download ({minZoomAvailable}-{maxZoomAvailable})
          </label>
          <p class="text-xs text-gray-500 mb-2">
            Higher zoom means more detail but larger download size.
          </p>
          <input
            type="range"
            id="zoom-slider"
            min={minZoomAvailable}
            max={maxZoomAvailable}
            bind:value={selectedMaxZoom}
            class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div class="flex justify-between text-xs text-gray-500 mt-1">
            <span>Zoom {minZoomAvailable}</span>
            <span>Zoom {maxZoomAvailable}</span>
          </div>
        </div>
      {/if}

      <div class="bg-blue-50 border border-blue-200 rounded-md p-4">
        <p class="font-semibold text-blue-800">
          Estimated Download (up to Zoom {selectedMaxZoom}):
          <span class="text-xl font-mono float-right">{calculatedSize.mb.toFixed(2)} MB</span>
        </p>
        <p class="text-sm text-gray-600 mt-1">Total tiles: {calculatedSize.count}</p>
      </div>

      <div class="mt-6 flex justify-end space-x-4">
        <button
          on:click={cancel}
          class="bg-gray-200 text-gray-700 font-semibold px-6 py-2 rounded-lg hover:bg-gray-300 transition"
        >
          Cancel
        </button>
        <button
          on:click={confirm}
          class="bg-green-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-green-700 transition"
          disabled={minZoomAvailable > maxZoomAvailable}
        >
          Confirm & Download
        </button>
      </div>
    </div>
  </dialog>
</div>

<style>
  /* This selector makes the overlay fixed to the viewport and gives it a high z-index to ensure it appears on top. */
  .confirmation-modal-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 5000;
    pointer-events: none; /* Allows clicks to pass through the overlay to the map */
  }

  dialog {
    border: none;
    padding: 0;
    pointer-events: auto; /* Re-enables clicks for the modal itself */
  }

  /* This styles the backdrop provided by the browser when dialog.showModal() is called */
  dialog::backdrop {
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(3px);
  }

  #zoom-slider:focus-visible {
    outline: none; /* Removes the default solid outline */
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.4); /* Adds a soft blue glow */
  }

</style>