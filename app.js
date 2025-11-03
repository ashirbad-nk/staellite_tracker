// Satellite service functions for browser use
const DEFAULT_LOCATION = {
  name: "Mt Abu Observatory Gurushikhar",
  latitude: 24.625,  // degrees
  longitude: 72.715, // degrees
  height: 1.68       // km above sea level
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
 * Calculates satellite position based on TLE data and observer location
 */
function calculateSatellitePosition(tleLine1, tleLine2, observerLocation) {
  try {
    // Initialize satellite record using TLE
    const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
    
    // Check for errors in satellite record
    if (satrec.error) {
      throw new Error(`Satellite propagation error: ${getSatelliteError(satrec.error)}`);
    }
    
    // Propagate satellite position to current time
    const positionAndVelocity = satellite.propagate(satrec, new Date());
    
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
    const gmst = satellite.gstime(new Date());
    
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

// Main application logic
document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const tleInput = document.getElementById('tle-input');
  const tleError = document.getElementById('tle-error');
  const submitBtn = document.getElementById('submit-btn');
  const loading = document.getElementById('loading');
  const resultsContainer = document.getElementById('results-container');

  // Location buttons
  const useDefaultLocationBtn = document.getElementById('use-default-location');
  const useBrowserLocationBtn = document.getElementById('use-browser-location');
  const useManualLocationBtn = document.getElementById('use-manual-location');
  const locationError = document.getElementById('location-error');
  const latitudeInput = document.getElementById('latitude');
  const longitudeInput = document.getElementById('longitude');
  const altitudeInput = document.getElementById('altitude');

  // Current observer location (default)
  let currentObserverLocation = { ...DEFAULT_LOCATION };

  // Event listeners for location selection
  useDefaultLocationBtn.addEventListener('click', () => {
      currentObserverLocation = { ...DEFAULT_LOCATION };
      showSuccess('Default location selected: ' + DEFAULT_LOCATION.name);
  });

  useBrowserLocationBtn.addEventListener('click', () => {
      if (navigator.geolocation) {
          loading.style.display = 'block';
          navigator.geolocation.getCurrentPosition(
              (position) => {
                  currentObserverLocation = {
                      latitude: position.coords.latitude,
                      longitude: position.coords.longitude,
                      height: position.coords.altitude ? position.coords.altitude / 1000 : 0.07 // Convert to km
                  };
                  loading.style.display = 'none';
                  showSuccess(`Browser location set: ${position.coords.latitude.toFixed(4)}°N, ${position.coords.longitude.toFixed(4)}°E`);
              },
              (error) => {
                  loading.style.display = 'none';
                  showLocationError(`Geolocation error: ${error.message}`);
              }
          );
      } else {
          showLocationError('Geolocation is not supported by this browser.');
      }
  });

  useManualLocationBtn.addEventListener('click', () => {
      const lat = parseFloat(latitudeInput.value);
      const lon = parseFloat(longitudeInput.value);
      const alt = parseFloat(altitudeInput.value);

      if (isNaN(lat) || isNaN(lon) || isNaN(alt)) {
          showLocationError('Please enter valid coordinates (latitude, longitude, altitude)');
          return;
      }

      if (lat < -90 || lat > 90) {
          showLocationError('Latitude must be between -90 and 90 degrees');
          return;
      }

      if (lon < -180 || lon > 180) {
          showLocationError('Longitude must be between -180 and 180 degrees');
          return;
      }

      currentObserverLocation = {
          latitude: lat,
          longitude: lon,
          height: alt
      };

      showSuccess(`Manual coordinates set: ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E, ${alt.toFixed(2)}km altitude`);
  });

  // Main submit button event listener
  submitBtn.addEventListener('click', async () => {
      const tleText = tleInput.value.trim();
      
      if (!tleText) {
          showError('Please enter TLE data');
          return;
      }

      // Split TLE text into two lines
      const lines = tleText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      if (lines.length < 2) {
          showError('TLE must contain exactly two lines');
          return;
      }

      let tleLine1, tleLine2;
      
      // Determine which lines are the TLE lines
      // If first line contains "1 ", it's the first line of TLE
      if (lines[0].startsWith('1 ')) {
          tleLine1 = lines[0];
          tleLine2 = lines[1];
      } else if (lines.length >= 3 && lines[1].startsWith('1 ') && lines[2].startsWith('2 ')) {
          // In case the satellite name is on first line
          tleLine1 = lines[1];
          tleLine2 = lines[2];
      } else if (lines.length >= 2 && lines[1].startsWith('2 ')) {
          // If the second line starts with '2 ', use previous line as '1 '
          tleLine1 = lines[0];
          tleLine2 = lines[1];
      } else {
          showError('Invalid TLE format. TLE lines must start with "1 " and "2 "');
          return;
      }

      // Validate TLE format
      if (!validateTLE(tleLine1, tleLine2)) {
          showError('Invalid TLE format. Please check the TLE data.');
          return;
      }

      // Show loading indicator
      loading.style.display = 'block';
      tleError.textContent = '';

      try {
          // Calculate satellite position
          const result = await calculateSatellitePosition(tleLine1, tleLine2, currentObserverLocation);
          
          // Hide loading indicator
          loading.style.display = 'none';
          
          // Display results
          displayResults(result, tleLine1, tleLine2);
      } catch (error) {
          loading.style.display = 'none';
          showError(`Error calculating satellite position: ${error.message}`);
          console.error('Satellite calculation error:', error);
      }
  });

  // Function to display results
  function displayResults(position, tleLine1, tleLine2) {
      // Extract satellite name from TLE line 1 (characters 9-32, removing leading/trailing spaces)
      const satelliteName = tleLine1.substring(9, 32).trim() || 'Satellite';

      // Create results HTML
      const resultsHTML = `
          <div class="results-section" style="background: #fff; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0, 0, 0, 0.1); margin: 20px auto; max-width: 1000px;">
              <header style="text-align: center; margin-bottom: 20px;">
                  <h2>${satelliteName}</h2>
                  <p>Real-time Position Data</p>
              </header>
              
              <div class="results-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                  <div class="result-card" style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #3498db;">
                      <h3>Look Angles</h3>
                      <p><strong>Azimuth:</strong> ${position.azimuth.toFixed(2)}°</p>
                      <p><strong>Elevation:</strong> ${position.elevation.toFixed(2)}°</p>
                  </div>
                  
                  <div class="result-card" style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #2ecc71;">
                      <h3>Distance</h3>
                      <p><strong>Range:</strong> ${position.range.toFixed(2)} km</p>
                  </div>
                  
                  <div class="result-card" style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #9b59b6;">
                      <h3>Coordinates</h3>
                      <p><strong>RA:</strong> ${position.rightAscension.toFixed(2)}°</p>
                      <p><strong>DEC:</strong> ${position.declination.toFixed(2)}°</p>
                  </div>
              </div>
              
              <div class="geodetic-coords" style="margin-top: 20px; background: #f8f9fa; padding: 20px; border-radius: 8px;">
                  <h3>Satellite Geodetic Coordinates</h3>
                  <p><strong>Latitude:</strong> ${(position.positionGeodetic.latitude * 180 / Math.PI).toFixed(4)}°</p>
                  <p><strong>Longitude:</strong> ${(position.positionGeodetic.longitude * 180 / Math.PI).toFixed(4)}°</p>
                  <p><strong>Height:</strong> ${position.positionGeodetic.height.toFixed(2)} km</p>
              </div>
              
              <div class="observer-info" style="margin-top: 20px; background: #e8f4fd; padding: 15px; border-radius: 8px;">
                  <h3>Observer Location</h3>
                  <p><strong>Coordinates:</strong> ${currentObserverLocation.latitude.toFixed(4)}°N, ${currentObserverLocation.longitude.toFixed(4)}°E</p>
                  <p><strong>Altitude:</strong> ${currentObserverLocation.height.toFixed(2)} km</p>
              </div>
              
              <div class="live-update-controls" style="margin-top: 20px; text-align: center;">
                  <button id="toggle-live-update" style="background: #e74c3c; padding: 10px 20px; border: none; border-radius: 5px; color: white; cursor: pointer;">Pause Live Updates</button>
                  <p id="last-update-time" style="margin-top: 10px; color: #7f8c8d;">Last update: ${new Date().toLocaleTimeString()}</p>
              </div>
              
              <div class="tle-display" style="margin-top: 20px; background: #f1f2f6; padding: 15px; border-radius: 8px; font-family: monospace;">
                  <h3>TLE Data</h3>
                  <p>${tleLine1}</p>
                  <p>${tleLine2}</p>
              </div>
              
              <div style="margin-top: 20px; text-align: center;">
                  <button id="back-to-input" style="background: #95a5a6; padding: 10px 20px; border: none; border-radius: 5px; color: white; cursor: pointer; margin-right: 10px;">Back to Input</button>
                  <button id="new-satellite" style="background: #3498db; padding: 10px 20px; border: none; border-radius: 5px; color: white; cursor: pointer;">Track New Satellite</button>
              </div>
          </div>
      `;
      
      // Insert results into the container
      resultsContainer.innerHTML = resultsHTML;
      
      // Add event listener for live update toggle
      const toggleBtn = document.getElementById('toggle-live-update');
      const lastUpdateTime = document.getElementById('last-update-time');
      const backToInputBtn = document.getElementById('back-to-input');
      const newSatelliteBtn = document.getElementById('new-satellite');
      
      let liveUpdateInterval;
      let isLiveUpdating = true;
      
      // Function to update positions
      const updatePosition = async () => {
          try {
              const result = await calculateSatellitePosition(tleLine1, tleLine2, currentObserverLocation);
              updateResultsDisplay(result);
              lastUpdateTime.textContent = `Last update: ${new Date().toLocaleTimeString()}`;
          } catch (error) {
              console.error('Error in live update:', error);
          }
      };
      
      // Function to update just the values in the display
      const updateResultsDisplay = (position) => {
          document.querySelector('.result-card:nth-child(1) p:nth-child(2)').innerHTML = `<strong>Azimuth:</strong> ${position.azimuth.toFixed(2)}°`;
          document.querySelector('.result-card:nth-child(1) p:nth-child(3)').innerHTML = `<strong>Elevation:</strong> ${position.elevation.toFixed(2)}°`;
          document.querySelector('.result-card:nth-child(2) p:nth-child(2)').innerHTML = `<strong>Range:</strong> ${position.range.toFixed(2)} km`;
          document.querySelector('.result-card:nth-child(3) p:nth-child(2)').innerHTML = `<strong>RA:</strong> ${position.rightAscension.toFixed(2)}°`;
          document.querySelector('.result-card:nth-child(3) p:nth-child(3)').innerHTML = `<strong>DEC:</strong> ${position.declination.toFixed(2)}°`;
          document.querySelector('.geodetic-coords p:nth-child(2)').innerHTML = `<strong>Latitude:</strong> ${(position.positionGeodetic.latitude * 180 / Math.PI).toFixed(4)}°`;
          document.querySelector('.geodetic-coords p:nth-child(3)').innerHTML = `<strong>Longitude:</strong> ${(position.positionGeodetic.longitude * 180 / Math.PI).toFixed(4)}°`;
          document.querySelector('.geodetic-coords p:nth-child(4)').innerHTML = `<strong>Height:</strong> ${position.positionGeodetic.height.toFixed(2)} km`;
      };
      
      // Start live updates
      liveUpdateInterval = setInterval(updatePosition, 2000); // Update every 2 seconds
      
      toggleBtn.addEventListener('click', () => {
          if (isLiveUpdating) {
              clearInterval(liveUpdateInterval);
              toggleBtn.textContent = 'Resume Live Updates';
              toggleBtn.style.background = '#3498db';
              isLiveUpdating = false;
          } else {
              liveUpdateInterval = setInterval(updatePosition, 2000);
              toggleBtn.textContent = 'Pause Live Updates';
              toggleBtn.style.background = '#e74c3c';
              isLiveUpdating = true;
              // Update immediately when resuming
              updatePosition();
          }
      });
      
      // Back to input button
      backToInputBtn.addEventListener('click', () => {
          clearInterval(liveUpdateInterval);
          resultsContainer.innerHTML = '';
      });
      
      // New satellite button (same as back but keeps the form visible)
      newSatelliteBtn.addEventListener('click', () => {
          clearInterval(liveUpdateInterval);
          resultsContainer.innerHTML = '';
      });
  }

  // Helper functions for displaying messages
  function showError(message) {
      tleError.textContent = message;
      tleError.className = 'error';
  }

  function showSuccess(message) {
      tleError.textContent = message;
      tleError.className = 'success';
  }

  function showLocationError(message) {
      locationError.textContent = message;
      locationError.className = 'error';
  }
});

// DOM elements
const tleInput = document.getElementById('tle-input');
const tleError = document.getElementById('tle-error');
const submitBtn = document.getElementById('submit-btn');
const loading = document.getElementById('loading');
const resultsContainer = document.getElementById('results-container');

// Location buttons
const useDefaultLocationBtn = document.getElementById('use-default-location');
const useBrowserLocationBtn = document.getElementById('use-browser-location');
const useManualLocationBtn = document.getElementById('use-manual-location');
const locationError = document.getElementById('location-error');
const latitudeInput = document.getElementById('latitude');
const longitudeInput = document.getElementById('longitude');
const altitudeInput = document.getElementById('altitude');

// Current observer location (default)
let currentObserverLocation = { ...DEFAULT_LOCATION };

// Event listeners for location selection
useDefaultLocationBtn.addEventListener('click', () => {
    currentObserverLocation = { ...DEFAULT_LOCATION };
    showSuccess('Default location selected: ' + DEFAULT_LOCATION.name);
});

useBrowserLocationBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
        loading.style.display = 'block';
        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentObserverLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    height: position.coords.altitude ? position.coords.altitude / 1000 : 0.07 // Convert to km
                };
                loading.style.display = 'none';
                showSuccess(`Browser location set: ${position.coords.latitude.toFixed(4)}°N, ${position.coords.longitude.toFixed(4)}°E`);
            },
            (error) => {
                loading.style.display = 'none';
                showLocationError(`Geolocation error: ${error.message}`);
            }
        );
    } else {
        showLocationError('Geolocation is not supported by this browser.');
    }
});

useManualLocationBtn.addEventListener('click', () => {
    const lat = parseFloat(latitudeInput.value);
    const lon = parseFloat(longitudeInput.value);
    const alt = parseFloat(altitudeInput.value);

    if (isNaN(lat) || isNaN(lon) || isNaN(alt)) {
        showLocationError('Please enter valid coordinates (latitude, longitude, altitude)');
        return;
    }

    if (lat < -90 || lat > 90) {
        showLocationError('Latitude must be between -90 and 90 degrees');
        return;
    }

    if (lon < -180 || lon > 180) {
        showLocationError('Longitude must be between -180 and 180 degrees');
        return;
    }

    currentObserverLocation = {
        latitude: lat,
        longitude: lon,
        height: alt
    };

    showSuccess(`Manual coordinates set: ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E, ${alt.toFixed(2)}km altitude`);
});

// Main submit button event listener
submitBtn.addEventListener('click', async () => {
    const tleText = tleInput.value.trim();
    
    if (!tleText) {
        showError('Please enter TLE data');
        return;
    }

    // Split TLE text into two lines
    const lines = tleText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length < 2) {
        showError('TLE must contain exactly two lines');
        return;
    }

    let tleLine1, tleLine2;
    
    // Determine which lines are the TLE lines
    // If first line contains "1 ", it's the first line of TLE
    if (lines[0].startsWith('1 ')) {
        tleLine1 = lines[0];
        tleLine2 = lines[1];
    } else if (lines.length >= 3 && lines[1].startsWith('1 ') && lines[2].startsWith('2 ')) {
        // In case the satellite name is on first line
        tleLine1 = lines[1];
        tleLine2 = lines[2];
    } else if (lines.length >= 2 && lines[1].startsWith('2 ')) {
        // If the second line starts with '2 ', use previous line as '1 '
        tleLine1 = lines[0];
        tleLine2 = lines[1];
    } else {
        showError('Invalid TLE format. TLE lines must start with "1 " and "2 "');
        return;
    }

    // Validate TLE format
    if (!validateTLE(tleLine1, tleLine2)) {
        showError('Invalid TLE format. Please check the TLE data.');
        return;
    }

    // Show loading indicator
    loading.style.display = 'block';
    tleError.textContent = '';

    try {
        // Calculate satellite position
        const result = await calculateSatellitePosition(tleLine1, tleLine2, currentObserverLocation);
        
        // Hide loading indicator
        loading.style.display = 'none';
        
        // Display results
        displayResults(result, tleLine1, tleLine2);
    } catch (error) {
        loading.style.display = 'none';
        showError(`Error calculating satellite position: ${error.message}`);
        console.error('Satellite calculation error:', error);
    }
});

// Function to display results
function displayResults(position, tleLine1, tleLine2) {
    // Extract satellite name from TLE line 1 (characters 9-32, removing leading/trailing spaces)
    const satelliteName = tleLine1.substring(9, 32).trim() || 'Satellite';

    // Create results HTML
    const resultsHTML = `
        <div class="results-section" style="background: #fff; padding: 30px; border-radius: 10px; box-shadow: 0 0 20px rgba(0, 0, 0, 0.1); margin: 20px auto; max-width: 1000px;">
            <header style="text-align: center; margin-bottom: 20px;">
                <h2>${satelliteName}</h2>
                <p>Real-time Position Data</p>
            </header>
            
            <div class="results-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                <div class="result-card" style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #3498db;">
                    <h3>Look Angles</h3>
                    <p><strong>Azimuth:</strong> ${position.azimuth.toFixed(2)}°</p>
                    <p><strong>Elevation:</strong> ${position.elevation.toFixed(2)}°</p>
                </div>
                
                <div class="result-card" style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #2ecc71;">
                    <h3>Distance</h3>
                    <p><strong>Range:</strong> ${position.range.toFixed(2)} km</p>
                </div>
                
                <div class="result-card" style="background: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #9b59b6;">
                    <h3>Coordinates</h3>
                    <p><strong>RA:</strong> ${position.rightAscension.toFixed(2)}°</p>
                    <p><strong>DEC:</strong> ${position.declination.toFixed(2)}°</p>
                </div>
            </div>
            
            <div class="geodetic-coords" style="margin-top: 20px; background: #f8f9fa; padding: 20px; border-radius: 8px;">
                <h3>Satellite Geodetic Coordinates</h3>
                <p><strong>Latitude:</strong> ${(position.positionGeodetic.latitude * 180 / Math.PI).toFixed(4)}°</p>
                <p><strong>Longitude:</strong> ${(position.positionGeodetic.longitude * 180 / Math.PI).toFixed(4)}°</p>
                <p><strong>Height:</strong> ${position.positionGeodetic.height.toFixed(2)} km</p>
            </div>
            
            <div class="observer-info" style="margin-top: 20px; background: #e8f4fd; padding: 15px; border-radius: 8px;">
                <h3>Observer Location</h3>
                <p><strong>Coordinates:</strong> ${currentObserverLocation.latitude.toFixed(4)}°N, ${currentObserverLocation.longitude.toFixed(4)}°E</p>
                <p><strong>Altitude:</strong> ${currentObserverLocation.height.toFixed(2)} km</p>
            </div>
            
            <div class="live-update-controls" style="margin-top: 20px; text-align: center;">
                <button id="toggle-live-update" style="background: #e74c3c; padding: 10px 20px; border: none; border-radius: 5px; color: white; cursor: pointer;">Pause Live Updates</button>
                <p id="last-update-time" style="margin-top: 10px; color: #7f8c8d;">Last update: ${new Date().toLocaleTimeString()}</p>
            </div>
            
            <div class="tle-display" style="margin-top: 20px; background: #f1f2f6; padding: 15px; border-radius: 8px; font-family: monospace;">
                <h3>TLE Data</h3>
                <p>${tleLine1}</p>
                <p>${tleLine2}</p>
            </div>
        </div>
    `;
    
    // Insert results into the container
    resultsContainer.innerHTML = resultsHTML;
    
    // Add event listener for live update toggle
    const toggleBtn = document.getElementById('toggle-live-update');
    const lastUpdateTime = document.getElementById('last-update-time');
    
    let liveUpdateInterval;
    let isLiveUpdating = true;
    
    // Function to update positions
    const updatePosition = async () => {
        try {
            const result = await calculateSatellitePosition(tleLine1, tleLine2, currentObserverLocation);
            updateResultsDisplay(result);
            lastUpdateTime.textContent = `Last update: ${new Date().toLocaleTimeString()}`;
        } catch (error) {
            console.error('Error in live update:', error);
        }
    };
    
    // Function to update just the values in the display
    const updateResultsDisplay = (position) => {
        document.querySelector('.result-card:nth-child(1) p:nth-child(2)').innerHTML = `<strong>Azimuth:</strong> ${position.azimuth.toFixed(2)}°`;
        document.querySelector('.result-card:nth-child(1) p:nth-child(3)').innerHTML = `<strong>Elevation:</strong> ${position.elevation.toFixed(2)}°`;
        document.querySelector('.result-card:nth-child(2) p:nth-child(2)').innerHTML = `<strong>Range:</strong> ${position.range.toFixed(2)} km`;
        document.querySelector('.result-card:nth-child(3) p:nth-child(2)').innerHTML = `<strong>RA:</strong> ${position.rightAscension.toFixed(2)}°`;
        document.querySelector('.result-card:nth-child(3) p:nth-child(3)').innerHTML = `<strong>DEC:</strong> ${position.declination.toFixed(2)}°`;
        document.querySelector('.geodetic-coords p:nth-child(2)').innerHTML = `<strong>Latitude:</strong> ${(position.positionGeodetic.latitude * 180 / Math.PI).toFixed(4)}°`;
        document.querySelector('.geodetic-coords p:nth-child(3)').innerHTML = `<strong>Longitude:</strong> ${(position.positionGeodetic.longitude * 180 / Math.PI).toFixed(4)}°`;
        document.querySelector('.geodetic-coords p:nth-child(4)').innerHTML = `<strong>Height:</strong> ${position.positionGeodetic.height.toFixed(2)} km`;
    };
    
    // Start live updates
    liveUpdateInterval = setInterval(updatePosition, 2000); // Update every 2 seconds
    
    toggleBtn.addEventListener('click', () => {
        if (isLiveUpdating) {
            clearInterval(liveUpdateInterval);
            toggleBtn.textContent = 'Resume Live Updates';
            toggleBtn.style.background = '#3498db';
            isLiveUpdating = false;
        } else {
            liveUpdateInterval = setInterval(updatePosition, 2000);
            toggleBtn.textContent = 'Pause Live Updates';
            toggleBtn.style.background = '#e74c3c';
            isLiveUpdating = true;
            // Update immediately when resuming
            updatePosition();
        }
    });
}

// Helper functions for displaying messages
function showError(message) {
    tleError.textContent = message;
    tleError.className = 'error';
}

function showSuccess(message) {
    tleError.textContent = message;
    tleError.className = 'success';
}

function showLocationError(message) {
    locationError.textContent = message;
    locationError.className = 'error';
}