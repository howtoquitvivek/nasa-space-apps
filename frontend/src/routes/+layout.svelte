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

<div class="app-container">
    <slot></slot>

    <footer>
        <p>© 2025 Map Viewer. All Rights Reserved.</p>
    </footer>
</div>

{#if $isModalOpen}
    <ProjectModal on:select={handleDatasetSelect} />
{/if}

<style>
    /* Your styles remain the same */
    .app-container {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }

    footer {
        width: 100%;
        text-align: center;
        padding: 1rem;
        margin-top: 2rem;
        color: #94a3b8;
        font-size: 0.9rem;
        border-top: 1px solid rgba(125, 156, 183, 0.1);
    }
</style>