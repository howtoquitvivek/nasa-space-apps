<script>
    import { createEventDispatcher } from 'svelte';

    export let map; // Receives the Leaflet map instance as a prop
    export let dataset; // Receives the current dataset object

    const dispatch = createEventDispatcher();
    let drawing = false;
    let rectangleDrawer;
    
    // An average tile size in KB for estimation. 25KB is a reasonable guess.
    const AVG_TILE_SIZE_KB = 25;

    function startAnalysisSelection() {
        if (!map) return;
        drawing = true;
        // Use Leaflet.draw to create a rectangle drawer
        rectangleDrawer = new L.Draw.Rectangle(map, {});
        rectangleDrawer.enable();

        // Listen for when the user finishes drawing
        map.on('draw:created', handleRectangleCreated);
    }

    function handleRectangleCreated(e) {
        drawing = false;
        const layer = e.layer;
        const bounds = layer.getBounds();

        // Estimate the download size
        const estimatedSize = estimateDownloadSize(bounds, dataset.maxZoom);
        
        // Confirm with the user
        const confirmed = confirm(
            `Analyzing this area will download an estimated ${estimatedSize.mb.toFixed(2)} MB of data (${estimatedSize.count} tiles).\n\nDo you want to continue?`
        );

        if (confirmed) {
            // If user confirms, send the necessary data to the parent component
            dispatch('startIngestion', {
                name: `${dataset.name} Analysis`,
                tileUrl: dataset.tileUrl,
                bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
                maxZoom: dataset.maxZoom
            });
        }
        
        // Clean up the draw handler
        map.off('draw:created', handleRectangleCreated);
    }
    
    // Helper function to calculate tile count and estimate size
    function estimateDownloadSize(bounds, maxZoom) {
        let totalTiles = 0;
        for (let z = 0; z <= maxZoom; z++) {
            const min = map.project(bounds.getSouthWest(), z);
            const max = map.project(bounds.getNorthEast(), z);
            const tileSize = 256;
            
            const minTx = Math.floor(min.x / tileSize);
            const maxTx = Math.floor(max.x / tileSize);
            const minTy = Math.floor(min.y / tileSize);
            const maxTy = Math.floor(max.y / tileSize);

            totalTiles += (maxTx - minTx + 1) * (maxTy - minTy + 1);
        }
        return {
            count: totalTiles,
            mb: (totalTiles * AVG_TILE_SIZE_KB) / 1024
        };
    }
</script>

{#if dataset && dataset.analysisReady}
    <div class="analysis-control-container">
        <button on:click={startAnalysisSelection} disabled={drawing}>
            {#if drawing}
                Draw a rectangle on the map...
            {:else}
                🔬 Analyze Area
            {/if}
        </button>
    </div>
{/if}

<style>
    .analysis-control-container {
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 1000;
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(10px);
        padding: 8px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    button {
        background-color: #16a34a; /* Green */
        color: white;
        font-weight: 600;
        padding: 0.5rem 1rem;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        transition: background-color 0.2s;
    }
    button:hover {
        background-color: #15803d;
    }
    button:disabled {
        background-color: #9ca3af;
        cursor: not-allowed;
    }
</style>