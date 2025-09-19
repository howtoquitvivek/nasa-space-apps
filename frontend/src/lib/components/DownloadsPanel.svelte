<script>
	import { onMount } from 'svelte';
	export let datasetId;

	let footprints = [];
	let isLoading = true;

	$: if (datasetId) {
		loadFootprints(datasetId);
	}

	async function loadFootprints(id) {
		isLoading = true;
		try {
			const res = await fetch(`http://localhost:8000/datasets/${id}/footprints`);
			if (!res.ok) throw new Error('Failed to fetch footprints');
			const data = await res.json();
			footprints = data.footprints || [];
		} catch (err) {
			console.error('Error loading footprints:', err);
			footprints = [];
		} finally {
			isLoading = false;
		}
	}
</script>

<div class="downloads-panel">
	<div class="panel-header">
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
			<path d="M3.5 3A1.5 1.5 0 002 4.5v11A1.5 1.5 0 003.5 17h13a1.5 1.5 0 001.5-1.5V7.875a1.5 1.5 0 00-.44-1.06l-2.25-2.25A1.5 1.5 0 0014.125 4h-1.375A3.502 3.502 0 009.25 1.5H6.5a1.5 1.5 0 00-1.406.953.5.5 0 01-.828-.41A3.5 3.5 0 017.75 0h1.5A4.502 4.502 0 0113.75 3h.375a3 3 0 012.121.879l2.25 2.25a3 3 0 01.879 2.121V15.5A3 3 0 0116.5 18.5h-13A3 3 0 01.5 15.5v-11A3 3 0 013.5 1.5H5V3z" />
		</svg>
		<span>Analysis Areas</span>
	</div>
	<div class="panel-content">
		{#if isLoading}
			<p class="status-text">Loading...</p>
		{:else if footprints.length === 0}
			<p class="status-text">No downloaded areas found for this dataset.</p>
		{:else}
			<ul class="footprint-list">
				{#each footprints as footprint}
					<li>
						<button>{footprint.replace(/_/g, ' ')}</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<style>
	.downloads-panel {
		background-color: #1f2937;
		color: #d1d5db;
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 280px;
		flex-shrink: 0;
	}
	.panel-header {
		font-size: 1rem;
		font-weight: 600;
		color: #ffffff;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid #374151;
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.panel-header svg {
		width: 1.25rem;
		height: 1.25rem;
		opacity: 0.7;
	}
	.panel-content {
		overflow-y: auto;
		flex-grow: 1;
	}
	.status-text {
		padding: 1.25rem;
		font-size: 0.875rem;
		color: #9ca3af;
		text-align: center;
	}
	.footprint-list {
		list-style: none;
		padding: 0.5rem 0;
		margin: 0;
	}
	.footprint-list button {
		width: 100%;
		text-align: left;
		padding: 0.75rem 1.5rem;
		background: none;
		border: none;
		cursor: pointer;
		font-size: 0.875rem;
		color: #d1d5db;
		text-transform: capitalize;
		transition: all 0.2s ease-in-out;
	}
	.footprint-list button:hover {
		background-color: #374151;
		color: #ffffff;
	}
</style>