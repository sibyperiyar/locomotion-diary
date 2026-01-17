/**
 * Parser for Google Location History (Records.json)
 * Handles both the new "Timeline Edits" format and older formats if possible.
 */

async function parseTimeline(input) {
    // 1. Normalize Input to Text
    let text;
    try {
        if (typeof input === 'string') {
            text = input;
        } else if (input instanceof Blob) {
            text = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = reject;
                reader.readAsText(input);
            });
        } else {
            throw new Error("Invalid input: Expected string or File/Blob.");
        }

        // 2. Parse Logic
        const data = JSON.parse(text);
        const events = [];

        // Google Takeout format usually has an array called 'locations' (raw) or 'timelineObjects' (semantic)
        // Semantic Location History usually comes in "Semantic Location History" folder as monthly JSONs, 
        // BUT "Records.json" is the raw data.
        // NOTE: The user prompt implies parsing "events", "places", "activities". This is found in the "Semantic Location History" JSONs usually.
        // However, "Records.json" is often just raw lat/longs.
        // Let's assume the user drags in a Semantic JSON (e.g., "2023_JANUARY.json").
        // If they drag "Records.json", we might need more complex logic to cluster stops.
        // Let's support the Semantic structure ('timelineObjects') first as it matches the "Diary" requirement best.

        let rawObjects = [];

        if (data.timelineObjects) {
            // Old Google Takeout Format
            rawObjects = data.timelineObjects;
        } else if (data.semanticSegments) {
            // New Android "Export Timeline data" Format (Timeline.json)
            // This format is a list of segments, each can be a visit or a path/activity.
            const segments = data.semanticSegments;
            segments.forEach(seg => {
                // The new format often puts startTime/endTime at the segment root
                // Timestamps might be ISO strings or similar in this new JSON.
                // Let's normalize them to the structure our sub-parsers expect, or write new sub-parsers.

                // Check for Visit
                if (seg.visit) {
                    // Structurally similar to placeVisit?
                    // Usually: seg.startTime, seg.endTime, seg.visit.hierarchyLevel...
                    // Let's create a normalized object for our existing parseVisit or a new one.
                    const visitObj = {
                        duration: {
                            startTimestampMs: new Date(seg.startTime).getTime(),
                            endTimestampMs: new Date(seg.endTime).getTime()
                        },
                        location: {
                            // Try to find a name or address
                            name: seg.visit.location?.name || seg.visit.location?.address || "Unknown Place",
                            address: seg.visit.location?.address
                        }
                    };
                    events.push(parseVisit(visitObj));
                }

                // Check for Activity / Path
                if (seg.transportation || seg.activity || seg.timelinePath) {
                    // "activity" in new format usually means moving
                    // seg.activity.startLocation, seg.activity.endLocation
                    // or seg.timelinePath

                    const activityType = seg.activity?.activityType || seg.transportation?.transportationMode || "MOVING";

                    const activityObj = {
                        duration: {
                            startTimestampMs: new Date(seg.startTime).getTime(),
                            endTimestampMs: new Date(seg.endTime).getTime()
                        },
                        activityType: activityType,
                        startLocation: seg.activity?.startLocation || seg.activity?.start || seg.startLocation || { name: "Unknown" },
                        endLocation: seg.activity?.endLocation || seg.activity?.end || seg.endLocation || { name: "Unknown" },
                        // Pass Path Data
                        waypointPath: seg.waypointPath,
                        simplifiedRawPath: seg.simplifiedRawPath,
                        timelinePath: seg.timelinePath
                    };
                    events.push(parseActivity(activityObj));
                }
            });

            // Return early as we processed them in the loop
            return events;

        } else if (Array.isArray(data)) {
            // Sometimes it's just an array
            rawObjects = data;
        } else {
            console.warn("Unknown JSON structure. Keys found:", Object.keys(data));
            // throw new Error("JSON format not recognized. Expected 'timelineObjects' or 'semanticSegments'.");
            // Soft Fail: return empty
            return [];
        }

        // If we fell through to here with rawObjects (e.g. older formats simple array)
        if (rawObjects.length > 0) {
            rawObjects.forEach(obj => {
                // Check for Locomotion Diary Internal Format (Re-import)
                if (obj.type && (obj.type === 'moving' || obj.type === 'stationary') && obj.startTime) {
                    // Already parsed! Just ensure dates are Date objects if they are strings
                    if (typeof obj.startTime === 'string') obj.startTime = new Date(obj.startTime);
                    if (typeof obj.endTime === 'string') obj.endTime = new Date(obj.endTime);
                    events.push(obj);
                }
                // Google Takeout Formats
                else if (obj.activitySegment) {
                    events.push(parseActivity(obj.activitySegment));
                } else if (obj.placeVisit) {
                    events.push(parseVisit(obj.placeVisit));
                }
            });

            return events;
        }

        // Fallback
        return [];

    } catch (err) {
        console.error("Parse error:", err);
        throw err;
    }
}

function parseActivity(segment) {
    const start = new Date(parseInt(segment.duration.startTimestampMs));
    const end = new Date(parseInt(segment.duration.endTimestampMs));
    const type = segment.activityType || 'MOVING';
    const cleanType = type.replace('IN_', '').replace('_', ' ').toLowerCase();

    let startLoc = segment.startLocation && segment.startLocation.name ? segment.startLocation.name : 'Unknown location';
    let endLoc = segment.endLocation && segment.endLocation.name ? segment.endLocation.name : 'Unknown destination';
    const narrative = `Started from ${startLoc}. Traveled by ${cleanType} to ${endLoc}.`;

    // 1. EXTRACT PATH (Priority 1)
    let path = [];
    if (segment.waypointPath && segment.waypointPath.waypoints) {
        path = segment.waypointPath.waypoints.map(wp => ({ lat: wp.latE7 / 1e7, lng: wp.lngE7 / 1e7 }));
    } else if (segment.simplifiedRawPath && segment.simplifiedRawPath.points) {
        path = segment.simplifiedRawPath.points.map(p => ({ lat: p.latE7 / 1e7, lng: p.lngE7 / 1e7 }));
    } else if (segment.timelinePath && segment.timelinePath.points) {
        path = segment.timelinePath.points.map(p => ({ lat: p.latE7 / 1e7, lng: p.lngE7 / 1e7 }));
    }

    // 2. EXTRACT COORDINATES (Priority 2)
    const getLat = (loc) => {
        if (!loc) return null;
        if (loc.latitudeE7) return loc.latitudeE7 / 1e7;
        if (loc.latLng) {
            try { return parseFloat(loc.latLng.split(',')[0].replace('°', '').trim()); } catch (e) { }
        }
        if (loc.name && loc.name.includes(',')) {
            try {
                const part = parseFloat(loc.name.split(',')[0].trim());
                if (!isNaN(part) && Math.abs(part) <= 90) return part;
            } catch (e) { }
        }
        return null;
    };
    const getLng = (loc) => {
        if (!loc) return null;
        if (loc.longitudeE7) return loc.longitudeE7 / 1e7;
        if (loc.latLng) {
            try { return parseFloat(loc.latLng.split(',')[1].replace('°', '').trim()); } catch (e) { }
        }
        if (loc.name && loc.name.includes(',')) {
            try {
                const part = parseFloat(loc.name.split(',')[1].trim());
                if (!isNaN(part) && Math.abs(part) <= 180) return part;
            } catch (e) { }
        }
        return null;
    };

    let startLat = getLat(segment.startLocation);
    let startLng = getLng(segment.startLocation);
    let endLat = getLat(segment.endLocation);
    let endLng = getLng(segment.endLocation);

    // 3. FALLBACK: USE PATH FOR COORDINATES (Priority 3)
    if (path.length > 0) {
        if (!startLat || !startLng) {
            startLat = path[0].lat;
            startLng = path[0].lng;
        }
        if (!endLat || !endLng) {
            endLat = path[path.length - 1].lat;
            endLng = path[path.length - 1].lng;
        }
    }

    // 4. FALLBACK: GENERATE PATH FROM COORDINATES (Priority 4)
    if (path.length === 0 && startLat && startLng && endLat && endLng) {
        path.push({ lat: startLat, lng: startLng });
        path.push({ lat: endLat, lng: endLng });
    }

    return {
        type: 'moving',
        startTime: start,
        endTime: end,
        narrative: narrative,
        path: path,
        details: segment,
        startLat: startLat,
        startLng: startLng,
        endLat: endLat,
        endLng: endLng,
        // Helpers for App
        startLocation: { name: startLoc, mapsLink: `https://www.google.com/maps/search/?api=1&query=${startLat},${startLng}` },
        endLocation: { name: endLoc, mapsLink: `https://www.google.com/maps/search/?api=1&query=${endLat},${endLng}` },
        // Add activity info for filtering/stats
        activityType: cleanType.toUpperCase(),
        distance: (segment.distanceMeters)
            || (segment.waypointPath && segment.waypointPath.distanceMeters)
            || (segment.simplifiedRawPath && segment.simplifiedRawPath.distanceMeters)
            || segment.distance
            // Fallback: Haversine Calculation
            || (startLat && startLng && endLat && endLng ? getDistanceInMeters(startLat, startLng, endLat, endLng) : 0)
    };
}

function parseVisit(visit) {
    const start = new Date(parseInt(visit.duration.startTimestampMs));
    const end = new Date(parseInt(visit.duration.endTimestampMs));
    const placeName = visit.location.name || visit.location.address || "Unsaved Place";

    // Duration calculation
    const diffMs = end - start;
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);
    let durStr = "";
    if (diffHrs > 0) durStr += `${diffHrs} hr `;
    durStr += `${diffMins} min`;

    // Narrative
    // "Reached [Place]. Spent [duration] here."
    const narrative = `Reached ${placeName}. Spent ${durStr} here.`;

    let lat = null;
    let lng = null;
    if (visit.location && visit.location.latitudeE7 && visit.location.longitudeE7) {
        lat = visit.location.latitudeE7 / 1e7;
        lng = visit.location.longitudeE7 / 1e7;
    }

    return {
        type: 'stationary',
        startTime: start,
        endTime: end,
        narrative: narrative,
        details: visit,
        lat: lat,
        lng: lng,
        // Helpers for App
        location: {
            name: placeName,
            mapsLink: visit.location?.mapsLink || (lat && lng ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : '#'),
            address: visit.location?.address || ""
        }
    };
}

// Distance Helper (Haversine Formula) - Explicitly defined
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}
window.getDistanceInMeters = getDistanceInMeters; // Export
