# Satellite Tracker Web App

A browser-based single-page web application that tracks satellites in real-time using TLE (Two-Line Element) data.

## Features

- Input TLE data for any satellite
- Real-time position calculation
- Look angles (azimuth and elevation)
- Right Ascension and Declination
- Geodetic coordinates
- Custom UTC time selection (calculate positions for specific date/time)
- Multiple location options:
  - Default location (Mt Abu Observatory Gurushikhar)
  - Browser geolocation
  - Manual coordinates (latitude, longitude, altitude)
- Live position updates (automatically disabled when custom time is selected)
- Pause/resume tracking
- Compact card-based design
- Responsive design with three location cards side-by-side on larger screens
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
3. Optionally set a custom UTC date/time for specific position calculation
4. Click "Track Satellite"
5. View satellite position data (live updates automatically disabled when custom time is selected)
6. Use pause/resume button to control live updates (when not using custom time)
7. Use "Back to Input" button to return to the input form

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
├── README.md           # This file
├── logo.png            # Application logo
├── 3d_forward_dots.html # 3D starfield background implementation
└── prompts.txt         # Development prompts and notes
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
- Interactive 3D Earth visualization
- Sun/moon position calculation
- Satellite pass predictions
- Data export functionality
- Dark/light theme toggle
- Multiple satellite tracking simultaneously
- Improved orbital prediction algorithms

## License

This project is licensed under the ISC License.