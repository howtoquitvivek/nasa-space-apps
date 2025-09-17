<script>
  import Map from '$lib/components/Map.svelte';
</script>

<section>
    <div class="section-header">
        <h2>🌍 GIS Workspace</h2>
    </div>

    <div class="map-container">
        <Map />
    </div>
</section>

<style>
  section {
    background: rgba(26, 26, 26, 0.8);
    backdrop-filter: blur(10px);
    border-radius: var(--radius-lg);
    padding: var(--space-8);
    border: 1px solid rgba(125, 156, 183, 0.15);
    box-shadow: var(--shadow-xl);
    animation: fadeIn 0.5s ease-out;
    display: flex;
    flex-direction: column;
    height: 85vh; /* Give the section a significant height */
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .section-header {
    margin-bottom: var(--space-4);
    padding-bottom: var(--space-4);
    border-bottom: 1px solid rgba(125, 156, 183, 0.2);
    flex-shrink: 0; /* Prevents header from shrinking */
  }

  .section-header h2 {
    color: var(--color-light);
    font-size: 1.75rem;
    font-weight: 700;
  }
  
  .map-container {
    flex-grow: 1; /* Allows map to fill the remaining space */
    min-height: 0; /* Crucial for flexbox resizing */
  }
</style>