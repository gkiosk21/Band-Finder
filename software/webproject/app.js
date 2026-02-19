"use strict";

require('dotenv').config();

const express = require('express');
const session = require('express-session'); // For keeping users logged in
const cookieParser = require('cookie-parser'); // For reading cookies
const path = require('path');

// Import existing database functions
const { initDatabase, dropDatabase } = require('./database');
const { insertUser, insertBand, insertReview, insertPublicEvent, insertPrivateEvent, insertMessage } = require('./databaseInsert');
const { users, bands, reviews, public_events, private_events, messages } = require('./resources');
const { getAllUsers, getUserByCredentials, updateUser, deleteUser } = require('./databaseQueriesUsers');
const { getAllBands, getBandByCredentials, updateBand, deleteBand } = require('./databaseQueriesBands');
const { sortEventsByDistance } = require('./helpers/distanceHelper');
const axios = require('axios');

const app = express();
const PORT = 3000;



/* MIDDLEWARE SETUP 
 * this parses the request body and makes it available as req.body
 */
app.use(express.json());

/*
 * express.urlencoded() allows us to receive form data
 * extended: true means we can handle complex objects in forms
 */
app.use(express.urlencoded({ extended: true }));

/*
 * cookieParser() reads cookies sent by the browser
 */
app.use(cookieParser());


app.use(session({
    secret: 'hy359-secret-key-2025', 
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,  //true if https
        httpOnly: true, 
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

/*
 * Any file in the 'public' folder can be accessed directly by the browser
 */
app.use(express.static('public'));


/*
 * XSS (Cross-Site Scripting)
 * 
 * EXAMPLE ATTACK:
 * Username: <script>alert('Hacked!')</script>
 * When displayed: the alert will pop up
 * 
 * HOW THIS PREVENTS IT:
 * We replace dangerous characters with their HTML entity equivalents:
 * < becomes &lt;
 * > becomes &gt;
 * " becomes &quot;
 * ' becomes &#x27;
 * & becomes &amp;
 * So <script> becomes &lt;script&gt; which displays as text, not code
 */
function sanitizeInput(str) {
    if (typeof str !== 'string') return str;
    
    return str
        .replace(/&/g, '&amp;')   // Must be first! (& is used in other escapes)
        .replace(/</g, '&lt;')    // Prevents <script> tags
        .replace(/>/g, '&gt;')    // Prevents closing tags
        .replace(/"/g, '&quot;')  // Prevents breaking out of attributes
        .replace(/'/g, '&#x27;')  // Prevents breaking out of attributes
        .replace(/\//g, '&#x2F;'); // Extra safety for URLs
}

/*
 * SANITIZE ALL FIELDS IN AN OBJECT
 */
function sanitizeObject(obj) {
    const sanitized = {};
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            // Recursively sanitize nested objects
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                sanitized[key] = sanitizeObject(obj[key]);
            } else {
                sanitized[key] = sanitizeInput(obj[key]);
            }
        }
    }
    return sanitized;
}

/*
 * GEOCODING HELPER FUNCTION
 * Converts an address (city + street) to latitude/longitude coordinates
 * Uses RapidAPI Forward-Reverse Geocoding service
 * Returns { lat, lon } or null if geocoding fails
 */
async function geocodeAddress(city, address, country = 'Greece') {
    try {
        const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '040c6a3e14msh8ee9f2ebfe36547p1fd4a1jsn8a9103255e3b';
        const fullAddress = `${address} ${city} ${country}`;
        const encodedAddress = encodeURIComponent(fullAddress);

        const response = await axios.get(
            `https://forward-reverse-geocoding.p.rapidapi.com/v1/search?q=${encodedAddress}&accept-language=en&polygon_threshold=0.0`,
            {
                headers: {
                    'X-RapidAPI-Key': RAPIDAPI_KEY,
                    'X-RapidAPI-Host': 'forward-reverse-geocoding.p.rapidapi.com'
                },
                timeout: 10000
            }
        );

        if (response.data && response.data.length > 0) {
            const location = response.data[0];
            const lat = parseFloat(location.lat);
            const lon = parseFloat(location.lon);

            if (!isNaN(lat) && !isNaN(lon)) {
                return { lat, lon };
            }
        }

        return null;
    } catch (error) {
        console.error('Geocoding error:', error.message);
        return null;
    }
}

/*
 * AUTHENTICATION MIDDLEWARE
 */
function requireAuth(req, res, next) {
    if (req.session && req.session.user) {
        // User is logged in, continue to the route
        return next();
    }
    // User is not logged in, send error
    res.status(401).json({
        error: 'Unauthorized',
        message: 'You must be logged in to access this resource'
    });
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/initdb', async (req, res) => {
    try {
        const result = await initDatabase();
        res.send(result);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.get('/insertRecords', async (req, res) => {
    try {
        for (const user of users) {
            await insertUser(user);
        }
        for (const band of bands) {
            await insertBand(band);
        }
        for (const review of reviews) {
            await insertReview(review);
        }
        for (const event of public_events) {
            await insertPublicEvent(event);
        }
        for (const privateEvent of private_events) {
            await insertPrivateEvent(privateEvent);
        }
        for (const message of messages) {
            await insertMessage(message);
        }
        res.send('All records inserted successfully (users, bands, reviews, public_events, private_events, messages)');
    } catch (error) {
        console.log(error.message);
        res.status(500).send(error.message);
    }
});

app.get('/dropdb', async (req, res) => {
    try {
        const message = await dropDatabase();
        res.send(message);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

/*
 * GET ALL USERS
 */
app.get('/users', async (req, res) => {
    try {
        const users = await getAllUsers();
        res.json(users);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

/*
 * GET ALL BANDS
 */
app.get('/bands', async (req, res) => {
    try {
        const bands = await getAllBands();
        res.json(bands);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

/*
 * GET BAND AVAILABILITY/SCHEDULE
 * Returns all scheduled events (public + accepted private) for a band
 * ENDPOINT: GET /api/band-availability/:band_id
 * HTTP STATUS CODES:
 * - 200 OK: Schedule retrieved successfully
 * - 404 Not Found: Band does not exist
 * - 500 Internal Server Error: Database error
 */
app.get('/api/band-availability/:band_id', async (req, res) => {
    try {
        const bandId = req.params.band_id;

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        // Check if band exists
        const [bands] = await connection.execute(
            'SELECT band_id, band_name FROM bands WHERE band_id = ?',
            [bandId]
        );

        if (bands.length === 0) {
            await connection.end();
            return res.status(404).json({ error: 'Band not found' });
        }

        // Get public events (future only)
        const [publicEvents] = await connection.execute(
            `SELECT 'public' as event_category, event_type, event_datetime, event_city
             FROM public_events
             WHERE band_id = ? AND event_datetime >= NOW()
             ORDER BY event_datetime ASC`,
            [bandId]
        );

        // Get accepted private events (future only, status = 'to_be_done')
        const [privateEvents] = await connection.execute(
            `SELECT 'private' as event_category, event_type, event_datetime, event_city
             FROM private_events
             WHERE band_id = ? AND event_datetime >= NOW() AND status = 'to_be_done'
             ORDER BY event_datetime ASC`,
            [bandId]
        );

        await connection.end();

        // Combine and sort all events
        const allEvents = [...publicEvents, ...privateEvents].sort((a, b) =>
            new Date(a.event_datetime) - new Date(b.event_datetime)
        );

        res.status(200).json({
            band_id: bandId,
            band_name: bands[0].band_name,
            scheduled_events: allEvents,
            total_scheduled: allEvents.length
        });

    } catch (error) {
        console.error('Get band availability error:', error);
        res.status(500).json({ error: 'Failed to fetch band availability' });
    }
});

/* TASK 1: USER/BAND REGISTRATION WITH AJAX DUPLICATE CHECKING
 * CHECK IF USERNAME EXISTS
 * ENDPOINT: GET /api/check-username?username=john123
 * 
 * HTTP STATUS CODES:
 * - 200 OK: Username is available
 * - 409 Conflict: Username already exists
 */
app.get('/api/check-username', async (req, res) => {
    try {
        const { username } = req.query;
        
        // Validate input
        if (!username || username.trim() === '') {
            return res.status(400).json({ 
                error: 'Username is required' 
            });
        }

        // Get database connection
        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        // Check in both users AND bands tables 
        const [userResults] = await connection.execute(
            'SELECT username FROM users WHERE username = ?',
            [username]
        );
        
        const [bandResults] = await connection.execute(
            'SELECT username FROM bands WHERE username = ?',
            [username]
        );

        await connection.end();

        // If found in either table, it's taken
        if (userResults.length > 0 || bandResults.length > 0) {
            return res.status(403).json({ 
                available: false,
                message: 'Το username υπάρχει ήδη' 
            });
        }

        // Username is available
        res.status(200).json({ 
            available: true,
            message: 'Το username είναι διαθέσιμο' 
        });

    } catch (error) {
        console.error('Check username error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*
 * CHECK IF EMAIL EXISTS
 * Same logic as username check
 */
app.get('/api/check-email', async (req, res) => {
    try {
        const { email } = req.query;
        
        if (!email || email.trim() === '') {
            return res.status(400).json({ 
                error: 'Email is required' 
            });
        }

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        // Check in both tables
        const [userResults] = await connection.execute(
            'SELECT email FROM users WHERE email = ?',
            [email]
        );
        
        const [bandResults] = await connection.execute(
            'SELECT email FROM bands WHERE email = ?',
            [email]
        );

        await connection.end();

        if (userResults.length > 0 || bandResults.length > 0) {
            return res.status(403).json({ 
                available: false,
                message: 'Το email υπάρχει ήδη' 
            });
        }

        res.status(200).json({ 
            available: true,
            message: 'Το email είναι διαθέσιμο' 
        });

    } catch (error) {
        console.error('Check email error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

/*
 * REGISTER USER 
 * ENDPOINT: POST /api/register/user 
 * HTTP STATUS CODES:
 * - 201 Created: User registered successfully
 * - 400 Bad Request: Missing required fields
 * - 403 Forbidden: Duplicate username/email
 * - 500 Internal Server Error: Database error
 */
app.post('/api/register/user', async (req, res) => {
    try {
        // Get and sanitize data (XSS Prevention)
        const userData = sanitizeObject(req.body);
        
        // Validate required fields
        const requiredFields = ['username', 'email', 'password', 'firstname', 
                              'lastname', 'birthdate', 'gender', 'country', 
                              'address', 'telephone'];
        
        for (const field of requiredFields) {
            if (!userData[field]) {
                return res.status(400).json({ 
                    error: `Missing required field: ${field}` 
                });
            }
        }

        // Insert into database
        await insertUser(userData);

        // Fetch the newly created user to return all data
        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        const [users] = await connection.execute(
            'SELECT * FROM users WHERE username = ?',
            [userData.username]
        );

        await connection.end();

        const user = users[0];

        // Create session for the newly registered user (auto-login)
        req.session.user = {
            user_id: user.user_id,
            username: user.username,
            email: user.email,
            firstname: user.firstname,
            lastname: user.lastname
        };

        // Save session explicitly and return response
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                // Still return success even if session fails
                return res.status(201).json({
                    message: 'Η εγγραφή σας πραγματοποιήθηκε επιτυχώς',
                    user: user
                });
            }

            res.status(201).json({
                message: 'Η εγγραφή σας πραγματοποιήθηκε επιτυχώς',
                user: user,
                loggedIn: true
            });
        });

    } catch (error) {
        console.error('Registration error:', error);
        
        // Check if it's a duplicate key error (MySQL error code 1062)
        if (error.message.includes('Duplicate entry')) {
            return res.status(403).json({ 
                error: 'Username or email already exists' 
            });
        }
        
        res.status(500).json({ error: 'Registration failed' });
    }
});

/*
 * REGISTER BAND
 * Same logic as user registration but for bands
 */
app.post('/api/register/band', async (req, res) => {
    try {
        const bandData = sanitizeObject(req.body);
        
        const requiredFields = ['username', 'email', 'password', 'band_name', 
                              'music_genres', 'band_description', 'members_number', 
                              'foundedYear', 'band_city', 'telephone'];
        
        for (const field of requiredFields) {
            if (!bandData[field]) {
                return res.status(400).json({ 
                    error: `Missing required field: ${field}` 
                });
            }
        }

        await insertBand(bandData);

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        const [bands] = await connection.execute(
            'SELECT * FROM bands WHERE username = ?',
            [bandData.username]
        );

        await connection.end();

        const band = bands[0];

        // Create session for the newly registered band (auto-login)
        req.session.user = {
            band_id: band.band_id,
            username: band.username,
            email: band.email,
            band_name: band.band_name,
            music_genres: band.music_genres
        };

        // Save session explicitly and return response
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                // Still return success even if session fails
                return res.status(201).json({
                    message: 'Η εγγραφή σας πραγματοποιήθηκε επιτυχώς',
                    band: band
                });
            }

            res.status(201).json({
                message: 'Η εγγραφή σας πραγματοποιήθηκε επιτυχώς',
                band: band,
                loggedIn: true
            });
        });

    } catch (error) {
        console.error('Band registration error:', error);
        
        if (error.message.includes('Duplicate entry')) {
            return res.status(403).json({ 
                error: 'Username, email, or band name already exists' 
            });
        }
        
        res.status(500).json({ error: 'Registration failed' });
    }
});

/*
 * LOGIN
 * Checks username/password, then stores user info in req.session
 * ENDPOINT: POST /api/login
 * BODY: { username, password }
 * FLOW:
 * 1. User sends credentials
 * 2. Server validates against database
 * 3. Server creates session: req.session.user = userData
 * 4. Server sends session ID cookie to browser
 * 5. Browser automatically sends this cookie with future requests
 * 6. Server reads cookie and retrieves session data
 * HTTP STATUS CODES:
 * - 200 OK: Login successful
 * - 400 Bad Request: Missing credentials
 * - 401 Unauthorized: Wrong password
 * - 404 Not Found: User doesn't exist
 */
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                error: 'Username and password are required'
            });
        }

        // Check for admin credentials (hardcoded)
        if (username === 'admin' && password === 'admiN12@*') {
            req.session.user = {
                username: 'admin',
                isAdmin: true
            };

            return req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.status(500).json({ error: 'Login failed' });
                }

                res.status(200).json({
                    message: 'Admin login successful',
                    user: { username: 'admin', isAdmin: true }
                });
            });
        }

        // Get database connection
        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        // Check if user exists in users table
        const [users] = await connection.execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (users.length > 0) {
            const user = users[0];

            // Check password
            if (user.password !== password) {
                await connection.end();
                return res.status(401).json({
                    error: 'Invalid password'
                });
            }

            // Create session for regular user
            req.session.user = {
                user_id: user.user_id,
                username: user.username,
                email: user.email,
                firstname: user.firstname,
                lastname: user.lastname
            };

            await connection.end();

            // Save session explicitly
            return req.session.save((err) => {
                if (err) {
                    console.error('Session save error:', err);
                    return res.status(500).json({ error: 'Login failed' });
                }

                res.status(200).json({
                    message: 'Login successful',
                    user: user
                });
            });
        }

        // Check if band exists in bands table
        const [bands] = await connection.execute(
            'SELECT * FROM bands WHERE username = ?',
            [username]
        );

        await connection.end();

        if (bands.length === 0) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        const band = bands[0];

        // Check password
        if (band.password !== password) {
            return res.status(401).json({
                error: 'Invalid password'
            });
        }

        // Create session for band
        req.session.user = {
            band_id: band.band_id,
            username: band.username,
            email: band.email,
            band_name: band.band_name,
            music_genres: band.music_genres
        };

        // Save session explicitly
        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.status(500).json({ error: 'Login failed' });
            }

            res.status(200).json({
                message: 'Login successful',
                user: band
            });
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

/*
 * LOGOUT
 * WHY: Destroys the session and logs user out
 * HOW: Calls req.session.destroy() which removes session data
 */
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.status(200).json({ message: 'Logout successful' });
    });
});

/*
 * GET USER PROFILE
 * Returns logged-in user's complete data
 * Requires authentication (uses requireAuth middleware)
 * requireAuth runs BEFORE this function. If user is not logged in,
 * requireAuth sends 401 error and this function never executes!
 */
app.get('/api/profile', requireAuth, async (req, res) => {
    try {
        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        // Check if it's a user or band
        if (req.session.user.user_id) {
            // It's a user
            const userId = req.session.user.user_id;

            const [users] = await connection.execute(
                'SELECT * FROM users WHERE user_id = ?',
                [userId]
            );

            await connection.end();

            if (users.length === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Don't send password to client
            const user = users[0];
            delete user.password;

            res.status(200).json(user);

        } else if (req.session.user.band_id) {
            // It's a band
            const bandId = req.session.user.band_id;

            const [bands] = await connection.execute(
                'SELECT * FROM bands WHERE band_id = ?',
                [bandId]
            );

            await connection.end();

            if (bands.length === 0) {
                return res.status(404).json({ error: 'Band not found' });
            }

            // Don't send password to client
            const band = bands[0];
            delete band.password;

            res.status(200).json(band);

        } else {
            await connection.end();
            return res.status(400).json({ error: 'Invalid session data' });
        }

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

/*
 * UPDATE USER PROFILE
 * Allows logged-in user to edit their profile
 * Username and email CANNOT be changed 
 * ENDPOINT: PUT /api/profile
 * BODY: JSON with fields to update (firstname, lastname, etc.)
 * HTTP STATUS CODES:
 * - 200 OK: Profile updated successfully
 * - 400 Bad Request: Trying to change username/email
 * - 401 Unauthorized: Not logged in
 */
app.put('/api/profile', requireAuth, async (req, res) => {
    try {
        const updates = sanitizeObject(req.body);

        // Prevent changing username and email (requirement!)
        if (updates.username || updates.email) {
            return res.status(400).json({
                error: 'Cannot change username or email'
            });
        }

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        // Check if user or band
        if (req.session.user.user_id) {
            // USER PROFILE UPDATE
            const userId = req.session.user.user_id;

            const allowedFields = ['firstname', 'lastname', 'birthdate', 'gender',
                                 'country', 'city', 'address', 'telephone', 'lat', 'lon'];

            const updateFields = [];
            const updateValues = [];

            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(updates[field]);
                }
            }

            if (updateFields.length === 0) {
                await connection.end();
                return res.status(400).json({ error: 'No fields to update' });
            }

            updateValues.push(userId);

            await connection.execute(
                `UPDATE users SET ${updateFields.join(', ')} WHERE user_id = ?`,
                updateValues
            );

            const [users] = await connection.execute(
                'SELECT * FROM users WHERE user_id = ?',
                [userId]
            );

            await connection.end();

            const user = users[0];
            delete user.password;

            res.status(200).json({
                message: 'Profile updated successfully',
                user: user
            });

        } else if (req.session.user.band_id) {
            // BAND PROFILE UPDATE
            const bandId = req.session.user.band_id;

            const allowedFields = ['band_name', 'band_description', 'music_genres',
                                 'members_number', 'foundedYear', 'country', 'band_city',
                                 'band_address', 'telephone', 'webpage', 'lat', 'lon'];

            const updateFields = [];
            const updateValues = [];

            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(updates[field]);
                }
            }

            if (updateFields.length === 0) {
                await connection.end();
                return res.status(400).json({ error: 'No fields to update' });
            }

            updateValues.push(bandId);

            await connection.execute(
                `UPDATE bands SET ${updateFields.join(', ')} WHERE band_id = ?`,
                updateValues
            );

            const [bands] = await connection.execute(
                'SELECT * FROM bands WHERE band_id = ?',
                [bandId]
            );

            await connection.end();

            const band = bands[0];
            delete band.password;

            // Update session with new band name if changed
            if (updates.band_name) {
                req.session.user.band_name = updates.band_name;
            }

            res.status(200).json({
                message: 'Profile updated successfully',
                band: band
            });

        } else {
            await connection.end();
            return res.status(401).json({ error: 'Invalid session' });
        }

    } catch (error) {
        console.error('Update profile error:', error.message);
        res.status(500).json({
            error: 'Database error: ' + error.message
        });
    }
});

/*
 * REST API FOR REVIEWS
 * CREATE REVIEW
 * Allows anyone to submit a review for a band (no login required)
 * ENDPOINT: POST /review/
 * BODY: { band_name, sender, review, rating }
 * VALIDATION:
 * - band_name must exist in database
 * - rating must be 1-5
 * - status is automatically set to "pending"
 * - date_time is automatically set to current time
 * HTTP STATUS CODES:
 * - 200 OK: Review created successfully
 * - 400 Bad Request: Missing fields or invalid rating
 * - 404 Not Found: Band doesn't exist
 * - 406 Not Acceptable: Invalid data format (as mentioned in assignment)
 */
app.post('/review/', async (req, res) => {
    try {
        const { band_name, sender, review, rating } = req.body;

        // Validate required fields
        if (!band_name || !sender || !review || !rating) {
            return res.status(400).json({ 
                error: 'Missing required fields',
                required: ['band_name', 'sender', 'review', 'rating']
            });
        }

        // Validate rating
        const ratingNum = parseInt(rating);
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            return res.status(406).json({ 
                error: 'Rating must be between 1 and 5' 
            });
        }

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        // Check if band exists
        const [bands] = await connection.execute(
            'SELECT band_name FROM bands WHERE band_name = ?',
            [band_name]
        );

        if (bands.length === 0) {
            await connection.end();
            return res.status(404).json({ 
                error: 'Band not found' 
            });
        }

        // Insert review with sanitized data
        const sanitizedData = sanitizeObject(req.body);
        const currentDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

        const [result] = await connection.execute(
            `INSERT INTO reviews (band_name, sender, review, rating, date_time, status) 
             VALUES (?, ?, ?, ?, ?, 'pending')`,
            [sanitizedData.band_name, sanitizedData.sender, sanitizedData.review, 
             ratingNum, currentDateTime]
        );

        await connection.end();

        res.status(200).json({ 
            message: 'Review submitted successfully',
            status: 'pending',
            review_id: result.insertId
        });

    } catch (error) {
        console.error('Create review error:', error);
        res.status(500).json({ error: 'Failed to create review' });
    }
});

/*
 * GET REVIEWS
 * Fetches published reviews for a band or all bands
 * ENDPOINT: GET /reviews/:band_name?ratingFrom=1&ratingTo=5
 * PARAMS: band_name (or 'all' for all bands)
 * QUERY: ratingFrom, ratingTo (optional filters)
 * ONLY returns reviews with status = 'published' (not pending/rejected)
 * HTTP STATUS CODES:
 * - 200 OK: Reviews retrieved successfully (even if empty array)
 * - 400 Bad Request: Invalid rating range
 */
app.get('/reviews/:band_name', async (req, res) => {
    try {
        const { band_name } = req.params;
        const { ratingFrom, ratingTo } = req.query;

        let query = `SELECT * FROM reviews WHERE status = 'published'`;
        const queryParams = [];

        // Filter by band name (unless 'all')
        if (band_name && band_name.toLowerCase() !== 'all') {
            query += ` AND band_name = ?`;
            queryParams.push(band_name);
        }

        // Filter by rating range
        if (ratingFrom) {
            const ratingFromNum = parseInt(ratingFrom);
            if (isNaN(ratingFromNum) || ratingFromNum < 1 || ratingFromNum > 5) {
                return res.status(400).json({ 
                    error: 'ratingFrom must be between 1 and 5' 
                });
            }
            query += ` AND rating >= ?`;
            queryParams.push(ratingFromNum);
        }

        if (ratingTo) {
            const ratingToNum = parseInt(ratingTo);
            if (isNaN(ratingToNum) || ratingToNum < 1 || ratingToNum > 5) {
                return res.status(400).json({ 
                    error: 'ratingTo must be between 1 and 5' 
                });
            }
            query += ` AND rating <= ?`;
            queryParams.push(ratingToNum);
        }

        query += ` ORDER BY date_time DESC`;

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        const [reviews] = await connection.execute(query, queryParams);

        await connection.end();

        res.status(200).json(reviews);

    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

/*
 * UPDATE REVIEW STATUS
 * Allows admins to change review status (pending -> published/rejected)
 * ENDPOINT: PUT /reviewStatus/:review_id/:status
 * PARAMS: review_id, status (pending/published/rejected)
 * REQUIRES: Admin session
 * HTTP STATUS CODES:
 * - 200 OK: Status updated successfully
 * - 400 Bad Request: Invalid status
 * - 401 Unauthorized: Not admin
 * - 404 Not Found: Review doesn't exist
 */
app.put('/reviewStatus/:review_id/:status', async (req, res) => {
    try {
        // Check if user is logged in as admin
        if (!req.session || !req.session.user || !req.session.user.isAdmin) {
            return res.status(401).json({ error: 'Unauthorized. Admin access required.' });
        }

        const { review_id, status } = req.params;

        // Validate status
        const validStatuses = ['pending', 'published', 'rejected'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error: 'Invalid status',
                valid: validStatuses
            });
        }

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        // Check if review exists
        const [reviews] = await connection.execute(
            'SELECT review_id FROM reviews WHERE review_id = ?',
            [review_id]
        );

        if (reviews.length === 0) {
            await connection.end();
            return res.status(404).json({ 
                error: 'Review not found' 
            });
        }

        // Update status
        await connection.execute(
            'UPDATE reviews SET status = ? WHERE review_id = ?',
            [status, review_id]
        );

        await connection.end();

        res.status(200).json({ 
            message: 'Review status updated successfully',
            review_id: review_id,
            new_status: status
        });

    } catch (error) {
        console.error('Update review status error:', error);
        res.status(500).json({ error: 'Failed to update review status' });
    }
});

/*
 * DELETE REVIEW
 * Allows admins to delete reviews
 * ENDPOINT: DELETE /reviewDeletion/:review_id
 * PARAMS: review_id
 * HTTP STATUS CODES:
 * - 200 OK: Review deleted successfully
 * - 404 Not Found: Review doesn't exist
 */
app.delete('/reviewDeletion/:review_id', async (req, res) => {
    try {
        const { review_id } = req.params;

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        // Check if review exists
        const [reviews] = await connection.execute(
            'SELECT review_id FROM reviews WHERE review_id = ?',
            [review_id]
        );

        if (reviews.length === 0) {
            await connection.end();
            return res.status(404).json({ 
                error: 'Review not found' 
            });
        }

        // Delete review
        await connection.execute(
            'DELETE FROM reviews WHERE review_id = ?',
            [review_id]
        );

        await connection.end();

        res.status(200).json({ 
            message: 'Review deleted successfully',
            review_id: review_id
        });

    } catch (error) {
        console.error('Delete review error:', error);
        res.status(500).json({ error: 'Failed to delete review' });
    }
});

/*
 * REQUEST PRIVATE EVENT
 * Allows logged-in users to request a private event with a band
 * ENDPOINT: POST /api/request-event
 * BODY: { band_id, event_type, event_datetime, event_description, price, event_city, event_address, event_lat, event_lon }
 */
app.post('/api/request-event', requireAuth, async (req, res) => {
    try {
        // Check if logged in as user (not band)
        if (!req.session.user.user_id) {
            return res.status(403).json({
                error: 'Only users can request private events. Bands cannot make requests.'
            });
        }

        const userId = req.session.user.user_id;
        const eventData = sanitizeObject(req.body);

        const requiredFields = ['band_id', 'event_type', 'event_datetime', 'event_description',
                              'event_city', 'event_address'];

        for (const field of requiredFields) {
            if (!eventData[field] || eventData[field].toString().trim() === '') {
                return res.status(400).json({
                    error: `Missing required field: ${field}`
                });
            }
        }

        // Validate datetime format
        const datetimeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
        if (!datetimeRegex.test(eventData.event_datetime)) {
            return res.status(400).json({
                error: 'Invalid datetime format. Expected: YYYY-MM-DD HH:MM:SS'
            });
        }

        const eventTypeLower = eventData.event_type.toLowerCase();
        let price;
        if (eventTypeLower.includes('baptism')) {
            price = 700;
        } else if (eventTypeLower.includes('wedding')) {
            price = 1000;
        } else if (eventTypeLower.includes('party')) {
            price = 500;
        } else {
            return res.status(400).json({
                error: 'Invalid event type. Must be Baptism, Wedding, or Party'
            });
        }

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        const [bands] = await connection.execute(
            'SELECT band_id FROM bands WHERE band_id = ?',
            [eventData.band_id]
        );

        if (bands.length === 0) {
            await connection.end();
            return res.status(404).json({ error: 'Band not found' });
        }

        // Check for conflicting private events
        const [privateConflicts] = await connection.execute(
            `SELECT private_event_id FROM private_events
             WHERE band_id = ? AND event_datetime = ? AND status != 'rejected'`,
            [eventData.band_id, eventData.event_datetime]
        );

        // Check for conflicting public events
        const [publicConflicts] = await connection.execute(
            `SELECT public_event_id FROM public_events
             WHERE band_id = ? AND event_datetime = ?`,
            [eventData.band_id, eventData.event_datetime]
        );

        if (privateConflicts.length > 0 || publicConflicts.length > 0) {
            await connection.end();
            return res.status(400).json({
                error: 'Band is not available at this date and time'
            });
        }

        const [result] = await connection.execute(
            `INSERT INTO private_events (band_id, price, status, band_decision, user_id,
             event_type, event_datetime, event_description, event_city, event_address,
             event_lat, event_lon)
             VALUES (?, ?, 'requested', '', ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                eventData.band_id,
                price,
                userId,
                eventData.event_type,
                eventData.event_datetime,
                eventData.event_description,
                eventData.event_city,
                eventData.event_address,
                eventData.event_lat || null,
                eventData.event_lon || null
            ]
        );

        await connection.end();

        res.status(201).json({
            message: 'Event request submitted successfully',
            private_event_id: result.insertId,
            status: 'requested',
            price: price
        });

    } catch (error) {
        console.error('Request event error:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            error: 'Failed to request event',
            details: error.message
        });
    }
});

/*
 * UPDATE PRIVATE EVENT STATUS
 * Allows bands to accept/reject requests, and users to mark completed events as done
 * ENDPOINT: PUT /api/update-event-status/:event_id
 * BODY: { status, band_decision? }
 */
app.put('/api/update-event-status/:event_id', requireAuth, async (req, res) => {
    try {
        const { event_id } = req.params;
        const { status, band_decision } = sanitizeObject(req.body);
        const userId = req.session.user.user_id;

        const validStatuses = ['requested', 'to_be_done', 'rejected', 'done'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error: 'Invalid status',
                valid: validStatuses
            });
        }

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        const [events] = await connection.execute(
            `SELECT pe.*, b.username as band_username
             FROM private_events pe
             JOIN bands b ON pe.band_id = b.band_id
             WHERE pe.private_event_id = ?`,
            [event_id]
        );

        if (events.length === 0) {
            await connection.end();
            return res.status(404).json({ error: 'Event not found' });
        }

        const event = events[0];

        const [bandCheck] = await connection.execute(
            'SELECT band_id FROM bands WHERE username = ?',
            [req.session.user.username]
        );

        const isBand = bandCheck.length > 0 && bandCheck[0].band_id === event.band_id;
        const isRequestingUser = event.user_id === userId;

        if (!isBand && !isRequestingUser) {
            await connection.end();
            return res.status(403).json({ error: 'Not authorized to update this event' });
        }

        if (isBand) {
            if (event.status !== 'requested') {
                await connection.end();
                return res.status(400).json({
                    error: 'Band can only update events with status "requested"'
                });
            }

            if (status !== 'to_be_done' && status !== 'rejected') {
                await connection.end();
                return res.status(400).json({
                    error: 'Band can only set status to "to_be_done" or "rejected"'
                });
            }

            if (status === 'to_be_done' && !band_decision) {
                await connection.end();
                return res.status(400).json({
                    error: 'band_decision required when accepting event'
                });
            }

            await connection.execute(
                'UPDATE private_events SET status = ?, band_decision = ? WHERE private_event_id = ?',
                [status, band_decision || '', event_id]
            );

        } else if (isRequestingUser) {
            if (event.status !== 'to_be_done') {
                await connection.end();
                return res.status(400).json({
                    error: 'User can only update events with status "to_be_done"'
                });
            }

            if (status !== 'done') {
                await connection.end();
                return res.status(400).json({
                    error: 'User can only set status to "done"'
                });
            }

            const eventDate = new Date(event.event_datetime);
            const now = new Date();

            if (eventDate > now) {
                await connection.end();
                return res.status(400).json({
                    error: 'Cannot mark event as done before the event date'
                });
            }

            await connection.execute(
                'UPDATE private_events SET status = ? WHERE private_event_id = ?',
                [status, event_id]
            );
        }

        await connection.end();

        res.status(200).json({
            message: 'Event status updated successfully',
            private_event_id: event_id,
            new_status: status
        });

    } catch (error) {
        console.error('Update event status error:', error);
        res.status(500).json({ error: 'Failed to update event status' });
    }
});

/*
 * GET PUBLIC EVENTS SORTED BY DISTANCE
 * Returns public events sorted by driving distance from user's location
 * ENDPOINT: GET /api/events/nearby?lat=35.3332&lon=25.1162
 */
app.get('/api/events/nearby', async (req, res) => {
    try {
        const { lat, lon } = req.query;

        if (!lat || !lon) {
            return res.status(400).json({
                error: 'User location required (lat and lon query parameters)'
            });
        }

        const userLat = parseFloat(lat);
        const userLon = parseFloat(lon);

        if (isNaN(userLat) || isNaN(userLon)) {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        const [events] = await connection.execute(
            `SELECT pe.*, b.band_name, b.music_genres, b.foundedYear
             FROM public_events pe
             JOIN bands b ON pe.band_id = b.band_id
             ORDER BY pe.event_datetime ASC`
        );

        await connection.end();

        const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '040c6a3e14msh8ee9f2ebfe36547p1fd4a1jsn8a9103255e3b';
        const sortedEvents = await sortEventsByDistance(
            { lat: userLat, lon: userLon },
            events,
            RAPIDAPI_KEY
        );

        res.status(200).json(sortedEvents);

    } catch (error) {
        console.error('Get nearby events error:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

/*
 * GET USER'S PRIVATE EVENT BOOKINGS
 * Returns all private events requested by the logged-in user
 * ENDPOINT: GET /api/my-bookings
 */
app.get('/api/my-bookings', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.user_id;

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        const [bookings] = await connection.execute(
            `SELECT pe.*, b.band_name, b.music_genres, b.telephone as band_telephone
             FROM private_events pe
             JOIN bands b ON pe.band_id = b.band_id
             WHERE pe.user_id = ?
             ORDER BY pe.event_datetime DESC`,
            [userId]
        );

        await connection.end();

        res.status(200).json(bookings);

    } catch (error) {
        console.error('Get my bookings error:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

/*
 * GET BAND'S EVENT REQUESTS
 * Returns all private event requests for the logged-in band
 * ENDPOINT: GET /api/band-requests
 */
app.get('/api/band-requests', requireAuth, async (req, res) => {
    try {
        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        const [bandCheck] = await connection.execute(
            'SELECT band_id FROM bands WHERE username = ?',
            [req.session.user.username]
        );

        if (bandCheck.length === 0) {
            await connection.end();
            return res.status(403).json({ error: 'Only bands can access this endpoint' });
        }

        const bandId = bandCheck[0].band_id;

        const [requests] = await connection.execute(
            `SELECT pe.*, u.firstname, u.lastname, u.email as user_email, u.telephone as user_telephone
             FROM private_events pe
             JOIN users u ON pe.user_id = u.user_id
             WHERE pe.band_id = ?
             ORDER BY pe.event_datetime ASC`,
            [bandId]
        );

        await connection.end();

        res.status(200).json(requests);

    } catch (error) {
        console.error('Get band requests error:', error);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

/*
 * SEND MESSAGE FOR TO_BE_DONE EVENT
 * Users and bands can exchange messages for events with status "to_be_done"
 * ENDPOINT: POST /api/send-message
 * BODY: { private_event_id, message }
 */
app.post('/api/send-message', requireAuth, async (req, res) => {
    try {
        const { private_event_id, message } = sanitizeObject(req.body);
        const userId = req.session.user.user_id;

        if (!private_event_id || !message) {
            return res.status(400).json({ error: 'private_event_id and message required' });
        }

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        const [events] = await connection.execute(
            `SELECT pe.*, b.username as band_username, b.band_id
             FROM private_events pe
             JOIN bands b ON pe.band_id = b.band_id
             WHERE pe.private_event_id = ?`,
            [private_event_id]
        );

        if (events.length === 0) {
            await connection.end();
            return res.status(404).json({ error: 'Event not found' });
        }

        const event = events[0];

        if (event.status !== 'to_be_done') {
            await connection.end();
            return res.status(400).json({
                error: 'Messages can only be sent for events with status "to_be_done"'
            });
        }

        const [bandCheck] = await connection.execute(
            'SELECT band_id FROM bands WHERE username = ?',
            [req.session.user.username]
        );

        const isBand = bandCheck.length > 0 && bandCheck[0].band_id === event.band_id;
        const isRequestingUser = event.user_id === userId;

        if (!isBand && !isRequestingUser) {
            await connection.end();
            return res.status(403).json({ error: 'Not authorized to send messages for this event' });
        }

        let sender, recipient;
        if (isBand) {
            sender = 'band';
            recipient = 'user';
        } else {
            sender = 'user';
            recipient = 'band';
        }

        const currentDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

        const [result] = await connection.execute(
            `INSERT INTO messages (private_event_id, message, sender, recipient, date_time)
             VALUES (?, ?, ?, ?, ?)`,
            [private_event_id, message, sender, recipient, currentDateTime]
        );

        await connection.end();

        res.status(201).json({
            message: 'Message sent successfully',
            message_id: result.insertId
        });

    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

/*
 * GET MESSAGES FOR AN EVENT
 * Retrieve all messages for a specific private event
 * ENDPOINT: GET /api/messages/:event_id
 */
app.get('/api/messages/:event_id', requireAuth, async (req, res) => {
    try {
        const { event_id } = req.params;
        const userId = req.session.user.user_id;

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        const [events] = await connection.execute(
            `SELECT pe.*, b.band_id
             FROM private_events pe
             JOIN bands b ON pe.band_id = b.band_id
             WHERE pe.private_event_id = ?`,
            [event_id]
        );

        if (events.length === 0) {
            await connection.end();
            return res.status(404).json({ error: 'Event not found' });
        }

        const event = events[0];

        const [bandCheck] = await connection.execute(
            'SELECT band_id FROM bands WHERE username = ?',
            [req.session.user.username]
        );

        const isBand = bandCheck.length > 0 && bandCheck[0].band_id === event.band_id;
        const isRequestingUser = event.user_id === userId;

        if (!isBand && !isRequestingUser) {
            await connection.end();
            return res.status(403).json({ error: 'Not authorized to view messages for this event' });
        }

        const [messages] = await connection.execute(
            `SELECT * FROM messages WHERE private_event_id = ? ORDER BY date_time ASC`,
            [event_id]
        );

        await connection.end();

        res.status(200).json(messages);

    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

/*
 * CREATE PUBLIC EVENT (BAND ONLY)
 * Allows bands to create public concerts/events
 * ENDPOINT: POST /api/create-public-event
 * REQUIRES: Band authentication (bands only, not users)
 * BODY: { event_type, event_datetime, event_description, participants_price, event_city, event_address, event_lat?, event_lon? }
 * HTTP STATUS CODES:
 * - 201 Created: Event created successfully
 * - 400 Bad Request: Missing fields or invalid data
 * - 403 Forbidden: Only bands can create public events
 * - 500 Internal Server Error: Database error
 */
app.post('/api/create-public-event', requireAuth, async (req, res) => {
    try {
        // Check if logged in as band (not user)
        if (!req.session.user.band_id) {
            return res.status(403).json({
                error: 'Only bands can create public events.'
            });
        }

        const bandId = req.session.user.band_id;
        const eventData = sanitizeObject(req.body);

        const requiredFields = ['event_type', 'event_datetime', 'event_description',
                              'participants_price', 'event_city', 'event_address'];

        for (const field of requiredFields) {
            if (!eventData[field] || eventData[field].toString().trim() === '') {
                return res.status(400).json({
                    error: `Missing required field: ${field}`
                });
            }
        }

        // Validate datetime format
        const datetimeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
        if (!datetimeRegex.test(eventData.event_datetime)) {
            return res.status(400).json({
                error: 'Invalid datetime format. Expected: YYYY-MM-DD HH:MM:SS'
            });
        }

        // Validate price is a positive number
        const price = parseFloat(eventData.participants_price);
        if (isNaN(price) || price < 0) {
            return res.status(400).json({
                error: 'Participant price must be a positive number'
            });
        }

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        // Check for conflicting events at the same datetime
        const [privateConflicts] = await connection.execute(
            `SELECT private_event_id FROM private_events
             WHERE band_id = ? AND event_datetime = ? AND status != 'rejected'`,
            [bandId, eventData.event_datetime]
        );

        const [publicConflicts] = await connection.execute(
            `SELECT public_event_id FROM public_events
             WHERE band_id = ? AND event_datetime = ?`,
            [bandId, eventData.event_datetime]
        );

        if (privateConflicts.length > 0 || publicConflicts.length > 0) {
            await connection.end();
            return res.status(400).json({
                error: 'You already have an event scheduled at this date and time'
            });
        }

        // Geocode the address to get coordinates if not provided
        let eventLat = eventData.event_lat || null;
        let eventLon = eventData.event_lon || null;

        if (!eventLat || !eventLon) {
            const coords = await geocodeAddress(eventData.event_city, eventData.event_address);
            if (coords) {
                eventLat = coords.lat;
                eventLon = coords.lon;
            }
        }

        // Insert public event
        const [result] = await connection.execute(
            `INSERT INTO public_events (band_id, event_type, event_datetime, event_description,
             participants_price, event_city, event_address, event_lat, event_lon)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                bandId,
                eventData.event_type,
                eventData.event_datetime,
                eventData.event_description,
                price,
                eventData.event_city,
                eventData.event_address,
                eventLat,
                eventLon
            ]
        );

        await connection.end();

        res.status(201).json({
            message: 'Public event created successfully',
            public_event_id: result.insertId,
            event_type: eventData.event_type,
            event_datetime: eventData.event_datetime
        });

    } catch (error) {
        console.error('Create public event error:', error.message);
        res.status(500).json({
            error: 'Failed to create public event',
            details: error.message
        });
    }
});

/*
 * GET BAND'S PUBLIC EVENTS
 * Returns all public events for the logged-in band
 * ENDPOINT: GET /api/band-events
 * REQUIRES: Band authentication (bands only, not users)
 * HTTP STATUS CODES:
 * - 200 OK: Events retrieved successfully
 * - 403 Forbidden: Only bands can access this endpoint
 * - 500 Internal Server Error: Database error
 */
app.get('/api/band-events', requireAuth, async (req, res) => {
    try {
        // Check if logged in as band (not user)
        if (!req.session.user.band_id) {
            return res.status(403).json({
                error: 'Only bands can access their events.'
            });
        }

        const bandId = req.session.user.band_id;

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        const [events] = await connection.execute(
            `SELECT * FROM public_events
             WHERE band_id = ?
             ORDER BY event_datetime DESC`,
            [bandId]
        );

        await connection.end();

        res.status(200).json(events);

    } catch (error) {
        console.error('Get band events error:', error);
        res.status(500).json({ error: 'Failed to fetch band events' });
    }
});

/*
 * DELETE PUBLIC EVENT
 * Allows a band to delete their own public event
 * ENDPOINT: DELETE /api/public-event/:event_id
 * REQUIRES: Band authentication (must be the band that created the event)
 * HTTP STATUS CODES:
 * - 200 OK: Event deleted successfully
 * - 403 Forbidden: Not authorized (not a band or not the owner)
 * - 404 Not Found: Event does not exist
 * - 500 Internal Server Error: Database error
 */
app.delete('/api/public-event/:event_id', requireAuth, async (req, res) => {
    try {
        // Check if logged in as band (not user)
        if (!req.session.user.band_id) {
            return res.status(403).json({
                error: 'Only bands can delete public events.'
            });
        }

        const bandId = req.session.user.band_id;
        const eventId = req.params.event_id;

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        // Check if event exists and belongs to this band
        const [events] = await connection.execute(
            'SELECT * FROM public_events WHERE public_event_id = ?',
            [eventId]
        );

        if (events.length === 0) {
            await connection.end();
            return res.status(404).json({ error: 'Event not found.' });
        }

        if (events[0].band_id !== bandId) {
            await connection.end();
            return res.status(403).json({ error: 'You can only delete your own events.' });
        }

        // Delete the event
        await connection.execute(
            'DELETE FROM public_events WHERE public_event_id = ?',
            [eventId]
        );

        await connection.end();

        res.status(200).json({
            message: 'Event deleted successfully',
            deleted_event_id: eventId
        });

    } catch (error) {
        console.error('Delete public event error:', error);
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

/*
 * GET ADMIN STATISTICS
 * Returns statistics for admin dashboard
 * ENDPOINT: GET /api/admin/statistics
 * REQUIRES: Admin session
 */
app.get('/api/admin/statistics', async (req, res) => {
    try {
        // Check if user is logged in as admin
        if (!req.session || !req.session.user || !req.session.user.isAdmin) {
            return res.status(401).json({ error: 'Unauthorized. Admin access required.' });
        }

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        const [bandsPerCity] = await connection.execute(
            `SELECT band_city, COUNT(*) as count FROM bands GROUP BY band_city`
        );

        const [eventCounts] = await connection.execute(
            `SELECT
                (SELECT COUNT(*) FROM public_events) as public_events,
                (SELECT COUNT(*) FROM private_events) as private_events`
        );

        const [userCounts] = await connection.execute(
            `SELECT
                (SELECT COUNT(*) FROM users) as users,
                (SELECT COUNT(*) FROM bands) as bands`
        );

        const [revenue] = await connection.execute(
            `SELECT SUM(price * 0.15) as total_revenue
             FROM private_events
             WHERE status = 'done'`
        );

        await connection.end();

        res.status(200).json({
            bandsPerCity: bandsPerCity,
            publicEvents: eventCounts[0].public_events,
            privateEvents: eventCounts[0].private_events,
            totalUsers: userCounts[0].users,
            totalBands: userCounts[0].bands,
            totalRevenue: revenue[0].total_revenue || 0
        });

    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

/*
 * GET ALL REVIEWS (ADMIN ONLY)
 * Returns ALL reviews regardless of status (pending, published, rejected)
 * ENDPOINT: GET /api/admin/reviews
 * REQUIRES: Admin session
 * HTTP STATUS CODES:
 * - 200 OK: Reviews retrieved successfully
 * - 401 Unauthorized: Not admin
 * - 500 Internal Server Error: Database error
 */
app.get('/api/admin/reviews', async (req, res) => {
    try {
        // Check if user is logged in as admin
        if (!req.session || !req.session.user || !req.session.user.isAdmin) {
            return res.status(401).json({ error: 'Unauthorized. Admin access required.' });
        }

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        // Get ALL reviews regardless of status, ordered by newest first
        const [reviews] = await connection.execute(
            `SELECT * FROM reviews ORDER BY date_time DESC`
        );

        await connection.end();

        res.status(200).json(reviews);

    } catch (error) {
        console.error('Get admin reviews error:', error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

/*
 * DELETE USER (ADMIN ONLY)
 * Allows admin to delete any user by user_id
 * ENDPOINT: DELETE /api/admin/users/:user_id
 * REQUIRES: Admin session
 * HTTP STATUS CODES:
 * - 200 OK: User deleted successfully
 * - 401 Unauthorized: Not admin
 * - 404 Not Found: User doesn't exist
 * - 500 Internal Server Error: Database error
 */
app.delete('/api/admin/users/:user_id', async (req, res) => {
    try {
        // Check if user is logged in as admin
        if (!req.session || !req.session.user || !req.session.user.isAdmin) {
            return res.status(401).json({ error: 'Unauthorized. Admin access required.' });
        }

        const { user_id } = req.params;

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        // Check if user exists
        const [users] = await connection.execute(
            'SELECT user_id, username FROM users WHERE user_id = ?',
            [user_id]
        );

        if (users.length === 0) {
            await connection.end();
            return res.status(404).json({
                error: 'User not found'
            });
        }

        // Delete user (CASCADE will delete related records)
        await connection.execute(
            'DELETE FROM users WHERE user_id = ?',
            [user_id]
        );

        await connection.end();

        res.status(200).json({
            message: 'User deleted successfully',
            user_id: user_id,
            username: users[0].username
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

/*
 * TRACK BAND PROFILE VISIT
 * Increments visit counter for band profiles
 * ENDPOINT: POST /api/track-visit/:band_id
 */
app.post('/api/track-visit/:band_id', async (req, res) => {
    try {
        const { band_id } = req.params;
        const userId = req.session && req.session.user ? req.session.user.user_id : null;

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        const currentDateTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

        await connection.execute(
            `INSERT INTO profile_visits (band_id, user_id, visit_time) VALUES (?, ?, ?)`,
            [band_id, userId, currentDateTime]
        );

        await connection.end();

        res.status(200).json({ message: 'Visit tracked' });

    } catch (error) {
        res.status(500).json({ error: 'Failed to track visit' });
    }
});

/*
 * GET BAND PROFILE ANALYTICS
 * Returns visit statistics for a band profile
 * ENDPOINT: GET /api/band-analytics/:band_id
 */
app.get('/api/band-analytics/:band_id', async (req, res) => {
    try {
        const { band_id } = req.params;

        const mysql = require('mysql2/promise');
        const connection = await mysql.createConnection({
            host: "localhost",
            port: 3306,
            user: "root",
            password: "",
            database: "HY359_2025"
        });

        const [totalVisits] = await connection.execute(
            `SELECT COUNT(*) as total FROM profile_visits WHERE band_id = ?`,
            [band_id]
        );

        const [registeredVisits] = await connection.execute(
            `SELECT COUNT(DISTINCT user_id) as registered
             FROM profile_visits
             WHERE band_id = ? AND user_id IS NOT NULL`,
            [band_id]
        );

        await connection.end();

        res.status(200).json({
            totalVisits: totalVisits[0].total,
            registeredUserVisits: registeredVisits[0].registered
        });

    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

/*
 * MAPS CONFIG
 * Exposes the Google Maps API key to the frontend without hardcoding it in HTML.
 * Key is read from the GOOGLE_MAPS_API_KEY environment variable (set in .env).
 */
app.get('/api/maps-config', (req, res) => {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) {
        return res.status(500).json({ error: 'Maps API key not configured on server' });
    }
    res.json({ key });
});

// START SERVER
app.listen(PORT, () => {
    console.log(`
    
    Server running on http://localhost:${PORT}    http://localhost:${PORT}/band-finder.html 
    
    
    Available Routes:
    
    Registration :
    - GET  /api/check-username?username=xxx
    - GET  /api/check-email?email=xxx
    - POST /api/register/user
    - POST /api/register/band
    
    Authentication :
    - POST /api/login
    - POST /api/logout
    - GET  /api/profile (protected)
    - PUT  /api/profile (protected)
    
    Reviews API :
    - POST   /review/
    - GET    /reviews/:band_name
    - PUT    /reviewStatus/:review_id/:status
    - DELETE /reviewDeletion/:review_id
    
    Database:
    - GET /initdb
    - GET /insertRecords
    - GET /dropdb
    - GET /users
    - GET /bands
    `);
});