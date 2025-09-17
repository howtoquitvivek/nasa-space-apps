<main class="flex flex-col items-center justify-center text-center p-8 flex-grow">
  <h1 class="gradient-text text-5xl md:text-7xl font-bold mb-4">
    Explore Your Universe
  </h1>
  <p class="text-lg md:text-xl text-gray-400 max-w-2xl mb-8">
    The ultimate multi-dataset map viewer for researchers, students, and explorers. Annotate, analyze, and discover like never before.
  </p>
  <a href="/home" class="control-button primary">
    Open Workspace
  </a>
</main>

<style>
  main {
    animation: fadeIn 0.6s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .flex-grow {
    flex-grow: 1; /* This makes the main content take up available space */
  }

  .gradient-text {
    background: var(--gradient-primary);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
  }

  .control-button.primary {
      padding: var(--space-4) var(--space-8);
      background: var(--gradient-primary);
      border: none;
      color: var(--color-white);
      border-radius: var(--radius-md);
      font-weight: 700;
      font-size: 1.1rem;
      cursor: pointer;
      transition: var(--transition-normal);
      text-decoration: none;
      box-shadow: var(--shadow-md), var(--glow-accent);
  }

  .control-button.primary:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg), var(--glow-strong);
  }
</style>