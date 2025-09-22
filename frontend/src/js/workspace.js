import { openConfirmationModal } from './confirmationmodal';

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const datasetId = urlParams.get('datasetId');
    let currentAbortController = null; // global to track ongoing ingestion

    const datasets = {
        mars_viking_vis: {
            id: 'mars_viking_vis',
            name: 'Mars: Viking VIS Global Color Mosaic',
            tileUrl: 'https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0//default/default028mm/{z}/{y}/{x}.jpg',
            maxZoom: 7
        },
        venus_magellan_gt: {
            id: 'venus_magellan_gt',
            name: 'Venus: Magellan Global Topography',
            tileUrl: 'https://trek.nasa.gov/tiles/Venus/EQ/Venus_Magellan_C3-MDIR_Global_Mosaic_2025m/1.0.0/default/default028mm/{z}/{y}/{x}.png',
            maxZoom: 7
        },
        mercury_messenger_mds: {
            id: 'mercury_messenger_mds',
            name: 'Mercury: MESSENGER Global Mosaic',
            tileUrl: 'https://trek.nasa.gov/tiles/Mercury/EQ/Mercury_MESSENGER_MDIS_Basemap_BDR_Mosaic_Global_166m/1.0.0//default/default028mm/{z}/{y}/{x}.jpg',
            maxZoom: 8
        }
    };

    const currentDataset = datasets[datasetId] || null;
    const loadingOverlay = document.getElementById('loading-overlay');
    const statusMessage = document.getElementById('status-message');
    const panelContent = document.querySelector('.panel-content');

    if (!currentDataset) {
        document.getElementById('map-container').innerHTML = `
            <div class="empty-state-container">
                <div class="empty-state-card">
                    <h2 class="empty-state-title">No Project Selected</h2>
                    <p class="empty-state-text">
                        Go to the <a href="/home" class="empty-state-link">Home Dashboard</a> to start a project.
                    </p>
                </div>
            </div>`;
        return;
    }

    let map, L, currentLayer, footprintLayer;
    let selectedFootprint = null;

    async function initMap() {
        L = (await import('leaflet')).default;

        const DefaultIcon = L.icon({
            iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
        });
        L.Marker.prototype.options.icon = DefaultIcon;

        map = L.map('map-container', {
            crs: L.CRS.EPSG4326,
            center: [0, 0],
            zoom: 1,
            maxZoom: currentDataset.maxZoom,
            zoomControl: false
        });

        currentLayer = L.tileLayer(currentDataset.tileUrl, {
            maxZoom: currentDataset.maxZoom,
            noWrap: true,
            attribution: currentDataset.name
        }).addTo(map);

        footprintLayer = new L.FeatureGroup().addTo(map);

        await loadMapFootprints();
        await loadDownloadsPanel();
    }

    async function loadMapFootprints() {
        showOverlay('Loading footprints...');
        try {
            const res = await fetch(`/${datasetId}_footprints.json`);
            if (!res.ok) throw new Error('Failed to load footprints');
            const data = await res.json();

            footprintLayer.clearLayers();
            data.forEach((footprint) => {
                const [minLng, minLat, maxLng, maxLat] = footprint.bbox;

                const rect = L.rectangle(
                    [[minLat, minLng], [maxLat, maxLng]],
                    { color: 'white', weight: 0.7, fillOpacity: 0.1 }
                ).addTo(footprintLayer);

                rect.on('click', () => {
                    // Assign selectedFootprint BEFORE opening modal
                    selectedFootprint = footprint;
                    openFootprintModal();
                });
            });

            if (footprintLayer.getLayers().length > 0) {
                map.fitBounds(footprintLayer.getBounds(), { padding: [50, 50] });
            }
        } catch (err) {
            console.error(err);
            alert('Failed to load footprints');
        } finally {
            hideOverlay();
        }
    }

    function openFootprintModal() {
        openConfirmationModal({ footprint: selectedFootprint, datasetId: currentDataset.id })
            .then((zoomRange) => {
                if (!zoomRange) return;
                handleIngestionConfirm(zoomRange);
            });
    }

    function handleIngestionConfirm(zoomRange) {
        if (!selectedFootprint) {
            console.error('No footprint selected!');
            return;
        }

        const payload = {
            footprintId: selectedFootprint.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_|_$/g, ''),
            datasetId: currentDataset.id,
            tileUrl: selectedFootprint.tileUrl,
            tilesPerZoom: selectedFootprint.downloadInfo.tilesPerZoom,
            minZoom: zoomRange.minZoom,
            maxZoom: zoomRange.maxZoom
        };

        startIngestionRequest(payload);
    }

    async function startIngestionRequest(payload) {
        showOverlay('Sending request to backend...');
        
        currentAbortController = new AbortController();
        const { signal } = currentAbortController;

        try {
            const res = await fetch('http://localhost:8000/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal
            });
            const result = await res.json();
            statusMessage.textContent = `✅ Success! New data for '${result.dataset_id}' is ready.`;
        } catch (err) {
            if (err.name === 'AbortError') {
                statusMessage.textContent = 'Ingestion canceled by user.';
            } else {
                console.error(err);
                statusMessage.textContent = `Error: ${err.message}`;
            }
        } finally {
            setTimeout(hideOverlay, 3000);
            currentAbortController = null;
        }
    }

    
    async function loadDownloadsPanel() {
        loadingOverlay.classList.remove('hidden');
        statusMessage.textContent = 'Loading analysis areas...';

        try {
            const res = await fetch(`http://localhost:8000/datasets/${datasetId}/footprints`);
            if (!res.ok) {
                panelContent.innerHTML = `<p class="status-text">Failed to load analysis areas.</p>`;
                throw new Error('Failed to fetch analysis areas from API');
            }
            const data = await res.json();
            const footprints = data.footprints || [];
            
            if (footprints.length === 0) {
                panelContent.innerHTML = `<p class="status-text">No downloaded areas found for this dataset.</p>`;
            } else {
                const listHtml = footprints.map(footprint => {
                    const footprintName = footprint.replace(/_/g, ' ');
                    const openUrl = `/analysis?dataset=${datasetId}&footprint=${footprint.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`;
                    return `
                        <li class="list-item">
                            <span class="footprint-name">${footprintName}</span>
                            <a href="${openUrl}" class="open-button">Open</a>
                        </li>
                    `;
                }).join('');
                panelContent.innerHTML = `<ul class="footprint-list">${listHtml}</ul>`;
            }
        } catch (err) {
            console.error('Error loading downloads panel:', err);
            statusMessage.textContent = 'Failed to load analysis areas.';
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    }

    function showOverlay(msg) {
        if (loadingOverlay && statusMessage) {
            loadingOverlay.style.display = 'flex';
            statusMessage.textContent = msg;
        }
    }

    function hideOverlay() {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
    }

    initMap();

    // Sidebar toggle
    const sidebar = document.querySelector('.sidebar-container');
    const toggleBtn = document.querySelector('.toggle-btn');
    let isSidebarOpen = true;
    toggleBtn?.addEventListener('click', () => {
        isSidebarOpen = !isSidebarOpen;
        sidebar.classList.toggle('collapsed', !isSidebarOpen);
        toggleBtn.textContent = isSidebarOpen ? '⏴' : '⏵';
    });

    const cancelBtn = document.getElementById('cancel-ingestion');
    cancelBtn?.addEventListener('click', () => {
        if (!currentAbortController) return;

        // Abort the ongoing fetch in the browser
        currentAbortController.abort();

        // Send cancel signal to backend
        if (!selectedFootprint) return;

        const payload = {
            datasetId: currentDataset.id,
            footprintId: selectedFootprint.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '_')
                .replace(/^_|_$/g, '')
        };

        fetch('http://localhost:8000/ingest/cancel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(err => console.error('Failed to send cancel signal:', err));
    });

});
