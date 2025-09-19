<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  const datasets = [
    {
      id: 'mars_mro_ctx',
      name: 'Mars: MRO CTX Mosaic',
      description: 'A high-resolution (5m/pixel) mosaic from the Context Camera, perfect for detailed analysis.',
      tileUrl: 'https://trek.nasa.gov/tiles/Mars/EQ/CTX_V3_Colorized_Hillshade/1.0.0//default/default028mm/{z}/{y}/{x}.jpg',
      maxZoom: 14,
      analysisReady: true, // This dataset is ready for our AI
    },
    {
      id: 'mars_viking_vis',
      name: 'Mars: Viking VIS Global Color Mosaic',
      description: 'A global mosaic from the Viking 1 and 2 orbiters, ideal for broad exploration.',
      tileUrl: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0//default/default028mm/{z}/{y}/{x}.jpg',
      maxZoom: 7,
      analysisReady: false,
    },
    {
      id: 'mercury_messenger_mds',
      name: 'Mercury: MESSENGER Global Mosaic',
      description: 'A comprehensive view of Mercury from the MESSENGER mission.',
      tileUrl: 'https://trek.nasa.gov/tiles/Mercury/EQ/MESSENGER_MDS_Color/1.0.0//default/default028mm/{z}/{y}/{x}.jpg',
      maxZoom: 8,
      analysisReady: false,
    },
    {
      id: 'venus_magellan_gt',
      name: 'Venus: Magellan Global Topography',
      description: 'A topographic map from radar data gathered by the Magellan spacecraft.',
      tileUrl: 'https://trek.nasa.gov/tiles/Venus/EQ/Magellan_Topography_Global/1.0.0//default/default028mm/{z}/{y}/{x}.jpg',
      maxZoom: 7,
      analysisReady: false,
    }
  ];

  function selectDataset(dataset) {
    dispatch('select', dataset);
  }
</script>

<div class="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50">
  
  <div class="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
    <div class="p-6 border-b">
      <h2 class="text-2xl font-bold text-gray-800">Start a New Project</h2>
      <p class="text-gray-500 mt-1">Select a dataset to begin.</p>
    </div>

    <div class="p-6 overflow-y-auto">
      <ul class="space-y-3">
        {#each datasets as dataset}
          <li class="p-4 border rounded-md hover:shadow-md hover:border-blue-500 transition flex items-center justify-between">
            <div>
              <h3 class="font-semibold text-lg text-gray-900">{dataset.name}</h3>
              <p class="text-gray-600 text-sm mt-1">{dataset.description}</p>
              <div class="mt-2">
                {#if dataset.analysisReady}
                  <span class="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">Analysis Ready</span>
                {:else}
                  <span class="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-0.5 rounded-full">Explore Only</span>
                {/if}
              </div>
            </div>
            <button 
              on:click={() => selectDataset(dataset)}
              class="bg-blue-600 text-white font-semibold px-4 py-2 rounded-md hover:bg-blue-700 transition ml-4 flex-shrink-0"
            >
              Select
            </button>
          </li>
        {/each}
      </ul>
    </div>
  </div>
</div>