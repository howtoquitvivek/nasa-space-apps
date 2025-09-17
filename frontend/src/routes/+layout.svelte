<script>import "../app.css";
// This line imports our new global stylesheet
import './../app.css';</script>

<div class="app-container">
  <slot></slot>

  <footer>
    <p>© 2025 Map Viewer. All Rights Reserved.</p>
  </footer>
</div>

<style>
  .app-container {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between; /* Pushes footer to the bottom */
  }

  footer {
    width: 100%;
    text-align: center;
    padding: var(--space-4);
    margin-top: var(--space-8);
    color: var(--color-accent);
    font-size: 0.9rem;
    border-top: 1px solid rgba(125, 156, 183, 0.1);
  }
</style>
