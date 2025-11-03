# Satellite Tracker Web App

A browser-based single-page web application that tracks satellites in real-time using TLE (Two-Line Element) data.

## Features

- Input TLE data for any satellite
- Real-time position calculation
- Look angles (azimuth and elevation)
- Satellite range/distance
- Right Ascension and Declination
- Geodetic coordinates
- Multiple location options:
  - Default location (Mt Abu Observatory Gurushikhar)
  - Browser geolocation
  - Manual coordinates
- Live position updates
- Pause/resume tracking
- Responsive design
- No server required - runs entirely in the browser

## Technologies Used

- HTML5
- CSS3
- JavaScript (ES6+)
- satellite.js library (loaded via CDN)

## Installation and Usage

1. Clone the repository:
```bash
git clone <repository-url>
cd satellite-tracker
```

2. Simply open `index.html` in your web browser - no server needed!

Alternatively, you can serve it using any local web server:
```bash
# Using Python 3
python -m http.server 8000

# Using Node.js with http-server
npx http-server

# Or using any other static server
```

Then open your browser and go to the appropriate URL (e.g., `http://localhost:8000`).

## How to Use

1. Enter TLE data in the input field (Two lines starting with "1 " and "2 ")
2. Select your observation location (default, browser location, or manual coordinates)
3. Click "Track Satellite"
4. View real-time satellite position data
5. Use pause/resume button to control live updates
6. Use "Back to Input" or "Track New Satellite" buttons to return to the input form

## TLE Format

TLE (Two-Line Element) sets describe the orbital elements of satellites:

```
Line 1: 1 NSSSSECCYYDDD.DDDDDDDD +/-DDDDDDDD +/-DDD.DDDDDD N EEEE
Line 2: 2 NSSSS IIII.IIII RRRR.RRRR RRRRRRR FFF.FFFF GGG.GGGG HHHHH.HHHHHHHH
```

Where:
- NSSSS - Satellite number
- E - Classification (U=Unclassified)
- CCYYDDD - International Designator (Century, Year, Day of year)
- DDDDDDDDDD - Element number and revolution number
- IIII.IIII - Inclination (degrees)
- RRRR.RRRR - Right ascension of the ascending node (degrees)
- RRRRRRR - Eccentricity (leading zero and decimal point not included)
- FFF.FFFF - Argument of perigee (degrees)
- GGG.GGGG - Mean anomaly (degrees)
- HHHHH.HHHHHHHH - Mean motion (revolutions per day)

## Project Structure

```
satellite-tracker/
├── index.html          # Single-page application
├── app.js              # Main application logic (browser-based)
├── style.css           # Styling
├── package.json        # Project configuration
└── README.md           # This file
```

## How It Works

The application runs entirely in the browser:
- All satellite calculations are performed client-side using the satellite.js library
- No server communication is required after initial page load
- All TLE parsing, propagation, and coordinate transformations happen in the browser
- Real-time updates are handled via browser JavaScript timers

## Future Enhancements

- Satellite catalog integration (Celestrak API)
- Sky chart visualization
- 3D Earth visualization
- Sun/moon position calculation
- Satellite pass predictions
- Data export functionality
- Web Worker implementation for heavy calculations

## License

This project is licensed under the ISC License.