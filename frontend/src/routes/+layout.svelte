<script>
    import "../app.css";
    import { goto } from '$app/navigation';
    import { selectedDataset, isModalOpen } from '$lib/store.js'; // Import both stores
    import ProjectModal from '$lib/components/ProjectModal.svelte';

    function handleDatasetSelect(event) {
        selectedDataset.set(event.detail);
        isModalOpen.set(false); // Close the modal
        goto('/workspace');
    }
</script>

<div>
  <div class="app-container">
    <main>
      <slot />
    </main>
  </div>

  {#if $isModalOpen}
    <ProjectModal on:select={handleDatasetSelect} on:close={() => isModalOpen.set(false)} />
  {/if}
</div>

<style>
  /* These styles ensure the app takes up the full screen 
    without using a flexbox container that can interfere with modals.
    You can also move the :global styles to your app.css file.
  */
  :global(html, body) {
    height: 100%;
    margin: 0;
    padding: 0;
  }

  .app-container {
    min-height: 100%;
  }
</style>