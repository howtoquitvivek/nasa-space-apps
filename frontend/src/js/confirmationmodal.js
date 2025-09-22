/**
 * A modal component for configuring and confirming an analysis area download.
 * @param {object} options
 * @param {object} options.footprint The selected footprint object.
 * @param {string} options.datasetId The ID of the current dataset.
 * @returns {Promise<object | null>} A promise that resolves with the selected zoom range or null if canceled.
 */
export function openConfirmationModal({ footprint, datasetId }) {
    return new Promise(async (resolve) => {
        let dialogElement;
        let availableZooms = [];
        let minZoomAvailable = 0;
        let maxZoomAvailable = 0;
        let selectedMaxZoom = 0;
        const AVG_TILE_SIZE_KB = 30;

        const modalHtml = `
            <div class="modal-overlay">
                <dialog class="modal-card">
                    <div class="modal-content">
                        <div class="text-center">
                            <h2 class="modal-title">Configure Analysis Area</h2>
                            <p class="modal-subtitle">
                                You have selected:
                                <strong class="modal-footprint-title">${footprint.title}</strong>
                            </p>
                        </div>
                        <div id="status-message-container"></div>
                        <div class="modal-section" id="zoom-controls-container"></div>
                        <div class="modal-info-box" id="size-info-container"></div>
                        <div class="modal-footer">
                            <button id="cancel-btn" class="btn btn-secondary">
                                Cancel
                            </button>
                            <button id="confirm-btn" class="btn btn-cta">
                                <i class="fas fa-download me-2"></i>
                                Confirm & Download
                            </button>
                        </div>
                    </div>
                </dialog>
            </div>
        `;

        const container = document.createElement('div');
        container.innerHTML = modalHtml;
        document.body.appendChild(container);
        dialogElement = container.querySelector('dialog');
        
        const statusContainer = container.querySelector('#status-message-container');
        const zoomControlsContainer = container.querySelector('#zoom-controls-container');
        const sizeInfoContainer = container.querySelector('#size-info-container');
        const confirmBtn = container.querySelector('#confirm-btn');
        const cancelBtn = container.querySelector('#cancel-btn');
        
        let calculatedSize = { mb: 0, count: 0 };
        let existingZooms = [];

        async function fetchExistingZooms() {
            const footprintId = footprint.title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
            try {
                const res = await fetch(`http://localhost:8000/ingest/status/${datasetId}/${footprintId}`);
                if (res.ok) {
                    const data = await res.json();
                    existingZooms = data.existingZooms || [];
                }
            } catch (err) {
                console.error('Could not fetch status:', err);
                existingZooms = [];
            }
        }
        
        function calculateTotalSize(tilesPerZoom, maxZoom, minZoom) {
            let totalTiles = 0;
            if (!tilesPerZoom) return { count: 0, mb: 0 };
            for (const zoom of availableZooms) {
                if (zoom >= minZoom && zoom <= maxZoom) {
                    totalTiles += tilesPerZoom[zoom].count;
                }
            }
            return { count: totalTiles, mb: (totalTiles * AVG_TILE_SIZE_KB) / 1024 };
        }
        
        function updateUI() {
            calculatedSize = calculateTotalSize(
                footprint.downloadInfo.tilesPerZoom,
                selectedMaxZoom,
                minZoomAvailable
            );

            if (existingZooms.length > 0) {
                statusContainer.innerHTML = `
                    <div class="status-badge status-success">
                        <div class="status-text">
                            Already downloaded zooms: ${Math.min(...existingZooms)}-${Math.max(...existingZooms)}
                        </div>
                    </div>
                `;
            }

            if (minZoomAvailable > maxZoomAvailable) {
                zoomControlsContainer.innerHTML = `
                    <div class="text-center font-semibold text-gray-light">
                        ✅ All available zooms have already been downloaded!
                    </div>
                `;
                confirmBtn.disabled = true;
            } else {
                zoomControlsContainer.innerHTML = `
                    <label for="zoom-slider" class="modal-label">
                        Select Max Zoom to Download (${minZoomAvailable}-${maxZoomAvailable})
                    </label>
                    <p class="modal-hint">
                        Higher zoom means more detail but larger download size.
                    </p>
                    <input
                        type="range"
                        id="zoom-slider"
                        min="${minZoomAvailable}"
                        max="${maxZoomAvailable}"
                        value="${selectedMaxZoom}"
                        class="modal-slider"
                    />
                    <div class="modal-slider-labels">
                        <span>Zoom ${minZoomAvailable}</span>
                        <span>Zoom ${maxZoomAvailable}</span>
                    </div>
                `;
                confirmBtn.disabled = false;
                const zoomSlider = container.querySelector('#zoom-slider');
                zoomSlider.addEventListener('input', (e) => {
                    selectedMaxZoom = e.target.value;
                    updateUI();
                });
            }
            
            sizeInfoContainer.innerHTML = `
                <p class="modal-info-text">
                    Estimated Download (up to Zoom ${selectedMaxZoom}):
                    <span class="modal-info-value">${calculatedSize.mb.toFixed(2)} MB</span>
                </p>
                <p class="modal-info-hint">Total tiles: ${calculatedSize.count}</p>
            `;
        }
        
        await fetchExistingZooms();
        
        availableZooms = Object.keys(footprint.downloadInfo.tilesPerZoom).map(Number).sort((a, b) => a - b);
        if (availableZooms.length > 0) {
            const lastDownloaded = existingZooms.length ? Math.max(...existingZooms) : -1;
            minZoomAvailable = Math.max(availableZooms[0], lastDownloaded + 1);
            maxZoomAvailable = availableZooms[availableZooms.length - 1];
            selectedMaxZoom = maxZoomAvailable;
        }

        updateUI();
        dialogElement.showModal();

        cancelBtn.addEventListener('click', () => {
            dialogElement.close();
            resolve(null);
        });

        confirmBtn.addEventListener('click', () => {
            dialogElement.close();
            resolve({ minZoom: minZoomAvailable, maxZoom: selectedMaxZoom });
        });

        dialogElement.addEventListener('close', () => {
            document.body.removeChild(container);
        });
    });
}