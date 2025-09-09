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
            condition: weather.weather[0].description,
            humidity: weather.main.humidity,
            precipitation: weather.weather[0].main.toLowerCase().includes('rain') || 
                          weather.weather[0].main.toLowerCase().includes('snow')
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

// Team weather profiles based on historical performance and geographic factors
const teamWeatherProfiles = {
  "Green Bay Packers": {
    cold_advantage: 1.12,
    wind_resistance: 1.08,
    rain_impact: 0.98,
    dome_opponent_advantage: 1.10,
    climate_type: "cold_weather"
  },
  "Chicago Bears": {
    cold_advantage: 1.08,
    wind_resistance: 1.05,
    rain_impact: 0.96,
    dome_opponent_advantage: 1.08,
    climate_type: "cold_weather"
  },
  "Cleveland Browns": {
    cold_advantage: 1.06,
    wind_resistance: 1.04,
    rain_impact: 0.94,
    dome_opponent_advantage: 1.06,
    climate_type: "cold_weather"
  },
  "Pittsburgh Steelers": {
    cold_advantage: 1.05,
    wind_resistance: 1.03,
    rain_impact: 0.95,
    dome_opponent_advantage: 1.05,
    climate_type: "cold_weather"
  },
  "Buffalo Bills": {
    cold_advantage: 1.10,
    wind_resistance: 1.06,
    rain_impact: 0.92,
    dome_opponent_advantage: 1.08,
    climate_type: "cold_weather"
  },
  "New England Patriots": {
    cold_advantage: 1.07,
    wind_resistance: 1.04,
    rain_impact: 0.96,
    dome_opponent_advantage: 1.06,
    climate_type: "cold_weather"
  },
  "Miami Dolphins": {
    cold_advantage: 0.85,
    heat_advantage: 1.12,
    wind_resistance: 0.92,
    dome_opponent_advantage: 0.95,
    climate_type: "warm_weather"
  },
  "Tampa Bay Buccaneers": {
    cold_advantage: 0.88,
    heat_advantage: 1.08,
    wind_resistance: 0.94,
    dome_opponent_advantage: 0.96,
    climate_type: "warm_weather"
  },
  "Jacksonville Jaguars": {
    cold_advantage: 0.86,
    heat_advantage: 1.10,
    wind_resistance: 0.93,
    dome_opponent_advantage: 0.94,
    climate_type: "warm_weather"
  },
  "Denver Broncos": {
    cold_advantage: 1.04,
    altitude_advantage: 1.15,
    wind_resistance: 1.02,
    dome_opponent_advantage: 1.12,
    climate_type: "high_altitude"
  },
  "Seattle Seahawks": {
    rain_advantage: 1.08,
    cold_advantage: 1.02,
    wind_resistance: 1.06,
    dome_opponent_advantage: 1.04,
    climate_type: "pacific_northwest"
  },
  "San Francisco 49ers": {
    wind_resistance: 1.03,
    mild_weather_advantage: 1.02,
    dome_opponent_advantage: 1.01,
    climate_type: "mild_coastal"
  }
};

// Position group weather impact factors
const positionWeatherImpact = {
  "passing_offense": {
    cold: 0.88,
    wind: 0.75,
    rain: 0.82,
    heat: 0.96
  },
  "rushing_offense": {
    cold: 1.05,
    wind: 1.02,
    rain: 1.12,
    heat: 0.98
  },
  "field_goal_unit": {
    cold: 0.85,
    wind: 0.65,
    rain: 0.78,
    altitude: 1.15
  },
  "defense": {
    cold: 1.02,
    wind: 1.01,
    rain: 1.08,
    heat: 0.94
  }
};

function calculateTeamWeatherAdvantage(homeTeam, awayTeam, weatherData, isStadiumDome) {
  if (isStadiumDome) {
    return {
      home_advantage: 1.0,
      away_disadvantage: 1.0,
      weather_narrative: "Indoor game - no weather impact"
    };
  }

  if (!weatherData) {
    return {
      home_advantage: 1.0,
      away_disadvantage: 1.0,
      weather_narrative: "Weather data unavailable"
    };
  }

  const homeProfile = teamWeatherProfiles[homeTeam] || {};
  const awayProfile = teamWeatherProfiles[awayTeam] || {};
  
  let homeAdvantage = 1.0;
  let awayDisadvantage = 1.0;
  let weatherFactors = [];

  const { temp, wind, precipitation } = weatherData;

  // Cold weather impact
  if (temp < 40) {
    homeAdvantage *= (homeProfile.cold_advantage || 1.0);
    awayDisadvantage *= (awayProfile.cold_advantage || 1.0);
    weatherFactors.push("freezing conditions");
  } else if (temp < 55) {
    const coldFactor = 0.5; // Reduce impact for mild cold
    homeAdvantage *= (1 + (homeProfile.cold_advantage - 1) * coldFactor) || 1.0;
    awayDisadvantage *= (1 + (awayProfile.cold_advantage - 1) * coldFactor) || 1.0;
    weatherFactors.push("cold weather");
  }

  // Heat impact
  if (temp > 85) {
    homeAdvantage *= (homeProfile.heat_advantage || 1.0);
    awayDisadvantage *= (awayProfile.heat_advantage || 1.0);
    weatherFactors.push("high heat");
  }

  // Wind impact
  if (wind > 15) {
    homeAdvantage *= (homeProfile.wind_resistance || 1.0);
    awayDisadvantage *= (awayProfile.wind_resistance || 1.0);
    weatherFactors.push("strong winds");
  }

  // Precipitation impact
  if (precipitation) {
    homeAdvantage *= (homeProfile.rain_impact || homeProfile.rain_advantage || 1.0);
    awayDisadvantage *= (awayProfile.rain_impact || awayProfile.rain_advantage || 1.0);
    weatherFactors.push("precipitation");
  }

  // Dome team disadvantage when playing outdoors in bad weather
  if ((temp < 45 || wind > 12 || precipitation) && awayProfile.climate_type !== "cold_weather") {
    awayDisadvantage *= 0.92;
    weatherFactors.push("outdoor elements");
  }

  const advantageScore = Math.round((homeAdvantage / awayDisadvantage) * 100);
  let narrative = "Neutral weather conditions";
  
  if (advantageScore > 108) {
    narrative = `Strong home weather advantage (${weatherFactors.join(", ")})`;
  } else if (advantageScore > 104) {
    narrative = `Moderate home weather advantage (${weatherFactors.join(", ")})`;
  } else if (advantageScore < 96) {
    narrative = `Away team handles conditions better (${weatherFactors.join(", ")})`;
  }

  return {
    home_advantage: Math.round(homeAdvantage * 1000) / 1000,
    away_disadvantage: Math.round(awayDisadvantage * 1000) / 1000,
    advantage_score: advantageScore,
    weather_narrative: narrative,
    weather_factors: weatherFactors
  };
}

function calculatePositionGroupImpact(weatherData, isStadiumDome) {
  if (isStadiumDome || !weatherData) {
    return {
      passing_offense: 1.0,
      rushing_offense: 1.0,
      field_goal_unit: 1.0,
      defense: 1.0
    };
  }

  const { temp, wind, precipitation } = weatherData;
  const impacts = {};

  Object.keys(positionWeatherImpact).forEach(position => {
    let impact = 1.0;
    const factors = positionWeatherImpact[position];

    if (temp < 40) impact *= factors.cold;
    if (temp > 85) impact *= factors.heat;
    if (wind > 15) impact *= factors.wind;
    if (precipitation) impact *= factors.rain;

    impacts[position] = Math.round(impact * 1000) / 1000;
  });

  return impacts;
}

function calculateWeatherAdjustedFactor(baseFactor, weatherData, factorType) {
  if (!weatherData) {
    return baseFactor;
  }
  
  const { temp, wind } = weatherData;
  let adjustedFactor = baseFactor;
  
  if (factorType === 'passing') {
    if (temp < 40) adjustedFactor *= 0.92;
    else if (temp < 60) adjustedFactor *= 0.96;
    else if (temp > 80) adjustedFactor *= 1.02;
    
    if (wind > 20) adjustedFactor *= 0.85;
    else if (wind > 15) adjustedFactor *= 0.92;
    else if (wind > 10) adjustedFactor *= 0.97;
    
  } else if (factorType === 'rushing') {
    if (temp < 40) adjustedFactor *= 1.05;
    else if (temp < 60) adjustedFactor *= 1.02;
    
    if (wind > 25) adjustedFactor *= 0.98;
    
  } else if (factorType === 'kicking') {
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
    "Lambeau Field": {"lat": 44.5013, "lon": -88.0622, "base_passing": 0.95, "base_rushing": 1.05, "base_kicking": 0.90, "dome": false, "home_team": "Green Bay Packers"},
    "Soldier Field": {"lat": 41.8623, "lon": -87.6167, "base_passing": 0.96, "base_rushing": 1.03, "base_kicking": 0.92, "dome": false, "home_team": "Chicago Bears"},
    "Cleveland Browns Stadium": {"lat": 41.5061, "lon": -81.6995, "base_passing": 0.97, "base_rushing": 1.02, "base_kicking": 0.93, "dome": false, "home_team": "Cleveland Browns"},
    "Heinz Field": {"lat": 40.4469, "lon": -80.0158, "base_passing": 0.96, "base_rushing": 1.04, "base_kicking": 0.91, "dome": false, "home_team": "Pittsburgh Steelers"},
    "M&T Bank Stadium": {"lat": 39.2780, "lon": -76.6227, "base_passing": 1.00, "base_rushing": 1.00, "base_kicking": 0.98, "dome": false, "home_team": "Baltimore Ravens"},
    "MetLife Stadium": {"lat": 40.8135, "lon": -74.0745, "base_passing": 1.01, "base_rushing": 0.99, "base_kicking": 0.97, "dome": false, "home_team": "New York Giants"},
    "Gillette Stadium": {"lat": 42.0909, "lon": -71.2643, "base_passing": 0.98, "base_rushing": 1.01, "base_kicking": 0.94, "dome": false, "home_team": "New England Patriots"},
    "Hard Rock Stadium": {"lat": 25.9580, "lon": -80.2389, "base_passing": 1.03, "base_rushing": 0.98, "base_kicking": 1.02, "dome": false, "home_team": "Miami Dolphins"},
    "TIAA Bank Field": {"lat": 30.3240, "lon": -81.6373, "base_passing": 1.02, "base_rushing": 0.99, "base_kicking": 1.01, "dome": false, "home_team": "Jacksonville Jaguars"},
    "Empower Field": {"lat": 39.7439, "lon": -105.0201, "base_passing": 1.08, "base_rushing": 0.95, "base_kicking": 0.85, "dome": false, "home_team": "Denver Broncos"},
    "Lumen Field": {"lat": 47.5952, "lon": -122.3316, "base_passing": 0.99, "base_rushing": 1.01, "base_kicking": 0.96, "dome": false, "home_team": "Seattle Seahawks"},
    "Levi's Stadium": {"lat": 37.4031, "lon": -121.9695, "base_passing": 1.01, "base_rushing": 0.99, "base_kicking": 1.00, "dome": false, "home_team": "San Francisco 49ers"},
    "Raymond James Stadium": {"lat": 27.9759, "lon": -82.5033, "base_passing": 1.02, "base_rushing": 0.98, "base_kicking": 1.01, "dome": false, "home_team": "Tampa Bay Buccaneers"},
    "NRG Stadium": {"lat": 29.6847, "lon": -95.4107, "base_passing": 1.02, "base_rushing": 0.98, "base_kicking": 1.03, "dome": true, "home_team": "Houston Texans"},
    "Lucas Oil Stadium": {"lat": 39.7601, "lon": -86.1639, "base_passing": 1.03, "base_rushing": 0.97, "base_kicking": 1.05, "dome": true, "home_team": "Indianapolis Colts"},
    "Allegiant Stadium": {"lat": 36.0908, "lon": -115.1834, "base_passing": 1.02, "base_rushing": 0.98, "base_kicking": 1.04, "dome": true, "home_team": "Las Vegas Raiders"},
    "SoFi Stadium": {"lat": 33.9535, "lon": -118.3392, "base_passing": 1.03, "base_rushing": 0.97, "base_kicking": 1.02, "dome": true, "home_team": "Los Angeles Rams"},
    "State Farm Stadium": {"lat": 33.5276, "lon": -112.2626, "base_passing": 1.02, "base_rushing": 0.98, "base_kicking": 1.03, "dome": true, "home_team": "Arizona Cardinals"},
    "AT&T Stadium": {"lat": 32.7473, "lon": -97.0945, "base_passing": 1.04, "base_rushing": 0.96, "base_kicking": 1.05, "dome": true, "home_team": "Dallas Cowboys"},
    "U.S. Bank Stadium": {"lat": 44.9738, "lon": -93.2581, "base_passing": 1.03, "base_rushing": 0.97, "base_kicking": 1.05, "dome": true, "home_team": "Minnesota Vikings"},
    "Ford Field": {"lat": 42.3400, "lon": -83.0456, "base_passing": 1.02, "base_rushing": 0.98, "base_kicking": 1.04, "dome": true, "home_team": "Detroit Lions"},
    "Mercedes-Benz Superdome": {"lat": 29.9511, "lon": -90.0812, "base_passing": 1.03, "base_rushing": 0.97, "base_kicking": 1.05, "dome": true, "home_team": "New Orleans Saints"},
    "Mercedes-Benz Stadium": {"lat": 33.7553, "lon": -84.4006, "base_passing": 1.03, "base_rushing": 0.97, "base_kicking": 1.05, "dome": true, "home_team": "Atlanta Falcons"}
  };
  
  console.log('Starting parallel weather data fetch for NFL stadiums...');
  
  const weatherPromises = Object.entries(nflStadiums).map(async ([stadiumName, data]) => {
    try {
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
    const adjustedPassingFactor = calculateWeatherAdjustedFactor(data.base_passing, weatherData, 'passing');
    const adjustedRushingFactor = calculateWeatherAdjustedFactor(data.base_rushing, weatherData, 'rushing');
    const adjustedKickingFactor = calculateWeatherAdjustedFactor(data.base_kicking, weatherData, 'kicking');
    
    // Calculate team weather advantages (using sample away teams)
    const sampleAwayTeam = isDome ? "Green Bay Packers" : "Miami Dolphins";
    const teamAdvantage = calculateTeamWeatherAdvantage(data.home_team, sampleAwayTeam, weatherData, isDome);
    
    // Calculate position group impacts
    const positionImpacts = calculatePositionGroupImpact(weatherData, isDome);
    
    let weatherSummary = isDome ? "Indoor (Dome)" : "Weather unavailable";
    if (weatherData && !isDome) {
      weatherSummary = `${weatherData.temp}°F, ${weatherData.wind} mph wind`;
      if (weatherData.precipitation) weatherSummary += ", precipitation";
    }
    
    return {
      stadium: stadiumName,
      home_team: data.home_team,
      passing_factor: adjustedPassingFactor,
      rushing_factor: adjustedRushingFactor,
      kicking_factor: adjustedKickingFactor,
      weather: weatherSummary,
      base_passing_factor: data.base_passing,
      base_rushing_factor: data.base_rushing,
      base_kicking_factor: data.base_kicking,
      is_dome: isDome,
      team_weather_advantage: teamAdvantage,
      position_impacts: positionImpacts,
      weather_details: weatherData
    };
  });
  
  stadiumFactors.sort((a, b) => b.passing_factor - a.passing_factor);
  
  console.log('Stadium factors calculation completed');
  
  return {
    last_updated: new Date().toISOString(),
    stadium_factors: stadiumFactors
  };
}