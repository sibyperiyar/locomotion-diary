/**
 * Manual Entry Module
 * Handles creation and formatting of manual diary events.
 */

const ManualEntry = {
    /**
     * Creates a structured event object from form data.
     * @param {Object} data - Raw form data
     * @returns {Object}Formatted event object (stationary or moving)
     */
    create(data) {
        const type = data.type; // 'stationary' or 'moving'
        const startTime = new Date(`${data.date}T${data.startTime}`);
        const endTime = new Date(`${data.date}T${data.endTime}`); // Simplified: single day events for v1

        // Basic Validation
        if (endTime <= startTime) {
            throw new Error("End time must be after start time.");
        }

        if (type === 'stationary') {
            return this._createStationary(data, startTime, endTime);
        } else {
            return this._createMoving(data, startTime, endTime);
        }
    },

    _createStationary(data, startTime, endTime) {
        const narrative = data.description || `Spent time at ${data.locationName}.`;

        return {
            type: 'stationary',
            startTime: startTime,
            endTime: endTime,
            narrative: narrative,
            lat: parseFloat(data.lat),
            lng: parseFloat(data.lng),
            location: {
                name: data.locationName,
                address: data.address || "",
                mapsLink: `https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lng}`,
                enriched: true // Mark as manually entered/enriched
            },
            details: {
                manual: true
            },
            // Generate a unique ID to prevent collisions with imports
            id: `manual_stay_${startTime.getTime()}`
        };
    },

    _createMoving(data, startTime, endTime) {
        const narrative = data.description || `Traveled from ${data.startLocName} to ${data.endLocName}.`;

        return {
            type: 'moving',
            startTime: startTime,
            endTime: endTime,
            narrative: narrative,
            activityType: data.activityType || 'MOVING',
            distance: 0, // We could calculate straight line distance if coords available
            startLat: parseFloat(data.startLat),
            startLng: parseFloat(data.startLng),
            endLat: parseFloat(data.endLat),
            endLng: parseFloat(data.endLng),
            startLocation: {
                name: data.startLocName,
                mapsLink: `https://www.google.com/maps/search/?api=1&query=${data.startLat},${data.startLng}`
            },
            endLocation: {
                name: data.endLocName,
                mapsLink: `https://www.google.com/maps/search/?api=1&query=${data.endLat},${data.endLng}`
            },
            path: [], // No path for manual entries unless we add a path drawer (out of scope)
            details: {
                manual: true
            },
            id: `manual_move_${startTime.getTime()}`
        };
    }
};

window.ManualEntry = ManualEntry;
