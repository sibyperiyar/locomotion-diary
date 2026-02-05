/**
 * MapManager: Handles Leaflet Map interactions.
 * Design:
 * - Lazy init: Maps are only created when "Show Map" or "View Route" is clicked.
 * - Singleton-ish: We reuse the modal map instance.
 * - Local-only: Uses standard OSM tiles (no API keys).
 */
const MapManager = {
    // Shared Modal Map Instance
    modalMap: null,

    // Icon Definitions
    icons: {
        start: null, // Init on load
        end: null,
        stop: null
    },

    initIcons: function () {
        if (!window.L) return;

        // Custom simple markers using Emoji or default colors
        const createIcon = (color) => new L.Icon({
            iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });

        this.icons.start = createIcon('green');
        this.icons.end = createIcon('red');
        this.icons.stop = createIcon('blue');
        this.icons.moving = createIcon('orange');
    },

    /**
     * Renders a small inline map for a specific entry.
     * @param {string} elementId DOM ID of the container
     * @param {number} lat 
     * @param {number} lng 
     * @param {string} popupText 
     */
    initEntryMap: function (elementId, lat, lng, popupText) {
        if (!window.L) {
            console.error("Leaflet not loaded");
            return;
        }

        // Delay slightly to ensure DOM is ready
        requestAnimationFrame(() => {
            const container = document.getElementById(elementId);
            if (!container) return;

            // Cleanup if already exists (re-clicking toggle)
            if (container._leaflet_id) {
                // Already init, just return? 
                // Or maybe we want to destroy? 
                // For now, let's assume if it exists, it's good.
                return;
            }

            const map = L.map(elementId).setView([lat, lng], 15);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);

            L.marker([lat, lng]).addTo(map)
                .bindPopup(popupText)
                .openPopup();

            // Fix gray area issue by invalidating size after render
            setTimeout(() => { map.invalidateSize(); }, 200);
        });
    },

    /**
     * Renders the Day Route Modal
     * @param {Array} events Array of event objects (moving/stationary) for the day
     * @param {string} dateStr Title string
     */
    renderDailyRoute: function (events, dateStr) {
        if (!window.L) {
            alert("Leaflet JS not loaded!");
            return;
        }
        if (!this.icons.start) this.initIcons();

        // 1. Force Clean DOM (Remove old modal if exists)
        const oldModal = document.getElementById('map-modal');
        if (oldModal) oldModal.remove();

        // 2. Create Fresh Modal
        const modal = document.createElement('div');
        modal.id = 'map-modal';
        modal.className = 'modal-overlay'; // Flex container from CSS
        modal.style.display = 'flex'; // Ensure visible
        modal.innerHTML = `
            <div class="modal" style="width: 90%; max-width: 1000px; height: 80vh; display:flex; flex-direction:column; background:white; padding:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; height:40px;">
                    <h3 id="map-modal-title" style="margin:0;">Route: ${dateStr}</h3>
                    <button class="btn secondary" onclick="document.getElementById('map-modal').remove()">Close</button>
                </div>
                <div id="daily-map-container" style="flex:1; width:100%; min-height:400px; background:#f0f0f0;"></div>
            </div>
        `;
        document.body.appendChild(modal);

        // 3. Init Map
        const containerId = 'daily-map-container';
        const container = document.getElementById(containerId);

        // Debug Visuals
        console.log(`Map Container: ${container.offsetWidth}x${container.offsetHeight}`);

        // 4. Create Map Instance
        try {
            const map = L.map(containerId);
            this.modalMap = map;

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap'
            }).addTo(map);

            // 5. Plot Data
            const bounds = L.latLngBounds();
            let hasPoints = false;

            // Draw Lines
            events.forEach(e => {
                if (e.type === 'moving' && e.path && e.path.length > 0) {
                    const points = e.path.map(p => [p.lat, p.lng]);
                    if (points.length > 0) {
                        L.polyline(points, { color: 'blue', weight: 4 }).addTo(map)
                            .bindPopup(`${e.activityType} (${(e.distance / 1000).toFixed(1)}km)`);
                        points.forEach(p => bounds.extend(p));
                        hasPoints = true;
                    }
                }
            });

            // Draw Markers
            events.forEach(e => {
                if (e.type === 'stationary' && e.lat && e.lng) {
                    L.marker([e.lat, e.lng], { icon: this.icons.stop })
                        .addTo(map)
                        .bindPopup(`<b>${e.location.name}</b><br>${new Date(e.startTime).toLocaleTimeString()}`);
                    bounds.extend([e.lat, e.lng]);
                    hasPoints = true;
                }
            });

            // 6. Finalize View
            setTimeout(() => {
                map.invalidateSize();
                if (hasPoints) {
                    map.fitBounds(bounds, { padding: [50, 50] });
                } else {
                    map.setView([0, 0], 2);
                    // alert("No coordinates found for this day.");
                }
                // Remove debug border if success
                container.style.border = 'none';
            }, 300);

        } catch (err) {
            alert("Map Error: " + err.message);
            console.error(err);
        }
    }
};

window.MapManager = MapManager;
