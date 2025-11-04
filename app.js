// Satellite service functions for browser use
const DEFAULT_LOCATION = {
  name: "Mt Abu Observatory Gurushikhar",
  latitude: 24.625,  // degrees
  longitude: 72.715, // degrees
  height: 1.68       // km above sea level (1680m)
};

/**
 * Validates TLE format (2 lines, proper structure)
 */
function validateTLE(tleLine1, tleLine2) {
  // Check line lengths (TLE lines should be at least 68 characters, but typically exactly 69)
  // The last character might be omitted in some cases, so we'll be flexible
  if (tleLine1.length < 68 || tleLine2.length < 68) {
    return false;
  }

  // Check that lines start with correct identifiers
  if (!tleLine1.trim().startsWith('1 ') || !tleLine2.trim().startsWith('2 ')) {
    return false;
  }

  // Extract satellite numbers from both lines and verify they match
  const tle1Match = tleLine1.trim().match(/^1 (\d{4,5})/);
  const tle2Match = tleLine2.trim().match(/^2 (\d{4,5})/);
  
  if (!tle1Match || !tle2Match) {
    return false;
  }
  
  const satNum1 = tle1Match[1];
  const satNum2 = tle2Match[1];
  
  if (satNum1 !== satNum2) {
    return false;
  }

  // Additional basic checks for expected TLE format
  // After the satellite number, there should be a space and classification letter
  // Then there's the international designator, epoch, etc.
  // For practical purposes, we've done the most essential validations
  // The satellite.js library will catch any remaining formatting issues during propagation
  return true;
}

/**
 * Validates OMM format (JSON or KVN)
 */
function validateOMM(ommData) {
  try {
    // If it's a string, try to parse it as JSON first
    let ommObject;
    if (typeof ommData === 'string') {
      // Check if it looks like KVN format (contains key=value pairs)
      if (ommData.includes('=')) {
        // Try to parse as KVN format
        ommObject = parseOMMKVN(ommData);
      } else {
        // Try to parse as JSON
        ommObject = JSON.parse(ommData);
      }
    } else {
      ommObject = ommData;
    }
    
    // Validate required OMM fields
    const requiredFields = [
      'OBJECT_NAME',
      'NORAD_CAT_ID', 
      'EPOCH',
      'MEAN_MOTION',
      'ECCENTRICITY',
      'INCLINATION',
      'RA_OF_ASC_NODE',
      'ARG_OF_PERICENTER',
      'MEAN_ANOMALY'
    ];
    
    for (const field of requiredFields) {
      if (ommObject[field] === undefined) {
        return false;
      }
    }
    
    // Validate data types
    if (typeof ommObject.NORAD_CAT_ID !== 'number' && typeof ommObject.NORAD_CAT_ID !== 'string') {
      return false;
    }
    
    if (typeof ommObject.EPOCH !== 'string') {
      return false;
    }
    
    if (isNaN(parseFloat(ommObject.MEAN_MOTION)) || isNaN(parseFloat(ommObject.ECCENTRICITY)) ||
        isNaN(parseFloat(ommObject.INCLINATION)) || isNaN(parseFloat(ommObject.RA_OF_ASC_NODE)) ||
        isNaN(parseFloat(ommObject.ARG_OF_PERICENTER)) || isNaN(parseFloat(ommObject.MEAN_ANOMALY))) {
      return false;
    }
    
    return true;
  } catch (error) {
    // If parsing fails, it's not valid OMM
    console.error('Error validating OMM:', error);
    return false;
  }
}

/**
 * Parses OMM in KVN (Key-Value Notation) format to JSON object
 */
function parseOMMKVN(kvnString) {
  const lines = kvnString.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const ommObject = {};
  
  // Define which fields should be treated as numeric vs string
  const numericFields = new Set([
    'NORAD_CAT_ID', 'MEAN_MOTION', 'ECCENTRICITY', 'INCLINATION', 'RA_OF_ASC_NODE',
    'ARG_OF_PERICENTER', 'MEAN_ANOMALY', 'ELEMENT_SET_NO', 'REV_AT_EPOCH', 'BSTAR',
    'MEAN_MOTION_DOT', 'MEAN_MOTION_DDOT', 'EPHEMERIS_TYPE'
  ]);
  
  for (const line of lines) {
    // Look for key = value pattern, allowing for optional whitespace
    const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2].trim();
      
      // Try to convert to appropriate data type
      if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      } else if (value === 'null') {
        value = null;
      } else if (key === 'EPOCH') {
        // Special handling for EPOCH - keep as string but ensure it's in proper format
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
        // Validate that it's a proper date format
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          console.warn(`Invalid date format for EPOCH: ${value}`);
        }
      } else if (numericFields.has(key)) {
        // For known numeric fields, force conversion to number
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          value = numValue;
          // Special validation for certain fields
          if (key === 'ECCENTRICITY' && (numValue < 0 || numValue >= 1)) {
            console.warn(`ECCENTRICITY value seems invalid: ${numValue}`);
          }
        } else {
          // If parsing fails, keep as original string
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.substring(1, value.length - 1);
          }
        }
      } else if (!isNaN(value) && !isNaN(parseFloat(value))) {
        // For other fields, convert to number if it looks like a number
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          value = numValue;
          // Preserve decimal values properly - don't convert 2.0 to 2 if the original had decimals
          if (value.toString().includes('.') && Number.isInteger(value)) {
            // If it's mathematically an integer but was written as a decimal, keep as float
            value = parseFloat(value.toFixed(1)); // Keep one decimal place to preserve format
          } else if (Number.isInteger(value)) {
            value = parseInt(value, 10); // Convert actual integers to int
          }
        }
      } else {
        // Remove quotes if present for non-numeric values
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
      }
      
      ommObject[key] = value;
    }
  }
  
  return ommObject;
}

/**
 * Calculates satellite position based on TLE/OMM data and observer location
 */
function calculateSatellitePosition(data1, data2, observerLocation) {
  try {
    let satrec;
    
    // Check if first parameter is TLE format (starts with '1 ') or OMM format
    if (typeof data1 === 'string' && data1.trim().startsWith('1 ') && typeof data2 === 'string' && data2.trim().startsWith('2 ')) {
      // This is TLE format
      satrec = satellite.twoline2satrec(data1, data2);
      
      // Check for errors in satellite record
      if (satrec.error) {
        throw new Error(`Satellite propagation error: ${getSatelliteError(satrec.error)}`);
      }
    } else {
      // This might be OMM format - it could be a string in JSON or KVN format, or a JSON object
      let ommObject;
      
      if (typeof data1 === 'string') {
        // Check if it looks like KVN format (contains key=value pairs with at least one equals sign)
        if ((data1.match(/=/g) || []).length > 0) {
          // Parse as KVN format
          ommObject = parseOMMKVN(data1);
        } else {
          // Parse as JSON format
          ommObject = JSON.parse(data1);
        }
      } else {
        // It's already a JSON object
        ommObject = data1;
      }
      
      // Validate OMM data
      if (!validateOMM(ommObject)) {
        throw new Error('Invalid OMM format');
      }
      
      // Check if the json2satrec function exists
      if (typeof satellite.json2satrec === 'function') {
        // Initialize satellite record using OMM
        satrec = satellite.json2satrec(ommObject);
        
        // Check for errors in satellite record (after calling json2satrec)
        if (satrec && satrec.error) {
          throw new Error(`Satellite propagation error from OMM: ${getSatelliteError(satrec.error)}`);
        }
      } else {
        throw new Error('OMM format is not supported in this version of satellite.js. Please upgrade to version 6.0.0 or higher.');
      }
      
      // Check for errors in satellite record
      if (satrec.error) {
        throw new Error(`Satellite propagation error: ${getSatelliteError(satrec.error)}`);
      }
    }
    
    // Propagate satellite position to selected time (current time or custom time)
    const targetDate = selectedCustomTime ? selectedCustomTime : new Date();
    const positionAndVelocity = satellite.propagate(satrec, targetDate);
    
    if (positionAndVelocity === null) {
      throw new Error('Propagation failed - null result returned');
    }
    
    // In addition to checking for null, let's also verify that the values are valid
    const pos = positionAndVelocity.position;
    if (!pos || isNaN(pos.x) || isNaN(pos.y) || isNaN(pos.z)) {
      throw new Error('Propagation failed - invalid position returned');
    }
    
    // Get position in ECI (Earth Centered Inertial) coordinates
    const positionEci = positionAndVelocity.position;
    
    // Calculate GMST (Greenwich Mean Sidereal Time)
    const gmst = satellite.gstime(targetDate);  // Use targetDate instead of current date for accuracy
    
    // Convert ECI to ECF (Earth Centered Fixed) coordinates
    const positionEcf = satellite.eciToEcf(positionEci, gmst);
    
    // Convert ECI to Geodetic coordinates (latitude, longitude, height)
    const positionGeodetic = satellite.eciToGeodetic(positionEci, gmst);
    
    // Calculate look angles from the observer's location
    const observer = {
      latitude: observerLocation.latitude * Math.PI / 180,
      longitude: observerLocation.longitude * Math.PI / 180,
      height: observerLocation.height
    };
    
    const lookAngles = satellite.ecfToLookAngles(observer, positionEcf);
    
    // Convert radians to degrees for display
    const azimuth = lookAngles.azimuth * 180 / Math.PI;
    const elevation = lookAngles.elevation * 180 / Math.PI;
    const range = lookAngles.rangeSat; // in km
    
    // Calculate Right Ascension and Declination (RA/DEC)
    // RA should be in range [0, 360), so we normalize if negative
    let rightAscension = Math.atan2(positionEci.y, positionEci.x) * 180 / Math.PI;
    if (rightAscension < 0) {
      rightAscension += 360;
    }
    const declination = Math.asin(positionEci.z / Math.sqrt(positionEci.x * positionEci.x + positionEci.y * positionEci.y + positionEci.z * positionEci.z)) * 180 / Math.PI;
    
    return {
      azimuth: azimuth,
      elevation: elevation,
      range: range,
      rightAscension: rightAscension,
      declination: declination,
      positionGeodetic: positionGeodetic,
      positionEcf: positionEcf
    };
    
  } catch (error) {
    console.error('Error in calculateSatellitePosition:', error);
    throw error;
  }
}

/**
 * Helper function to get human-readable error messages from satellite error codes
 */
function getSatelliteError(errorCode) {
  switch (errorCode) {
    case 1:
      return 'Mean elements, ecc >= 1.0 or ecc < -0.001 or a < 0.95 er';
    case 2:
      return 'Mean motion less than 0.0';
    case 3:
      return 'Pert elements, ecc < 0.0 or ecc > 1.0';
    case 4:
      return 'Semi-latus rectum < 0.0';
    case 5:
      return 'Epoch elements are sub-orbital';
    case 6:
      return 'Satellite has decayed';
    default:
      return `Unknown error code: ${errorCode}`;
  }
}

// 3D forward motion space dots background
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('spaceCanvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        ctx.scale(dpr, dpr);
    }
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Dot class with 3D positioning
    class Dot {
        constructor() {
            this.reset();
        }
        
        reset() {
            const initial_z = 1000;
            const p = 2000 / (initial_z + 2000);

            const screenX = Math.random() * canvas.width;
            const screenY = Math.random() * canvas.height;

            this.x = (screenX - canvas.width / 2) / p + canvas.width / 2;
            this.y = (screenY - canvas.height / 2) / p + canvas.height / 2;
            this.z = initial_z;
            
            // Movement speed toward viewer
            this.speed = 8 + Math.random() * 7;
            
            // Size and opacity based on distance
            this.size = 0.5 + Math.random() * 1.5;
            this.opacity = 0.3 + Math.random() * 0.7;
            
            // Color
            const colors = [
                '#ffffff', // White
                '#ccccff', // Blue-ish
                '#ffcaca', // Red-ish
                '#caffca', // Green-ish
                '#ffffcc'  // Yellow-ish
            ];
            this.color = colors[Math.floor(Math.random() * colors.length)];
        }
        
        update() {
            // Move toward viewer (decrease z)
            this.z -= this.speed;
            
            // Reset when dot passes the viewer
            if (this.z <= 0) {
                this.reset();
            }
        }
        
        draw() {
            // Calculate screen position with perspective
            const perspective = 2000 / (this.z + 2000);
            const screenX = (this.x - canvas.width/2) * perspective + canvas.width/2;
            const screenY = (this.y - canvas.height/2) * perspective + canvas.height/2;
            
            // Draw simple dot
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.opacity;
            ctx.fillRect(screenX - this.size / 2, screenY - this.size / 2, this.size, this.size);
            ctx.globalAlpha = 1.0;
        }
    }
    
    // Create dots with reduced density for better performance
    const dots = [];
    const dotCount = 400;
    
    for (let i = 0; i < dotCount; i++) {
        dots.push(new Dot());
    }
    
    // Animation loop optimized for performance
    let lastTime = 0;
    const targetFPS = 60;
    const frameDuration = 1000 / targetFPS;
    
    function animate(currentTime) {
        // Throttle frame rate for better performance
        if (currentTime - lastTime < frameDuration) {
            requestAnimationFrame(animate);
            return;
        }
        lastTime = currentTime;
        
        // Clear canvas completely with black (removes any residual outline)
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Update and draw dots
        for (let i = 0; i < dots.length; i++) {
            dots[i].update();
            dots[i].draw();
        }
        
        requestAnimationFrame(animate);
    }
    
    // Start animation
    animate(0);
});

// Main application logic
// Global variable for custom time
let selectedCustomTime = null;

document.addEventListener('DOMContentLoaded', function() {
  // Set up favicon
  const favicon = document.createElement('link');
  favicon.rel = 'icon';
  favicon.type = 'image/x-icon';
  favicon.href = 'logo.png';
  document.head.appendChild(favicon);
  
  // DOM elements
  const tleInput = document.getElementById('tle-input');

  const submitBtn = document.getElementById('submit-btn');
  const loading = document.getElementById('loading');
  const resultsContainer = document.getElementById('results-container');
  const locationLoading = document.getElementById('location-loading');
  const currentLocationInfo = document.getElementById('current-location-info');
  const selectedLocationDisplay = document.getElementById('selected-location-display');

  // Location buttons
  const useDefaultLocationBtn = document.getElementById('use-default-location');
  const useBrowserLocationBtn = document.getElementById('use-browser-location');
  const useManualLocationBtn = document.getElementById('use-manual-location');
  const useCustomTimeBtn = document.getElementById('use-custom-time');
  const resetToCurrentTimeBtn = document.getElementById('reset-to-current-time');
  const customDateInput = document.getElementById('custom-date');
  const customTimeInput = document.getElementById('custom-time');
  const latitudeInput = document.getElementById('latitude');
  const longitudeInput = document.getElementById('longitude');
  const altitudeInput = document.getElementById('altitude');

  // Current observer location (default)
  let currentObserverLocation = { ...DEFAULT_LOCATION };
  
  // Update current location display
  function updateLocationDisplay() {
    selectedLocationDisplay.textContent = `${currentObserverLocation.name || 'Custom Location'} (${currentObserverLocation.latitude.toFixed(4)}°N, ${currentObserverLocation.longitude.toFixed(4)}°E, ${Math.round(currentObserverLocation.height * 1000)}m)`;
  }
  
  // Initialize display
  updateLocationDisplay();

  // Event listeners for location selection
  useDefaultLocationBtn.addEventListener('click', () => {
      currentObserverLocation = { ...DEFAULT_LOCATION };
      updateLocationDisplay();
      showSuccess('Default location selected: ' + DEFAULT_LOCATION.name);
      // Reset back to location display after 2 seconds
      setTimeout(() => {
          resetLocationInfo();
      }, 2000);
  });

  useBrowserLocationBtn.addEventListener('click', () => {
      if (navigator.geolocation) {
          // Show loading indicator and disable other buttons during location fetch
          locationLoading.classList.add('show');
          useDefaultLocationBtn.disabled = true;
          useBrowserLocationBtn.disabled = true;
          
          navigator.geolocation.getCurrentPosition(
              (position) => {
                  currentObserverLocation = {
                      name: "Browser Location",
                      latitude: position.coords.latitude,
                      longitude: position.coords.longitude,
                      height: position.coords.altitude ? position.coords.altitude / 1000 : 0.07 // Convert meters to km
                  };
                  locationLoading.classList.remove('show');
                  useDefaultLocationBtn.disabled = false;
                  useBrowserLocationBtn.disabled = false;
                  updateLocationDisplay();
                  showSuccess(`Browser location set: ${position.coords.latitude.toFixed(4)}°N, ${position.coords.longitude.toFixed(4)}°E`);
                  // Reset back to location display after 2 seconds
                  setTimeout(() => {
                      resetLocationInfo();
                  }, 2000);
              },
              (error) => {
                  locationLoading.classList.remove('show');
                  useDefaultLocationBtn.disabled = false;
                  useBrowserLocationBtn.disabled = false;
                  showLocationError(`Geolocation error: ${error.message}`);
                  // Reset back to location display after 3 seconds
                  setTimeout(() => {
                      resetLocationInfo();
                  }, 3000);
              }
          );
      } else {
          locationLoading.classList.remove('show');
          showLocationError('Geolocation is not supported by this browser.');
          // Reset back to location display after 3 seconds
          setTimeout(() => {
              resetLocationInfo();
          }, 3000);
      }
  });

  // Manual location functionality
  useManualLocationBtn.addEventListener('click', () => {
      const lat = parseFloat(latitudeInput.value);
      const lon = parseFloat(longitudeInput.value);
      const alt = parseFloat(altitudeInput.value) / 1000; // Convert meters to km

      // Validate inputs
      if (isNaN(lat) || isNaN(lon) || isNaN(alt)) {
          showLocationError('Please enter valid coordinates (latitude, longitude, altitude in meters)');
          // Reset back to location display after 3 seconds
          setTimeout(() => {
              resetLocationInfo();
          }, 3000);
          return;
      }

      if (lat < -90 || lat > 90) {
          showLocationError('Latitude must be between -90 and 90 degrees');
          // Reset back to location display after 3 seconds
          setTimeout(() => {
              resetLocationInfo();
          }, 3000);
          return;
      }

      if (lon < -180 || lon > 180) {
          showLocationError('Longitude must be between -180 and 180 degrees');
          // Reset back to location display after 3 seconds
          setTimeout(() => {
              resetLocationInfo();
          }, 3000);
          return;
      }

      currentObserverLocation = {
          name: "Manual Coordinates",
          latitude: lat,
          longitude: lon,
          height: alt
      };

      updateLocationDisplay();
      showSuccess(`Manual coordinates set: ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E, ${Math.round(alt * 1000)}m altitude`);
      // Reset back to location display after 2 seconds
      setTimeout(() => {
          resetLocationInfo();
      }, 2000);
  });

  // Set initial date and time values
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  const timeStr = now.toTimeString().substring(0, 5); // HH:MM format
  
  customDateInput.value = dateStr;
  customTimeInput.value = timeStr;

  // Custom time functionality
  useCustomTimeBtn.addEventListener('click', () => {
      const customDate = customDateInput.value;
      const customTime = customTimeInput.value;
      
      if (!customDate || !customTime) {
          showLocationError('Please select both date and time');
          // Reset back to location display after 3 seconds
          setTimeout(() => {
              resetLocationInfo();
          }, 3000);
          return;
      }
      
      // Create date in UTC
      const fullDateTime = `${customDate}T${customTime}Z`;
      const customDateTime = new Date(fullDateTime);
      
      // Check if date is valid
      if (isNaN(customDateTime.getTime())) {
          showLocationError('Invalid date or time format');
          // Reset back to location display after 3 seconds
          setTimeout(() => {
              resetLocationInfo();
          }, 3000);
          return;
      }
      
      selectedCustomTime = customDateTime;
      showSuccess(`Custom time set: ${customDateTime.toUTCString()}`);
      // Reset back to location display after 2 seconds
      setTimeout(() => {
          resetLocationInfo();
      }, 2000);
  });
  
  // Reset to current time functionality
  resetToCurrentTimeBtn.addEventListener('click', () => {
      selectedCustomTime = null;
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = now.toTimeString().substring(0, 5);
      
      customDateInput.value = dateStr;
      customTimeInput.value = timeStr;
      
      showSuccess('Reset to current time');
      // Reset back to location display after 2 seconds
      setTimeout(() => {
          resetLocationInfo();
      }, 2000);
  });

  // Main submit button event listener
  submitBtn.addEventListener('click', async () => {
      const inputText = tleInput.value.trim();
      
      if (!inputText) {
          showError('Please enter TLE or OMM data');
          return;
      }

      let data1, data2;
      let isTLE = false;
      let isOMM = false;
      
      // Check if input looks like TLE format (starts with '1 ' and contains '2 ')
      const lines = inputText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      if (lines.length >= 2 && lines[0].startsWith('1 ') && lines.some(line => line.startsWith('2 '))) {
          // This looks like TLE format
          isTLE = true;
          
          // Determine which lines are the TLE lines
          // If first line contains "1 ", it's the first line of TLE
          if (lines[0].startsWith('1 ')) {
              data1 = lines[0];
              data2 = lines[1];
          } else if (lines.length >= 3 && lines[1].startsWith('1 ') && lines[2].startsWith('2 ')) {
              // In case the satellite name is on first line
              data1 = lines[1];
              data2 = lines[2];
          } else if (lines.length >= 2 && lines[1].startsWith('2 ')) {
              // If the second line starts with '2 ', use previous line as '1 '
              data1 = lines[0];
              data2 = lines[1];
          } else {
              showError('Invalid TLE format. TLE lines must start with "1 " and "2 "');
              return;
          }

          // Validate TLE format
          if (!validateTLE(data1, data2)) {
              showError('Invalid TLE format. Please check the TLE data.');
              return;
          }
      } else if (inputText.includes('{') || inputText.includes('OBJECT_NAME')) {
          // This might be OMM format (either JSON or KVN)
          isOMM = true;
          
          // Check if json2satrec function is available before validating
          if (typeof satellite.json2satrec !== 'function') {
              showError('OMM format is not supported in this version of satellite.js. Please upgrade to version 6.0.0 or higher.');
              return;
          }
          
          // Validate OMM format
          let ommObjectForValidation;
          try {
              if (inputText.includes('=')) {
                  // It's KVN format, need to parse to validate
                  ommObjectForValidation = parseOMMKVN(inputText);
              } else {
                  // It's JSON format
                  ommObjectForValidation = JSON.parse(inputText);
              }
          } catch (e) {
              showError(`Invalid OMM format: ${e.message}`);
              return;
          }
          
          if (!validateOMM(ommObjectForValidation)) {
              showError('Invalid OMM format. Please check the OMM data and ensure required fields are present.');
              return;
          }
          
          data1 = inputText;  // For OMM, we pass the whole input as one parameter
          data2 = null;       // No second parameter needed for OMM
      } else {
          showError('Invalid format. Please enter either TLE (Two-Line Element) or OMM (Orbital Mean-Elements Message) data.');
          return;
      }

      // Show loading indicator
      loading.style.display = 'block';

      try {
          // Calculate satellite position
          const result = await calculateSatellitePosition(data1, data2, currentObserverLocation);
          
          // Hide loading indicator
          loading.style.display = 'none';
          // Make sure location info shows normal state before showing results
          resetLocationInfo();
          
          // Display results
          if (isTLE) {
              displayResults(result, data1, data2);
          } else if (isOMM) {
              // For OMM, we need to extract the object name for display
              let objectName = 'Satellite';
              try {
                  let ommObject;
                  if (inputText.includes('=')) {
                      // It's KVN format, parse it to get the name
                      ommObject = parseOMMKVN(inputText);
                  } else {
                      // It's JSON format
                      ommObject = JSON.parse(inputText);
                  }
                  objectName = ommObject.OBJECT_NAME || 'Satellite';
              } catch (e) {
                  // If parsing fails, keep default name
              }
              // Display OMM data - for display purposes, we'll format it appropriately
              displayResults(result, data1, objectName);  // data1 contains the full OMM data
          }
      } catch (error) {
          loading.style.display = 'none';
          showError(`Error calculating satellite position: ${error.message}`);
          // Reset location info after 3 seconds
          setTimeout(() => {
              resetLocationInfo();
          }, 3000);
          console.error('Satellite calculation error:', error);
      }
  });

  // Function to convert decimal degrees to hours/minutes/seconds for RA
  function raToHMS(ra) {
    // RA is in degrees, convert to hours (1 hour = 15 degrees)
    const totalHours = ra / 15.0;
    const hours = Math.floor(totalHours);
    const minutesDecimal = (totalHours - hours) * 60;
    const minutes = Math.floor(minutesDecimal);
    const seconds = (minutesDecimal - minutes) * 60;
    
    return {
      hours: hours % 24,
      minutes: minutes,
      seconds: seconds
    };
  }

  // Function to convert decimal degrees to degrees/minutes/seconds for DEC
  function decToDMS(dec) {
    const isNegative = dec < 0;
    const absDec = Math.abs(dec);
    const degrees = Math.floor(absDec);
    const minutesDecimal = (absDec - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    const seconds = (minutesDecimal - minutes) * 60;
    
    return {
      degrees: isNegative ? -degrees : degrees,
      minutes: minutes,
      seconds: seconds
    };
  }

  // Function to display results
  function displayResults(position, data1, data2) {
      // Determine if this is TLE or OMM format and extract satellite name accordingly
      let satelliteName = 'Satellite';
      let isTLE = false;
      let isOMM = false;
      let displayData = '';
      
      // Check if data1 is a TLE line (starts with '1 ')
      if (typeof data1 === 'string' && data1.startsWith('1 ') && typeof data2 === 'string' && data2.startsWith('2 ')) {
          isTLE = true;
          // Extract satellite name from TLE line 1 (characters 9-32, removing leading/trailing spaces)
          satelliteName = data1.substring(9, 32).trim() || 'Satellite';
          displayData = `<p>${data1}</p><p>${data2}</p>`;
      } else {
          // This is OMM format
          isOMM = true;
          try {
              let ommObject;
              if (typeof data1 === 'string') {
                  if (data1.includes('=')) {
                      // It's KVN format
                      ommObject = parseOMMKVN(data1);
                  } else {
                      // It's JSON format
                      ommObject = JSON.parse(data1);
                  }
              }
              satelliteName = (ommObject && ommObject.OBJECT_NAME) || 'Satellite';
              
              // Format the OMM data for display - if it's a long string, show a summary instead
              if (typeof data1 === 'string' && data1.length > 200) {
                  // For display purposes, just show that it's OMM data
                  displayData = `<p>OMM (Orbital Mean-Elements Message) - ${satelliteName}</p>`;
              } else {
                  displayData = `<p>${data1.substring(0, 200)}${data1.length > 200 ? '...' : ''}</p>`;
              }
          } catch (e) {
              // If parsing fails, use default name
              satelliteName = 'Satellite';
              displayData = `<p>${data1.substring(0, 100)}${data1.length > 100 ? '...' : ''}</p>`;
          }
      }

      // Convert RA and DEC to standard formats
      const raHMS = raToHMS(position.rightAscension);
      const decDMS = decToDMS(position.declination);
      
      // Format RA as hh:mm:ss
      const raFormatted = `${raHMS.hours.toString().padStart(2, '0')}h ${raHMS.minutes.toString().padStart(2, '0')}m ${raHMS.seconds.toFixed(2).padStart(5, '0')}s`;
      // Format DEC as deg:arcmin:arcsec
      const decFormatted = `${decDMS.degrees}° ${decDMS.minutes}' ${decDMS.seconds.toFixed(2)}"`;

      // Prepare variables for template based on current time settings
      const toggleButtonLabel = selectedCustomTime ? 'Live Updates Disabled' : 'Pause Live Updates';
      const updateTimeText = selectedCustomTime ? selectedCustomTime.toUTCString() : new Date().toUTCString();
      
      // Determine the header text for the data display section
      const dataTypeHeader = isTLE ? 'TLE Data' : 'OMM Data';
      
      // Create results HTML - this will replace the input form
      const resultsHTML = `
          <div class="results-section">
              <div class="results-header">
                  <h2>Satellite Tracker</h2>
                  <h2>${satelliteName}</h2>
                  <p>Real-time Position Data</p>
              </div>
              
              <div class="results-grid">
                  <div class="result-card">
                      <h3>Look Angles</h3>
                      <p><strong>Azimuth:</strong> ${position.azimuth.toFixed(2)}°</p>
                      <p><strong>Elevation:</strong> ${position.elevation.toFixed(2)}°</p>
                  </div>
                  
                  <div class="result-card">
                      <h3>Equatorial Coordinates</h3>
                      <p><strong>RA:</strong> ${raFormatted}</p>
                      <p><strong>DEC:</strong> ${decFormatted}</p>
                  </div>
              </div>
              
              <div class="coordinates-grid">
                  <div class="geodetic-coords result-card">
                      <h3>Satellite Geodetic Coordinates</h3>
                      <p><strong>Latitude:</strong> ${(position.positionGeodetic.latitude * 180 / Math.PI).toFixed(4)}°</p>
                      <p><strong>Longitude:</strong> ${(position.positionGeodetic.longitude * 180 / Math.PI).toFixed(4)}°</p>
                      <p><strong>Height:</strong> ${position.positionGeodetic.height.toFixed(2)} km</p>
                  </div>
                  
                  <div class="observer-info result-card">
                      <h3>Observer Location</h3>
                      <p><strong>Coordinates:</strong> ${currentObserverLocation.latitude.toFixed(4)}°N, ${currentObserverLocation.longitude.toFixed(4)}°E</p>
                      <p><strong>Altitude:</strong> ${Math.round(currentObserverLocation.height * 1000)}m</p>
                  </div>
              </div>
              
              <div class="live-update-controls">
                  <button id="toggle-live-update">${toggleButtonLabel}</button>
                  <p id="last-update-time">Position calculated for: ${updateTimeText}</p>
              </div>
              
              <div class="tle-display result-card">
                  <h3>${dataTypeHeader}</h3>
                  ${displayData}
              </div>
              
              <div style="margin-top: 20px; text-align: center;">
                    <button id="back-to-input">Back to Input</button>

                 
              </div>
          </div>
      `;
      
      // Replace the input section with results, hide the help section and main header
      const inputSection = document.getElementById('input-section');
      const helpSection = document.querySelector('.help-section');
      const appContainer = document.getElementById('app-container');
      const mainHeader = document.querySelector('header'); // The main page header with logo/title
      
      inputSection.style.display = 'none';
      if (helpSection) helpSection.style.display = 'none';
      if (mainHeader) mainHeader.style.display = 'none';
      if (appContainer) appContainer.style.display = 'none';
      
      // Insert results into the container
      resultsContainer.innerHTML = resultsHTML;
      
      // Add event listener for live update toggle
      const toggleBtn = document.getElementById('toggle-live-update');
      const lastUpdateTime = document.getElementById('last-update-time');
      const backToInputBtn = document.getElementById('back-to-input');
      
      let liveUpdateInterval;
      let isLiveUpdating = true;
      
      // Function to update positions
      const updatePosition = async () => {
          try {
              const result = await calculateSatellitePosition(data1, data2, currentObserverLocation);
              updateResultsDisplay(result);
              lastUpdateTime.textContent = `Position calculated for: ${new Date().toUTCString()}`;
          } catch (error) {
              console.error('Error in live update:', error);
          }
      };
      
      // Function to update just the values in the display
      const updateResultsDisplay = (position) => {
          // Update look angles
          document.querySelector('.result-card:nth-of-type(1) p:nth-of-type(1)').innerHTML = `<strong>Azimuth:</strong> ${position.azimuth.toFixed(2)}°`;
          document.querySelector('.result-card:nth-of-type(1) p:nth-of-type(2)').innerHTML = `<strong>Elevation:</strong> ${position.elevation.toFixed(2)}°`;
          
          // Update RA/DEC in standard format (with proper caching to prevent flickering)
          const raHMS = raToHMS(position.rightAscension);
          const decDMS = decToDMS(position.declination);
          const raFormatted = `${raHMS.hours.toString().padStart(2, '0')}h ${raHMS.minutes.toString().padStart(2, '0')}m ${raHMS.seconds.toFixed(2).padStart(5, '0')}s`;
          const decFormatted = `${decDMS.degrees}° ${decDMS.minutes}' ${decDMS.seconds.toFixed(2)}"`;
          
          // Now RA/DEC are in the 2nd card (since distance card was removed)
          document.querySelector('.result-card:nth-of-type(2) p:nth-of-type(1)').innerHTML = `<strong>RA:</strong> ${raFormatted}`;
          document.querySelector('.result-card:nth-of-type(2) p:nth-of-type(2)').innerHTML = `<strong>DEC:</strong> ${decFormatted}`;
          
          // Update geodetic coordinates
          document.querySelector('.geodetic-coords p:nth-of-type(1)').innerHTML = `<strong>Latitude:</strong> ${(position.positionGeodetic.latitude * 180 / Math.PI).toFixed(4)}°`;
          document.querySelector('.geodetic-coords p:nth-of-type(2)').innerHTML = `<strong>Longitude:</strong> ${(position.positionGeodetic.longitude * 180 / Math.PI).toFixed(4)}°`;
          document.querySelector('.geodetic-coords p:nth-of-type(3)').innerHTML = `<strong>Height:</strong> ${position.positionGeodetic.height.toFixed(2)} km`;
      };
      
      // Start live updates if no custom time is selected
      if (selectedCustomTime) {
          // Disable live updates when custom time is selected
          toggleBtn.disabled = true;
          toggleBtn.title = 'Live updates disabled when custom time is selected';
      } else {
          // Enable live updates and start interval
          liveUpdateInterval = setInterval(updatePosition, 2000); // Update every 2 seconds
      }
      
      toggleBtn.addEventListener('click', () => {
          if (isLiveUpdating) {
              clearInterval(liveUpdateInterval);
              toggleBtn.textContent = 'Resume Live Updates';
              isLiveUpdating = false;
          } else if (!selectedCustomTime) {
              liveUpdateInterval = setInterval(updatePosition, 2000);
              toggleBtn.textContent = 'Pause Live Updates';
              isLiveUpdating = true;
              // Update immediately when resuming
              updatePosition();
          }
      });
      
      // Back to input button - this will restore the input form
      backToInputBtn.addEventListener('click', () => {
          clearInterval(liveUpdateInterval);
          // Show the input section and help section again
          inputSection.style.display = 'block';
          if (helpSection) helpSection.style.display = 'block';
          const mainHeader = document.querySelector('header'); // The main page header with logo/title
          if (mainHeader) mainHeader.style.display = 'block';
          if (appContainer) appContainer.style.display = 'block';
          // Clear the results container
          resultsContainer.innerHTML = '';
      });
  }

  // Helper functions for displaying messages in location-info area
  function showError(message) {
      const selectedLocationDisplay = document.getElementById('selected-location-display');
      if (selectedLocationDisplay && selectedLocationDisplay.parentElement) {
          const locationInfo = selectedLocationDisplay.parentElement;
          locationInfo.innerHTML = message;
          locationInfo.style.color = 'var(--danger, #ff5555)';
          locationInfo.style.backgroundColor = 'rgba(255, 85, 85, 0.15)';
          locationInfo.style.border = '1px solid var(--danger, #ff5555)';
      } else {
          // Fallback: try to find the current-location-info div directly
          const locationInfo = document.getElementById('current-location-info');
          if (locationInfo) {
              locationInfo.innerHTML = message;
              locationInfo.style.color = 'var(--danger, #ff5555)';
              locationInfo.style.backgroundColor = 'rgba(255, 85, 85, 0.15)';
              locationInfo.style.border = '1px solid var(--danger, #ff5555)';
          }
      }
  }

  function showSuccess(message) {
      const selectedLocationDisplay = document.getElementById('selected-location-display');
      if (selectedLocationDisplay && selectedLocationDisplay.parentElement) {
          const locationInfo = selectedLocationDisplay.parentElement;
          locationInfo.innerHTML = message;
          locationInfo.style.color = 'var(--success, #50fa7b)';
          locationInfo.style.backgroundColor = 'rgba(80, 250, 123, 0.15)';
          locationInfo.style.border = '1px solid var(--success, #50fa7b)';
      } else {
          // Fallback: try to find the current-location-info div directly
          const locationInfo = document.getElementById('current-location-info');
          if (locationInfo) {
              locationInfo.innerHTML = message;
              locationInfo.style.color = 'var(--success, #50fa7b)';
              locationInfo.style.backgroundColor = 'rgba(80, 250, 123, 0.15)';
              locationInfo.style.border = '1px solid var(--success, #50fa7b)';
          }
      }
  }

  function showLocationError(message) {
      const selectedLocationDisplay = document.getElementById('selected-location-display');
      if (selectedLocationDisplay && selectedLocationDisplay.parentElement) {
          const locationInfo = selectedLocationDisplay.parentElement;
          locationInfo.innerHTML = message;
          locationInfo.style.color = 'var(--danger, #ff5555)';
          locationInfo.style.backgroundColor = 'rgba(255, 85, 85, 0.15)';
          locationInfo.style.border = '1px solid var(--danger, #ff5555)';
      } else {
          // Fallback: try to find the current-location-info div directly
          const locationInfo = document.getElementById('current-location-info');
          if (locationInfo) {
              locationInfo.innerHTML = message;
              locationInfo.style.color = 'var(--danger, #ff5555)';
              locationInfo.style.backgroundColor = 'rgba(255, 85, 85, 0.15)';
              locationInfo.style.border = '1px solid var(--danger, #ff5555)';
          }
      }
  }
  
  // Function to reset location info to normal state
  function resetLocationInfo() {
      const selectedLocationDisplay = document.getElementById('selected-location-display');
      if (selectedLocationDisplay && selectedLocationDisplay.parentElement) {
          const locationInfo = selectedLocationDisplay.parentElement;
          locationInfo.innerHTML = `Current location selected: <span id="selected-location-display">${currentObserverLocation.name || 'Custom Location'} (${currentObserverLocation.latitude.toFixed(4)}°N, ${currentObserverLocation.longitude.toFixed(4)}°E, ${Math.round(currentObserverLocation.height * 1000)}m)</span>`;
          locationInfo.style.color = '';
          locationInfo.style.backgroundColor = '';
          locationInfo.style.border = '1px solid var(--border, #44475a)';
      }
  }
  
  // Modal functionality
  const helpModal = document.getElementById('helpModal');
  const aboutAppModal = document.getElementById('aboutAppModal');
  const aboutMeModal = document.getElementById('aboutMeModal');
  
  const helpFormatsLink = document.getElementById('helpFormatsLink');
  const aboutAppLink = document.getElementById('aboutAppLink');
  const aboutMeLink = document.getElementById('aboutMeLink');
  
  const closeHelpModal = document.getElementById('closeHelpModal');
  const closeAboutAppModal = document.getElementById('closeAboutAppModal');
  const closeAboutMeModal = document.getElementById('closeAboutMeModal');
  
  const backFromHelpModal = document.getElementById('backFromHelpModal');
  const backFromAboutAppModal = document.getElementById('backFromAboutAppModal');
  const backFromAboutMeModal = document.getElementById('backFromAboutMeModal');
  
  // Open modals
  helpFormatsLink.addEventListener('click', (e) => {
      e.preventDefault();
      helpModal.style.display = 'block';
  });
  
  aboutAppLink.addEventListener('click', (e) => {
      e.preventDefault();
      aboutAppModal.style.display = 'block';
  });
  
  aboutMeLink.addEventListener('click', (e) => {
      e.preventDefault();
      aboutMeModal.style.display = 'block';
  });
  
  // Close modals with X button
  closeHelpModal.addEventListener('click', () => {
      helpModal.style.display = 'none';
  });
  
  closeAboutAppModal.addEventListener('click', () => {
      aboutAppModal.style.display = 'none';
  });
  
  closeAboutMeModal.addEventListener('click', () => {
      aboutMeModal.style.display = 'none';
  });
  
  // Close modals when clicking outside the modal content
  window.addEventListener('click', (e) => {
      if (e.target === helpModal) {
          helpModal.style.display = 'none';
      }
      if (e.target === aboutAppModal) {
          aboutAppModal.style.display = 'none';
      }
      if (e.target === aboutMeModal) {
          aboutMeModal.style.display = 'none';
      }
  });
  
  // Close modals with back buttons
  backFromHelpModal.addEventListener('click', () => {
      helpModal.style.display = 'none';
  });
  
  backFromAboutAppModal.addEventListener('click', () => {
      aboutAppModal.style.display = 'none';
  });
  
  backFromAboutMeModal.addEventListener('click', () => {
      aboutMeModal.style.display = 'none';
  });
});