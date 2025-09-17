<section>
  <div class="section-header">
    <h2>🏠 Home Dashboard</h2>
  </div>

  <p class="description">
    This is where a list of your saved maps and annotation projects will appear.
  </p>

  <div class="project-card">
    <h3 class="font-bold text-lg">Mars Crater Analysis</h3>
    <p class="text-sm text-gray-400">Last updated: 2 days ago</p>
    <a href="/workspace" class="font-bold">Open Project →</a>
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
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .section-header {
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

  .project-card {
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
</style>