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
          locationLoading.style.display = 'block';
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
                  locationLoading.style.display = 'none';
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
                  locationLoading.style.display = 'none';
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

      try {
          // Calculate satellite position
          const result = await calculateSatellitePosition(tleLine1, tleLine2, currentObserverLocation);
          
          // Hide loading indicator
          loading.style.display = 'none';
          // Make sure location info shows normal state before showing results
          resetLocationInfo();
          
          // Display results
          displayResults(result, tleLine1, tleLine2);
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
  function displayResults(position, tleLine1, tleLine2) {
      // Extract satellite name from TLE line 1 (characters 9-32, removing leading/trailing spaces)
      const satelliteName = tleLine1.substring(9, 32).trim() || 'Satellite';

      // Convert RA and DEC to standard formats
      const raHMS = raToHMS(position.rightAscension);
      const decDMS = decToDMS(position.declination);
      
      // Format RA as hh:mm:ss
      const raFormatted = `${raHMS.hours.toString().padStart(2, '0')}h ${raHMS.minutes.toString().padStart(2, '0')}m ${raHMS.seconds.toFixed(2).padStart(5, '0')}s`;
      // Format DEC as deg:arcmin:arcsec
      const decFormatted = `${decDMS.degrees}° ${decDMS.minutes}' ${decDMS.seconds.toFixed(2)}"`;

      // Create results HTML - this will replace the input form
      const resultsHTML = `
          <div class="results-section">
              <div class="results-header results-header-with-title">
                  <h1>Satellite Tracker</h1>
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
                      <h3>Distance</h3>
                      <p><strong>Range:</strong> ${position.range.toFixed(2)} km</p>
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
                  <button id="toggle-live-update">Pause Live Updates</button>
                  <p id="last-update-time">Last update: ${new Date().toLocaleTimeString()}</p>
              </div>
              
              <div class="tle-display result-card">
                  <h3>TLE Data</h3>
                  <p>${tleLine1}</p>
                  <p>${tleLine2}</p>
              </div>
              
              <div style="margin-top: 20px; text-align: center;">
                  <button id="back-to-input">Back to Input</button>
                  <button id="new-satellite">Track New Satellite</button>
              </div>
          </div>
      `;
      
      // Replace the input section with results, hide the help section and main header
      const inputSection = document.getElementById('input-section');
      const helpSection = document.querySelector('.help-section');
      const mainHeader = document.querySelector('header'); // The main page header with logo/title
      
      inputSection.style.display = 'none';
      if (helpSection) helpSection.style.display = 'none';
      if (mainHeader) mainHeader.style.display = 'none';
      
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
          // Update look angles
          document.querySelector('.result-card:nth-of-type(1) p:nth-of-type(1)').innerHTML = `<strong>Azimuth:</strong> ${position.azimuth.toFixed(2)}°`;
          document.querySelector('.result-card:nth-of-type(1) p:nth-of-type(2)').innerHTML = `<strong>Elevation:</strong> ${position.elevation.toFixed(2)}°`;
          
          // Update distance
          document.querySelector('.result-card:nth-of-type(2) p:nth-of-type(1)').innerHTML = `<strong>Range:</strong> ${position.range.toFixed(2)} km`;
          
          // Update RA/DEC in standard format (with proper caching to prevent flickering)
          const raHMS = raToHMS(position.rightAscension);
          const decDMS = decToDMS(position.declination);
          const raFormatted = `${raHMS.hours.toString().padStart(2, '0')}h ${raHMS.minutes.toString().padStart(2, '0')}m ${raHMS.seconds.toFixed(2).padStart(5, '0')}s`;
          const decFormatted = `${decDMS.degrees}° ${decDMS.minutes}' ${decDMS.seconds.toFixed(2)}"`;
          
          document.querySelector('.result-card:nth-of-type(3) p:nth-of-type(1)').innerHTML = `<strong>RA:</strong> ${raFormatted}`;
          document.querySelector('.result-card:nth-of-type(3) p:nth-of-type(2)').innerHTML = `<strong>DEC:</strong> ${decFormatted}`;
          
          // Update geodetic coordinates
          document.querySelector('.geodetic-coords p:nth-of-type(1)').innerHTML = `<strong>Latitude:</strong> ${(position.positionGeodetic.latitude * 180 / Math.PI).toFixed(4)}°`;
          document.querySelector('.geodetic-coords p:nth-of-type(2)').innerHTML = `<strong>Longitude:</strong> ${(position.positionGeodetic.longitude * 180 / Math.PI).toFixed(4)}°`;
          document.querySelector('.geodetic-coords p:nth-of-type(3)').innerHTML = `<strong>Height:</strong> ${position.positionGeodetic.height.toFixed(2)} km`;
      };
      
      // Start live updates
      liveUpdateInterval = setInterval(updatePosition, 2000); // Update every 2 seconds
      
      toggleBtn.addEventListener('click', () => {
          if (isLiveUpdating) {
              clearInterval(liveUpdateInterval);
              toggleBtn.textContent = 'Resume Live Updates';
              isLiveUpdating = false;
          } else {
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
          // Clear the results container
          resultsContainer.innerHTML = '';
      });
      
      // New satellite button - same as back to input
      newSatelliteBtn.addEventListener('click', () => {
          clearInterval(liveUpdateInterval);
          // Show the input section and help section again
          inputSection.style.display = 'block';
          if (helpSection) helpSection.style.display = 'block';
          const mainHeader = document.querySelector('header'); // The main page header with logo/title
          if (mainHeader) mainHeader.style.display = 'block';
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
});