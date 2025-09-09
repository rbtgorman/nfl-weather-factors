const https = require('https');

exports.handler = async (event, context) => {
  try {
    const stadiumFactors = await calculateStadiumFactors();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(stadiumFactors)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Failed to calculate stadium factors',
        details: error.message 
      })
    };
  }
};

function getWeatherData(lat, lon) {
  return new Promise((resolve, reject) => {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=3f9b48769c07fcf29078b4d62df8d84d&units=imperial`;
    
    const timeout = setTimeout(() => {
      resolve(null);
    }, 3000);
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        clearTimeout(timeout);
        try {
          const weather = JSON.parse(data);
          resolve({
            temp: Math.round(weather.main.temp),
            wind: Math.round(weather.wind.speed),
            condition: weather.weather[0].description
          });
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', (err) => {
      clearTimeout(timeout);
      resolve(null);
    });
  });
}

function calculateWeatherAdjustedFactor(baseFactor, weatherData, factorType) {
  if (!weatherData) {
    return baseFactor;
  }
  
  const { temp, wind } = weatherData;
  let adjustedFactor = baseFactor;
  
  // Different adjustments based on factor type
  if (factorType === 'passing') {
    // Cold weather and wind hurt passing
    if (temp < 40) adjustedFactor *= 0.92;
    else if (temp < 60) adjustedFactor *= 0.96;
    else if (temp > 80) adjustedFactor *= 1.02;
    
    if (wind > 20) adjustedFactor *= 0.85;
    else if (wind > 15) adjustedFactor *= 0.92;
    else if (wind > 10) adjustedFactor *= 0.97;
    
  } else if (factorType === 'rushing') {
    // Cold weather slightly favors rushing
    if (temp < 40) adjustedFactor *= 1.05;
    else if (temp < 60) adjustedFactor *= 1.02;
    
    // Wind has minimal impact on rushing
    if (wind > 25) adjustedFactor *= 0.98;
    
  } else if (factorType === 'kicking') {
    // Kicking heavily affected by wind and cold
    if (temp < 32) adjustedFactor *= 0.85;
    else if (temp < 50) adjustedFactor *= 0.92;
    
    if (wind > 20) adjustedFactor *= 0.75;
    else if (wind > 15) adjustedFactor *= 0.85;
    else if (wind > 10) adjustedFactor *= 0.92;
  }
  
  return Math.round(adjustedFactor * 1000) / 1000;
}

async function calculateStadiumFactors() {
  const nflStadiums = {
    "Lambeau Field": {"lat": 44.5013, "lon": -88.0622, "base_passing": 0.95, "base_rushing": 1.05, "base_kicking": 0.90, "dome": false},
    "Soldier Field": {"lat": 41.8623, "lon": -87.6167, "base_passing": 0.96, "base_rushing": 1.03, "base_kicking": 0.92, "dome": false},
    "Cleveland Browns Stadium": {"lat": 41.5061, "lon": -81.6995, "base_passing": 0.97, "base_rushing": 1.02, "base_kicking": 0.93, "dome": false},
    "Heinz Field": {"lat": 40.4469, "lon": -80.0158, "base_passing": 0.96, "base_rushing": 1.04, "base_kicking": 0.91, "dome": false},
    "M&T Bank Stadium": {"lat": 39.2780, "lon": -76.6227, "base_passing": 1.00, "base_rushing": 1.00, "base_kicking": 0.98, "dome": false},
    "MetLife Stadium": {"lat": 40.8135, "lon": -74.0745, "base_passing": 1.01, "base_rushing": 0.99, "base_kicking": 0.97, "dome": false},
    "Gillette Stadium": {"lat": 42.0909, "lon": -71.2643, "base_passing": 0.98, "base_rushing": 1.01, "base_kicking": 0.94, "dome": false},
    "Hard Rock Stadium": {"lat": 25.9580, "lon": -80.2389, "base_passing": 1.03, "base_rushing": 0.98, "base_kicking": 1.02, "dome": false},
    "TIAA Bank Field": {"lat": 30.3240, "lon": -81.6373, "base_passing": 1.02, "base_rushing": 0.99, "base_kicking": 1.01, "dome": false},
    "Nissan Stadium": {"lat": 36.1664, "lon": -86.7713, "base_passing": 1.00, "base_rushing": 1.00, "base_kicking": 0.99, "dome": false},
    "NRG Stadium": {"lat": 29.6847, "lon": -95.4107, "base_passing": 1.02, "base_rushing": 0.98, "base_kicking": 1.03, "dome": true},
    "Lucas Oil Stadium": {"lat": 39.7601, "lon": -86.1639, "base_passing": 1.03, "base_rushing": 0.97, "base_kicking": 1.05, "dome": true},
    "Arrowhead Stadium": {"lat": 39.0489, "lon": -94.4839, "base_passing": 0.98, "base_rushing": 1.02, "base_kicking": 0.95, "dome": false},
    "Empower Field": {"lat": 39.7439, "lon": -105.0201, "base_passing": 1.08, "base_rushing": 0.95, "base_kicking": 0.85, "dome": false},
    "Allegiant Stadium": {"lat": 36.0908, "lon": -115.1834, "base_passing": 1.02, "base_rushing": 0.98, "base_kicking": 1.04, "dome": true},
    "SoFi Stadium": {"lat": 33.9535, "lon": -118.3392, "base_passing": 1.03, "base_rushing": 0.97, "base_kicking": 1.02, "dome": true},
    "Levi's Stadium": {"lat": 37.4031, "lon": -121.9695, "base_passing": 1.01, "base_rushing": 0.99, "base_kicking": 1.00, "dome": false},
    "Lumen Field": {"lat": 47.5952, "lon": -122.3316, "base_passing": 0.99, "base_rushing": 1.01, "base_kicking": 0.96, "dome": false},
    "State Farm Stadium": {"lat": 33.5276, "lon": -112.2626, "base_passing": 1.02, "base_rushing": 0.98, "base_kicking": 1.03, "dome": true},
    "AT&T Stadium": {"lat": 32.7473, "lon": -97.0945, "base_passing": 1.04, "base_rushing": 0.96, "base_kicking": 1.05, "dome": true},
    "FedExField": {"lat": 38.9077, "lon": -76.8644, "base_passing": 0.99, "base_rushing": 1.01, "base_kicking": 0.98, "dome": false},
    "Lincoln Financial Field": {"lat": 39.9008, "lon": -75.1675, "base_passing": 1.00, "base_rushing": 1.00, "base_kicking": 0.97, "dome": false},
    "MetLife Stadium": {"lat": 40.8135, "lon": -74.0745, "base_passing": 1.01, "base_rushing": 0.99, "base_kicking": 0.97, "dome": false},
    "U.S. Bank Stadium": {"lat": 44.9738, "lon": -93.2581, "base_passing": 1.03, "base_rushing": 0.97, "base_kicking": 1.05, "dome": true},
    "Ford Field": {"lat": 42.3400, "lon": -83.0456, "base_passing": 1.02, "base_rushing": 0.98, "base_kicking": 1.04, "dome": true},
    "Mercedes-Benz Superdome": {"lat": 29.9511, "lon": -90.0812, "base_passing": 1.03, "base_rushing": 0.97, "base_kicking": 1.05, "dome": true},
    "Bank of America Stadium": {"lat": 35.2259, "lon": -80.8533, "base_passing": 1.00, "base_rushing": 1.00, "base_kicking": 0.99, "dome": false},
    "Mercedes-Benz Stadium": {"lat": 33.7553, "lon": -84.4006, "base_passing": 1.03, "base_rushing": 0.97, "base_kicking": 1.05, "dome": true},
    "Raymond James Stadium": {"lat": 27.9759, "lon": -82.5033, "base_passing": 1.02, "base_rushing": 0.98, "base_kicking": 1.01, "dome": false}
  };
  
  console.log('Starting parallel weather data fetch for NFL stadiums...');
  
  const weatherPromises = Object.entries(nflStadiums).map(async ([stadiumName, data]) => {
    try {
      // Skip weather for dome stadiums
      if (data.dome) {
        return { stadiumName, data, weatherData: null, isDome: true };
      }
      
      const weatherData = await getWeatherData(data.lat, data.lon);
      return { stadiumName, data, weatherData, isDome: false };
    } catch (error) {
      console.error(`Weather fetch failed for ${stadiumName}:`, error);
      return { stadiumName, data, weatherData: null, isDome: data.dome };
    }
  });
  
  console.log('Waiting for all weather API calls to complete...');
  const weatherResults = await Promise.all(weatherPromises);
  console.log('All weather data fetched, processing results...');
  
  const stadiumFactors = weatherResults.map(({ stadiumName, data, weatherData, isDome }) => {
    let adjustedPassingFactor, adjustedRushingFactor, adjustedKickingFactor;
    
    if (isDome) {
      // No weather adjustments for domed stadiums
      adjustedPassingFactor = data.base_passing;
      adjustedRushingFactor = data.base_rushing;
      adjustedKickingFactor = data.base_kicking;
    } else {
      adjustedPassingFactor = calculateWeatherAdjustedFactor(data.base_passing, weatherData, 'passing');
      adjustedRushingFactor = calculateWeatherAdjustedFactor(data.base_rushing, weatherData, 'rushing');
      adjustedKickingFactor = calculateWeatherAdjustedFactor(data.base_kicking, weatherData, 'kicking');
    }
    
    let weatherSummary = isDome ? "Indoor (Dome)" : "Weather unavailable";
    if (weatherData && !isDome) {
      weatherSummary = `${weatherData.temp}°F, ${weatherData.wind} mph wind`;
    }
    
    return {
      stadium: stadiumName,
      passing_factor: adjustedPassingFactor,
      rushing_factor: adjustedRushingFactor,
      kicking_factor: adjustedKickingFactor,
      weather: weatherSummary,
      base_passing_factor: data.base_passing,
      base_rushing_factor: data.base_rushing,
      base_kicking_factor: data.base_kicking,
      is_dome: isDome
    };
  });
  
  // Sort by passing factor (highest first)
  stadiumFactors.sort((a, b) => b.passing_factor - a.passing_factor);
  
  console.log('Stadium factors calculation completed');
  
  return {
    last_updated: new Date().toISOString(),
    stadium_factors: stadiumFactors
  };
}