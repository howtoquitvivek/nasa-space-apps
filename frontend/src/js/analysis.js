document.addEventListener('DOMContentLoaded', () => {
    // --- CONSTANTS ---
    const API_BASE = 'http://localhost:8000';
    const TOP_K = 10;
    const PARTICLE_COUNT = 40;

    // --- STATE ---
    let map;
    let L;
    let currentLayer;
    let drawnItems;
    let highlightLayer;
    let clusterLayer;
    let findSimilarMode = false;
    let searchedZooms = [];
    let currentQueryLayer = null;
    let availableZooms = [];
    let currentMinZoom = 1;
    let showAnnotations = true;
    let showLabels = true;
    let aiSystemActive = true;
    let clusteringActive = false;

    // --- DOM Elements ---
    const zoomInfoElement = document.getElementById('zoom-info');
    const datasetNameElement = document.getElementById('dataset-name');
    const loadingOverlay = document.getElementById('loading-overlay');
    const statusMessageElement = document.getElementById('status-message');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    // AI Showcase Panel Elements
    const aiPanelToggle = document.getElementById('ai-panel-toggle');
    const aiPanelContent = document.getElementById('ai-panel-content');
    const activateSimilarityBtn = document.getElementById('activate-similarity-btn');
    const simulateClusteringBtn = document.getElementById('simulate-clustering-btn');
    const clusteringAlgorithm = document.getElementById('clustering-algorithm');
    const clusterCountSlider = document.getElementById('cluster-count');
    const clusterCountDisplay = document.getElementById('cluster-count-display');
    const analysisFeedContent = document.getElementById('analysis-feed-content');
    const clearFeedBtn = document.getElementById('clear-feed-btn');
    
    // Control Elements
    const findSimilarBtn = document.getElementById('find-similar-btn');
    const searchDeeperBtn = document.getElementById('search-deeper-btn');
    const toggleAnnotationsBtn = document.getElementById('toggle-annotations-btn');
    const toggleLabelsBtn = document.getElementById('toggle-labels-btn');
    const clearHighlightsBtn = document.getElementById('clear-highlights-btn');
    const annotationsOnIcon = document.getElementById('annotations-on-icon');
    const annotationsOffIcon = document.getElementById('annotations-off-icon');
    
    // Clustering Elements
    const clusteringOverlay = document.getElementById('clustering-overlay');
    const closeClusteringBtn = document.getElementById('close-clustering-btn');
    const legendItems = document.getElementById('legend-items');
    const silhouetteScore = document.getElementById('silhouette-score');
    const inertiaScore = document.getElementById('inertia-score');
    
    // Results Panel
    const aiResultsPanel = document.getElementById('ai-results-panel');
    const resultsContent = document.getElementById('results-content');
    const closeResultsBtn = document.getElementById('close-results-btn');
    const exportResultsBtn = document.getElementById('export-results-btn');

    // Get dataset and footprint from URL
    const urlParams = new URLSearchParams(window.location.search);
    const currentDataset = urlParams.get('dataset');
    const currentFootprint = urlParams.get('footprint');

    if (!currentDataset || !currentFootprint) {
        document.getElementById('map-container').innerHTML = 
            '<p style="padding: 2rem; text-align: center; color: var(--color-error);">Invalid URL. Please return to Mission Control.</p>';
        return;
    }

    // --- INITIALIZATION ---
    init();

    function init() {
        createParticles();
        initializeLeaflet();
        bindEvents();
        startAISystem();
        updateAIStats();
        setupFeedCollapse();
    }

    function createParticles() {
        const container = document.getElementById('particles');
        if (!container) return;

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            particle.style.animationDelay = Math.random() * 12 + 's';
            particle.style.animationDuration = (8 + Math.random() * 4) + 's';
            container.appendChild(particle);
        }
    }

    function initializeLeaflet() {
        import('leaflet-draw').then(() => {
            L = window.L;

             setupTileRequestValidation();
            
            // Set up default markers
            const markerIcon = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
            const markerShadow = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
            const DefaultIcon = L.icon({
                iconUrl: markerIcon,
                shadowUrl: markerShadow,
                iconSize: [25, 41],
                iconAnchor: [12, 41]
            });
            L.Marker.prototype.options.icon = DefaultIcon;

            // Initialize map
            map = L.map('map-container', {
                center: [0, 0],
                zoom: 0,
                zoomControl: false
            });

            // Initialize layers
            drawnItems = new L.FeatureGroup().addTo(map);
            highlightLayer = new L.FeatureGroup().addTo(map);
            clusterLayer = new L.FeatureGroup().addTo(map);

            // Set up drawing controls
            const drawControl = new L.Control.Draw({
                edit: { featureGroup: drawnItems, edit: false, remove: true },
                draw: {
                    polygon: true,
                    polyline: true,
                    rectangle: { showArea: false },
                    circle: false,
                    circlemarker: false,
                    marker: true
                }
            });
            map.addControl(drawControl);
            // Map event listeners
            map.on(L.Draw.Event.CREATED, handleCreateAnnotation);
            map.on('draw:deleted', handleDeleteAnnotation);
            drawnItems.on('click', handleAnnotationClick);
            map.on('zoomend', updateZoomInfo);

            loadDataset(currentDataset, currentFootprint);
            loadAnnotations();
        });
    }

    // In your bindEvents function, update the event listeners:
    function bindEvents() {
        // AI Panel Events
        aiPanelToggle?.addEventListener('click', toggleAIPanel);
        activateSimilarityBtn?.addEventListener('click', activateSimilaritySearch);
        simulateClusteringBtn?.addEventListener('click', simulateClustering);
        clusterCountSlider?.addEventListener('input', updateClusterCount);
        clearFeedBtn?.addEventListener('click', clearAnalysisFeed);

        // Control Events - REMOVED findSimilarBtn and searchDeeperBtn from here
        toggleAnnotationsBtn?.addEventListener('click', toggleAnnotations);
        toggleLabelsBtn?.addEventListener('click', toggleLabels);
        clearHighlightsBtn?.addEventListener('click', clearHighlights);

        // Clustering Events
        closeClusteringBtn?.addEventListener('click', closeClustering);

        // Results Panel Events
        closeResultsBtn?.addEventListener('click', closeResultsPanel);
        exportResultsBtn?.addEventListener('click', exportResults);
        
        // Add these if not already present - they should reference the new buttons in the AI panel
        document.getElementById('activate-similarity-btn')?.addEventListener('click', handleFindSimilar);
        document.getElementById('search-deeper-btn')?.addEventListener('click', handleSearchDeeper);
    }

    // --- AI SYSTEM FUNCTIONS ---
    function startAISystem() {
        addToFeed('AI system initialization complete', 'success');
        addToFeed('Neural networks loaded and ready', 'success');
        addToFeed('Feature extraction pipeline active', 'success');
        
        // Simulate ongoing AI activity
        setInterval(() => {
            if (aiSystemActive) {
                updateAIStats();
            }
        }, 5000);
    }

    function updateAIStats() {
        // Simulate dynamic stats
        const gpuUsage = 80 + Math.random() * 15;
        const memoryUsage = 20 + Math.random() * 10;
        const indexCount = 2.4 + Math.random() * 0.2;

        document.getElementById('gpu-status').textContent = `${Math.floor(gpuUsage)}% Active`;
        document.getElementById('memory-status').textContent = `${memoryUsage.toFixed(1)} GB`;
        document.getElementById('index-status').textContent = `${indexCount.toFixed(1)}M vectors`;

        // Update accuracy and speed
        const accuracy = 94.5 + Math.random() * 0.4;
        const speed = 0.25 + Math.random() * 0.1;

        document.getElementById('similarity-accuracy').textContent = `${accuracy.toFixed(1)}%`;
        document.getElementById('search-speed').textContent = `${speed.toFixed(2)}s`;
    }

    function addToFeed(message, type = 'success', timestamp = null) {
        if (!analysisFeedContent) return;

        const now = timestamp || new Date();
        const timeStr = now.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });

        const feedItem = document.createElement('div');
        feedItem.className = 'feed-item';
        feedItem.innerHTML = `
            <div class="feed-timestamp">${timeStr}</div>
            <div class="feed-message">${message}</div>
            <div class="feed-status ${type}"></div>
        `;

        analysisFeedContent.insertBefore(feedItem, analysisFeedContent.firstChild);

        // Keep only last 20 items
        while (analysisFeedContent.children.length > 20) {
            analysisFeedContent.removeChild(analysisFeedContent.lastChild);
        }

        // Auto-scroll to top
        analysisFeedContent.scrollTop = 0;
    }

    function clearAnalysisFeed() {
        if (analysisFeedContent) {
            analysisFeedContent.innerHTML = '';
            addToFeed('Analysis feed cleared', 'success');
        }
    }

    function toggleAIPanel() {
        if (!aiPanelContent) return;
        
        const isCollapsed = aiPanelContent.style.display === 'none';
        const icon = aiPanelToggle.querySelector('i');
        
        if (isCollapsed) {
            aiPanelContent.style.display = 'block';
            icon.className = 'fas fa-chevron-up';
        } else {
            aiPanelContent.style.display = 'none';
            icon.className = 'fas fa-chevron-down';
        }
    }

    function activateSimilaritySearch() {
        findSimilarMode = true;
        addToFeed('Similarity search mode activated', 'success');
        addToFeed('Click on any annotation to find similar features', 'success');
        
        // Animate the button
        activateSimilarityBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            activateSimilarityBtn.style.transform = 'scale(1)';
        }, 150);
    }

    function updateClusterCount() {
        const count = clusterCountSlider.value;
        clusterCountDisplay.textContent = count;
    }

    // --- CLUSTERING SIMULATION ---
    function simulateClustering() {
        const algorithm = clusteringAlgorithm.value;
        const clusterCount = parseInt(clusterCountSlider.value);
        
        addToFeed(`Initializing ${algorithm.toUpperCase()} clustering`, 'success');
        addToFeed(`Target clusters: ${clusterCount}`, 'success');
        
        showLoading('Performing AI clustering analysis...');
        setTimeout(() => hideLoading(), 4000); // auto-hide after 10s
        updateProgress(0);
        
        // Simulate clustering process
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                setTimeout(() => {
                    hideLoading();
                    showClusteringResults(algorithm, clusterCount);
                }, 500);
            }
            updateProgress(progress);
        }, 200);
    }

    function showClusteringResults(algorithm, clusterCount) {
        // Clear existing clusters
        clusterLayer.clearLayers();
        
        // Generate random cluster centers and assign colors
        const colors = [
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
            '#ff9ff3', '#54a0ff', '#5f27cd', '#10ac84', '#ee5a24'
        ];
        
        const clusters = [];
        for (let i = 0; i < clusterCount; i++) {
            clusters.push({
                id: i,
                color: colors[i % colors.length],
                label: `Cluster ${i + 1}`,
                points: []
            });
        }
        
        // Generate random points for visualization
        const bounds = map.getBounds();
        const pointCount = 50 + Math.random() * 100;
        
        for (let i = 0; i < pointCount; i++) {
            const lat = bounds.getSouth() + (bounds.getNorth() - bounds.getSouth()) * Math.random();
            const lng = bounds.getWest() + (bounds.getEast() - bounds.getWest()) * Math.random();
            const clusterId = Math.floor(Math.random() * clusterCount);
            
            const marker = L.circleMarker([lat, lng], {
                radius: 6,
                color: 'white',
                fillColor: clusters[clusterId].color,
                fillOpacity: 0.8,
                weight: 2
            });
            
            marker.bindTooltip(`${clusters[clusterId].label}<br/>Confidence: ${(0.7 + Math.random() * 0.3).toFixed(3)}`);
            clusterLayer.addLayer(marker);
            clusters[clusterId].points.push(marker);
        }
        
        // Show clustering overlay
        showClusteringOverlay(clusters, algorithm);
        
        addToFeed(`${algorithm.toUpperCase()} clustering completed`, 'success');
        addToFeed(`${clusters.length} clusters identified`, 'success');
        addToFeed(`${Math.floor(pointCount)} features analyzed`, 'success');
        
        clusteringActive = true;
    }

    function showClusteringOverlay(clusters, algorithm) {
        // Populate legend
        if (legendItems) {
            legendItems.innerHTML = '';
            clusters.forEach(cluster => {
                const legendItem = document.createElement('div');
                legendItem.className = 'legend-item';
                legendItem.innerHTML = `
                    <div class="legend-color" style="background-color: ${cluster.color}"></div>
                    <div class="legend-label">${cluster.label}</div>
                `;
                legendItems.appendChild(legendItem);
            });
        }
        
        // Update clustering stats
        const silhouette = 0.7 + Math.random() * 0.2;
        const inertia = 1000 + Math.random() * 500;
        
        if (silhouetteScore) silhouetteScore.textContent = silhouette.toFixed(3);
        if (inertiaScore) inertiaScore.textContent = inertia.toFixed(1);
        
        // Show overlay
        if (clusteringOverlay) {
            clusteringOverlay.classList.add('active');
        }
    }

    function closeClustering() {
        if (clusteringOverlay) {
            clusteringOverlay.classList.remove('active');
        }
        
        // Clear cluster visualization
        clusterLayer.clearLayers();
        clusteringActive = false;
        
        addToFeed('Clustering analysis closed', 'success');
    }

    // --- MAP FUNCTIONS ---
    async function loadDataset(dataset, footprint) {
        showLoading(`Loading dataset: ${dataset}/${footprint}...`);
        
        try {
            const res = await fetch(`${API_BASE}/datasets/${dataset}/${footprint}/bounds`);
            if (!res.ok) {
                throw new Error(`Failed to load dataset bounds. Status: ${res.status}`);
            }
            const data = await res.json();
            const { bounds } = data;

            // Set available zooms
            if (Array.isArray(data.available_zooms) && data.available_zooms.length > 0) {
                availableZooms = data.available_zooms;
                const minApiZoom = Math.min(...availableZooms);
                const maxApiZoom = Math.max(...availableZooms);
                currentMinZoom = minApiZoom;
                
                // Set map zoom limits
                map.options.minZoom = minApiZoom;
                map.options.maxZoom = maxApiZoom;
            } else {
                console.warn('Warning: available_zooms is missing or invalid. Using default zoom levels.');
                availableZooms = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
                currentMinZoom = 0;
                map.options.minZoom = 0;
                map.options.maxZoom = 10;
            }

            // Create tile layer with error handling
            currentLayer = L.tileLayer(`${API_BASE}/tiles/${dataset}/${footprint}/{z}/{x}/{y}.png`, {
                attribution: `&copy; ${dataset}/${footprint}`,
                noWrap: true,
                bounds: L.latLngBounds(bounds),
                errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
                detectRetina: false
            }).addTo(map);

            // Set bounds and initial view
            const mapBounds = L.latLngBounds(bounds);
            map.setMaxBounds(mapBounds.pad(5));
            map.setView(mapBounds.getCenter(), currentMinZoom);

            // Handle tile errors silently
            currentLayer.on('tileerror', function(error) {
                console.debug('Tile loading error:', error);
            });

            updateZoomInfo();
            datasetNameElement.textContent = `${dataset}/${footprint}`;
            
        } catch (error) {
            console.error('Error loading dataset:', error);
            addToFeed(`Failed to load dataset: ${error.message}`, 'error');
        } finally {
            // Hide loading after a short delay to ensure everything is rendered
            setTimeout(hideLoading, 300);
        }
    }

    // Add this more aggressive tile validation
    function setupTileRequestValidation() {
        // Override the _addTile method to prevent creating tiles for invalid coordinates
        const originalAddTile = L.GridLayer.prototype._addTile;
        
        L.GridLayer.prototype._addTile = function(coords, container) {
            // Check if coordinates are valid before creating the tile
            if (coords.x < 0 || coords.y < 0) {
                return null; // Don't create tile for negative coordinates
            }
            
            // Check if this zoom level is available
            if (availableZooms.length > 0 && !availableZooms.includes(coords.z)) {
                return null;
            }
            
            return originalAddTile.call(this, coords, container);
        };
        
        // Also override the _getTileUrl method as before
        const originalGetTileUrl = L.TileLayer.prototype._getTileUrl;
        
        L.TileLayer.prototype._getTileUrl = function(coords) {
            // Check if coordinates are valid
            if (coords.x < 0 || coords.y < 0) {
                return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
            }
            
            // Check if this zoom level is available
            if (availableZooms.length > 0 && !availableZooms.includes(coords.z)) {
                return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
            }
            
            return originalGetTileUrl.call(this, coords);
        };
    }


    async function loadAnnotations() {
        try {
            const params = new URLSearchParams({ dataset: currentDataset, footprint: currentFootprint });
            const res = await fetch(`${API_BASE}/annotations?${params.toString()}`);
            const data = await res.json();
            
            drawnItems.clearLayers();
            data.forEach((annotation) => {
                const layer = L.geoJSON(annotation.geojson).getLayers()[0];
                if (annotation.label) {
                    layer._label = annotation.label;
                    layer.bindTooltip(annotation.label, { permanent: true, direction: 'top' }).openTooltip();
                }
                layer._annotationId = annotation.id;
                layer._dataset = annotation.dataset;
                layer._footprint = annotation.footprint;
                drawnItems.addLayer(layer);
            });
            
            addToFeed(`${data.length} annotations loaded`, 'success');
        } catch (error) {
            console.error('Failed to load annotations:', error);
            addToFeed('Failed to load annotations', 'error');
        }
    }

    // --- SIMILARITY SEARCH ---
    async function handleAnnotationClick(e) {
        const layer = e.layer || e.target;
        if (!layer._annotationId) return;

        if (findSimilarMode) {
            await performSimilaritySearch(layer);
        } else {
            editAnnotationLabel(layer);
        }
    }

    async function performSimilaritySearch(layer) {
        findSimilarMode = false;
        showLoading('AI analyzing surface features...');
        updateProgress(0);
        searchedZooms = [];
        currentQueryLayer = layer;
        searchDeeperBtn.disabled = true;

        const currentZoom = map.getZoom();
        
        try {
            addToFeed('Initiating similarity search', 'success');
            addToFeed('Extracting feature vectors', 'success');
            
            updateProgress(20);
            
            const url = `${API_BASE}/annotations/similar?top_k=${TOP_K}&zoom=${currentZoom}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    annotation_id: layer._annotationId,
                    dataset: currentDataset,
                    footprint: currentFootprint,
                    geojson: layer.toGeoJSON()
                })
            });
            
            updateProgress(60);
            
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.detail || `HTTP ${res.status}`);
            }
            
            updateProgress(80);
            const data = await res.json();
            
            drawResults(data, true);
            searchedZooms.push(currentZoom);
            
            updateProgress(100);
            
            if (highlightLayer.getLayers().length > 0) {
                map.fitBounds(highlightLayer.getBounds().pad(0.1));
                searchDeeperBtn.disabled = false;
                showResultsPanel(data);
            }
            
            addToFeed(`Found ${data.similar_tiles.length} similar features`, 'success');
            addToFeed('Search completed successfully', 'success');
            
        } catch (err) {
            console.error('Similarity search error:', err);
            addToFeed(`Search failed: ${err.message}`, 'error');
        } finally {
            hideLoading();
        }
    }

    function drawResults(data, clearFirst = false) {
    if (clearFirst) {
        highlightLayer.clearLayers();
    }

    data.similar_tiles.forEach((tile) => {
        const bounds = [
        [tileYToLat(tile.y + 1, tile.z), tileXToLng(tile.x, tile.z)],
        [tileYToLat(tile.y, tile.z), tileXToLng(tile.x + 1, tile.z)]
        ];

        const rect = L.rectangle(bounds, { color: '#80ef80', weight: 2, fillOpacity: 0.3 });
        const tooltipText = `Score: ${tile.score.toFixed(3)} Zoom: ${tile.z}`;
        rect.bindTooltip(tooltipText, { permanent: true, direction: 'top' }).openTooltip();
        highlightLayer.addLayer(rect);
    });
    }


    function showResultsPanel(data) {
        if (!aiResultsPanel || !resultsContent) return;
        
        resultsContent.innerHTML = '';
        
        data.similar_tiles.forEach((tile, index) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            resultItem.style.cssText = `
                padding: var(--space-3);
                margin-bottom: var(--space-2);
                background: rgba(15, 23, 42, 0.6);
                border-radius: var(--radius-sm);
                border-left: 3px solid hsl(${tile.score * 120}, 70%, 50%);
            `;
            
            resultItem.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 600; color: var(--color-light);">Match ${index + 1}</div>
                        <div style="font-size: 0.8rem; color: var(--color-gray-light);">
                            Similarity: ${(tile.score * 100).toFixed(1)}% | Zoom: ${tile.z}
                        </div>
                    </div>
                    <div style="color: hsl(${tile.score * 120}, 70%, 60%); font-weight: 800; font-size: 1.2rem;">
                        ${(tile.score * 100).toFixed(0)}%
                    </div>
                </div>
            `;
            
            resultsContent.appendChild(resultItem);
        });
        
        aiResultsPanel.classList.add('active');
    }

    function closeResultsPanel() {
        if (aiResultsPanel) {
            aiResultsPanel.classList.remove('active');
        }
    }

    function exportResults() {
        addToFeed('Exporting analysis results', 'success');
        // Simulate export functionality
        setTimeout(() => {
            addToFeed('Results exported successfully', 'success');
        }, 1000);
    }

    // --- HELPER FUNCTIONS ---
    function showLoading(message) {
        const loadingOverlay = document.getElementById('loading-overlay');
        const statusMessageElement = document.getElementById('status-message');
        
        if (statusMessageElement) statusMessageElement.textContent = message;
        if (loadingOverlay) {
            loadingOverlay.classList.remove('hidden');
            loadingOverlay.style.display = 'flex';
        }
        updateProgress(0);
    }

    function hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay');
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
            loadingOverlay.style.display = 'none';
        }
        
        // Also hide the map loading element
        const mapLoading = document.getElementById('map-loading');
        if (mapLoading) {
            mapLoading.classList.add('hidden');
            mapLoading.style.display = 'none';
        }
    }

    function updateProgress(percent) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        if (progressFill) progressFill.style.width = `${percent}%`;
        if (progressText) progressText.textContent = `${Math.round(percent)}%`;
    }

    function updateZoomInfo() {
        if (!map || !zoomInfoElement) return;
        const displayZoom = map.getZoom() - currentMinZoom;
        zoomInfoElement.textContent = `Zoom Level: ${displayZoom}`;
    }

    function tileXToLng(x, z) {
        return (x / Math.pow(2, z)) * 360 - 180;
    }

    function tileYToLat(y, z) {
        const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
        return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    }

    // Analysis Feed Collapse/Expand functionality
    function setupFeedCollapse() {
        const feedPanel = document.querySelector('.analysis-feed-panel');
        const collapseBtn = document.getElementById('feed-collapse-btn');
        const infoBtn = document.getElementById('feed-info-btn');
        
        if (!feedPanel || !collapseBtn) return;
        
        // Toggle collapse/expand
        collapseBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            feedPanel.classList.toggle('collapsed');
            
            // Update icon
            const icon = collapseBtn.querySelector('i');
            if (feedPanel.classList.contains('collapsed')) {
                icon.className = 'fas fa-chevron-up';
            } else {
                icon.className = 'fas fa-chevron-down';
            }
        });
        
        // Make header clickable to expand if collapsed
        const feedHeader = document.querySelector('.analysis-feed-panel .feed-header');
        feedHeader.addEventListener('click', function(e) {
            if (feedPanel.classList.contains('collapsed') && !e.target.closest('button')) {
                feedPanel.classList.remove('collapsed');
                const icon = collapseBtn.querySelector('i');
                icon.className = 'fas fa-chevron-down';
            }
        });
        
        // Info button functionality
        if (infoBtn) {
            infoBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                alert('Analysis Feed shows real-time updates and notifications from the AI system. Click the arrow to collapse/expand.');
            });
        }
    }

    // --- ANNOTATION FUNCTIONS ---
    async function handleCreateAnnotation(e) {
        const layer = e.layer;
        const label = prompt('Enter label for this annotation:');
        if (label) {
            layer._label = label;
            layer.bindTooltip(label, { permanent: true, direction: 'center' }).openTooltip();
        }
        drawnItems.addLayer(layer);
        
        const annotation = {
            id: String(Date.now()),
            dataset: currentDataset,
            footprint: currentFootprint,
            geojson: layer.toGeoJSON(),
            label: label
        };
        
        try {
            await fetch(`${API_BASE}/annotations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(annotation)
            });
            layer._annotationId = annotation.id;
            addToFeed('New annotation created', 'success');
        } catch (error) {
            console.error('Failed to save annotation:', error);
            addToFeed('Failed to save annotation', 'error');
        }
    }

    async function handleDeleteAnnotation(e) {
        e.layers.eachLayer(async (layer) => {
            if (layer._annotationId) {
                const params = new URLSearchParams({
                    dataset: currentDataset,
                    footprint: currentFootprint
                });
                await fetch(`${API_BASE}/annotations/${layer._annotationId}?${params.toString()}`, {
                    method: 'DELETE'
                });
                addToFeed('Annotation deleted', 'success');
            }
        });
    }

    async function editAnnotationLabel(layer) {
        const newLabel = prompt('Edit label:', layer._label || '');
        if (newLabel !== null) {
            layer._label = newLabel;
            layer.getTooltip().setContent(newLabel);
            const params = new URLSearchParams({
                dataset: currentDataset,
                footprint: currentFootprint
            });
            await fetch(`${API_BASE}/annotations/${layer._annotationId}?${params.toString()}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ label: newLabel })
            });
            addToFeed('Annotation label updated', 'success');
        }
    }

    // --- CONTROL FUNCTIONS ---
    function handleFindSimilar() {
        activateSimilaritySearch();
    }

    async function handleSearchDeeper() {
        if (!currentQueryLayer) return;
        
        showLoading('Searching additional zoom levels...');
        searchDeeperBtn.disabled = true;

        try {
            const url = `${API_BASE}/annotations/similar/more?top_k=${TOP_K}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    annotation_id: currentQueryLayer._annotationId,
                    dataset: currentDataset,
                    footprint: currentFootprint,
                    geojson: currentQueryLayer.toGeoJSON(),
                    exclude_zooms: searchedZooms
                })
            });
            
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.detail || `HTTP ${res.status}`);
            }
            
            const data = await res.json();
            drawResults(data, false);
            searchedZooms.push(...availableZooms.filter((z) => !searchedZooms.includes(z)));
            
            if (highlightLayer.getLayers().length > 0) {
                map.fitBounds(highlightLayer.getBounds().pad(0.1));
            }
            
            addToFeed(`Deep search found ${data.similar_tiles.length} additional matches`, 'success');
            
        } catch (err) {
            console.error('Deeper search error:', err);
            addToFeed(`Deep search failed: ${err.message}`, 'error');
        } finally {
            hideLoading();
        }
    }

    function toggleAnnotations() {
        showAnnotations = !showAnnotations;
        if (showAnnotations) {
            map.addLayer(drawnItems);
            annotationsOnIcon.classList.remove('hidden');
            annotationsOffIcon.classList.add('hidden');
        } else {
            map.removeLayer(drawnItems);
            annotationsOnIcon.classList.add('hidden');
            annotationsOffIcon.classList.remove('hidden');
        }
        addToFeed(`Annotations ${showAnnotations ? 'shown' : 'hidden'}`, 'success');
    }

    function toggleLabels() {
        showLabels = !showLabels;
        drawnItems.eachLayer((layer) => {
            const tooltip = layer.getTooltip();
            if (tooltip) {
                if (showLabels) {
                    layer.openTooltip();
                } else {
                    layer.closeTooltip();
                }
            }
        });
        
        highlightLayer.eachLayer((layer) => {
            const tooltip = layer.getTooltip();
            if (tooltip) {
                if (showLabels) {
                    layer.openTooltip();
                } else {
                    layer.closeTooltip();
                }
            }
        });
        
        addToFeed(`Labels ${showLabels ? 'shown' : 'hidden'}`, 'success');
    }

    function clearHighlights() {
        highlightLayer.clearLayers();
        clusterLayer.clearLayers();
        searchedZooms = [];
        currentQueryLayer = null;
        searchDeeperBtn.disabled = true;
        clusteringActive = false;
        
        if (clusteringOverlay) {
            clusteringOverlay.classList.remove('active');
        }
        
        closeResultsPanel();
        addToFeed('All highlights and clusters cleared', 'success');
    }

    // --- ANIMATION HELPERS ---
    function animateButton(button) {
        if (!button) return;
        button.style.transform = 'scale(0.95)';
        setTimeout(() => {
            button.style.transform = 'scale(1)';
        }, 150);
    }

    function pulseElement(element, duration = 1000) {
        if (!element) return;
        element.style.animation = `aiPulse ${duration}ms ease-in-out`;
        setTimeout(() => {
            element.style.animation = '';
        }, duration);
    }

    // Enhanced event handlers with animations
    function handleFindSimilar() {
        animateButton(findSimilarBtn);
        pulseElement(document.querySelector('.ai-icon'));
        activateSimilaritySearch();
    }

    // Add smooth transitions for UI state changes
    function smoothToggle(element, show) {
        if (!element) return;
        
        if (show) {
            element.style.opacity = '0';
            element.style.display = 'block';
            element.offsetHeight; // Force reflow
            element.style.transition = 'opacity 0.3s ease-in-out';
            element.style.opacity = '1';
        } else {
            element.style.transition = 'opacity 0.3s ease-in-out';
            element.style.opacity = '0';
            setTimeout(() => {
                element.style.display = 'none';
                element.style.transition = '';
            }, 300);
        }
    }

    // Enhanced clustering visualization with smooth animations
    function animateClusterPoints() {
        const points = clusterLayer.getLayers();
        points.forEach((point, index) => {
            setTimeout(() => {
                const element = point._path;
                if (element) {
                    element.style.transform = 'scale(0)';
                    element.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                    element.offsetHeight; // Force reflow
                    element.style.transform = 'scale(1)';
                }
            }, index * 50);
        });
    }

    // Add particle interaction on mouse move
    document.addEventListener('mousemove', (e) => {
        const particles = document.querySelectorAll('.particle');
        particles.forEach((particle, index) => {
            const rect = particle.getBoundingClientRect();
            const distance = Math.sqrt(
                Math.pow(e.clientX - (rect.left + rect.width / 2), 2) +
                Math.pow(e.clientY - (rect.top + rect.height / 2), 2)
            );
            
            if (distance < 100) {
                const scale = 1.5 - (distance / 100);
                particle.style.transform = `scale(${scale})`;
                particle.style.opacity = Math.max(0.3, 1 - (distance / 150));
            } else {
                particle.style.transform = 'scale(1)';
                particle.style.opacity = '';
            }
        });
    });

    // Add ripple effect on click
    document.addEventListener('click', (e) => {
        const ripple = document.createElement('div');
        ripple.style.cssText = `
            position: absolute;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(139, 92, 246, 0.4) 0%, transparent 70%);
            pointer-events: none;
            transform: translate(-50%, -50%);
            animation: rippleEffect 0.8s ease-out forwards;
            z-index: 2000;
            left: ${e.clientX}px;
            top: ${e.clientY}px;
            width: 0;
            height: 0;
        `;
        
        document.body.appendChild(ripple);
        
        setTimeout(() => {
            if (document.body.contains(ripple)) {
                document.body.removeChild(ripple);
            }
        }, 800);
    });

    // Dynamic AI statistics updates
    function startDynamicUpdates() {
        setInterval(() => {
            if (aiSystemActive) {
                // Update similarity accuracy with small variations
                const currentAccuracy = parseFloat(document.getElementById('similarity-accuracy').textContent);
                const newAccuracy = Math.max(94.0, Math.min(95.0, currentAccuracy + (Math.random() - 0.5) * 0.2));
                document.getElementById('similarity-accuracy').textContent = `${newAccuracy.toFixed(1)}%`;

                // Update search speed
                const currentSpeed = parseFloat(document.getElementById('search-speed').textContent);
                const newSpeed = Math.max(0.2, Math.min(0.4, currentSpeed + (Math.random() - 0.5) * 0.05));
                document.getElementById('search-speed').textContent = `${newSpeed.toFixed(2)}s`;

                // Randomly add system messages
                if (Math.random() < 0.1) {
                    const messages = [
                        'Background model optimization complete',
                        'Feature cache updated',
                        'Neural network weights synchronized',
                        'Processing pipeline optimized',
                        'Memory allocation rebalanced'
                    ];
                    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
                    addToFeed(randomMessage, 'success');
                }
            }
        }, 3000);
    }

    // Initialize dynamic updates
    startDynamicUpdates();

    // Add CSS animations for ripple effect
    const style = document.createElement('style');
    style.textContent = `
        @keyframes rippleEffect {
            to {
                width: 200px;
                height: 200px;
                opacity: 0;
            }
        }

        .result-item {
            transition: all 0.3s ease;
        }

        .result-item:hover {
            transform: translateX(5px);
            background: rgba(15, 23, 42, 0.8) !important;
        }

        .feed-item {
            transition: all 0.3s ease;
        }

        .feed-item:hover {
            transform: translateX(3px);
            background: rgba(15, 23, 42, 0.6) !important;
        }

        .ai-feature-card {
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .clustering-visualization {
            animation: modalSlideIn 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes modalSlideIn {
            from {
                opacity: 0;
                transform: scale(0.9) translateY(50px);
            }
            to {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
        }

        .legend-item {
            transition: all 0.3s ease;
            cursor: pointer;
        }

        .legend-item:hover {
            transform: translateX(5px);
            background: rgba(139, 92, 246, 0.1) !important;
        }
    `;
    document.head.appendChild(style);

    // Performance monitoring and optimization
    function monitorPerformance() {
        let frameCount = 0;
        let startTime = performance.now();
        
        function checkFrameRate() {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime - startTime >= 2000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - startTime));
                
                if (fps < 30) {
                    // Reduce visual effects for better performance
                    const particles = document.querySelectorAll('.particle');
                    const reduceCount = Math.floor(particles.length * 0.3);
                    for (let i = 0; i < reduceCount; i++) {
                        if (particles[i] && particles[i].parentNode) {
                            particles[i].parentNode.removeChild(particles[i]);
                        }
                    }
                    addToFeed(`Performance optimization: cached tiles (size: ${fps})`, 'warning');
                }
                
                frameCount = 0;
                startTime = currentTime;
            }
            
            requestAnimationFrame(checkFrameRate);
        }
        
        requestAnimationFrame(checkFrameRate);
    }

    // Initialize performance monitoring
    monitorPerformance();

    // Add enhanced error handling
    window.addEventListener('error', (e) => {
        addToFeed(`System error: ${e.message}`, 'error');
        console.error('Stellar error:', e);
    });

    window.addEventListener('unhandledrejection', (e) => {
        addToFeed(`Promise rejection: ${e.reason}`, 'error');
        console.error('Stellar rejection:', e.reason);
    });

    // Initialize welcome sequence
    setTimeout(() => {
        addToFeed('Stellar AI system fully operational', 'success');
        addToFeed('Ready for planetary surface analysis', 'success');
        
        // Animate the AI icon
        const aiIcon = document.querySelector('.ai-icon');
        if (aiIcon) {
            pulseElement(aiIcon, 2000);
        }
    }, 1000);

    // Emergency fix: Force hide loading overlay if it's still visible
    setTimeout(() => {
        hideLoading();
        
        // Add debug info
        console.log("Initialization complete - hiding loading overlays");
        console.log("Loading overlay hidden:", document.getElementById('loading-overlay')?.classList.contains('hidden'));
        console.log("Map loading hidden:", document.getElementById('map-loading')?.classList.contains('hidden'));
    }, 1000);

    // Emergency fallback - hide loading after 8 seconds no matter what
    setTimeout(() => {
        const loadingOverlay = document.getElementById('loading-overlay');
        const mapLoading = document.getElementById('map-loading');
        
        if (loadingOverlay && !loadingOverlay.classList.contains('hidden')) {
            console.warn("Emergency: Force hiding loading overlay after timeout");
            hideLoading();
        }
        
        if (mapLoading && !mapLoading.classList.contains('hidden')) {
            mapLoading.classList.add('hidden');
            mapLoading.style.display = 'none';
        }
    }, 8000);
});