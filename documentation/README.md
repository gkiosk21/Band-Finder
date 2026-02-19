# Band Finder - HY359 Project (Team 62)

**CSD5127** George Kiosklis
**CSD5107** Panagiotis Charalampopoulos

## Project Description

Band Finder is a web application developed for the HY359 course at the University of Crete. It serves as a marketplace/booking platform that connects bands with event organizers in Greece. Users can browse bands, book private events (weddings, baptisms, parties), and write reviews, while bands can manage their profiles, create public events, accept or reject private event requests, and communicate with users through an in-app messaging system.

## Architecture

The application follows a client-server architecture built on **Node.js/Express**. The system uses AJAX for seamless communication and REST requests based on RESTful practices.

- **Backend:** Node.js/Express providing 25+ REST endpoints for login, registration, events (public and private), reviews, messaging, admin functions, and statistics.
- **Frontend:** HTML/CSS/JavaScript with dynamic UI management (filters, forms, maps). All communication with the server is done via AJAX without page reloads.
- **Database:** MySQL, supporting events, bookings, reviews with approval workflow, messages, and analytics.

### External APIs

- **RapidAPI Forward-Reverse Geocoding:** Converts addresses to geographic coordinates during user/band registration and event creation.
- **wttr.in Weather API:** Displays a weather widget showing current weather by city (no key required).
- **Google Maps JavaScript API:** Displays events on an interactive map and calculates distances for finding nearby events.

## User Roles

| Role | Capabilities |
|---|---|
| **Visitor** | Browse bands and public events, view the events map, weather, and calendar |
| **Registered User** | All visitor features + request private events, message bands, leave reviews, manage profile |
| **Band** | Manage event requests (accept/reject), create public events, view reviews, manage profile |
| **Administrator** | Review moderation, user management, statistics dashboard |

## Prerequisites

- **Node.js** v18 or later
- **MySQL Server** (e.g. via XAMPP)
- A **Google Maps JavaScript API** key — [get one here](https://console.cloud.google.com/apis/credentials)
- A **RapidAPI** key for the Forward-Reverse Geocoding API — [get one here](https://rapidapi.com/geocodeapi/api/forward-reverse-geocoding)

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/gkiosk21/Band-Finder.git
cd Band-Finder
```

### 2. Install dependencies

```bash
cd software/webproject
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your API keys:

```bash
cp .env.example .env
```

Edit `software/webproject/.env`:

```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
RAPIDAPI_KEY=your_rapidapi_key_here
```

> **Never commit `.env` to git.** It is listed in `.gitignore`.

### 4. Restrict your Google Maps API key (recommended)

In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
- **API restrictions** → limit to **Maps JavaScript API** only
- **Application restrictions** → HTTP referrers → add `http://localhost:3000/*` (and your production domain if deploying)

### 5. Start the server

```bash
node app.js
```

The server starts at **http://localhost:3000**

### 6. Initialize the database

Open these URLs in your browser **once**, in order:

1. http://localhost:3000/initdb — creates the database schema
2. http://localhost:3000/insertRecords — populates sample data

## Running the Application

| URL | Description |
|---|---|
| http://localhost:3000/band-finder.html | Main application |
| http://localhost:3000/ | Exercise 3 home page |

## Admin Access

Log in through the standard login form using the admin credentials.
The admin dashboard shows statistics, pending reviews, and user management.

## Project Structure

```
team62/
├── documentation/
│   └── README.md
└── software/
    └── webproject/
        ├── app.js                  # Express server + all REST endpoints
        ├── database.js             # DB schema initialization
        ├── databaseInsert.js       # Sample data insertion
        ├── databaseQueriesBands.js # Band CRUD operations
        ├── databaseQueriesUsers.js # User CRUD operations
        ├── resources.js            # Sample data definitions
        ├── helpers/
        │   └── distanceHelper.js   # Event sorting by distance
        ├── public/
        │   ├── band-finder.html    # Main application page
        │   ├── index.html          # Exercise 3 page
        │   ├── css/
        │   └── js/
        ├── .env.example            # Environment variable template
        └── package.json
```

## REST API Overview

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/register/user` | Register a new user |
| POST | `/api/register/band` | Register a new band |
| POST | `/api/login` | Login (user, band, or admin) |
| POST | `/api/logout` | Logout |
| GET | `/api/profile` | Get logged-in user/band profile |
| PUT | `/api/profile` | Update profile |
| GET | `/api/events/nearby` | Get public events sorted by distance |
| POST | `/api/request-event` | User requests a private event |
| PUT | `/api/update-event-status/:id` | Band accepts/rejects, user marks done |
| POST | `/api/create-public-event` | Band creates a public event |
| GET | `/api/band-events` | Get band's own public events |
| POST | `/review/` | Submit a review |
| GET | `/reviews/:band_name` | Get published reviews |
| GET | `/api/maps-config` | Serves Maps API key to frontend |
