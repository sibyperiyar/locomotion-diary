/**
 * PlacesManager
 * Handles storage and persistence of "Named/Corrected Places".
 * Uses localStorage for session persistence and JSON Export/Import for permanent storage.
 */
const PlacesManager = {
    STORAGE_KEY: 'locomotion_places',
    places: [],

    init() {
        this.load();
    },

    load() {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (raw) {
            try {
                this.places = JSON.parse(raw);
            } catch (e) {
                console.error("Failed to parse saved places", e);
                this.places = [];
            }
        }
    },

    // --- Helpers ---
    getDist(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // metres
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // in meters
    },

    /**
     * Finds the nearest place within radius (meters).
     * @param {number} lat 
     * @param {number} lng 
     * @param {number} radiusMeters 
     * @returns {string|null} Name of place or null
     */
    findNearest(lat, lng, radiusMeters = 150) {
        let closest = null;
        let minKeyDist = Infinity;

        // Check for exact(ish) match first (prioritize the one we just saved)
        // Then check for nearest spatial match

        for (const p of this.places) {
            if (!p.lat || !p.lng) continue;
            const d = this.getDist(lat, lng, p.lat, p.lng);

            if (d <= radiusMeters) {
                if (d < minKeyDist) {
                    minKeyDist = d;
                    closest = p.name;
                }
            }
        }
        return closest;
    },

    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.places));
        } catch (e) {
            console.error("Failed to save places", e);
        }
    },

    /**
     * Adds or updates a place.
     * @param {string} name - User defined name
     * @param {number} lat 
     * @param {number} lng 
     */
    addPlace(name, lat, lng) {
        if (!name || !lat || !lng) return;

        // Check availability (deduplicate by coords approx? or exact?)
        // Strategy: If close enough (e.g. 50m), update name. OR just push new.
        // User might want to name specific coords differently if they are distinct.
        // Let's check for exact matches first to update.
        // WIDENED TOLERANCE: 0.001 (~100m) to handle precision loss in DOM roundtrip
        const existingIndex = this.places.findIndex(p =>
            Math.abs(p.lat - lat) < 0.001 && Math.abs(p.lng - lng) < 0.001
        );

        if (existingIndex >= 0) {
            this.places[existingIndex].name = name; // Update
            this.places[existingIndex].lat = lat;   // Update precision if needed
            this.places[existingIndex].lng = lng;
        } else {
            this.places.push({ name, lat, lng, timestamp: Date.now() });
        }

        this.save();
    },

    removePlace(lat, lng) {
        this.places = this.places.filter(p =>
            !(Math.abs(p.lat - lat) < 0.001 && Math.abs(p.lng - lng) < 0.001)
        );
        this.save();
    },

    getPlace(lat, lng) {
        // Find closest
        const p = this.places.find(p =>
            Math.abs(p.lat - lat) < 0.001 && Math.abs(p.lng - lng) < 0.001
        );
        return p ? p.name : null;
    },

    getAll() {
        return this.places;
    },

    // --- Persistence ---

    exportPlaces() {
        if (this.places.length === 0) {
            alert("No saved places to export.");
            return;
        }
        const dataStr = JSON.stringify(this.places, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `locomotion_places_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    importPlaces(jsonData) {
        if (!Array.isArray(jsonData)) throw new Error("Invalid JSON format. Expected an array.");

        let added = 0;
        let updated = 0;

        jsonData.forEach(newItem => {
            if (!newItem.name || !newItem.lat || !newItem.lng) return;

            const existingIndex = this.places.findIndex(p =>
                Math.abs(p.lat - newItem.lat) < 0.001 && Math.abs(p.lng - newItem.lng) < 0.001
            );

            if (existingIndex >= 0) {
                // Update if name different? Or assume Import is master?
                // Let's overwrite.
                this.places[existingIndex] = newItem;
                updated++;
            } else {
                this.places.push(newItem);
                added++;
            }
        });

        this.save();
        return { added, updated };
    }
};

// Initialize immediately so other scripts can access it
PlacesManager.init();
window.PlacesManager = PlacesManager;
