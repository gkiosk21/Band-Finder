const axios = require('axios');

/**
 * Calculate straight-line distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const toRad = (deg) => deg * Math.PI / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Sort events by straight-line distance 
 * @param {Object} userLocation - { lat: number, lon: number }
 * @param {Array} events - Array of event objects with event_lat and event_lon
 * @returns {Array} Events sorted by distance (closest first)
 */
function sortEventsByHaversine(userLocation, events) {
    const eventsWithCoords = events.filter(e => e.event_lat && e.event_lon);

    eventsWithCoords.forEach(event => {
        const distance = haversineDistance(
            userLocation.lat, userLocation.lon,
            event.event_lat, event.event_lon
        );
        event.distance_meters = Math.round(distance);
        event.distance_km = (distance / 1000).toFixed(2);
        // Estimate driving time: ~50 km/h average speed
        event.duration_minutes = Math.round((distance / 1000) / 50 * 60);
    });

    eventsWithCoords.sort((a, b) => a.distance_meters - b.distance_meters);

    const eventsWithoutCoords = events.filter(e => !e.event_lat || !e.event_lon);

    return [...eventsWithCoords, ...eventsWithoutCoords];
}

/**
 * Sort events by distance from user location
 * Uses Haversine (straight-line) distance calculation - no API needed
 * @param {Object} userLocation - { lat: number, lon: number }
 * @param {Array} events - Array of event objects with event_lat and event_lon
 * @param {String} apiKey - Not used (kept for compatibility)
 * @returns {Promise<Array>} Events sorted by distance (closest first)
 */
async function sortEventsByDistance(userLocation, events, apiKey) {
    return sortEventsByHaversine(userLocation, events);
}

module.exports = { sortEventsByDistance, sortEventsByHaversine };
