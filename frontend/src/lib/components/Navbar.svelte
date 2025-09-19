<script>
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  // We track the current dataset for the select dropdown
  let currentDataset = 'mars';

  function handleDatasetChange() {
    // When the dropdown changes, we dispatch a 'setDataset' event
    // with the new value as the detail.
    dispatch('setDataset', currentDataset);
  }
</script>

<nav class="main-nav" role="navigation" aria-label="Main navigation">
    <a href="/" class="nav-brand">
        <h1>Map Viewer</h1>
        <span class="tagline">Interactive GIS Analysis</span>
    </a>
    <div class="nav-controls">
        <select bind:value={currentDataset} on:change={handleDatasetChange} class="nav-button">
            <option value="mars">🔴 Mars Dataset</option>
            <option value="earth">🌍 Earth Dataset</option>
            <option value="hubble">🔭 Hubble Dataset</option>
        </select>

        <button on:click={() => dispatch('findSimilar')} class="nav-button">
          Find Similar
        </button>
        <button on:click={() => dispatch('resetView')} class="nav-button">
          Reset View
        </button>
    </div>
</nav>

<style>
  /* Styles for the Navbar component */
  .main-nav {
      position: sticky;
      top: 0;
      z-index: 10;
      backdrop-filter: blur(20px);
      background: rgba(10, 10, 10, 0.85);
      border-bottom: 1px solid rgba(125, 156, 183, 0.2);
      padding: var(--space-4) var(--space-8);
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: var(--shadow-lg);
  }

  .nav-brand {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      text-decoration: none;
  }

  .nav-brand h1 {
      font-size: 2rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--color-light) 0%, var(--color-primary) 100%);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      filter: drop-shadow(var(--glow-primary));
  }

  .nav-brand .tagline {
      color: var(--color-accent);
      font-style: italic;
      opacity: 0.9;
  }

  .nav-controls {
      display: flex;
      gap: var(--space-3);
      align-items: center;
  }

  .nav-button {
      padding: var(--space-3) var(--space-5);
      background: rgba(125, 156, 183, 0.1);
      border: 1px solid rgba(125, 156, 183, 0.3);
      color: var(--color-light);
      border-radius: var(--radius-md);
      font-weight: 500;
      cursor: pointer;
      transition: var(--transition-normal);
      position: relative;
      overflow: hidden;
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
  }

  .nav-button:hover {
      color: var(--color-white);
      border-color: var(--color-strong);
      box-shadow: var(--glow-strong);
      transform: translateY(-1px);
  }

  select.nav-button {
    padding-right: 2.5rem;
    background-position: right 0.75rem center;
    background-repeat: no-repeat;
    background-size: 1em;
    background-image: url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%23eeeeee" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3e%3cpolyline points="6 9 12 15 18 9"%3e%3c/polyline%3e%3c/svg%3e');
  }

  select.nav-button option {
    background: var(--color-dark-secondary);
  }
</style>