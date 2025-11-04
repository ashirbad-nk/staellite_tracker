# Satellite Tracker Web App - To-Do List

## Project Setup & Dependencies
use: satellite.js: `npm install satellite.js`
use html, css , js.
do not use any frontend framework or tools like vite etc.

## Core Functionality Implementation
- [ ] Implement TLE parsing and validation:
  - [ ] Create function to validate TLE format (2 lines, proper structure)
  - [ ] Add error handling for invalid TLE inputs
  - [ ] Implement fallback to OMM format support

- [ ] Setup satellite propagation:
  - [ ] Create function using `satellite.twoline2satrec()` to initialize satellite record
  - [ ] Implement `satellite.propagate()` for real-time position calculation
  - [ ] Add error handling for propagation failures (check `satrec.error`)

- [ ] Implement coordinate transformations:
  - [ ] Calculate GMST using `satellite.gstime(new Date())`
  - [ ] Convert ECI to ECF coordinates using `satellite.eciToEcf()`
  - [ ] Convert ECI to Geodetic coordinates using `satellite.eciToGeodetic()`
  - [ ] Calculate look angles (azimuth, elevation) using `satellite.ecfToLookAngles()`

## User Interface - Landing Page
- [ ] Design and implement responsive landing page:
  - [ ] App title and description
  - [ ] TLE input textarea with placeholder examples
  - [ ] Location input section:
    - [ ] Default location: Mt Abu Observatory Gurushikhar (coordinates: 24.625°N, 72.715°E, ~1680m altitude)
    - [ ] Option to use browser geolocation
    - [ ] Manual coordinates input fallback
  - [ ] Submit button with loading state
  - [ ] Help section with TLE format explanation

## User Interface - Results Page
- [ ] Create results dashboard with live updates:
  - [ ] Satellite name display (extract from TLE)
  - [ ] Real-time position display:
    - [ ] Altitude (degrees)
    - [ ] Azimuth (degrees, compass direction)
    - [ ] Right Ascension (RA)
    - [ ] Declination (DEC)
  - [ ] Satellite distance/range display
  - [ ] Orbital parameters display (optional)
  - [ ] Sky map visualization (optional but recommended)

- [ ] Implement live update functionality:
  - [ ] Set up setInterval for position updates (every 1-5 seconds)
  - [ ] Add pause/resume toggle for live updates
  - [ ] Include timestamp of last update

## Advanced Features
- [ ] Add satellite catalog integration:
  - [ ] Implement Celestrak API integration for popular satellites
  - [ ] Add dropdown menu with common satellites (ISS, Hubble, Starlink, etc.)

- [ ] Add visualization components:
  - [ ] Sky chart showing satellite path
  - [ ] 3D Earth visualization with satellite position
  - [ ] Rise/set times prediction

- [ ] Add observational tools:
  - [ ] Calculate sun/moon position to determine visibility
  - [ ] Add day/night detection for better observation planning
  - [ ] Implement satellite pass predictions

- [ ] Add sharing and export features:
  - [ ] Generate shareable URLs with satellite parameters
  - [ ] Export position data to CSV/JSON
  - [ ] Screenshot functionality for sky charts

## Technical Implementation Details
- [ ] Create API service module for satellite calculations:
  ```javascript
  import { twoline2satrec, propagate, gstime, eciToEcf, ecfToLookAngles } from 'satellite.js';

  export function calculateSatellitePosition(tleLine1, tleLine2, observerLocation) {
    const satrec = twoline2satrec(tleLine1, tleLine2);
    const positionAndVelocity = propagate(satrec, new Date());
    
    if (positionAndVelocity === null) {
      throw new Error('Propagation failed: ' + getSatelliteError(satrec.error));
    }
    
    const gmst = gstime(new Date());
    const positionEci = positionAndVelocity.position;
    const positionEcf = eciToEcf(positionEci, gmst);
    const lookAngles = ecfToLookAngles(observerLocation, positionEcf);
    
    return {
      azimuth: lookAngles.azimuth,
      elevation: lookAngles.elevation,
      range: lookAngles.rangeSat,
      // Add RA/DEC calculations here
    };
  }
  ```

- [ ] Implement location service:
  ```javascript
  export const DEFAULT_LOCATION = {
    name: "Mt Abu Observatory Gurushikhar",
    latitude: 24.625,  // degrees
    longitude: 72.715, // degrees
    height: 1.68       // km above sea level
  };
  ```

- [ ] Create TLE validation utility:
  ```javascript
  export function validateTLE(tleLine1, tleLine2) {
    const tleLine1Regex = /^1\s+\d{5}[A-Z]\s+\d{2}\d{3}[A-Z]\s+\d{5}\.\d{8}\s+[\+\-]\d{6}\.\d{6}\s+[\+\-]\d{1}\d{5}\-\d\s+[\+\-]\d{1}\d{5}\-\d\s+\d\s+\d{4}$/;
    const tleLine2Regex = /^2\s+\d{5}\s+\d{3}\.\d{4}\s+\d{3}\.\d{4}\s+[\+\-]?\d{1}\.\d{4}\s+\d{3}\.\d{4}\s+\d{3}\.\d{4}\s+\d{2}\.\d{8}\s+\d{4}\d$/;
    
    return tleLine1Regex.test(tleLine1) && tleLine2Regex.test(tleLine2);
  }
  ```

## Testing & Quality Assurance
- [ ] Write unit tests for core functions
- [ ] Test TLE validation with various valid/invalid inputs
- [ ] Test coordinate transformations with known values
- [ ] Test edge cases (satellite below horizon, propagation errors)
- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsiveness testing

## Deployment & Documentation
- [ ] Create deployment pipeline (GitHub Pages, Netlify, Vercel)
- [ ] Write user documentation:
  - [ ] How to get TLE data
  - [ ] How to interpret results
  - [ ] FAQ section
- [ ] Add analytics for usage tracking (optional)
- [ ] Create GitHub repository with proper README.md

## Performance Optimization
- [ ] Implement Web Worker for heavy calculations to avoid UI blocking
- [ ] Add caching for satellite records to avoid re-initialization
- [ ] Optimize rendering for smooth live updates
- [ ] Implement lazy loading for visualization components

## Security Considerations
- [ ] Sanitize TLE inputs to prevent XSS attacks
- [ ] Validate all user inputs
- [ ] Implement proper CORS handling for external API calls
- [ ] Add rate limiting for API requests (if applicable)

## Future Enhancements (Post-MVP)
- [ ] Add user accounts for saving favorite satellites
- [ ] Implement push notifications for satellite passes
- [ ] Add augmented reality view using device camera
- [ ] Create mobile app version using PWA or React Native
- [ ] Add community features (share observations, satellite spotting reports)