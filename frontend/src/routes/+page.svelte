<script>
    import { selectedDataset } from '$lib/store.js';
    import Map from '$lib/components/Map.svelte';
    import AnalysisControl from '$lib/components/AnalysisControl.svelte'; // Import the new component
    import { onMount } from 'svelte';

    let mapInstance; // We need a reference to the map instance
    let isLoading = false;
    let statusMessage = '';

    // This function will be called by the AnalysisControl component
    async function handleStartIngestion(event) {
        const payload = event.detail;
        console.log("Starting ingestion with payload:", payload);
        
        isLoading = true;
        statusMessage = 'Downloading and indexing new dataset... This may take several minutes.';

        try {
            const res = await fetch('/ingest', { // Assuming your API is on the same host or proxied
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.detail || 'Ingestion failed');
            }

            const result = await res.json();
            statusMessage = `Success! New dataset '${result.dataset_id}' is ready. You can now start a new project to analyze it.`;

        } catch (err) {
            statusMessage = `Error: ${err.message}`;
            console.error(err);
        } finally {
            isLoading = false;
        }
    }
</script>

{#if isLoading}
    <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
        <div class="text-center text-white">
            <div class="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-blue-500 mx-auto"></div>
            <h2 class="text-2xl font-semibold mt-4">Processing Data</h2>
            <p class="mt-2">{statusMessage}</p>
        </div>
    </div>
{/if}

<div class="workspace-container">
    {#if $selectedDataset}
        <AnalysisControl dataset={$selectedDataset} map={mapInstance} on:startIngestion={handleStartIngestion} />
        <Map dataset={$selectedDataset} bind:map={mapInstance} />
    {:else}
        <div class="flex items-center justify-center h-full">
            <div class="text-center">
                <h2 class="text-2xl font-semibold text-gray-700">No Project Selected</h2>
                <p class="text-gray-500 mt-2">Please go to the <a href="/home" class="text-blue-600 hover:underline">Home Dashboard</a> to start a new project.</p>
            </div>
        </div>
    {/if}
</div>

<style>
    .workspace-container {
        position: relative; /* Needed for the control to be positioned correctly */
        width: 100%;
        height: calc(100vh - 80px); /* Adjust height to fit within your layout's footer */
    }
</style>