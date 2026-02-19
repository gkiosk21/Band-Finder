"use strict";

// Global variables to store verification data
let verifiedLocation = null;
let currentMap = null;
let markersLayer = null;

const RAPIDAPI_KEY = "040c6a3e14msh8ee9f2ebfe36547p1fd4a1jsn8a9103255e3b";

/**
 * Initialize event listeners when DOM is loaded
 */
document.addEventListener('DOMContentLoaded', function() {
    // Verify Address Button
    const verifyBtn = document.getElementById('verifyAddressBtn');
    if (verifyBtn) {
        verifyBtn.addEventListener('click', verifyAddress);
    }

    // Show Map Button
    const showMapBtn = document.getElementById('showMapBtn');
    if (showMapBtn) {
        showMapBtn.addEventListener('click', displayMap);
    }

    // Address input fields - reset verification when changed
    const addressInputs = ['country', 'band-city', 'band-address'];
    addressInputs.forEach(function(inputId) {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', resetAddressVerification);
        }
    });
});

/**
 * Verify address using RapidAPI Geocoding Service
 */
function verifyAddress() {
    // Get form values
    const country = document.getElementById('country').value.trim();
    const city = document.getElementById('band-city').value.trim();
    const street = document.getElementById('band-address').value.trim();

    // Validate inputs
    if (!country || !city || !street) {
        displayMessage('error', 'Παρακαλώ συμπληρώστε όλα τα πεδία διεύθυνσης (Χώρα, Πόλη, Διεύθυνση).');
        return;
    }

    // Check if service is available only for Greece
    if (country.toLowerCase() !== 'greece' && country.toLowerCase() !== 'ελλάδα') {
        displayMessage('warning', 'Η υπηρεσία επαλήθευσης διεύθυνσης είναι διαθέσιμη μόνο για την Ελλάδα αυτή τη στιγμή.');
        verifiedLocation = null;
        hideMapButton();
        return;
    }

    // Construct full address for geocoding
    const fullAddress = street + " " + city + " " + country;
    
    // Display loading message
    displayMessage('info', 'Επαλήθευση διεύθυνσης σε εξέλιξη...');
    
    // Disable verify button during request
    const verifyBtn = document.getElementById('verifyAddressBtn');
    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Επαλήθευση σε εξέλιξη...';

    // Make AJAX request to RapidAPI
    makeGeocodeRequest(fullAddress);
}

/**
 * Make AJAX request to RapidAPI Geocoding Service
 */
function makeGeocodeRequest(address) {
    const xhr = new XMLHttpRequest();
    // Note: withCredentials should NOT be true for RapidAPI
    
    xhr.addEventListener("readystatechange", function () {
        if (this.readyState === this.DONE) {
            handleGeocodeResponse(this);
        }
    });

    // Open GET request
    const encodedAddress = encodeURIComponent(address);
    const url = "https://forward-reverse-geocoding.p.rapidapi.com/v1/search?q=" + 
                encodedAddress + "&accept-language=en&polygon_threshold=0.0";
    
    xhr.open("GET", url);
    
    // Set headers
    xhr.setRequestHeader("x-rapidapi-host", "forward-reverse-geocoding.p.rapidapi.com");
    xhr.setRequestHeader("x-rapidapi-key", RAPIDAPI_KEY);

    // Send request
    xhr.send();
}

/**
 * Handle response from Geocoding API
 */
function handleGeocodeResponse(xhr) {
    // Re-enable verify button
    const verifyBtn = document.getElementById('verifyAddressBtn');
    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Επαλήθευση Διεύθυνσης';

    try {
        // Check for HTTP errors
        if (xhr.status !== 200) {
            displayMessage('error', 'Σφάλμα επικοινωνίας με την υπηρεσία γεωκωδικοποίησης. Κωδικός: ' + xhr.status);
            verifiedLocation = null;
            hideMapButton();
            return;
        }

        // Parse JSON response
        const response = JSON.parse(xhr.responseText);
        
        // Check if response is empty (location not found)
        if (!response || response.length === 0) {
            displayMessage('error', 'Η διεύθυνση δεν βρέθηκε. Παρακαλώ ελέγξτε τα στοιχεία και δοκιμάστε ξανά.');
            verifiedLocation = null;
            hideMapButton();
            return;
        }

        // Take the first (most relevant) result
        const location = response[0];
        
        // Extract latitude and longitude
        const lat = parseFloat(location.lat);
        const lon = parseFloat(location.lon);
        
        // Validate coordinates
        if (isNaN(lat) || isNaN(lon)) {
            displayMessage('error', 'Μη έγκυρες συντεταγμένες στην απάντηση.');
            verifiedLocation = null;
            hideMapButton();
            return;
        }

        // Store verified location data
        verifiedLocation = {
            lat: lat,
            lon: lon,
            display_name: location.display_name || 'Άγνωστη τοποθεσία',
            address: location
        };

        // Display success message
        displayMessage('success', 
            'Η διεύθυνση επαληθεύτηκε επιτυχώς!<br>' +
            '<strong>Τοποθεσία:</strong> ' + verifiedLocation.display_name + '<br>' +
            '<strong>Συντεταγμένες:</strong> Lat: ' + lat.toFixed(6) + ', Lon: ' + lon.toFixed(6)
        );

        // Show the map button
        showMapButton();

        // Log to console for debugging
        console.log('Verified Location:', verifiedLocation);

    } catch (error) {
        displayMessage('error', 'Σφάλμα κατά την επεξεργασία της απάντησης: ' + error.message);
        verifiedLocation = null;
        hideMapButton();
        console.error('Geocoding Error:', error);
    }
}

/**
 * Display map with marker
 */
function displayMap() {
    if (!verifiedLocation) {
        displayMessage('error', 'Παρακαλώ επαληθεύστε πρώτα τη διεύθυνση.');
        return;
    }

    // Show map container
    const mapContainer = document.getElementById('mapContainer');
    mapContainer.style.display = 'block';

    // Clear existing map if any
    if (currentMap) {
        currentMap.destroy();
        currentMap = null;
    }

    // Clear the map div
    const mapDiv = document.getElementById('Map');
    mapDiv.innerHTML = '';

    // Create new map
    currentMap = new OpenLayers.Map("Map");
    
    // Add OpenStreetMap layer
    const mapnik = new OpenLayers.Layer.OSM();
    currentMap.addLayer(mapnik);

    // Transform coordinates from WGS84 (EPSG:4326) to Spherical Mercator (EPSG:900913)
    const position = setPosition(verifiedLocation.lat, verifiedLocation.lon);

    // Create markers layer
    markersLayer = new OpenLayers.Layer.Markers("Markers");
    currentMap.addLayer(markersLayer);

    // Create marker
    const marker = new OpenLayers.Marker(position);
    markersLayer.addMarker(marker);

    // Add click event to marker to show popup
    marker.events.register('mousedown', marker, function(evt) { 
        handleMarkerClick(position, verifiedLocation.display_name);
    });

    // Set zoom level and center the map
    const zoom = 15; // Zoom level for city/street view
    currentMap.setCenter(position, zoom);

    // Update message
    displayMessage('success', 'Ο χάρτης εμφανίστηκε επιτυχώς! Κάντε κλικ στον δείκτη για περισσότερες πληροφορίες.');

    // Scroll to map
    mapContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
}


function setPosition(lat, lon) {
    const fromProjection = new OpenLayers.Projection("EPSG:4326");
    const toProjection = new OpenLayers.Projection("EPSG:900913");   // Spherical Mercator Projection
    const position = new OpenLayers.LonLat(lon, lat).transform(fromProjection, toProjection);
    return position;
}

/**
 * Handle marker click event - show popup
 */
function handleMarkerClick(position, message) {
    // Create and display popup
    const popup = new OpenLayers.Popup.FramedCloud(
        "Popup", 
        position, 
        null,
        "<strong>Τοποθεσία Μπάντας:</strong><br>" + message, 
        null,
        true // Show close (X) button
    );
    currentMap.addPopup(popup);
}

/**
 * Reset address verification when address fields change
 */
function resetAddressVerification() {
    // Clear verified location
    verifiedLocation = null;
    
    // Hide map button and map
    hideMapButton();
    hideMap();
    
    // Clear message
    const messageDiv = document.getElementById('addressMessage');
    if (messageDiv) {
        messageDiv.innerHTML = '';
        messageDiv.className = 'address-message';
    }
}

/**
 * Display message to user
 */
function displayMessage(type, message) {
    const messageDiv = document.getElementById('addressMessage');
    if (!messageDiv) return;

    // Clear previous classes
    messageDiv.className = 'address-message';
    
    // Add appropriate class based on message type
    switch(type) {
        case 'success':
            messageDiv.className += ' alert alert-success';
            break;
        case 'error':
            messageDiv.className += ' alert alert-danger';
            break;
        case 'warning':
            messageDiv.className += ' alert alert-warning';
            break;
        case 'info':
            messageDiv.className += ' alert alert-info';
            break;
        default:
            messageDiv.className += ' alert alert-secondary';
    }

    // Set message content
    messageDiv.innerHTML = message;
    messageDiv.style.display = 'block';
}

/**
 * Show the "Show Map" button
 */
function showMapButton() {
    const container = document.getElementById('showMapContainer');
    if (container) {
        container.style.display = 'block';
    }
}

/**
 * Hide the "Show Map" button
 */
function hideMapButton() {
    const container = document.getElementById('showMapContainer');
    if (container) {
        container.style.display = 'none';
    }
}

/**
 * Hide the map
 */
function hideMap() {
    const mapContainer = document.getElementById('mapContainer');
    if (mapContainer) {
        mapContainer.style.display = 'none';
    }
    
    // Destroy map instance
    if (currentMap) {
        currentMap.destroy();
        currentMap = null;
    }
}
