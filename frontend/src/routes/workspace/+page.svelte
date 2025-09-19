<script>
    import { selectedDataset } from '$lib/store.js';
    import Map from '$lib/components/Map.svelte';

    let isLoading = false;
    let statusMessage = '';
    let mapComponent; // A reference to the Map component instance

    // This function handles the final event from the Map component
    // Replace the existing function in /workspace/+page.svelte
    async function handleStartIngestion(event) {
        const footprintData = event.detail.footprint;
        const zoomRange = event.detail.zoomRange;
        const datasetId = event.detail.datasetId;

        isLoading = true;
        statusMessage = 'Sending request to backend...';

        // Construct the payload that matches the backend's IngestRequest model
        const payload = {
            footprintId: footprintData.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
            datasetId: datasetId,
            tileUrl: footprintData.tileUrl,
            tilesPerZoom: footprintData.downloadInfo.tilesPerZoom,
            minZoom: zoomRange.minZoom,
            maxZoom: zoomRange.maxZoom
        };

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
            statusMessage = `✅ Success! New dataset '${result.dataset_id}' is ready.`;
            
            setTimeout(() => { isLoading = false; }, 5000);

        } catch (err) {
            statusMessage = `❌ Error: ${err.message}`;
            console.error(err);
            setTimeout(() => { isLoading = false; }, 5000);
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

<div class="workspace-container">
    {#if $selectedDataset}
        <Map dataset={$selectedDataset} on:startIngestion={handleStartIngestion} bind:this={mapComponent} />
    {:else}
        <div class="flex items-center justify-center h-full">
            <div class="text-center">
                <h2 class="text-2xl font-semibold text-gray-700">No Project Selected</h2>
                <p class="text-gray-500 mt-2">Go to the <a href="/home" class="text-blue-600 hover:underline">Home Dashboard</a> to start a project.</p>
            </div>
        </div>
    {/if}
</div>

<style>
    .workspace-container {
        position: relative;
        width: 100%;
        height: calc(100vh - 80px);
    }
</style>