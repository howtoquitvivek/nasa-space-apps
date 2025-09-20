<script>
  import { isModalOpen } from '$lib/store.js';
  import ProjectCreateModal from '$lib/components/ProjectModal.svelte';
  // The CSS import is no longer needed here.

  function startNewProject() {
    isModalOpen.set(true);
  }
</script>

<div class="container-fluid p-0">
  <div class="row g-0">
    <div class="col-md-3 col-lg-2 sidebar" id="sidebar">
      <nav class="nav flex-column p-3">
        <a class="nav-link active d-flex align-items-center" href="x" data-section="dashboard">
          <i class="fas fa-th-large me-3"></i>
          <span>Dashboard</span>
        </a>
        <a class="nav-link d-flex align-items-center" href="x" data-section="projects">
          <i class="fas fa-folder me-3"></i>
          <span>Projects</span>
        </a>
        <a class="nav-link d-flex align-items-center" href="x" data-section="workspace">
          <i class="fas fa-briefcase me-3"></i>
          <span>Workspace</span>
        </a>
      </nav>
    </div>

    <div class="col-md-9 col-lg-10 main-content">
      <div class="section">
        <div class="d-flex justify-content-between align-items-center mb-4">
          <h4 class="mb-0">🏠 My Projects</h4>
          <button class="btn btn-primary" on:click={startNewProject}>
            + Start New Project
          </button>
        </div>
        <p class="text-muted mb-3">
          Select a project to continue your work or start a new one.
        </p>


			<div class="row g-4">
				<!-- Active Projects -->
				<div class="col-md-6 col-lg-4">
					<div class="project-card">
					<div class="d-flex justify-content-between align-items-start mb-2">
						<h6>Testing AI on HiRISE data</h6>
						<span class="badge bg-success-subtle text-success">Active</span>
					</div>
					<p class="text-muted small">Last updated: just now</p>
					<a href="http://127.0.0.1:5174/analysis/hirise/test_data" target="_self" class="fw-semibold">
						Open Project →
					</a>
					</div>
				</div>

				<div class="col-md-6 col-lg-4">
					<div class="project-card">
					<div class="d-flex justify-content-between align-items-start mb-2">
						<h6>Ingested : Mars 22n048w_mosaic</h6>
						<span class="badge bg-success-subtle text-success">Active</span>
					</div>
					<p class="text-muted small">Last updated: two days ago</p>
					<a href="http://127.0.0.1:5174/analysis/mars_viking_vis/mro_ctx_22n048w_mosaic" target="_self" class="fw-semibold">
						Open Project →
					</a>
					</div>
				</div>

				<!-- Draft Projects -->
				<div class="col-md-6 col-lg-4">
					<div class="project-card">
					<div class="d-flex justify-content-between align-items-start mb-2">
						<h6>Exploring Mercury Surface</h6>
						<span class="badge bg-yellow-100" style="color:#b45309;">Draft</span>
					</div>
					<p class="text-muted small">Last updated: recently</p>
					<a href="/workspace/mercury_messenger_mds" target="_self" class="fw-semibold">
						Open Project →
					</a>
					</div>
				</div>


				<div class="col-md-6 col-lg-4">
					<div class="project-card">
					<div class="d-flex justify-content-between align-items-start mb-2">
						<h6>Mars Viking + CTX</h6>
						<span class="badge bg-yellow-100" style="color:#b45309;">Draft</span>
					</div>
					<p class="text-muted small">Last updated: recently</p>
					<a href="/workspace/mars_viking_vis" target="_self" class="fw-semibold">
						Open Project →
					</a>
					</div>
				</div>

			</div>

	</div>
   
		
      <div class="section">
		<h4 class="mb-3">👤 Profile</h4>
		<div class="profile-card p-3">
			<p><strong>Username:</strong> spaceappsuser1 </p>
			<p><strong>Email:</strong> spaceappsuser1@gmail.com</p>
			<p><strong>Projects:</strong> 4</p>
			<small class="text-muted"></small>
		</div>
	</div>


    </div>
  </div>
</div>



<style>
	/* Updated Research Collaboration Dashboard CSS with NASA-style theme */
	:global(:root) {
		/* Light theme colors */
		--bg-primary: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #cbd5e1 100%);
		--bg-secondary: rgba(255, 255, 255, 0.1);
		--text-primary: #1e293b;
		--text-secondary: #475569;
		--text-accent: #3b82f6;
		--border-color: rgba(0, 0, 0, 0.1);
		--card-bg: rgba(255, 255, 255, 0.8);
		--shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
		--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6 -2px rgba(0, 0, 0, 0.05);
	}

	/* Base Styles */
	:global(*) {
		margin: 0;
		padding: 0;
		box-sizing: border-box;
	}

	:global(body) {
		font-family: 'Inter', sans-serif;
		background: var(--bg-primary);
		color: var(--text-primary);
		line-height: 1.6;
		min-height: 100vh;
		transition: all 0.3s ease;
		margin: 0rem;
		padding: 0rem;
	}

	/* Sidebar */
	.sidebar {
		background: var(--card-bg);
		min-height: calc(100vh - 80px); /* Assuming header height of 80px */
		padding: 2rem 0;
		border-right: 1px solid var(--border-color);
		transition: background 0.3s ease, border-color 0.3s ease;
	}

	.sidebar .nav-link {
		color: var(--text-secondary);
		padding: 0.75rem 1.5rem;
		margin: 0.25rem 0 0.25rem 1rem;
		border-radius: 0 25px 25px 0;
		font-weight: 500;
		position: relative;
		transition: all 0.3s ease;
	}

	.sidebar .nav-link:hover {
		background-color: var(--bg-secondary);
		color: var(--text-accent);
		transform: translateX(5px);
	}

	.sidebar .nav-link.active {
		background: var(--text-accent);
		color: white;
		box-shadow: var(--shadow);
	}

	.sidebar .nav-link.active::before {
		content: '';
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 4px;
		background-color: var(--text-accent);
		border-radius: 0 4px 4px 0;
	}

	/* Main Content */
	.main-content {
		padding: 2rem;
		
	}

	.container-fluid {
		min-height: 100vh;
		display: flex;
	}

	.row {
		flex: 1;
	}

	.section {
		background: var(--card-bg);
		border-radius: 12px;
		padding: 1.5rem;
		box-shadow: var(--shadow);
		margin-bottom: 1.5rem;
		animation: fadeInUp 0.6s ease-out;
		transition: background 0.3s ease, box-shadow 0.3s ease;
	}

	.section h4 {
		color: var(--text-primary);
		font-weight: 600;
		margin-bottom: 1.5rem;
	}

	.section:last-child {
		margin-bottom: 0;
	}


	/* Project Cards */
	.project-card {
		background: var(--card-bg);
		border: 1px solid var(--border-color);
		border-radius: 12px;
		padding: 1.5rem;
		transition: all 0.3s ease;
		cursor: pointer;
		height: 100%;
		animation: fadeInUp 0.6s ease-out 0.1s;
		animation-fill-mode: both;
	}

	.project-card:hover {
		box-shadow: var(--shadow-lg);
		transform: translateY(-4px);
		border-color: var(--text-accent);
	}

	.project-card h6 {
		color: var(--text-primary) !important;
		font-weight: 600;
		margin-bottom: 0.75rem;
	}

	/* Animations */
	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>