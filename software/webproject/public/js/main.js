"use strict";

let currentUser = null;
let currentView = 'visitor';
let allPublicEvents = []; // Store all events for filtering
let allPublicBands = []; // Store all bands for filtering

async function apiRequest(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(endpoint, options);
    const data = await response.json();

    if (!response.ok) {
        // Include more details in the error
        const errorMsg = data.error || 'Request failed';
        const errorDetails = data.details ? ` (${data.details})` : '';
        throw new Error(errorMsg + errorDetails);
    }

    return data;
}

function showView(viewName) {
    document.getElementById('visitor-view').style.display = 'none';
    document.getElementById('user-view').style.display = 'none';
    document.getElementById('band-view').style.display = 'none';

    document.getElementById(`${viewName}-view`).style.display = 'block';
    currentView = viewName;
}

function showSection(sectionId) {
    const view = currentView === 'user' ? 'user-view' : 'band-view';
    const sections = document.querySelectorAll(`#${view} .content-section`);
    sections.forEach(s => s.style.display = 'none');

    document.getElementById(sectionId).style.display = 'block';

    const navBtns = document.querySelectorAll(`#${view} .nav-btn`);
    navBtns.forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`[data-section="${sectionId}"]`);
    if (activeBtn) activeBtn.classList.add('active');
}

document.getElementById('show-login').addEventListener('click', () => {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-options').style.display = 'none';
});

document.getElementById('show-register').addEventListener('click', () => {
    document.getElementById('register-options').style.display = 'block';
    document.getElementById('login-form').style.display = 'none';
});

document.getElementById('cancel-login').addEventListener('click', () => {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('login-form').reset();
    document.getElementById('login-error').textContent = '';
});

document.getElementById('cancel-register').addEventListener('click', () => {
    document.getElementById('register-options').style.display = 'none';
});

document.getElementById('register-user-btn').addEventListener('click', () => {
    window.location.href = 'index_user_exercise2.html';
});

document.getElementById('register-band-btn').addEventListener('click', () => {
    window.location.href = 'index_band_exercise2.html';
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const data = await apiRequest('/api/login', 'POST', { username, password });
        currentUser = data.user;

        // Check if admin login
        if (currentUser.isAdmin) {
            // Redirect to admin dashboard
            window.location.href = 'admin.html';
            return;
        }

        if (currentUser.band_name) {
            document.getElementById('band-name').textContent = currentUser.band_name;
            showView('band');
            loadBandRequests();
        } else {
            document.getElementById('user-name').textContent = currentUser.firstname;
            showView('user');
            loadUserEvents();
        }

        document.getElementById('login-error').textContent = '';
        document.getElementById('login-form').reset();

    } catch (error) {
        document.getElementById('login-error').textContent = error.message;
    }
});

document.getElementById('user-logout').addEventListener('click', logout);
document.getElementById('band-logout').addEventListener('click', logout);

async function logout() {
    try {
        await apiRequest('/api/logout', 'POST');
        currentUser = null;
        showView('visitor');
        loadPublicEvents();
        loadPublicBands();
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        showSection(section);

        if (section === 'user-events') loadUserEvents();
        else if (section === 'user-bookings') loadUserBookings();
        else if (section === 'user-bands') loadBandsForUser();
        else if (section === 'user-profile') loadUserProfile();
        else if (section === 'band-requests') loadBandRequests();
        else if (section === 'band-events') loadBandEvents();
        else if (section === 'band-reviews') loadBandReviews();
        else if (section === 'band-profile') loadBandProfile();
    });
});

async function loadPublicEvents() {
    try {
        const events = await apiRequest('/api/events/nearby?lat=35.3332&lon=25.1162');
        allPublicEvents = events; // Store for filtering

        populateEventFilters(events);
        renderPublicEvents(events);
    } catch (error) {
        console.error('Load events failed:', error);
    }
}

function populateEventFilters(events) {
    // Get unique cities
    const cities = [...new Set(events.map(e => e.event_city).filter(Boolean))].sort();
    const citySelect = document.getElementById('filter-city');
    if (citySelect) {
        citySelect.innerHTML = '<option value="">All Cities</option>' +
            cities.map(city => `<option value="${city}">${city}</option>`).join('');
    }

    // Get unique music genres
    const allGenres = events.flatMap(e => (e.music_genres || '').split(',').map(g => g.trim())).filter(Boolean);
    const genres = [...new Set(allGenres)].sort();
    const genreSelect = document.getElementById('filter-genre');
    if (genreSelect) {
        genreSelect.innerHTML = '<option value="">All Genres</option>' +
            genres.map(genre => `<option value="${genre}">${genre}</option>`).join('');
    }

    // Get unique founding years
    const years = [...new Set(events.map(e => e.foundedYear).filter(Boolean))].sort((a, b) => b - a);
    const yearSelect = document.getElementById('filter-year');
    if (yearSelect) {
        yearSelect.innerHTML = '<option value="">Any Year</option>' +
            years.map(year => `<option value="${year}">${year}</option>`).join('');
    }
}

function renderPublicEvents(events) {
    const container = document.getElementById('public-events-list');

    if (events.length === 0) {
        container.innerHTML = '<p class="no-data">No events match your filters</p>';
        return;
    }

    container.innerHTML = events.map(event => `
        <div class="event-card">
            <h3>${event.band_name}</h3>
            <p class="event-type">${event.event_type}</p>
            <p class="event-location">${event.event_city}</p>
            <p class="event-date">${new Date(event.event_datetime).toLocaleDateString()}</p>
            <p class="event-price">€${event.participants_price}</p>
            <p class="event-genre" style="color: #666; font-size: 0.9em;">${event.music_genres || 'Various'}</p>
        </div>
    `).join('');
}

function applyEventFilters() {
    const cityFilter = document.getElementById('filter-city')?.value || '';
    const genreFilter = document.getElementById('filter-genre')?.value || '';
    const yearFilter = document.getElementById('filter-year')?.value || '';

    let filtered = allPublicEvents;

    if (cityFilter) {
        filtered = filtered.filter(e => e.event_city === cityFilter);
    }

    if (genreFilter) {
        filtered = filtered.filter(e => (e.music_genres || '').toLowerCase().includes(genreFilter.toLowerCase()));
    }

    if (yearFilter) {
        filtered = filtered.filter(e => e.foundedYear == yearFilter);
    }

    renderPublicEvents(filtered);
}

function clearEventFilters() {
    const citySelect = document.getElementById('filter-city');
    const genreSelect = document.getElementById('filter-genre');
    const yearSelect = document.getElementById('filter-year');

    if (citySelect) citySelect.value = '';
    if (genreSelect) genreSelect.value = '';
    if (yearSelect) yearSelect.value = '';

    renderPublicEvents(allPublicEvents);
}

// Band browsing functions for visitor view
async function loadPublicBands() {
    try {
        const bands = await apiRequest('/bands');
        allPublicBands = bands;

        populateBandFilters(bands);
        renderPublicBands(bands);
    } catch (error) {
        console.error('Load bands failed:', error);
    }
}

function populateBandFilters(bands) {
    // Get unique cities
    const cities = [...new Set(bands.map(b => b.band_city).filter(Boolean))].sort();
    const citySelect = document.getElementById('band-filter-city');
    if (citySelect) {
        citySelect.innerHTML = '<option value="">All Cities</option>' +
            cities.map(city => `<option value="${city}">${city}</option>`).join('');
    }

    // Get unique music genres
    const allGenres = bands.flatMap(b => (b.music_genres || '').split(',').map(g => g.trim())).filter(Boolean);
    const genres = [...new Set(allGenres)].sort();
    const genreSelect = document.getElementById('band-filter-genre');
    if (genreSelect) {
        genreSelect.innerHTML = '<option value="">All Genres</option>' +
            genres.map(genre => `<option value="${genre}">${genre}</option>`).join('');
    }

    // Get unique founding years
    const years = [...new Set(bands.map(b => b.foundedYear).filter(Boolean))].sort((a, b) => b - a);
    const yearSelect = document.getElementById('band-filter-year');
    if (yearSelect) {
        yearSelect.innerHTML = '<option value="">Any Year</option>' +
            years.map(year => `<option value="${year}">${year}</option>`).join('');
    }
}

function renderPublicBands(bands) {
    const container = document.getElementById('public-bands-list');
    if (!container) return;

    if (bands.length === 0) {
        container.innerHTML = '<p class="no-data">No bands match your filters</p>';
        return;
    }

    container.innerHTML = bands.map(band => `
        <div class="event-card">
            <h3>${band.band_name}</h3>
            <p class="event-type">${band.music_genres || 'Various'}</p>
            <p class="event-description">${band.band_description || ''}</p>
            <p><strong>Members:</strong> ${band.members_number || 'N/A'}</p>
            <p><strong>Founded:</strong> ${band.foundedYear || 'N/A'}</p>
            <p><strong>City:</strong> ${band.band_city || 'N/A'}</p>
            ${band.webpage ? `<p><a href="${band.webpage}" target="_blank">Visit Website</a></p>` : ''}
        </div>
    `).join('');
}

function applyBandFilters() {
    const cityFilter = document.getElementById('band-filter-city')?.value || '';
    const genreFilter = document.getElementById('band-filter-genre')?.value || '';
    const yearFilter = document.getElementById('band-filter-year')?.value || '';

    let filtered = allPublicBands;

    if (cityFilter) {
        filtered = filtered.filter(b => b.band_city === cityFilter);
    }

    if (genreFilter) {
        filtered = filtered.filter(b => (b.music_genres || '').toLowerCase().includes(genreFilter.toLowerCase()));
    }

    if (yearFilter) {
        filtered = filtered.filter(b => b.foundedYear == yearFilter);
    }

    renderPublicBands(filtered);
}

function clearBandFilters() {
    const citySelect = document.getElementById('band-filter-city');
    const genreSelect = document.getElementById('band-filter-genre');
    const yearSelect = document.getElementById('band-filter-year');

    if (citySelect) citySelect.value = '';
    if (genreSelect) genreSelect.value = '';
    if (yearSelect) yearSelect.value = '';

    renderPublicBands(allPublicBands);
}

async function loadUserEvents() {
    try {
        const profile = await apiRequest('/api/profile');
        const lat = profile.lat || 35.3332;
        const lon = profile.lon || 25.1162;

        const events = await apiRequest(`/api/events/nearby?lat=${lat}&lon=${lon}`);
        const container = document.getElementById('user-events-list');

        if (events.length === 0) {
            container.innerHTML = '<p class="no-data">No upcoming events found</p>';
            return;
        }

        container.innerHTML = events.map(event => `
            <div class="event-card">
                <h3>${event.band_name}</h3>
                <p class="event-type">${event.event_type}</p>
                <p class="event-location">${event.event_city}, ${event.event_address}</p>
                <p class="event-date">${new Date(event.event_datetime).toLocaleString()}</p>
                <p class="event-price">€${event.participants_price}</p>
                ${event.distance_km ? `<p class="event-distance">${event.distance_km} km (${event.duration_minutes} min)</p>` : ''}
                <button class="btn btn-primary" onclick="bookEvent(${event.band_id}, '${event.band_name}')">Request Private Event</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load user events failed:', error);
    }
}

function bookEvent(bandId, bandName) {
    const eventType = prompt(`Request a private event with ${bandName}\n\nEvent type (e.g., Wedding, Birthday, Party):`);
    if (!eventType) return;

    const datetime = prompt('Event date and time (YYYY-MM-DD HH:MM):');
    if (!datetime) return;

    const price = prompt('Your budget (€):');
    if (!price) return;

    const city = prompt('Event city:');
    if (!city) return;

    const address = prompt('Event address:');
    if (!address) return;

    const description = prompt('Event description:');
    if (!description) return;

    apiRequest('/api/request-event', 'POST', {
        band_id: bandId,
        event_type: eventType,
        event_datetime: datetime,
        price: parseFloat(price),
        event_city: city,
        event_address: address,
        event_description: description
    }).then(() => {
        alert('Event request submitted successfully!');
        showSection('user-bookings');
        loadUserBookings();
    }).catch(error => {
        alert('Failed to submit request: ' + error.message);
    });
}

async function loadUserBookings() {
    try {
        const bookings = await apiRequest('/api/my-bookings');
        const container = document.getElementById('user-bookings-list');

        if (bookings.length === 0) {
            container.innerHTML = '<p class="no-data">No bookings yet</p>';
            return;
        }

        container.innerHTML = bookings.map(booking => `
            <div class="booking-card">
                <h3>${booking.event_type} with ${booking.band_name}</h3>
                <p class="booking-date">Date: ${new Date(booking.event_datetime).toLocaleString()}</p>
                <p class="booking-location">${booking.event_city}, ${booking.event_address}</p>
                <p class="booking-status status-${booking.status}">Status: ${booking.status}</p>
                <p class="booking-price">Price: €${booking.price}</p>
                ${booking.band_decision ? `<p class="band-decision"><strong>Band:</strong> ${booking.band_decision}</p>` : ''}
                ${booking.status === 'to_be_done' ? `
                    <div class="messaging-section">
                        <h4>Messages</h4>
                        <div id="messages-${booking.private_event_id}"></div>
                        <button class="btn btn-secondary" onclick="sendMessage(${booking.private_event_id})">Send Message</button>
                    </div>
                ` : ''}
                ${booking.status === 'to_be_done' && new Date(booking.event_datetime) < new Date() ?
                    `<button class="btn btn-primary" onclick="markAsDone(${booking.private_event_id})">Mark as Done</button>` : ''}
            </div>
        `).join('');

        // Load messages for to_be_done events
        bookings.forEach(booking => {
            if (booking.status === 'to_be_done') {
                loadMessages(booking.private_event_id);
            }
        });
    } catch (error) {
        console.error('Load bookings failed:', error);
    }
}

async function markAsDone(eventId) {
    try {
        await apiRequest(`/api/update-event-status/${eventId}`, 'PUT', { status: 'done' });
        alert('Event marked as done!');
        loadUserBookings();
    } catch (error) {
        alert('Failed to mark as done: ' + error.message);
    }
}

async function loadBandsForUser() {
    try {
        const bands = await apiRequest('/bands');
        const container = document.getElementById('user-bands-list');

        if (bands.length === 0) {
            container.innerHTML = '<p class="no-data">No bands found</p>';
            return;
        }

        container.innerHTML = bands.map(band => `
            <div class="event-card" id="band-card-${band.band_id}">
                <h3>${band.band_name}</h3>
                <p class="event-type">${band.music_genres}</p>
                <p class="event-description">${band.band_description}</p>
                <p><strong>Members:</strong> ${band.members_number}</p>
                <p><strong>Founded:</strong> ${band.foundedYear}</p>
                <p><strong>Location:</strong> ${band.band_city}</p>
                <p><strong>Contact:</strong> ${band.telephone}</p>
                ${band.webpage ? `<p><a href="${band.webpage}" target="_blank">Visit Website</a></p>` : ''}
                <div id="availability-${band.band_id}" class="band-availability" style="margin: 15px 0; padding: 10px; background: #f8f9fa; border-radius: 5px; display: none;"></div>
                <div class="band-actions" style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                    <button class="btn btn-secondary" onclick="toggleBandAvailability(${band.band_id}, '${band.band_name}')">View Availability</button>
                    <button class="btn btn-primary" onclick="requestPrivateEvent(${band.band_id}, '${band.band_name}')">Request Private Event</button>
                    <button class="btn btn-success" onclick="openReviewForm(${band.band_id}, '${band.band_name}')">Leave Review</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load bands failed:', error);
    }
}

async function toggleBandAvailability(bandId, bandName) {
    const container = document.getElementById(`availability-${bandId}`);

    // Toggle visibility
    if (container.style.display === 'block') {
        container.style.display = 'none';
        return;
    }

    // Show loading
    container.style.display = 'block';
    container.innerHTML = '<p>Loading availability...</p>';

    try {
        const data = await apiRequest(`/api/band-availability/${bandId}`);

        if (data.scheduled_events.length === 0) {
            container.innerHTML = `
                <p style="color: green; font-weight: bold;">✓ ${bandName} has no scheduled events - fully available!</p>
            `;
        } else {
            container.innerHTML = `
                <p><strong>Scheduled Events (${data.total_scheduled}):</strong></p>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    ${data.scheduled_events.map(event => `
                        <li style="margin: 5px 0;">
                            <strong>${new Date(event.event_datetime).toLocaleDateString()}</strong> -
                            ${event.event_type} (${event.event_category}) in ${event.event_city}
                        </li>
                    `).join('')}
                </ul>
                <p style="color: #666; font-size: 0.9em;">Avoid booking on these dates.</p>
            `;
        }
    } catch (error) {
        console.error('Failed to load availability:', error);
        container.innerHTML = '<p style="color: red;">Failed to load availability</p>';
    }
}

function requestPrivateEvent(bandId, bandName) {
    const eventType = prompt(`Request a private event with ${bandName}\n\nEvent type (Wedding, Baptism, Party):`);
    if (!eventType) return;

    const datetime = prompt('Event date and time (YYYY-MM-DD HH:MM):');
    if (!datetime) return;

    // Convert to MySQL datetime format (add seconds if not provided)
    let formattedDatetime = datetime.trim();
    if (formattedDatetime.length === 16) {
        // Format is YYYY-MM-DD HH:MM, add :00 for seconds
        formattedDatetime += ':00';
    }

    const city = prompt('Event city:');
    if (!city || city.trim() === '') return;

    const address = prompt('Event address:');
    if (!address || address.trim() === '') return;

    const description = prompt('Event description:');
    if (!description || description.trim() === '') return;

    apiRequest('/api/request-event', 'POST', {
        band_id: parseInt(bandId),
        event_type: eventType.trim(),
        event_datetime: formattedDatetime,
        event_description: description.trim(),
        event_city: city.trim(),
        event_address: address.trim()
    }).then(() => {
        alert('Private event request sent successfully!');
        // Reload bookings to show the new request
        loadUserBookings();
    }).catch(error => {
        console.error('Request event error:', error);
        console.error('Request data was:', {
            band_id: parseInt(bandId),
            event_type: eventType.trim(),
            event_datetime: formattedDatetime,
            event_description: description.trim(),
            event_city: city.trim(),
            event_address: address.trim()
        });
        // Avoid duplicating error messages
        const errorMsg = error.message || 'Unknown error occurred';
        if (errorMsg.toLowerCase().includes('failed to')) {
            alert(errorMsg);
        } else {
            alert('Failed to send request: ' + errorMsg);
        }
    });
}

function openReviewForm(bandId, bandName) {
    const sender = prompt(`Leave a review for ${bandName}\n\nYour name:`);
    if (!sender) return;

    const rating = prompt('Rating (1-5 stars):');
    if (!rating || rating < 1 || rating > 5) {
        alert('Rating must be between 1 and 5');
        return;
    }

    const review = prompt('Your review:');
    if (!review) return;

    apiRequest('/review/', 'POST', {
        band_name: bandName,
        sender: sender,
        review: review,
        rating: parseInt(rating)
    }).then(() => {
        alert('Review submitted successfully! It will be published after admin approval.');
    }).catch(error => {
        alert('Failed to submit review: ' + error.message);
    });
}

let isEditingProfile = false;
let userProfileData = null;

async function loadUserProfile() {
    try {
        const profile = await apiRequest('/api/profile');
        userProfileData = profile;
        renderUserProfile(false);
    } catch (error) {
        console.error('Load profile failed:', error);
    }
}

function renderUserProfile(editMode) {
    const container = document.getElementById('profile-data');
    const profile = userProfileData;

    if (!profile) return;

    if (!editMode) {
        // View mode - display profile info
        container.innerHTML = `
            <div class="profile-info">
                <div class="profile-actions" style="margin-bottom: 20px;">
                    <button class="btn btn-primary" onclick="toggleEditProfile()">Edit Profile</button>
                </div>
                <p><strong>First Name:</strong> ${profile.firstname}</p>
                <p><strong>Last Name:</strong> ${profile.lastname}</p>
                <p><strong>Username:</strong> ${profile.username} <span style="color: #666; font-size: 0.9em;">(cannot be changed)</span></p>
                <p><strong>Email:</strong> ${profile.email} <span style="color: #666; font-size: 0.9em;">(cannot be changed)</span></p>
                <p><strong>Birthdate:</strong> ${profile.birthdate}</p>
                <p><strong>Gender:</strong> ${profile.gender}</p>
                <p><strong>Country:</strong> ${profile.country}</p>
                <p><strong>City:</strong> ${profile.city || 'Not set'}</p>
                <p><strong>Address:</strong> ${profile.address}</p>
                <p><strong>Telephone:</strong> ${profile.telephone}</p>
            </div>
        `;
    } else {
        // Edit mode - display editable form
        container.innerHTML = `
            <div class="profile-edit-form">
                <div class="profile-actions" style="margin-bottom: 20px;">
                    <button class="btn btn-success" onclick="saveUserProfile()">Save Changes</button>
                    <button class="btn btn-secondary" onclick="cancelEditProfile()" style="margin-left: 10px;">Cancel</button>
                </div>

                <div class="form-group">
                    <label><strong>First Name:</strong></label>
                    <input type="text" id="edit-firstname" value="${profile.firstname}" class="form-input">
                </div>

                <div class="form-group">
                    <label><strong>Last Name:</strong></label>
                    <input type="text" id="edit-lastname" value="${profile.lastname}" class="form-input">
                </div>

                <div class="form-group">
                    <label><strong>Username:</strong></label>
                    <input type="text" value="${profile.username}" class="form-input" disabled style="background-color: #f0f0f0; cursor: not-allowed;">
                    <small style="color: #666;">Username cannot be changed</small>
                </div>

                <div class="form-group">
                    <label><strong>Email:</strong></label>
                    <input type="email" value="${profile.email}" class="form-input" disabled style="background-color: #f0f0f0; cursor: not-allowed;">
                    <small style="color: #666;">Email cannot be changed</small>
                </div>

                <div class="form-group">
                    <label><strong>Birthdate:</strong></label>
                    <input type="date" id="edit-birthdate" value="${profile.birthdate ? profile.birthdate.split('T')[0] : ''}" class="form-input">
                </div>

                <div class="form-group">
                    <label><strong>Gender:</strong></label>
                    <select id="edit-gender" class="form-input">
                        <option value="Male" ${profile.gender === 'Male' ? 'selected' : ''}>Male</option>
                        <option value="Female" ${profile.gender === 'Female' ? 'selected' : ''}>Female</option>
                        <option value="Other" ${profile.gender === 'Other' ? 'selected' : ''}>Other</option>
                    </select>
                </div>

                <div class="form-group">
                    <label><strong>Country:</strong></label>
                    <input type="text" id="edit-country" value="${profile.country}" class="form-input">
                </div>

                <div class="form-group">
                    <label><strong>City:</strong></label>
                    <input type="text" id="edit-city" value="${profile.city || ''}" class="form-input">
                </div>

                <div class="form-group">
                    <label><strong>Address:</strong></label>
                    <input type="text" id="edit-address" value="${profile.address}" class="form-input">
                </div>

                <div class="form-group">
                    <label><strong>Telephone:</strong></label>
                    <input type="tel" id="edit-telephone" value="${profile.telephone}" class="form-input">
                </div>
            </div>
        `;
    }
}

function toggleEditProfile() {
    isEditingProfile = true;
    renderUserProfile(true);
}

function cancelEditProfile() {
    isEditingProfile = false;
    renderUserProfile(false);
}

async function saveUserProfile() {
    try {
        const updatedData = {
            firstname: document.getElementById('edit-firstname').value.trim(),
            lastname: document.getElementById('edit-lastname').value.trim(),
            birthdate: document.getElementById('edit-birthdate').value,
            gender: document.getElementById('edit-gender').value,
            country: document.getElementById('edit-country').value.trim(),
            city: document.getElementById('edit-city').value.trim(),
            address: document.getElementById('edit-address').value.trim(),
            telephone: document.getElementById('edit-telephone').value.trim()
        };

        // Remove empty fields to avoid sending empty strings
        Object.keys(updatedData).forEach(key => {
            if (updatedData[key] === '' || updatedData[key] === null || updatedData[key] === undefined) {
                delete updatedData[key];
            }
        });

        const result = await apiRequest('/api/profile', 'PUT', updatedData);

        alert('Profile updated successfully!');

        // Update local data and switch back to view mode
        userProfileData = result.user;
        isEditingProfile = false;
        renderUserProfile(false);

        // Update the displayed name in header if firstname changed
        if (currentUser.firstname !== result.user.firstname) {
            currentUser.firstname = result.user.firstname;
            document.getElementById('user-name').textContent = currentUser.firstname;
        }

    } catch (error) {
        console.error('Profile update error:', error);
        const errorMsg = error.message || 'Unknown error occurred';
        // Avoid duplicating "Failed to update profile" if it's already in the error message
        if (errorMsg.toLowerCase().includes('failed to update')) {
            alert(errorMsg);
        } else {
            alert('Failed to update profile: ' + errorMsg);
        }
    }
}

async function loadBandRequests() {
    try {
        const requests = await apiRequest('/api/band-requests');
        const container = document.getElementById('band-requests-list');

        if (requests.length === 0) {
            container.innerHTML = '<p class="no-data">No event requests</p>';
            return;
        }

        container.innerHTML = requests.map(req => `
            <div class="request-card">
                <h3>${req.event_type} Request</h3>
                <p><strong>From:</strong> ${req.firstname} ${req.lastname}</p>
                <p><strong>Contact:</strong> ${req.user_email} | ${req.user_telephone}</p>
                <p><strong>Date:</strong> ${new Date(req.event_datetime).toLocaleString()}</p>
                <p><strong>Location:</strong> ${req.event_city}, ${req.event_address}</p>
                <p><strong>Budget:</strong> €${req.price}</p>
                <p><strong>Description:</strong> ${req.event_description}</p>
                <p class="request-status status-${req.status}">Status: ${req.status}</p>
                ${req.status === 'requested' ? `
                    <div class="request-actions">
                        <button class="btn btn-success" onclick="acceptRequest(${req.private_event_id})">Accept</button>
                        <button class="btn btn-danger" onclick="rejectRequest(${req.private_event_id})">Reject</button>
                    </div>
                ` : req.band_decision ? `<p><strong>Your response:</strong> ${req.band_decision}</p>` : ''}
                ${req.status === 'to_be_done' ? `
                    <div class="messaging-section">
                        <h4>Messages</h4>
                        <div id="messages-${req.private_event_id}"></div>
                        <button class="btn btn-secondary" onclick="sendMessage(${req.private_event_id})">Send Message</button>
                    </div>
                ` : ''}
            </div>
        `).join('');

        // Load messages for to_be_done events
        requests.forEach(req => {
            if (req.status === 'to_be_done') {
                loadMessages(req.private_event_id);
            }
        });
    } catch (error) {
        console.error('Load band requests failed:', error);
    }
}

async function acceptRequest(eventId) {
    const decision = prompt('Enter your acceptance message (e.g., "We are happy to perform at your event!"):');
    if (!decision) return;

    try {
        await apiRequest(`/api/update-event-status/${eventId}`, 'PUT', {
            status: 'to_be_done',
            band_decision: decision
        });
        alert('Request accepted!');
        loadBandRequests();
    } catch (error) {
        alert('Failed to accept request: ' + error.message);
    }
}

async function rejectRequest(eventId) {
    const decision = prompt('Enter rejection reason (optional):');

    try {
        await apiRequest(`/api/update-event-status/${eventId}`, 'PUT', {
            status: 'rejected',
            band_decision: decision || 'Request declined'
        });
        alert('Request rejected');
        loadBandRequests();
    } catch (error) {
        alert('Failed to reject request: ' + error.message);
    }
}

async function loadBandEvents() {
    try {
        const events = await apiRequest('/api/band-events');
        const container = document.getElementById('band-events-list');

        if (events.length === 0) {
            container.innerHTML = '<p class="no-data">You have not created any public events yet</p>';
            return;
        }

        container.innerHTML = events.map(event => `
            <div class="event-card" id="event-card-${event.public_event_id}">
                <h3>${event.event_type}</h3>
                <p><strong>Date:</strong> ${new Date(event.event_datetime).toLocaleString()}</p>
                <p><strong>Location:</strong> ${event.event_city}</p>
                <p><strong>Address:</strong> ${event.event_address}</p>
                <p><strong>Price:</strong> €${event.participants_price}</p>
                <p class="event-description">${event.event_description}</p>
                <button class="btn btn-danger" onclick="deletePublicEvent(${event.public_event_id})">Delete Event</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load band events failed:', error);
        document.getElementById('band-events-list').innerHTML =
            '<p class="error">Failed to load events</p>';
    }
}

async function deletePublicEvent(eventId) {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
        return;
    }

    try {
        await apiRequest(`/api/public-event/${eventId}`, 'DELETE');
        alert('Event deleted successfully!');
        // Remove the event card from the page
        const eventCard = document.getElementById(`event-card-${eventId}`);
        if (eventCard) {
            eventCard.remove();
        }
        // Check if there are no more events
        const container = document.getElementById('band-events-list');
        if (container && container.children.length === 0) {
            container.innerHTML = '<p class="no-data">You have not created any public events yet</p>';
        }
    } catch (error) {
        console.error('Delete event failed:', error);
        alert('Failed to delete event: ' + error.message);
    }
}

async function loadBandReviews() {
    try {
        const reviews = await apiRequest(`/reviews/${currentUser.band_name}`);
        const container = document.getElementById('band-reviews-list');

        if (reviews.length === 0) {
            container.innerHTML = '<p class="no-data">No reviews yet</p>';
            return;
        }

        container.innerHTML = reviews.map(review => `
            <div class="review-card">
                <p class="review-rating">${'&#9733;'.repeat(review.rating)}${'&#9734;'.repeat(5 - review.rating)}</p>
                <p class="review-text">${review.review}</p>
                <p class="review-sender">- ${review.sender}</p>
                <p class="review-date">${new Date(review.date_time).toLocaleDateString()}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load reviews failed:', error);
    }
}

let bandProfileData = null;
let bandEditMode = false;
let bandProfileReviews = [];
let bandProfilePublicEvents = [];
let bandProfilePrivateEvents = [];

async function loadBandProfile() {
    try {
        // Fetch profile, reviews, public events, and private events in parallel
        const [profile, reviews, publicEvents, privateEvents] = await Promise.all([
            apiRequest('/api/profile'),
            apiRequest(`/reviews/${currentUser.band_name}`).catch(() => []),
            apiRequest('/api/band-events').catch(() => []),
            apiRequest('/api/band-requests').catch(() => [])
        ]);

        bandProfileData = profile;
        bandProfileReviews = reviews || [];
        bandProfilePublicEvents = publicEvents || [];
        bandProfilePrivateEvents = privateEvents || [];

        renderBandProfile(false);
    } catch (error) {
        console.error('Load band profile failed:', error);
        document.getElementById('band-profile-content').innerHTML =
            '<p class="error">Failed to load profile</p>';
    }
}

function renderBandProfile(editMode) {
    bandEditMode = editMode;
    const container = document.getElementById('band-profile-content');
    const profile = bandProfileData;

    if (!profile) {
        container.innerHTML = '<p class="error">No profile data</p>';
        return;
    }

    if (!editMode) {
        // View mode - display comprehensive profile with all sections
        const reviewsHtml = bandProfileReviews.length > 0
            ? bandProfileReviews.map(review => `
                <div class="review-card" style="margin-bottom: 10px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
                    <p class="review-rating">${'&#9733;'.repeat(review.rating)}${'&#9734;'.repeat(5 - review.rating)}</p>
                    <p class="review-text">${review.review}</p>
                    <p class="review-sender" style="color: #666; font-size: 0.9em;">- ${review.sender}, ${new Date(review.date_time).toLocaleDateString()}</p>
                </div>
            `).join('')
            : '<p class="no-data">No reviews yet</p>';

        const publicEventsHtml = bandProfilePublicEvents.length > 0
            ? bandProfilePublicEvents.map(event => `
                <div class="event-item" style="margin-bottom: 10px; padding: 15px; background: #e8f5e9; border-radius: 8px; border-left: 4px solid #4caf50;">
                    <p><strong>${event.event_type}</strong></p>
                    <p>${new Date(event.event_datetime).toLocaleDateString()} at ${new Date(event.event_datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    <p style="color: #666;">${event.event_city} - ${event.participants_price}</p>
                </div>
            `).join('')
            : '<p class="no-data">No public events</p>';

        const privateEventsHtml = bandProfilePrivateEvents.length > 0
            ? bandProfilePrivateEvents.map(event => `
                <div class="event-item" style="margin-bottom: 10px; padding: 15px; background: #fff3e0; border-radius: 8px; border-left: 4px solid #ff9800;">
                    <p><strong>Private Event</strong></p>
                    <p>${new Date(event.event_datetime).toLocaleDateString()} at ${new Date(event.event_datetime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                    <p style="color: #666;">Status: ${event.status}</p>
                </div>
            `).join('')
            : '<p class="no-data">No private events</p>';

        container.innerHTML = `
            <div class="profile-info">
                <div class="profile-actions" style="margin-bottom: 20px;">
                    <button class="btn btn-primary" onclick="renderBandProfile(true)">Edit Profile</button>
                </div>

                <!-- Band Information Section -->
                <div class="profile-section" style="margin-bottom: 30px;">
                    <h3 style="border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 15px;">Band Information</h3>
                    <p><strong>Band Name:</strong> ${profile.band_name || 'N/A'}</p>
                    <p><strong>Username:</strong> ${profile.username || 'N/A'} <span style="color: #666; font-size: 0.9em;">(cannot be changed)</span></p>
                    <p><strong>Email:</strong> ${profile.email || 'N/A'} <span style="color: #666; font-size: 0.9em;">(cannot be changed)</span></p>
                    <p><strong>Description:</strong> ${profile.band_description || 'N/A'}</p>
                    <p><strong>Music Genres:</strong> ${profile.music_genres || 'N/A'}</p>
                    <p><strong>Members:</strong> ${profile.members_number || 'N/A'}</p>
                    <p><strong>Founded:</strong> ${profile.foundedYear || 'N/A'}</p>
                    <p><strong>City:</strong> ${profile.band_city || 'Not set'}</p>
                    <p><strong>Telephone:</strong> ${profile.telephone || 'N/A'}</p>
                    <p><strong>Website:</strong> ${profile.webpage ? `<a href="${profile.webpage}" target="_blank">${profile.webpage}</a>` : 'N/A'}</p>
                </div>

                <!-- Reviews Section -->
                <div class="profile-section" style="margin-bottom: 30px;">
                    <h3 style="border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 15px;">Reviews (${bandProfileReviews.length})</h3>
                    ${reviewsHtml}
                </div>

                <!-- Public Events Section -->
                <div class="profile-section" style="margin-bottom: 30px;">
                    <h3 style="border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 15px;">Public Events (${bandProfilePublicEvents.length})</h3>
                    ${publicEventsHtml}
                </div>

                <!-- Private Events Section -->
                <div class="profile-section" style="margin-bottom: 30px;">
                    <h3 style="border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 15px;">Private Events (${bandProfilePrivateEvents.length})</h3>
                    ${privateEventsHtml}
                </div>
            </div>
        `;
    } else {
        // Edit mode - display editable form
        container.innerHTML = `
            <div class="profile-edit-form">
                <div class="profile-actions" style="margin-bottom: 20px;">
                    <button class="btn btn-success" onclick="saveBandProfile()">Save Changes</button>
                    <button class="btn btn-secondary" onclick="renderBandProfile(false)" style="margin-left: 10px;">Cancel</button>
                </div>

                <div class="form-group">
                    <label><strong>Band Name:</strong></label>
                    <input type="text" id="edit-band-name" value="${profile.band_name || ''}" class="form-input">
                </div>

                <div class="form-group">
                    <label><strong>Username:</strong></label>
                    <input type="text" value="${profile.username || ''}" class="form-input" disabled style="background-color: #f0f0f0; cursor: not-allowed;">
                    <small style="color: #666;">Username cannot be changed</small>
                </div>

                <div class="form-group">
                    <label><strong>Email:</strong></label>
                    <input type="email" value="${profile.email || ''}" class="form-input" disabled style="background-color: #f0f0f0; cursor: not-allowed;">
                    <small style="color: #666;">Email cannot be changed</small>
                </div>

                <div class="form-group">
                    <label><strong>Description:</strong></label>
                    <textarea id="edit-band-description" rows="4" class="form-input">${profile.band_description || ''}</textarea>
                </div>

                <div class="form-group">
                    <label><strong>Music Genres:</strong></label>
                    <input type="text" id="edit-music-genres" value="${profile.music_genres || ''}" class="form-input" placeholder="e.g., Rock, Jazz, Pop">
                </div>

                <div class="form-group">
                    <label><strong>Number of Members:</strong></label>
                    <input type="number" id="edit-members-number" value="${profile.members_number || ''}" class="form-input">
                </div>

                <div class="form-group">
                    <label><strong>Founded Year:</strong></label>
                    <input type="number" id="edit-founded-year" value="${profile.foundedYear || ''}" class="form-input" placeholder="e.g., 2015">
                </div>

                <div class="form-group">
                    <label><strong>City:</strong></label>
                    <input type="text" id="edit-band-city" value="${profile.band_city || ''}" class="form-input">
                </div>

                <div class="form-group">
                    <label><strong>Telephone:</strong></label>
                    <input type="text" id="edit-telephone" value="${profile.telephone || ''}" class="form-input">
                </div>

                <div class="form-group">
                    <label><strong>Website:</strong></label>
                    <input type="url" id="edit-webpage" value="${profile.webpage || ''}" class="form-input" placeholder="https://...">
                </div>
            </div>
        `;
    }
}

async function saveBandProfile() {
    try {
        const updates = {
            band_name: document.getElementById('edit-band-name').value.trim(),
            band_description: document.getElementById('edit-band-description').value.trim(),
            music_genres: document.getElementById('edit-music-genres').value.trim(),
            members_number: parseInt(document.getElementById('edit-members-number').value) || null,
            foundedYear: parseInt(document.getElementById('edit-founded-year').value) || null,
            band_city: document.getElementById('edit-band-city').value.trim(),
            telephone: document.getElementById('edit-telephone').value.trim(),
            webpage: document.getElementById('edit-webpage').value.trim()
        };

        // Remove empty fields to avoid sending empty strings
        Object.keys(updates).forEach(key => {
            if (updates[key] === '' || updates[key] === null || updates[key] === undefined) {
                delete updates[key];
            }
        });

        const result = await apiRequest('/api/profile', 'PUT', updates);
        bandProfileData = result.band;

        // Update header with new band name
        if (updates.band_name) {
            document.getElementById('band-name').textContent = updates.band_name;
            currentUser.band_name = updates.band_name;
        }

        alert('Profile updated successfully!');
        renderBandProfile(false);
    } catch (error) {
        console.error('Save band profile failed:', error);
        alert('Failed to save profile: ' + error.message);
    }
}

function openCreateEventForm() {
    const eventType = prompt('Event Type (e.g., Concert, Festival, Live Performance):');
    if (!eventType || eventType.trim() === '') return;

    const datetime = prompt('Event date and time (YYYY-MM-DD HH:MM):');
    if (!datetime || datetime.trim() === '') return;

    // Convert to MySQL datetime format (add seconds if not provided)
    let formattedDatetime = datetime.trim();
    if (formattedDatetime.length === 16) {
        formattedDatetime += ':00';
    }

    const city = prompt('Event city:');
    if (!city || city.trim() === '') return;

    const address = prompt('Event address:');
    if (!address || address.trim() === '') return;

    const price = prompt('Ticket price (€):');
    if (!price || price.trim() === '') return;

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
        alert('Price must be a positive number');
        return;
    }

    const description = prompt('Event description:');
    if (!description || description.trim() === '') return;

    apiRequest('/api/create-public-event', 'POST', {
        event_type: eventType.trim(),
        event_datetime: formattedDatetime,
        event_description: description.trim(),
        participants_price: priceNum,
        event_city: city.trim(),
        event_address: address.trim()
    }).then(() => {
        alert('Public event created successfully!');
        // Reload events to show the new event
        loadBandEvents();
    }).catch(error => {
        console.error('Create event error:', error);
        console.error('Request data was:', {
            event_type: eventType.trim(),
            event_datetime: formattedDatetime,
            event_description: description.trim(),
            participants_price: priceNum,
            event_city: city.trim(),
            event_address: address.trim()
        });
        // Avoid duplicating error messages
        const errorMsg = error.message || 'Unknown error occurred';
        if (errorMsg.toLowerCase().includes('failed to')) {
            alert(errorMsg);
        } else {
            alert('Failed to create event: ' + errorMsg);
        }
    });
}

// Google Maps Functions
let eventsMap = null;
let mapMarkers = [];

async function initializeEventsMap() {
    const mapDiv = document.getElementById('events-map');
    if (!mapDiv) return;

    try {
        const events = await apiRequest('/api/events/nearby?lat=35.3332&lon=25.1162');

        // Center map on Heraklion, Crete
        const mapCenter = { lat: 35.3332, lng: 25.1162 };

        eventsMap = new google.maps.Map(mapDiv, {
            center: mapCenter,
            zoom: 10
        });

        // Clear existing markers
        mapMarkers.forEach(marker => marker.setMap(null));
        mapMarkers = [];

        // Add markers for each event with coordinates
        events.forEach(event => {
            if (event.event_lat && event.event_lon) {
                const marker = new google.maps.Marker({
                    position: { lat: event.event_lat, lng: event.event_lon },
                    map: eventsMap,
                    title: event.band_name + ' - ' + event.event_type
                });

                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div style="max-width: 250px;">
                            <h3 style="margin: 0 0 10px 0;">${event.band_name}</h3>
                            <p><strong>Type:</strong> ${event.event_type}</p>
                            <p><strong>Location:</strong> ${event.event_city}, ${event.event_address}</p>
                            <p><strong>Date:</strong> ${new Date(event.event_datetime).toLocaleString()}</p>
                            <p><strong>Price:</strong> €${event.participants_price}</p>
                            ${event.distance_km ? `<p><strong>Distance:</strong> ${event.distance_km} km</p>` : ''}
                        </div>
                    `
                });

                marker.addListener('click', () => {
                    infoWindow.open(eventsMap, marker);
                });

                mapMarkers.push(marker);
            }
        });

    } catch (error) {
        console.error('Failed to initialize map:', error);
    }
}

// Messaging System Functions
async function loadMessages(eventId) {
    try {
        const messages = await apiRequest(`/api/messages/${eventId}`);
        const container = document.getElementById(`messages-${eventId}`);

        if (!messages || messages.length === 0) {
            container.innerHTML = '<p class="no-data">No messages yet</p>';
            return;
        }

        container.innerHTML = messages.map(msg => `
            <div class="message ${msg.sender === 'user' ? 'message-user' : 'message-band'}">
                <p class="message-sender"><strong>${msg.sender === 'user' ? 'You' : 'Band'}:</strong></p>
                <p class="message-text">${msg.message}</p>
                <p class="message-date">${new Date(msg.date_time).toLocaleString()}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load messages:', error);
    }
}

async function sendMessage(eventId) {
    const message = prompt('Enter your message:');
    if (!message) return;

    try {
        await apiRequest('/api/send-message', 'POST', {
            private_event_id: eventId,
            message: message
        });
        alert('Message sent!');
        loadMessages(eventId);
    } catch (error) {
        alert('Failed to send message: ' + error.message);
    }
}

// Profile Visit Tracking
async function trackBandVisit(bandId) {
    try {
        await apiRequest(`/api/track-visit/${bandId}`, 'POST');
    } catch (error) {
        console.error('Failed to track visit:', error);
    }
}

async function loadBandAnalytics(bandId) {
    try {
        const analytics = await apiRequest(`/api/band-analytics/${bandId}`);
        const container = document.getElementById('band-analytics');

        container.innerHTML = `
            <div class="analytics-box">
                <h3>Profile Analytics</h3>
                <p><strong>Total Visits:</strong> ${analytics.totalVisits}</p>
                <p><strong>Registered User Visits:</strong> ${analytics.registeredVisits}</p>
                <p><strong>Anonymous Visits:</strong> ${analytics.anonymousVisits}</p>
                <h4>Recent Visitors:</h4>
                <ul>
                    ${analytics.recentVisits.map(visit => `
                        <li>${visit.visitor || 'Anonymous'} - ${new Date(visit.visit_time).toLocaleString()}</li>
                    `).join('')}
                </ul>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load analytics:', error);
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is already logged in (e.g., after registration or page refresh)
    try {
        const profile = await apiRequest('/api/profile');
        currentUser = profile;

        // Determine which view to show based on user type
        if (currentUser.band_name) {
            document.getElementById('band-name').textContent = currentUser.band_name;
            showView('band');
            loadBandRequests();
        } else {
            document.getElementById('user-name').textContent = currentUser.firstname;
            showView('user');
            loadUserEvents();
        }
    } catch (error) {
        // User not logged in, show visitor view
        showView('visitor');
        loadPublicEvents();
        loadPublicBands();
    }

    // Initialize map if Google Maps API is loaded
    if (typeof google !== 'undefined' && google.maps) {
        // Wait for map div to be visible
        setTimeout(initializeEventsMap, 1000);
    }

    // Initialize plugins
    initWeatherWidget();
    initCalendar();
});

// Weather Plugin
async function initWeatherWidget() {
    const container = document.getElementById('weather-content');
    if (!container) return;

    // Default to Heraklion, Crete
    const city = 'Heraklion';

    // Using wttr.in free weather API
    try {
        const response = await fetch(`https://wttr.in/${city}?format=j1`);
        const data = await response.json();

        const current = data.current_condition[0];
        const temp = current.temp_C;
        const desc = current.weatherDesc[0].value;
        const humidity = current.humidity;
        const wind = current.windspeedKmph;
        const feelsLike = current.FeelsLikeC;

        // Weather icon based on description
        let icon = '☀️';
        const descLower = desc.toLowerCase();
        if (descLower.includes('cloud')) icon = '☁️';
        else if (descLower.includes('rain')) icon = '🌧️';
        else if (descLower.includes('sun')) icon = '☀️';
        else if (descLower.includes('clear')) icon = '☀️';
        else if (descLower.includes('storm') || descLower.includes('thunder')) icon = '⛈️';
        else if (descLower.includes('snow')) icon = '❄️';
        else if (descLower.includes('fog') || descLower.includes('mist')) icon = '🌫️';
        else if (descLower.includes('overcast')) icon = '☁️';

        container.innerHTML = `
            <p class="weather-city">${city}, Greece</p>
            <div class="weather-info">
                <span class="weather-icon">${icon}</span>
                <span class="weather-temp">${temp}°C</span>
            </div>
            <p style="margin-top: 10px; color: #666;">${desc}</p>
            <div class="weather-details">
                <p>Feels like: ${feelsLike}°C | Humidity: ${humidity}% | Wind: ${wind} km/h</p>
            </div>
        `;
    } catch (error) {
        console.error('Weather error:', error);
        container.innerHTML = `
            <p class="weather-city">${city}, Greece</p>
            <p style="color: #666;">Weather data unavailable</p>
        `;
    }
}

// Calendar Plugin
let currentCalendarDate = new Date();

function initCalendar() {
    renderCalendar();
}

function changeMonth(delta) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + delta);
    renderCalendar();
}

async function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    const monthYearEl = document.getElementById('calendar-month-year');

    if (!grid || !monthYearEl) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];

    monthYearEl.textContent = `${monthNames[month]} ${year}`;

    // Get first day of month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Get today for highlighting
    const today = new Date();
    const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

    // Fetch events for this month to mark on calendar
    let eventDates = [];
    try {
        const events = await apiRequest('/api/events/nearby?lat=35.3332&lon=25.1162');
        eventDates = events
            .filter(e => {
                const eventDate = new Date(e.event_datetime);
                return eventDate.getMonth() === month && eventDate.getFullYear() === year;
            })
            .map(e => new Date(e.event_datetime).getDate());
    } catch (error) {
        // Ignore error, just don't show event markers
    }

    let html = '';

    // Day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
        html += `<div class="calendar-day-header">${day}</div>`;
    });

    // Previous month days
    const startDay = firstDay === 0 ? 7 : firstDay;
    for (let i = startDay - 1; i > 0; i--) {
        html += `<div class="calendar-day other-month">${daysInPrevMonth - i + 1}</div>`;
    }

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        let classes = 'calendar-day';
        if (isCurrentMonth && day === today.getDate()) {
            classes += ' today';
        }
        if (eventDates.includes(day)) {
            classes += ' has-event';
        }
        html += `<div class="${classes}">${day}</div>`;
    }

    // Next month days to fill the grid
    const totalCells = Math.ceil((startDay - 1 + daysInMonth) / 7) * 7;
    const remaining = totalCells - (startDay - 1 + daysInMonth);
    for (let i = 1; i <= remaining; i++) {
        html += `<div class="calendar-day other-month">${i}</div>`;
    }

    grid.innerHTML = html;
}
