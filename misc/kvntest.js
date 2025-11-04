// kvntest.js - Test KVN format handling

// Mock satellite.js functions for testing the parsing logic
const satellite = {
  json2satrec: function(ommObject) {
    console.log('json2satrec called with:', ommObject);
    
    // Return a mock satrec object
    // In real satellite.js, this would create the actual satellite record
    return {
      // Mock satrec properties
      satnum: ommObject.NORAD_CAT_ID || 0,
      epochyr: 2023, // This would be parsed from epoch
      error: null, // No error initially
      // Other satrec properties...
    };
  },
  propagate: function(satrec, date) {
    console.log('propagate called with satrec:', satrec, 'and date:', date);
    
    // Simulate valid propagation result
    return {
      position: {
        x: 6525.123456,
        y: 2123.987654,
        z: -1123.456789
      },
      velocity: {
        x: 1.234567,
        y: 4.567890,
        z: 6.789012
      }
    };
  }
};

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
      
      console.log(`Processing: ${key} = ${value} (type: ${typeof value})`);
      
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
        value = parseFloat(value);
        // If it's a whole number, make it an integer
        if (Number.isInteger(value)) {
          value = parseInt(value, 10);
        }
      } else {
        // Remove quotes if present for non-numeric values
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
      }
      
      ommObject[key] = value;
      console.log(`  -> Final value: ${ommObject[key]} (type: ${typeof ommObject[key]})`);
    }
  }
  
  return ommObject;
}

/**
 * Validates OMM format (JSON or KVN)
 */
function validateOMM(ommData) {
  try {
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
      if (ommData[field] === undefined) {
        console.log(`Missing required field: ${field}`);
        return false;
      }
    }
    
    // Validate data types
    if (typeof ommData.NORAD_CAT_ID !== 'number' && typeof ommData.NORAD_CAT_ID !== 'string') {
      console.log(`NORAD_CAT_ID has invalid type: ${typeof ommData.NORAD_CAT_ID}`);
      return false;
    }
    
    if (typeof ommData.EPOCH !== 'string') {
      console.log(`EPOCH has invalid type: ${typeof ommData.EPOCH}`);
      return false;
    }
    
    if (isNaN(parseFloat(ommData.MEAN_MOTION)) || isNaN(parseFloat(ommData.ECCENTRICITY)) ||
        isNaN(parseFloat(ommData.INCLINATION)) || isNaN(parseFloat(ommData.RA_OF_ASC_NODE)) ||
        isNaN(parseFloat(ommData.ARG_OF_PERICENTER)) || isNaN(parseFloat(ommData.MEAN_ANOMALY))) {
      console.log(`One or more numeric fields are not valid numbers`);
      return false;
    }
    
    console.log('OMM validation passed');
    return true;
  } catch (error) {
    // If parsing fails, it's not valid OMM
    console.error('Error validating OMM:', error);
    return false;
  }
}

/**
 * Calculates satellite position based on OMM data
 */
function calculateSatellitePositionOMM(ommData) {
  try {
    console.log('Starting OMM calculation...');
    console.log('Input data type:', typeof ommData);
    console.log('Input data:', ommData);
    
    let ommObject;
    if (typeof ommData === 'string') {
      // Check if it looks like KVN format (contains key=value pairs)
      if (ommData.includes('=')) {
        // Parse as KVN format
        console.log('Detected KVN format, parsing...');
        ommObject = parseOMMKVN(ommData);
      } else {
        // Parse as JSON format
        console.log('Detected JSON format, parsing...');
        ommObject = JSON.parse(ommData);
      }
    } else {
      // It's already a JSON object
      console.log('Data is already JSON object');
      ommObject = ommData;
    }
    
    console.log('Parsed OMM object:', ommObject);
    
    // Validate OMM data
    if (!validateOMM(ommObject)) {
      throw new Error('Invalid OMM format');
    }
    
    // Initialize satellite record using OMM
    if (typeof satellite.json2satrec === 'function') {
      console.log('Calling satellite.json2satrec...');
      const satrec = satellite.json2satrec(ommObject);
      
      // Check for errors in satellite record (after calling json2satrec)
      if (satrec && satrec.error) {
        throw new Error(`Satellite propagation error from OMM: ${satrec.error}`);
      }
      
      console.log('satrec created:', satrec);
      
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
      
      console.log('Final position:', pos);
      
      return {
        position: pos,
        velocity: positionAndVelocity.velocity
      };
    } else {
      throw new Error('OMM format is not supported in this version of satellite.js. Please upgrade to version 6.0.0 or higher.');
    }
  } catch (error) {
    console.error('Error in calculateSatellitePositionOMM:', error);
    throw error;
  }
}

// Test cases
console.log('=== Testing KVN Format ===');

const kvnData = `CCSDS_OMM_VERS = 2.0
COMMENT = Sample Satellite
CREATION_DATE = 2023-085T12:00:00.000
ORIGINATOR = JSpOC
OBJECT_NAME = ISS (ZARYA)
OBJECT_ID = 1998-067A
CENTER_NAME = EARTH
REF_FRAME = ITRF97
TIME_SYSTEM = UTC
MEAN_ELEMENT_THEORY = SGP4
EPOCH = 2023-03-26T05:19:34.116960
MEAN_MOTION = 15.49598850
ECCENTRICITY = 0.000315
INCLINATION = 51.6435
RA_OF_ASC_NODE = 106.9059
ARG_OF_PERICENTER = 268.2073
MEAN_ANOMALY = 91.8026
EPHEMERIS_TYPE = 0
CLASSIFICATION_TYPE = U
NORAD_CAT_ID = 25544
ELEMENT_SET_NO = 999
REV_AT_EPOCH = 12345
BSTAR = 0.000036618
MEAN_MOTION_DOT = 0.00003322
MEAN_MOTION_DDOT = 0`;

try {
  console.log('\nStep 1: Parse KVN format');
  const parsed = parseOMMKVN(kvnData);
  console.log('Parsed result:', JSON.stringify(parsed, null, 2));
  
  console.log('\nStep 2: Validate OMM');
  const isValid = validateOMM(parsed);
  console.log('Validation result:', isValid);
  
  if (isValid) {
    console.log('\nStep 3: Calculate satellite position');
    const result = calculateSatellitePositionOMM(kvnData);
    console.log('Final result:', result);
  } else {
    console.log('OMM validation failed');
  }
} catch (e) {
  console.log('Test failed with error:', e.message);
  console.log(e.stack);
}

// Test with actual working example from satellite.js docs
console.log('\n\n=== Testing with Known Good JSON ===');
const goodOMM = {
  "OBJECT_NAME": "HELIOS 2A",
  "OBJECT_ID": "2004-049A",
  "EPOCH": "2025-03-26T05:19:34.116960",
  "MEAN_MOTION": 15.00555103,
  "ECCENTRICITY": 0.000583,
  "INCLINATION": 98.3164,
  "RA_OF_ASC_NODE": 103.8411,
  "ARG_OF_PERICENTER": 20.5667,
  "MEAN_ANOMALY": 339.5789,
  "EPHEMERIS_TYPE": 0,
  "CLASSIFICATION_TYPE": "U",
  "NORAD_CAT_ID": 28492,
  "ELEMENT_SET_NO": 999,
  "REV_AT_EPOCH": 8655,
  "BSTAR": 0.00048021,
  "MEAN_MOTION_DOT": 0.00005995,
  "MEAN_MOTION_DDOT": 0
};

try {
  console.log('\nTesting with good OMM data...');
  const result = calculateSatellitePositionOMM(goodOMM);
  console.log('Good OMM result:', result);
} catch (e) {
  console.log('Good OMM test failed with error:', e.message);
}

console.log('\n=== KVN Test Complete ===');