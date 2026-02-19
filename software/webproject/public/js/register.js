"use strict";

const RAPIDAPI_BASE_URL = "https://forward-reverse-geocoding.p.rapidapi.com/v1/search";

// Toggle Password Visibility
function togglePassword(inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    
    if (input.type === "password") {
        input.type = "text";
        icon.textContent = "hide"; 
    } else {
        input.type = "password";
        icon.textContent = "show"; 
    }
}

// Fetch Coordinates
async function fetchCoordinatesInternal(address, city, country) {
    const apiKey = (typeof RAPIDAPI_KEY !== 'undefined') ? RAPIDAPI_KEY : "040c6a3e14msh8ee9f2ebfe36547p1fd4a1jsn8a9103255e3b";
    const apiHost = "forward-reverse-geocoding.p.rapidapi.com";

    const fullAddress = `${address} ${city} ${country}`;
    const encodedAddress = encodeURIComponent(fullAddress);
    const url = `${RAPIDAPI_BASE_URL}?q=${encodedAddress}&accept-language=en&polygon_threshold=0.0`;

    const options = {
        method: 'GET',
        headers: {
            'x-rapidapi-host': apiHost,
            'x-rapidapi-key': apiKey
        }
    };

    try {
        console.log(`Auto-fetching coordinates for: ${fullAddress}`);
        const response = await fetch(url, options);
        if (!response.ok) throw new Error("RapidAPI response not ok");
        const data = await response.json();
        
        if (Array.isArray(data) && data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lon: parseFloat(data[0].lon)
            };
        }
        return null;
    } catch (error) {
        console.error("Geocoding Error:", error);
        return null;
    }
}

// AVAILABILITY CHECK
async function checkAvailability(type, value, elementId) {
    if (!value || value.trim() === '') return;

    const messageElement = document.getElementById(elementId + '-msg');
    const inputElement = document.getElementById(elementId);

    try {
        const endpoint = type === 'username' 
            ? `/api/check-username?username=${encodeURIComponent(value)}`
            : `/api/check-email?email=${encodeURIComponent(value)}`;

        const response = await fetch(endpoint);
        const data = await response.json();

        if (response.status === 200) {
            if (inputElement) {
                inputElement.style.borderColor = "green";
                inputElement.style.backgroundColor = "#e8f0fe";
            }
            if (messageElement) {
                messageElement.textContent = "Διαθέσιμο";
                messageElement.style.color = "green";
            }
        } else {
            if (inputElement) {
                inputElement.style.borderColor = "red";
                inputElement.style.backgroundColor = "#ffe6e6";
            }
            if (messageElement) {
                messageElement.textContent = (data.message || "Μη διαθέσιμο");
                messageElement.style.color = "red";
            }
        }
    } catch (error) {
        console.error('Availability check error:', error);
    }
}

// REGISTER USER
async function registerUser(event) {
    event.preventDefault(); 
    const form = document.getElementById('user-register-form');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    const originalText = submitBtn ? submitBtn.innerHTML : "Εγγραφή";

    const password = document.getElementById('user-password').value;
    const confirmPass = document.getElementById('user-password-conf').value;
    if (password !== confirmPass) {
        alert("Οι κωδικοί δεν ταιριάζουν!");
        return;
    }

    // Location Data
    const countrySelect = document.getElementById('user-country');
    const country = countrySelect.options[countrySelect.selectedIndex] ? countrySelect.options[countrySelect.selectedIndex].text : "Greece";
    const city = document.getElementById('user-city').value;
    const address = document.getElementById('user-address').value;

    let lat, lon;

    if (typeof verifiedLocation !== 'undefined' && verifiedLocation !== null) {
        lat = verifiedLocation.lat;
        lon = verifiedLocation.lon;
    } else {
        if (submitBtn) {
            submitBtn.innerHTML = "Εύρεση τοποθεσίας...";
            submitBtn.disabled = true;
        }
        const coords = await fetchCoordinatesInternal(address, city, country);
        if (coords) {
            lat = coords.lat;
            lon = coords.lon;
        } else {
            const proceed = confirm("Η διεύθυνση δεν βρέθηκε αυτόματα. Συνέχεια με προεπιλογή (Ηράκλειο);");
            if (!proceed) {
                if (submitBtn) {
                    submitBtn.innerHTML = originalText;
                    submitBtn.disabled = false;
                }
                return;
            }
            lat = 35.3387;
            lon = 25.1442;
        }
    }

    const formData = {
        username: document.getElementById('user-username').value,
        email: document.getElementById('user-email').value,
        password: password,
        firstname: document.getElementById('user-firstname').value,
        lastname: document.getElementById('user-lastname').value,
        birthdate: document.getElementById('user-birthdate').value,
        gender: document.getElementById('user-gender').value,
        country: country,
        city: city,
        address: address,
        telephone: document.getElementById('user-telephone').value,
        lat: lat, 
        lon: lon
    };

    if (submitBtn) submitBtn.innerHTML = "Εγγραφή...";

    try {
        const response = await fetch('/api/register/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (response.status === 201) {
            alert("Επιτυχία: " + result.message);
            // Redirect to band-finder dashboard (user is now logged in)
            window.location.href = "/band-finder.html";
        } else {
            alert("Σφάλμα: " + (result.error || "Κάτι πήγε στραβά"));
        }
    } catch (error) {
        console.error('Error:', error);
        alert("Σφάλμα σύνδεσης με τον server.");
    } finally {
        if (submitBtn) {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }
}

// REGISTER BAND
async function registerBand(event) {
    event.preventDefault();
    const form = document.getElementById('band-register-form');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    const originalText = submitBtn ? submitBtn.innerHTML : "Εγγραφή";

    const password = document.getElementById('band-password').value;
    const confirmPass = document.getElementById('band-password-conf').value;
    if (password !== confirmPass) {
        alert("Οι κωδικοί δεν ταιριάζουν!");
        return;
    }

    // Location Data
    const countrySelect = document.getElementById('country');
    const country = countrySelect.options[countrySelect.selectedIndex].text;
    const city = document.getElementById('band-city').value;
    const address = document.getElementById('band-address').value;

    let lat, lon;

    if (typeof verifiedLocation !== 'undefined' && verifiedLocation !== null) {
        lat = verifiedLocation.lat;
        lon = verifiedLocation.lon;
    } else {
        if (submitBtn) {
            submitBtn.innerHTML = "Εύρεση τοποθεσίας...";
            submitBtn.disabled = true;
        }
        const coords = await fetchCoordinatesInternal(address, city, country);
        if (coords) {
            lat = coords.lat;
            lon = coords.lon;
        } else {
            lat = 35.3387; 
            lon = 25.1442;
        }
    }

    const formData = {
        username: document.getElementById('band-username').value,
        email: document.getElementById('band-email').value,
        password: password,
        band_name: document.getElementById('band-name').value,
        music_genres: document.getElementById('band-genres').value,
        band_description: document.getElementById('band-desc').value,
        members_number: document.getElementById('band-members').value,
        foundedYear: document.getElementById('band-year').value,
        band_city: city,
        telephone: document.getElementById('band-phone').value,
        photo: document.getElementById('band-photo').value,
        webpage: document.getElementById('band-webpage') ? document.getElementById('band-webpage').value : "",
        lat: lat,
        lon: lon
    };

    try {
        const response = await fetch('/api/register/band', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (response.status === 201) {
            alert("Επιτυχία: " + result.message);
            // Redirect to band-finder dashboard (band is now logged in)
            window.location.href = "/band-finder.html";
        } else {
            alert("Σφάλμα: " + (result.error || "Κάτι πήγε στραβά"));
        }
    } catch (error) {
        alert("Σφάλμα σύνδεσης με τον server.");
    } finally {
        if (submitBtn) {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    }
}