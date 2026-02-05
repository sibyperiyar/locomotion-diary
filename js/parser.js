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
                        },
                        // Mix in ALL raw properties so parseVisit can find topCandidate
                        ...seg.visit
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
    const start = new Date(segment.duration?.startTimestampMs ? parseInt(segment.duration.startTimestampMs) : segment.startTime);
    const end = new Date(segment.duration?.endTimestampMs ? parseInt(segment.duration.endTimestampMs) : segment.endTime);

    // Activity Type
    const type = segment.activityType || (segment.topCandidate?.type) || 'MOVING';
    const cleanType = type.replace('IN_', '').replace('_', ' ').toLowerCase();

    // 1. Extract Locations (Robust)
    // Try explicit start/end first, then fall back to activity wrapper fields
    const startObj = segment.startLocation || segment.activity?.start || segment.start;
    const endObj = segment.endLocation || segment.activity?.end || segment.end;

    // Names
    const startLocName = startObj?.name || "Unknown location";
    const endLocName = endObj?.name || "Unknown destination";

    let narrative = `Started from ${startLocName}. Traveled by ${cleanType} to ${endLocName}.`;

    // 2. Extract Coordinates (Deep Search)
    // We search the specific start/end objects first
    let startCoords = extractBestCoordinates(startObj);
    let endCoords = extractBestCoordinates(endObj);

    // Fallback: Check Parking for End Coords
    if (!endCoords && segment.parking || segment.activity?.parking) {
        const parking = segment.parking || segment.activity?.parking;
        endCoords = extractBestCoordinates(parking?.location || parking);
    }

    // 3. Extract Path
    let path = [];
    // Helper to converting "lat, lng" string to {lat, lng} object
    const parsePoint = (p) => {
        let coords = null;
        if (p.latE7) coords = { lat: p.latE7 / 1e7, lng: p.lngE7 / 1e7 };
        else if (p.point) coords = extractBestCoordinates({ latLng: p.point }); // Re-use logic for "lat, lng" string

        if (coords) {
            // ATTACH TIME IF AVAILABLE
            if (p.time) coords.time = p.time;
            else if (p.timestamp) coords.time = p.timestamp;
            return coords;
        }
        return null;
    };

    const rawPath = segment.timelinePath || segment.waypointPath || segment.simplifiedRawPath;
    if (rawPath && Array.isArray(rawPath)) {
        // Direct array (Timeline.json style sometimes)
        path = rawPath.map(parsePoint).filter(x => x);
    } else if (rawPath?.points) {
        // Object wrapper
        path = rawPath.points.map(parsePoint).filter(x => x);
    } else if (rawPath?.waypoints) {
        path = rawPath.waypoints.map(parsePoint).filter(x => x);
    }

    // 4. Fallback: Use Path for Start/End
    if (path.length > 0) {
        if (!startCoords) startCoords = path[0];
        if (!endCoords) endCoords = path[path.length - 1];
    }

    // 5. Fallback: Deep Search in Wrapper if still null (e.g. Activity object itself has latLng?)
    // Rare, but sometimes 'segment' itself has 'latitudeE7'
    if (!startCoords) startCoords = extractBestCoordinates(segment, ['startLocation', 'activity.start']);
    // ^ checks itself excluding standard sub-objects to avoid loop? No, just check props.

    // 6. Sub-Stop Detection (Intelligent Analysis)
    const stops = detectSubStops(path);
    if (stops.length > 0) {
        const stopDescriptions = stops.map(s => {
            const mins = Math.round(s.durationMs / 60000);
            let timeTxt = `${mins} min`;
            if (mins >= 60) {
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                timeTxt = `${h} hr ${m} min`;
            }
            const timeStr = s.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `${timeTxt} stop at ${timeStr}`;
        });

        // Intelligent Narrative Injection
        if (stopDescriptions.length === 1) {
            narrative += ` Includes a ${stopDescriptions[0]}.`;
        } else {
            narrative += ` Includes stops: ${stopDescriptions.join(', ')}.`;
        }
    }

    return {
        type: 'moving',
        startTime: start,
        endTime: end,
        narrative: narrative,
        path: path,
        details: segment,
        startLat: startCoords?.lat || null,
        startLng: startCoords?.lng || null,
        endLat: endCoords?.lat || null,
        endLng: endCoords?.lng || null,
        // Helpers for App
        startLocation: {
            name: startLocName,
            mapsLink: startCoords ? `https://www.google.com/maps/search/?api=1&query=${startCoords.lat},${startCoords.lng}` : '#'
        },
        endLocation: {
            name: endLocName,
            mapsLink: endCoords ? `https://www.google.com/maps/search/?api=1&query=${endCoords.lat},${endCoords.lng}` : '#'
        },
        activityType: cleanType.toUpperCase(),
        distance: (segment.distanceMeters)
            || (segment.activity?.distanceMeters)
            || (segment.waypointPath?.distanceMeters)
            || (segment.simplifiedRawPath?.distanceMeters)
            || (startCoords && endCoords ? getDistanceInMeters(startCoords.lat, startCoords.lng, endCoords.lat, endCoords.lng) : 0),
        subStops: stops // Exposed for future UI (e.g. map markers)
    };
}

/**
 * Scans a path for periods of stationarity.
 * @param {Array<{lat, lng, time}>} path 
 * @returns {Array<{startTime: Date, durationMs: number, lat: number, lng: number}>}
 */
function detectSubStops(path) {
    if (!path || path.length < 2) return [];

    const STOPS = [];
    const DIST_THRESHOLD = 500; // meters (generous to account for GPS drift)
    const TIME_THRESHOLD = 10 * 60 * 1000; // 10 minutes

    let clusterStart = path[0];
    let clusterStartTime = new Date(clusterStart.time || 0).getTime();
    if (!clusterStart.time) return []; // Cannot detect without time

    for (let i = 1; i < path.length; i++) {
        const p = path[i];
        if (!p.time) continue;
        const pTime = new Date(p.time).getTime();

        const dist = getDistanceInMeters(clusterStart.lat, clusterStart.lng, p.lat, p.lng);

        if (dist < DIST_THRESHOLD) {
            // Still in cluster, just continue
        } else {
            // Movement detected. Check if previous cluster was a stop.
            // The "Cluster" ended at the PREVIOUS point (i-1)
            const clusterEndTime = new Date(path[i - 1].time).getTime();
            const duration = clusterEndTime - clusterStartTime;

            if (duration >= TIME_THRESHOLD) {
                STOPS.push({
                    startTime: new Date(clusterStartTime),
                    durationMs: duration,
                    lat: clusterStart.lat,
                    lng: clusterStart.lng
                });
            }

            // Start new cluster
            clusterStart = p;
            clusterStartTime = pTime;
        }
    }

    // Check final cluster
    const lastP = path[path.length - 1];
    if (lastP.time) {
        const lastTime = new Date(lastP.time).getTime();
        const duration = lastTime - clusterStartTime;
        if (duration >= TIME_THRESHOLD) {
            STOPS.push({
                startTime: new Date(clusterStartTime),
                durationMs: duration,
                lat: clusterStart.lat,
                lng: clusterStart.lng
            });
        }
    }

    return STOPS;
}

function parseVisit(visit) {
    const start = new Date(visit.duration?.startTimestampMs ? parseInt(visit.duration.startTimestampMs) : visit.startTime);
    const end = new Date(visit.duration?.endTimestampMs ? parseInt(visit.duration.endTimestampMs) : visit.endTime);

    // 1. Coordinate Extraction (Do this first to use in naming)
    let coords = extractBestCoordinates(visit.location)
        || extractBestCoordinates(visit.visit?.location)
        || extractBestCoordinates(visit.topCandidate) // Check candidate directly
        || extractBestCoordinates(visit); // Last resort

    // 2. Name Resolution
    const locationObj = visit.location || visit.visit?.location || visit.topCandidate?.placeLocation || visit;
    let placeName = locationObj.name || locationObj.address;

    if (!placeName) {
        // Smart Fallbacks
        const candidate = visit.topCandidate || visit.visit?.topCandidate;
        if (candidate?.semanticType && candidate.semanticType !== 'UNKNOWN') {
            // e.g. "HOME" -> "Home"
            placeName = candidate.semanticType.charAt(0).toUpperCase() + candidate.semanticType.slice(1).toLowerCase();
        } else if (coords) {
            // Coordinate Fallback
            placeName = `Location near ${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)}`;
        } else {
            placeName = "Unsaved Place";
        }
    }

    // Duration calculation
    const diffMs = end - start;
    const diffHrs = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);
    let durStr = "";
    if (diffHrs > 0) durStr += `${diffHrs} hr `;
    durStr += `${diffMins} min`;

    // Narrative
    const narrative = `Reached ${placeName}. Spent ${durStr} here.`;

    const lat = coords?.lat || null;
    const lng = coords?.lng || null;

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

// --- Robust Reference Extractor ---
/**
 * Recursively looks for valid coordinates in an object.
 * Checks: lat/lng E7, latLng string ("9.0°, 77.0°"), point string, geo: URIs
 * @param {Object} obj The object to search (e.g., location, segment, candidate)
 * @param {Array<string>} excludeKeys Keys to skip to avoid infinite loops or irrelevance
 * @returns {{lat: number, lng: number} | null}
 */
function extractBestCoordinates(obj, excludeKeys = []) {
    if (!obj || typeof obj !== 'object') return null;

    // 1. Direct Integer E7
    if (obj.latitudeE7 && obj.longitudeE7) {
        return { lat: obj.latitudeE7 / 1e7, lng: obj.longitudeE7 / 1e7 };
    }
    if (obj.latE7 && obj.lngE7) {
        return { lat: obj.latE7 / 1e7, lng: obj.lngE7 / 1e7 };
    }

    // 2. String Formats (latLng: "9.6°, 77.1°" or point: "...")
    const parseStringInfo = (str) => {
        if (!str || typeof str !== 'string') return null;
        // Remove °, spaces
        const clean = str.replace(/°/g, '').trim();
        const parts = clean.split(',');
        if (parts.length === 2) {
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
                return { lat, lng };
            }
        }
        return null;
    };

    if (obj.latLng) {
        const res = parseStringInfo(obj.latLng);
        if (res) return res;
    }
    if (obj.point) {
        const res = parseStringInfo(obj.point);
        if (res) return res;
    }

    // 3. Known Nested Objects (1-Level Deep Priority)
    // Check 'placeLocation', 'location', 'parking', 'topCandidate'
    const priorityKeys = ['placeLocation', 'location', 'parking', 'topCandidate', 'start', 'end'];
    for (const key of priorityKeys) {
        if (obj[key] && !excludeKeys.includes(key)) {
            // Recurse strictly into priority children
            const found = extractBestCoordinates(obj[key], excludeKeys); // Pass excludes down? or clear?
            // Actually, for pure structure drilling, passing is fine.
            if (found) return found;
        }
    }

    // 4. Raw 'geo:' URI? (Rare but possible in KML-derived JSONs)
    if (obj.geoUri) {
        // logic if needed
    }

    return null;
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
