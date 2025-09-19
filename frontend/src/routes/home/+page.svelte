<script>
  // Import the shared store
  import { isModalOpen } from '$lib/store.js';

  function startNewProject() {
    // Set the store value to true, which opens the modal
    isModalOpen.set(true);
  }
</script>

<div class="grid-container">
  <section class="main-section">
    <div class="section-header">
      <h2>🏠 My Projects</h2>
      <button 
        on:click={startNewProject}
        class="start-project-btn"
      >
        + Start New Project
      </button>
    </div>

    <p class="description">
      Select a project to continue your work or start a new one.
    </p>

    <div class="project-card">
      <h3 class="font-bold text-lg">Mars Crater Analysis</h3>
      <p class="text-sm text-gray-400">Last updated: 2 days ago</p>
      <a href="/workspace" class="font-bold">Open Project →</a>
    </div>
    </section>

  <section class="sidebar-section">
    <div class="section-header">
      <h2>👤 Profile</h2>
    </div>
    <div class="profile-card">
      <p>Username: Analyst_01</p>
      <p>Projects: 1</p>
      <p class="text-gray-400 mt-4">(Full profile coming soon)</p>
    </div>
  </section>
</div>


<style>
  /* Using your variables and style, with additions for layout */
  :root {
    --radius-lg: 12px;
    --radius-md: 8px;
    --space-8: 2rem;
    --space-6: 1.5rem;
    --space-4: 1rem;
    --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    --transition-normal: all 0.2s ease-in-out;
    --color-light: #f1f5f9;
    --color-accent: #94a3b8;
    --color-primary: #3b82f6;
  }

  .grid-container {
    display: grid;
    grid-template-columns: 3fr 1fr;
    gap: var(--space-8);
    padding: var(--space-8);
    animation: fadeIn 0.5s ease-out;
  }

  section {
    background: rgba(26, 26, 26, 0.8);
    backdrop-filter: blur(10px);
    border-radius: var(--radius-lg);
    padding: var(--space-8);
    border: 1px solid rgba(125, 156, 183, 0.15);
    box-shadow: var(--shadow-xl);
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-6);
    padding-bottom: var(--space-4);
    border-bottom: 1px solid rgba(125, 156, 183, 0.2);
  }

  .section-header h2 {
    color: var(--color-light);
    font-size: 1.75rem;
    font-weight: 700;
  }

  .description {
    color: var(--color-accent);
    margin-bottom: var(--space-6);
  }

  .project-card, .profile-card {
    margin-top: var(--space-4);
    padding: var(--space-4);
    border: 1px solid rgba(125, 156, 183, 0.2);
    border-radius: var(--radius-md);
    background: rgba(10, 10, 10, 0.3);
    transition: var(--transition-normal);
  }

  .project-card:hover {
    border-color: var(--color-primary);
    transform: translateY(-2px);
  }
  
  .profile-card {
    color: var(--color-accent);
  }

  .start-project-btn {
    background-color: var(--color-primary);
    color: white;
    font-weight: 600;
    padding: 0.75rem 1.5rem;
    border-radius: var(--radius-md);
    transition: var(--transition-normal);
  }

  .start-project-btn:hover {
    background-color: #2563eb; /* A darker shade of blue */
    transform: scale(1.05);
  }
</style>