/**
 * Weather App Pro – Main Application Script (Production Grade)
 * ═══════════════════════════════════════════════════════════
 * Handles:
 *  • Weather fetch & UI updates (Current, Hourly, 5-Day)
 *  • Precise Geolocation & Reverse Geocoding (Nominatim)
 *  • Smart Weather Recommendation Engine
 *  • Automated Weather Alerts System
 *  • Interactive Charts (Chart.js for Trends and Analytics)
 *  • Multi-City Comparison with column sorting
 *  • Nearby Cities Weather Finder
 *  • CSS Animated weather icons
 *  • Theme toggling & Local Storage Caching
 *  • Custom API Key settings persistence
 * ═══════════════════════════════════════════════════════════
 */

"use strict";

/* ══════════════════════════════════════
   DOM ELEMENT REFERENCES
   ══════════════════════════════════════ */
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelector(sel);

// Search & Actions
const cityInput        = $("cityInput");
const searchBtn        = $("searchBtn");
const locationBtn      = $("locationBtn");
const historySelect    = $("historySelect");
const clearHistoryBtn  = $("clearHistoryBtn");
const themeToggle      = $("themeToggle");

// Settings Panel Elements
const settingsToggle   = $("settingsToggle");
const settingsPanel    = $("settingsPanel");
const apiKeyInput      = $("apiKeyInput");
const toggleApiKeyVisibility = $("toggleApiKeyVisibility");
const saveSettingsBtn  = $("saveSettingsBtn");
const resetSettingsBtn = $("resetSettingsBtn");

// Core Layout Screens
const emptyState       = $("emptyState");
const loadingState     = $("loadingState");
const errorState       = $("errorState");
const errorMsg         = $("errorMsg");
const weatherContent   = $("weatherContent");

// Alerts Banner
const alertsBanner     = $("alertsBanner");

// Current Weather Elements
const cityEl           = $$(".city");
const countryEl        = $$(".country");
const tempEl           = $$(".temp");
const descriptionEl    = $$(".description");
const feelsLikeEl      = $$(".feels-like");
const humidityEl       = $$(".humidity");
const windEl           = $$(".wind");
const pressureEl       = $$(".pressure");
const sunriseEl        = $$(".sunrise");
const sunsetEl         = $$(".sunset");
const dayLengthEl      = $$(".day-length");
const visibilityEl     = $$(".visibility");
const animatedIconContainer = $("animatedIconContainer");
const weatherIconEl    = $$(".weather-icon-img"); // Backwards compatibility bind

// Precise Location Elements
const locDistrict      = $("locDistrict");
const locState         = $("locState");
const locCountry       = $("locCountry");
const locLat           = $("locLat");
const locLon           = $("locLon");
const locAccuracy      = $("locAccuracy");

// Recommendations
const recommendationsList = $("recommendationsList");

// AQI Card Elements
const aqiValue         = $("aqiValue");
const aqiLabel         = $("aqiLabel");
const aqiBar           = $("aqiBar");

// Forecast & Hourly Containers
const forecastContainer = $("forecastContainer");
const hourlyContainer   = $("hourlyContainer");

// Favorites Elements
const favoritesListEl  = $("favoritesList");
const addFavoriteBtn   = $("addFavoriteBtn");

// Comparison Dashboard Elements
const comparisonInput  = $("comparisonInput");
const addComparisonBtn = $("addComparisonBtn");
const refreshComparisonBtn = $("refreshComparisonBtn");
const comparisonBody   = $("comparisonBody");

// Nearby Cities
const nearbyCitiesContainer = $("nearbyCitiesContainer");

// Chart.js Chart Instances (stored globally to prevent memory leaks via .destroy())
let trendChartInstance = null;
let tempChartInstance = null;
let humidityChartInstance = null;
let pressureChartInstance = null;

// Leaflet Map State
let weatherMapInstance = null;
let mapMarkerInstance  = null;

// Application State
let currentCityName    = null;
let currentLatitude    = null;
let currentLongitude   = null;
let forecastDataCache  = null;
let activeTrendTab     = "temp"; // temp, humidity, rain
let comparisonCities   = [];
let currentSortField   = "city";
let currentSortAscending = true;

// API Response Cache (5 Minutes TTL to optimize API usage)
const apiCache = {};

/* ══════════════════════════════════════
   API KEY UTILITIES
   ══════════════════════════════════════ */
function getActiveApiKey() {
  const userKey = localStorage.getItem("userApiKey");
  return userKey ? userKey.trim() : CONFIG.API_KEY;
}

function initSettingsPanel() {
  if (!settingsToggle || !settingsPanel) return;

  // Toggle display
  settingsToggle.addEventListener("click", () => {
    settingsPanel.classList.toggle("hidden");
    if (!settingsPanel.classList.contains("hidden")) {
      apiKeyInput.value = localStorage.getItem("userApiKey") || "";
    }
  });

  // Toggle key visibility
  if (toggleApiKeyVisibility && apiKeyInput) {
    toggleApiKeyVisibility.addEventListener("click", () => {
      const type = apiKeyInput.type === "password" ? "text" : "password";
      apiKeyInput.type = type;
      const icon = toggleApiKeyVisibility.querySelector("i");
      if (icon) {
        icon.className = type === "password" ? "fa-solid fa-eye" : "fa-solid fa-eye-slash";
      }
    });
  }

  // Save key
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener("click", () => {
      const keyVal = apiKeyInput.value.trim();
      if (keyVal) {
        localStorage.setItem("userApiKey", keyVal);
      } else {
        localStorage.removeItem("userApiKey");
      }
      settingsPanel.classList.add("hidden");
      // Re-trigger current load
      if (currentCityName) {
        getWeatherByCity(currentCityName);
      } else {
        showEmpty();
      }
    });
  }

  // Reset key
  if (resetSettingsBtn) {
    resetSettingsBtn.addEventListener("click", () => {
      localStorage.removeItem("userApiKey");
      apiKeyInput.value = "";
      settingsPanel.classList.add("hidden");
      if (currentCityName) {
        getWeatherByCity(currentCityName);
      }
    });
  }

  // Close when clicking outside settings panel
  document.addEventListener("click", (e) => {
    if (!settingsPanel.contains(e.target) && !settingsToggle.contains(e.target)) {
      settingsPanel.classList.add("hidden");
    }
  });
}

/* ══════════════════════════════════════
   LIVE CLOCK & DATE
   ══════════════════════════════════════ */
function updateDateTime() {
  const now = new Date();
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
}
setInterval(updateDateTime, 1000);
updateDateTime();

/* ══════════════════════════════════════
   UI STATE MANAGEMENT
   ══════════════════════════════════════ */
function showEmpty() {
  if (emptyState)    emptyState.classList.remove("hidden");
  if (loadingState)  loadingState.classList.add("hidden");
  if (errorState)    errorState.classList.add("hidden");
  if (weatherContent) weatherContent.classList.add("hidden");
}

function showLoading() {
  if (emptyState)    emptyState.classList.add("hidden");
  if (loadingState)  loadingState.classList.remove("hidden");
  if (errorState)    errorState.classList.add("hidden");
  if (weatherContent) weatherContent.classList.add("hidden");
}

function showError(message) {
  if (emptyState)    emptyState.classList.add("hidden");
  if (loadingState)  loadingState.classList.add("hidden");
  if (errorState)    errorState.classList.remove("hidden");
  if (weatherContent) weatherContent.classList.add("hidden");
  if (errorMsg)      errorMsg.textContent = message || "City not found. Please try again.";
}

function showWeather() {
  if (emptyState)    emptyState.classList.add("hidden");
  if (loadingState)  loadingState.classList.add("hidden");
  if (errorState)    errorState.classList.add("hidden");
  if (weatherContent) weatherContent.classList.remove("hidden");
}

/* ══════════════════════════════════════
   CACHE UTILITIES
   ══════════════════════════════════════ */
function getCachedData(key) {
  const cached = apiCache[key];
  if (cached && (Date.now() - cached.timestamp < 300000)) { // 5 minutes TTL
    return cached.data;
  }
  return null;
}

function setCachedData(key, data) {
  apiCache[key] = {
    timestamp: Date.now(),
    data: data
  };
}

/* ══════════════════════════════════════
   WEATHER FETCH CONTROLLER
   ══════════════════════════════════════ */
async function getWeatherByCity(city) {
  if (!city || !city.trim()) return;
  showLoading();

  const apiKey = getActiveApiKey();
  const cacheKey = `weather_city_${city.toLowerCase()}`;
  const cached = getCachedData(cacheKey);

  try {
    let data;
    if (cached) {
      data = cached;
    } else {
      const url = `${CONFIG.BASE_URL}/weather?q=${encodeURIComponent(city)}&units=${CONFIG.UNITS}&appid=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) throw new Error(`City "${city}" not found. Please check spelling.`);
        if (res.status === 401) throw new Error("Invalid API Key. Please verify settings.");
        throw new Error("Failed to fetch current weather data.");
      }
      data = await res.json();
      setCachedData(cacheKey, data);
    }

    currentLatitude = data.coord.lat;
    currentLongitude = data.coord.lon;
    currentCityName = data.name;

    // Display updates
    updateWeatherUI(data);
    saveHistory(data.name);
    updateFavoritesPanel();

    // Trigger secondary features
    await Promise.all([
      getForecast(data.name),
      getAQI(data.coord.lat, data.coord.lon),
      getNearbyCities(data.coord.lat, data.coord.lon),
    ]);

    // Precise Geocoding Lookup
    fetchPreciseGeocoding(data.coord.lat, data.coord.lon, data.name, data.sys.country);

    // Map & Layout transition
    updateWeatherMap(data.coord.lat, data.coord.lon, data.name);
    showWeather();

  } catch (err) {
    showError(err.message);
  }
}

async function getWeatherByCoords(lat, lon, accuracy = null) {
  showLoading();
  const apiKey = getActiveApiKey();
  const cacheKey = `weather_coords_${lat}_${lon}`;
  const cached = getCachedData(cacheKey);

  try {
    let data;
    if (cached) {
      data = cached;
    } else {
      const url = `${CONFIG.BASE_URL}/weather?lat=${lat}&lon=${lon}&units=${CONFIG.UNITS}&appid=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Could not retrieve weather for your coordinates.");
      data = await res.json();
      setCachedData(cacheKey, data);
    }

    currentLatitude = lat;
    currentLongitude = lon;
    currentCityName = data.name;

    if (cityInput) cityInput.value = data.name;
    if (locAccuracy) {
      locAccuracy.textContent = accuracy ? `± ${Math.round(accuracy)} meters` : "GPS / Geolocation Mode";
    }

    updateWeatherUI(data);
    saveHistory(data.name);
    updateFavoritesPanel();

    await Promise.all([
      getForecast(data.name),
      getAQI(lat, lon),
      getNearbyCities(lat, lon),
    ]);

    fetchPreciseGeocoding(lat, lon, data.name, data.sys.country);
    updateWeatherMap(lat, lon, data.name);
    showWeather();

  } catch (err) {
    showError(err.message);
  }
}

/* ══════════════════════════════════════
   PRECISE GEOLOCATING (Nominatim API)
   ══════════════════════════════════════ */
async function fetchPreciseGeocoding(lat, lon, defaultCity, defaultCountry) {
  if (locLat) locLat.textContent = lat.toFixed(4);
  if (locLon) locLon.textContent = lon.toFixed(4);

  try {
    // Nominatim Reverse Geocoding
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=en`);
    if (!res.ok) throw new Error("Reverse geocoding response not ok");
    const data = await res.json();

    const address = data.address || {};
    const district = address.suburb || address.city_district || address.county || address.town || defaultCity;
    const state = address.state || address.region || "––";
    const country = address.country || defaultCountry;

    if (locDistrict) locDistrict.textContent = district;
    if (locState) locState.textContent = state;
    if (locCountry) locCountry.textContent = country;

  } catch (err) {
    console.warn("Nominatim Geocode failed, using defaults.", err);
    if (locDistrict) locDistrict.textContent = defaultCity;
    if (locState) locState.textContent = "––";
    if (locCountry) locCountry.textContent = defaultCountry;
  }
}

/* ══════════════════════════════════════
   UPDATE CURRENT WEATHER UI
   ══════════════════════════════════════ */
function updateWeatherUI(data) {
  safeSetText(cityEl,        data.name);
  safeSetText(countryEl,     data.sys.country);
  safeSetText(tempEl,        `${Math.round(data.main.temp)}°C`);
  safeSetText(descriptionEl, capitalizeText(data.weather[0].description));
  safeSetText(feelsLikeEl,   `${Math.round(data.main.feels_like)}°C`);
  safeSetText(humidityEl,    `${data.main.humidity}%`);
  safeSetText(windEl,        `${(data.wind.speed * 3.6).toFixed(1)} km/h`);
  safeSetText(pressureEl,    `${data.main.pressure} hPa`);
  safeSetText(visibilityEl,  `${((data.visibility || 0) / 1000).toFixed(1)} km`);

  // Sun times calculation
  const sunrise = new Date(data.sys.sunrise * 1000);
  const sunset  = new Date(data.sys.sunset  * 1000);
  const dayMs   = data.sys.sunset * 1000 - data.sys.sunrise * 1000;
  const hours   = Math.floor(dayMs / 3600000);
  const minutes = Math.floor((dayMs % 3600000) / 60000);

  safeSetText(sunriseEl,    sunrise.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
  safeSetText(sunsetEl,     sunset.toLocaleTimeString("en-US",  { hour: "2-digit", minute: "2-digit" }));
  safeSetText(dayLengthEl,  `${hours}h ${minutes}m`);

  // Backwards compatibility image element update
  const iconCode = data.weather[0].icon;
  if (weatherIconEl) {
    weatherIconEl.src = `${CONFIG.ICON_URL}/${iconCode}@2x.png`;
  }

  // Render Premium CSS Animated Icon
  renderCSSAnimatedIcon(data.weather[0].main, data.weather[0].id);

  // Recommendations and Alerts
  updateRecommendationEngine(data.weather[0].main, data.main.temp, data.main.humidity, data.wind.speed);
  updateWeatherAlerts(data);

  // Favorite button status update
  updateFavoriteBtnUI();

  // Theme auto background change
  setDynamicWeatherBackground(data.weather[0].main, data.weather[0].id, data.sys.sunrise, data.sys.sunset);
}

function safeSetText(el, value) {
  if (el) el.textContent = value;
}

function capitalizeText(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ══════════════════════════════════════
   PREMIUM CSS ANIMATED ICONS (Phase 9)
   ══════════════════════════════════════ */
function renderCSSAnimatedIcon(condition, weatherId) {
  if (!animatedIconContainer) return;
  animatedIconContainer.innerHTML = "";

  let iconHTML = "";
  const condLower = condition.toLowerCase();

  if (weatherId >= 200 && weatherId < 300) {
    // Thunderstorm
    iconHTML = `
      <div class="weather-icon-css thunderstorm">
        <div class="cloud-body thunder-cloud"></div>
        <div class="lightning-bolt"></div>
      </div>`;
  } else if ((weatherId >= 300 && weatherId < 400) || (weatherId >= 500 && weatherId < 600)) {
    // Rain or Drizzle
    iconHTML = `
      <div class="weather-icon-css rainy">
        <div class="cloud-body"></div>
        <div class="rain-drops">
          <span class="rain-drop"></span>
          <span class="rain-drop"></span>
          <span class="rain-drop"></span>
        </div>
      </div>`;
  } else if (weatherId >= 600 && weatherId < 700) {
    // Snow
    iconHTML = `
      <div class="weather-icon-css snowy">
        <div class="cloud-body"></div>
        <div class="snow-flakes">
          <span class="snow-flake"></span>
          <span class="snow-flake"></span>
          <span class="snow-flake"></span>
        </div>
      </div>`;
  } else if (weatherId >= 700 && weatherId < 800) {
    // Mist, Fog, Haze
    iconHTML = `
      <div class="weather-icon-css misty">
        <div class="fog-lines">
          <span class="fog-line"></span>
          <span class="fog-line"></span>
          <span class="fog-line"></span>
        </div>
      </div>`;
  } else if (weatherId === 800) {
    // Sunny/Clear
    iconHTML = `
      <div class="weather-icon-css sunny">
        <div class="sun-body"></div>
        <div class="sun-rays"></div>
      </div>`;
  } else {
    // Cloudy (801 - 804)
    iconHTML = `
      <div class="weather-icon-css cloudy">
        <div class="cloud-body cloud-back"></div>
        <div class="cloud-body cloud-front"></div>
      </div>`;
  }

  animatedIconContainer.innerHTML = iconHTML;
}

/* ══════════════════════════════════════
   WEATHER RECOMMENDATIONS (Phase 4)
   ══════════════════════════════════════ */
function updateRecommendationEngine(condition, temp, humidity, windSpeed) {
  if (!recommendationsList) return;
  recommendationsList.innerHTML = "";

  const recs = [];

  // 1. Temp recommendations
  if (temp > 33) {
    recs.push({ icon: "fa-sun", title: "Heat & UV Advisory", desc: "Wear sunblock, sunglasses, and lightweight clothes. Avoid peak heat.", type: "heat" });
    recs.push({ icon: "fa-glass-water", title: "Hydration", desc: "Drink plenty of water even if you don't feel thirsty.", type: "hydr" });
  } else if (temp < 12) {
    recs.push({ icon: "fa-shirt", title: "Cold Advisory", desc: "Dress in warm layers, and wear gloves or a scarf if outdoors.", type: "cold" });
  }

  // 2. Weather condition recommendations
  const condLower = condition.toLowerCase();
  if (condLower.includes("rain") || condLower.includes("drizzle")) {
    recs.push({ icon: "fa-umbrella", title: "Wet Weather Gear", desc: "Carry an umbrella, wear waterproof shoes and jacket.", type: "rain" });
    recs.push({ icon: "fa-car-burst", title: "Driving Alert", desc: "Roads are slippery; double your braking distance.", type: "drive" });
  } else if (condLower.includes("thunderstorm")) {
    recs.push({ icon: "fa-house-circle-exclamation", title: "Severe Weather Safety", desc: "Stay indoors. Disconnect electronics to protect from surges.", type: "thunder" });
  } else if (condLower.includes("snow")) {
    recs.push({ icon: "fa-snowflake", title: "Snow & Ice", desc: "Watch out for black ice. Wear high-grip snow boots.", type: "snow" });
  } else if (condLower.includes("mist") || condLower.includes("fog") || condLower.includes("haze")) {
    recs.push({ icon: "fa-smog", title: "Low Visibility", desc: "Use low-beam fog lights. Reduce speed while driving.", type: "fog" });
  }

  // 3. Humidity & Wind recommendations
  if (humidity > 80 && temp > 28) {
    recs.push({ icon: "fa-temperature-arrow-up", title: "High Muggy Index", desc: "Air feels sticky. Keep indoor fan running for ventilation.", type: "muggy" });
  }
  if (windSpeed * 3.6 > 40) {
    recs.push({ icon: "fa-wind", title: "Strong Winds", desc: "Secure outdoor patio items. Avoid cycling or high rooftops.", type: "wind" });
  }

  // Fallback default recommendations if none match
  if (recs.length === 0) {
    recs.push({ icon: "fa-face-smile", title: "Perfect Day", desc: "Conditions are great! Splendid day to plan outdoor activities.", type: "ideal" });
    recs.push({ icon: "fa-shirt", title: "Comfort Dress", desc: "Dress comfortably in normal light clothes.", type: "dress" });
  }

  // Render cards
  recommendationsList.innerHTML = recs.map(rec => `
    <div class="rec-card rec-type-${rec.type || "default"}">
      <div class="rec-icon-wrap"><i class="fa-solid ${rec.icon}"></i></div>
      <div class="rec-body">
        <h4>${rec.title}</h4>
        <p>${rec.desc}</p>
      </div>
    </div>
  `).join("");
}

/* ══════════════════════════════════════
   WEATHER ALERTS SYSTEM (Phase 5)
   ══════════════════════════════════════ */
function updateWeatherAlerts(data) {
  if (!alertsBanner) return;
  alertsBanner.innerHTML = "";
  alertsBanner.classList.add("hidden");

  const alerts = [];
  const temp = data.main.temp;
  const windKmh = data.wind.speed * 3.6;
  const condition = data.weather[0].main;
  const weatherId = data.weather[0].id;

  // Temperature thresholds
  if (temp > 40) {
    alerts.push({ severity: "high", icon: "fa-triangle-exclamation", title: "Extreme Heat Wave Warning", desc: "Dangerous heat above 40°C. Avoid sun exposure and stay hydrated." });
  } else if (temp > 35) {
    alerts.push({ severity: "medium", icon: "fa-circle-exclamation", title: "High Heat Advisory", desc: "Elevated temperature. Take breaks in shaded or air-conditioned environments." });
  } else if (temp < 0) {
    alerts.push({ severity: "high", icon: "fa-snowflake", title: "Hard Freeze Warning", desc: "Sub-zero temperatures. Frost damage hazard to pipes and plants." });
  }

  // Wind thresholds
  if (windKmh > 55) {
    alerts.push({ severity: "high", icon: "fa-wind", title: "Strong Gale Warning", desc: "High winds exceeding 55 km/h. Watch for falling branches or debris." });
  } else if (windKmh > 40) {
    alerts.push({ severity: "medium", icon: "fa-wind", title: "Wind Advisory", desc: "Gusty winds. Drive high-profile vehicles with care." });
  }

  // Condition thresholds
  if (weatherId >= 200 && weatherId < 300) {
    alerts.push({ severity: "high", icon: "fa-cloud-bolt", title: "Severe Thunderstorm Warning", desc: "Active lightning strikes and heavy downpours in progress." });
  } else if (weatherId === 502 || weatherId === 503 || weatherId === 504 || weatherId === 522) {
    alerts.push({ severity: "high", icon: "fa-cloud-showers-heavy", title: "Torrential Rain Warning", desc: "High precipitation volume. Beware of immediate localized flash flooding." });
  }

  if (alerts.length > 0) {
    alertsBanner.classList.remove("hidden");
    alertsBanner.innerHTML = alerts.map(alert => `
      <div class="alert-strip severity-${alert.severity}">
        <span class="alert-title-block">
          <i class="fa-solid ${alert.icon}"></i>
          <strong>${alert.title}</strong>
        </span>
        <span class="alert-desc-block">${alert.desc}</span>
      </div>
    `).join("");
  } else {
    // Show green "All Clear" banner
    alertsBanner.classList.remove("hidden");
    alertsBanner.innerHTML = `
      <div class="alert-strip severity-low">
        <span class="alert-title-block">
          <i class="fa-solid fa-circle-check"></i>
          <strong>No Active Weather Alerts</strong>
        </span>
        <span class="alert-desc-block">Conditions are stable and safe in this region.</span>
      </div>`;
  }
}

/* ══════════════════════════════════════
   DYNAMIC WEATHER BACKGROUNDS (Phase 10)
   ══════════════════════════════════════ */
const BACKGROUND_THEMES = {
  Thunderstorm: { cls: "bg-thunderstorm", anim: "anim-lightning" },
  Drizzle:      { cls: "bg-rain",         anim: "anim-rain" },
  Rain:         { cls: "bg-rain",         anim: "anim-rain" },
  Snow:         { cls: "bg-snow",         anim: "anim-snow" },
  Mist:         { cls: "bg-mist",         anim: "anim-mist" },
  Smoke:        { cls: "bg-mist",         anim: "anim-mist" },
  Haze:         { cls: "bg-mist",         anim: "anim-mist" },
  Fog:          { cls: "bg-mist",         anim: "anim-mist" },
  Clouds:       { cls: "bg-cloudy",       anim: "anim-clouds" },
  Clear:        { cls: "bg-sunny",        anim: "anim-sun" },
};

function setDynamicWeatherBackground(condition, weatherId, sunriseSec, sunsetSec) {
  let theme = BACKGROUND_THEMES[condition] || { cls: "bg-sunny", anim: "anim-sun" };

  // Night-time check (Phase 10: stars / night background replacement)
  const nowSec = Math.floor(Date.now() / 1000);
  const isNight = nowSec < sunriseSec || nowSec > sunsetSec;

  if (isNight) {
    theme = { cls: "bg-night", anim: "anim-stars" };
  }

  // Remove existing bg-* classes from body
  document.body.className = document.body.className
    .replace(/\bbg-\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  document.body.classList.add(theme.cls);

  // Injected CSS particle generator
  if (animationLayer) {
    animationLayer.className = "animation-layer " + theme.anim;
    animationLayer.innerHTML = generateBackgroundParticles(theme.anim);
  }
}

function generateBackgroundParticles(animType) {
  if (animType === "anim-rain" || animType === "anim-lightning") {
    return Array.from({ length: 60 }, () =>
      `<div class="drop" style="left:${Math.random()*100}%;animation-delay:${(Math.random()*2).toFixed(2)}s;animation-duration:${(0.6+Math.random()*0.6).toFixed(2)}s"></div>`
    ).join("") + (animType === "anim-lightning" ? '<div class="lightning"></div>' : "");
  }
  if (animType === "anim-snow") {
    return Array.from({ length: 50 }, () =>
      `<div class="flake" style="left:${Math.random()*100}%;width:${(4+Math.random()*8).toFixed(0)}px;height:${(4+Math.random()*8).toFixed(0)}px;animation-delay:${(Math.random()*5).toFixed(2)}s;animation-duration:${(4+Math.random()*4).toFixed(2)}s"></div>`
    ).join("");
  }
  if (animType === "anim-clouds") {
    return Array.from({ length: 6 }, (_, i) =>
      `<div class="cloud" style="top:${5+i*10}%;animation-delay:${i*3}s;width:${100+i*40}px;opacity:${0.3+i*0.08}"></div>`
    ).join("");
  }
  if (animType === "anim-sun") {
    return '<div class="sun-ray-container"><div class="sun-core"></div>' +
      Array.from({ length: 12 }, (_, i) =>
        `<div class="sun-ray" style="transform:rotate(${i*30}deg)"></div>`
      ).join("") + '</div>';
  }
  if (animType === "anim-mist") {
    return Array.from({ length: 5 }, (_, i) =>
      `<div class="mist-band" style="top:${10+i*15}%;animation-delay:${i*1.5}s"></div>`
    ).join("");
  }
  if (animType === "anim-stars") {
    // Premium Night stars twinkle animation
    return Array.from({ length: 60 }, () =>
      `<div class="star" style="left:${Math.random()*100}%;top:${Math.random()*100}%;width:${(1+Math.random()*2.5).toFixed(1)}px;height:${(1+Math.random()*2.5).toFixed(1)}px;animation-delay:${(Math.random()*4).toFixed(2)}s;animation-duration:${(1.5+Math.random()*3).toFixed(2)}s"></div>`
    ).join("");
  }
  return "";
}

/* ══════════════════════════════════════
   5-DAY FORECAST & CHARTS (Phase 8 & 7)
   ══════════════════════════════════════ */
async function getForecast(city) {
  if (!forecastContainer) return;
  const apiKey = getActiveApiKey();
  const cacheKey = `forecast_${city.toLowerCase()}`;
  const cached = getCachedData(cacheKey);

  try {
    let data;
    if (cached) {
      data = cached;
    } else {
      const url = `${CONFIG.BASE_URL}/forecast?q=${encodeURIComponent(city)}&units=${CONFIG.UNITS}&appid=${apiKey}`;
      const res  = await fetch(url);
      if (!res.ok) throw new Error("Forecast API failure");
      data = await res.json();
      setCachedData(cacheKey, data);
    }

    forecastDataCache = data;

    // Filter to one reading per day (e.g. at 12:00)
    const dailyMap = {};
    data.list.forEach(item => {
      const date = item.dt_txt.split(" ")[0];
      if (!dailyMap[date] && item.dt_txt.includes("12:00:00")) {
        dailyMap[date] = item;
      }
    });

    // Fallback: make sure we have at least 5 days
    data.list.forEach(item => {
      const date = item.dt_txt.split(" ")[0];
      if (!dailyMap[date]) dailyMap[date] = item;
    });

    const days = Object.values(dailyMap).slice(1, 6); // skip today, take next 5 days

    // Render Cards
    forecastContainer.innerHTML = days.map(day => {
      const dateObj = new Date(day.dt * 1000);
      const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
      const dateStr = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const tempMax = Math.round(day.main.temp_max);
      const tempMin = Math.round(day.main.temp_min);
      const icon = day.weather[0].icon;
      const desc = capitalizeText(day.weather[0].description);

      return `
        <div class="forecast-card">
          <div class="fc-day">${dayName}</div>
          <div class="fc-date">${dateStr}</div>
          <img class="fc-icon" src="${CONFIG.ICON_URL}/${icon}@2x.png" alt="${desc}">
          <div class="fc-temp">${tempMax}°<span class="fc-min">${tempMin}°</span></div>
          <div class="fc-desc">${desc}</div>
        </div>`;
    }).join("");

    // Hourly Forecast strip (8 increments = 24 Hours)
    if (hourlyContainer) {
      const hourly = data.list.slice(0, 8);
      hourlyContainer.innerHTML = hourly.map(slot => {
        const slotTime = new Date(slot.dt * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        const temp = Math.round(slot.main.temp);
        const icon = slot.weather[0].icon;
        const desc = capitalizeText(slot.weather[0].description);

        return `
          <div class="hourly-card">
            <div class="hc-time">${slotTime}</div>
            <img class="hc-icon" src="${CONFIG.ICON_URL}/${icon}@2x.png" alt="${desc}">
            <div class="hc-temp">${temp}°C</div>
            <div class="hc-desc">${desc}</div>
          </div>`;
      }).join("");
    }

    // Build charts
    renderTrendForecastChart();
    renderAnalyticsDashboard(data.list);

  } catch (err) {
    console.error("Forecast fetch failed:", err);
    if (forecastContainer) {
      forecastContainer.innerHTML = `<p class="no-data">Forecast data currently unavailable.</p>`;
    }
  }
}

// Render trend chart for forecast (Phase 8)
function renderTrendForecastChart() {
  const canvas = $("forecastTrendChart");
  if (!canvas || !forecastDataCache) return;

  // Destroy existing trend chart
  if (trendChartInstance) {
    trendChartInstance.destroy();
    trendChartInstance = null;
  }

  // Filter 8 midday data points (or just next 8 steps in forecast)
  const slots = forecastDataCache.list.slice(0, 8);
  const labels = slots.map(s => {
    const d = new Date(s.dt * 1000);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", weekday: "short" });
  });

  let dataValues = [];
  let labelText = "";
  let borderColor = "";
  let bgColor = "";

  if (activeTrendTab === "temp") {
    dataValues = slots.map(s => s.main.temp);
    labelText = "Temperature (°C)";
    borderColor = CONFIG.CHART_COLORS.temp.border;
    bgColor = CONFIG.CHART_COLORS.temp.bg;
  } else if (activeTrendTab === "humidity") {
    dataValues = slots.map(s => s.main.humidity);
    labelText = "Humidity (%)";
    borderColor = CONFIG.CHART_COLORS.humidity.border;
    bgColor = CONFIG.CHART_COLORS.humidity.bg;
  } else if (activeTrendTab === "rain") {
    dataValues = slots.map(s => Math.round((s.pop || 0) * 100)); // probability of precipitation %
    labelText = "Precipitation Probability (%)";
    borderColor = CONFIG.CHART_COLORS.rain.border;
    bgColor = CONFIG.CHART_COLORS.rain.bg;
  }

  const ctx = canvas.getContext("2d");
  trendChartInstance = new Chart(ctx, {
    type: activeTrendTab === "rain" ? "bar" : "line",
    data: {
      labels: labels,
      datasets: [{
        label: labelText,
        data: dataValues,
        borderColor: borderColor,
        backgroundColor: bgColor,
        borderWidth: 2,
        tension: 0.3,
        fill: activeTrendTab !== "rain",
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.85)",
          titleColor: "#fff",
          bodyColor: "#fff",
          padding: 10,
          displayColors: false
        }
      },
      scales: {
        x: { ticks: { color: "rgba(255, 255, 255, 0.7)" }, grid: { display: false } },
        y: { ticks: { color: "rgba(255, 255, 255, 0.7)" }, grid: { color: "rgba(255, 255, 255, 0.15)" } }
      }
    }
  });
}

function initChartToggles() {
  const tabs = ["temp", "humidity", "rain"];
  tabs.forEach(tab => {
    const btn = $(`toggleChart${tab.charAt(0).toUpperCase() + tab.slice(1)}`);
    if (btn) {
      btn.addEventListener("click", () => {
        tabs.forEach(t => $(`toggleChart${t.charAt(0).toUpperCase() + t.slice(1)}`).classList.remove("active"));
        btn.classList.add("active");
        activeTrendTab = tab;
        renderTrendForecastChart();
      });
    }
  });
}

// Render detailed analytics dashboard charts (Phase 7)
function renderAnalyticsDashboard(forecastList) {
  // 1. Calculate values
  let maxTemp = -999;
  let minTemp = 999;
  let totalTemp = 0;
  let totalWind = 0;

  forecastList.forEach(s => {
    if (s.main.temp_max > maxTemp) maxTemp = s.main.temp_max;
    if (s.main.temp_min < minTemp) minTemp = s.main.temp_min;
    totalTemp += s.main.temp;
    totalWind += s.wind.speed;
  });

  const avgTemp = totalTemp / forecastList.length;
  const avgWind = totalWind / forecastList.length;

  safeSetText($("statMaxTemp"), `${Math.round(maxTemp)}°C`);
  safeSetText($("statMinTemp"), `${Math.round(minTemp)}°C`);
  safeSetText($("statAvgTemp"), `${Math.round(avgTemp)}°C`);
  safeSetText($("statAvgWind"), `${(avgWind * 3.6).toFixed(1)} km/h`);

  // Daily grouping for analytics trends
  const dailyTemps = {};
  const dailyHumidities = {};
  const dailyPressures = {};

  forecastList.forEach(s => {
    const d = new Date(s.dt * 1000).toLocaleDateString("en-US", { weekday: "short" });
    if (!dailyTemps[d]) {
      dailyTemps[d] = [];
      dailyHumidities[d] = [];
      dailyPressures[d] = [];
    }
    dailyTemps[d].push(s.main.temp);
    dailyHumidities[d].push(s.main.humidity);
    dailyPressures[d].push(s.main.pressure);
  });

  const dates = Object.keys(dailyTemps).slice(0, 5);
  const avgTemps = dates.map(d => dailyTemps[d].reduce((a,b)=>a+b, 0) / dailyTemps[d].length);
  const avgHumids = dates.map(d => dailyHumidities[d].reduce((a,b)=>a+b, 0) / dailyHumidities[d].length);
  const avgPress = dates.map(d => dailyPressures[d].reduce((a,b)=>a+b, 0) / dailyPressures[d].length);

  // Destroy existing charts to prevent memory leak
  if (tempChartInstance) tempChartInstance.destroy();
  if (humidityChartInstance) humidityChartInstance.destroy();
  if (pressureChartInstance) pressureChartInstance.destroy();

  // Create Temp Chart
  const ctxTemp = $("analyticsTempChart").getContext("2d");
  tempChartInstance = new Chart(ctxTemp, {
    type: "bar",
    data: {
      labels: dates,
      datasets: [{
        label: "Temp Avg",
        data: avgTemps,
        backgroundColor: CONFIG.CHART_COLORS.temp.bg,
        borderColor: CONFIG.CHART_COLORS.temp.border,
        borderWidth: 1.5
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "rgba(255, 255, 255, 0.7)" }, grid: { display: false } },
        y: { ticks: { color: "rgba(255, 255, 255, 0.7)" }, grid: { color: "rgba(255,255,255,0.1)" } }
      }
    }
  });

  // Create Humidity Chart
  const ctxHum = $("analyticsHumidityChart").getContext("2d");
  humidityChartInstance = new Chart(ctxHum, {
    type: "line",
    data: {
      labels: dates,
      datasets: [{
        label: "Humidity Avg",
        data: avgHumids,
        borderColor: CONFIG.CHART_COLORS.humidity.border,
        backgroundColor: CONFIG.CHART_COLORS.humidity.bg,
        fill: true,
        borderWidth: 2,
        tension: 0.3
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "rgba(255, 255, 255, 0.7)" }, grid: { display: false } },
        y: { ticks: { color: "rgba(255, 255, 255, 0.7)" }, grid: { color: "rgba(255,255,255,0.1)" } }
      }
    }
  });

  // Create Pressure Chart
  const ctxPress = $("analyticsPressureChart").getContext("2d");
  pressureChartInstance = new Chart(ctxPress, {
    type: "line",
    data: {
      labels: dates,
      datasets: [{
        label: "Pressure Avg",
        data: avgPress,
        borderColor: CONFIG.CHART_COLORS.wind.border,
        backgroundColor: "transparent",
        borderWidth: 2,
        tension: 0.2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: "rgba(255, 255, 255, 0.7)" }, grid: { display: false } },
        y: { ticks: { color: "rgba(255, 255, 255, 0.7)" }, grid: { color: "rgba(255,255,255,0.1)" } }
      }
    }
  });
}

/* ══════════════════════════════════════
   AIR QUALITY INDEX (AQI)
   ══════════════════════════════════════ */
const AQI_RANGES = [
  { label: "Good",        color: "#22c55e", bg: "rgba(34,197,94,0.2)" },
  { label: "Fair",        color: "#84cc16", bg: "rgba(132,204,22,0.2)" },
  { label: "Moderate",    color: "#eab308", bg: "rgba(234,179,8,0.2)" },
  { label: "Poor",        color: "#f97316", bg: "rgba(249,115,22,0.2)" },
  { label: "Very Poor",   color: "#ef4444", bg: "rgba(239,68,68,0.2)" },
];

async function getAQI(lat, lon) {
  if (!aqiValue || !aqiLabel || !aqiBar) return;
  const apiKey = getActiveApiKey();
  const cacheKey = `aqi_${lat}_${lon}`;
  const cached = getCachedData(cacheKey);

  try {
    let data;
    if (cached) {
      data = cached;
    } else {
      const url = `${CONFIG.BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;
      const res  = await fetch(url);
      if (!res.ok) throw new Error("AQI API failure");
      data = await res.json();
      setCachedData(cacheKey, data);
    }

    const aqiVal = data.list[0].main.aqi; // 1–5 range
    const range = AQI_RANGES[aqiVal - 1] || AQI_RANGES[0];

    aqiValue.textContent = aqiVal;
    aqiLabel.textContent = range.label;
    aqiLabel.style.color = range.color;
    aqiBar.style.width   = `${(aqiVal / 5) * 100}%`;
    aqiBar.style.background = range.color;

    const aqiCard = $("aqiCard");
    if (aqiCard) {
      aqiCard.style.setProperty("--aqi-glow", range.color);
    }

    const comps = data.list[0].components;
    safeSetText($("pm25"), `PM2.5: ${comps.pm2_5.toFixed(1)} μg/m³`);
    safeSetText($("pm10"), `PM10: ${comps.pm10.toFixed(1)} μg/m³`);

  } catch (err) {
    console.warn("Failed to fetch air pollution data.", err);
    safeSetText(aqiLabel, "Unavailable");
  }
}

/* ══════════════════════════════════════
   WEATHER MAP (Leaflet.js Overlay)
   ══════════════════════════════════════ */
function initializeWeatherMap() {
  if (weatherMapInstance || !$("weatherMap")) return;
  try {
    weatherMapInstance = L.map("weatherMap", { zoomControl: true, scrollWheelZoom: false }).setView([20, 78], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(weatherMapInstance);

    // Weather temp tiles layer overlay
    const apiKey = getActiveApiKey();
    L.tileLayer(
      `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${apiKey}`,
      { opacity: 0.45, maxZoom: 18 }
    ).addTo(weatherMapInstance);
  } catch (err) {
    console.warn("Failed to initialize Leaflet Map:", err);
  }
}

function updateWeatherMap(lat, lon, name) {
  if (!weatherMapInstance) initializeWeatherMap();
  if (!weatherMapInstance) return;

  try {
    weatherMapInstance.setView([lat, lon], 10, { animate: true });
    if (mapMarkerInstance) {
      mapMarkerInstance.remove();
    }

    const pinIcon = L.divIcon({
      className: "map-marker",
      html: `<div class="marker-pin"><i class="fa-solid fa-location-dot"></i></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });

    mapMarkerInstance = L.marker([lat, lon], { icon: pinIcon })
      .addTo(weatherMapInstance)
      .bindPopup(`<b>${name}</b><br>Lat: ${lat.toFixed(3)}, Lon: ${lon.toFixed(3)}`)
      .openPopup();

  } catch (err) {
    console.warn("Map coordinate refresh failed:", err);
  }
}

/* ══════════════════════════════════════
   NEARBY CITIES WEATHER (Phase 13)
   ══════════════════════════════════════ */
async function getNearbyCities(lat, lon) {
  if (!nearbyCitiesContainer) return;
  nearbyCitiesContainer.innerHTML = "";

  const apiKey = getActiveApiKey();
  const cacheKey = `nearby_${lat}_${lon}`;
  const cached = getCachedData(cacheKey);

  try {
    let data;
    if (cached) {
      data = cached;
    } else {
      // Fetch nearby weather coordinates (within bounds or via /find API)
      const url = `${CONFIG.BASE_URL}/find?lat=${lat}&lon=${lon}&cnt=6&units=${CONFIG.UNITS}&appid=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Nearby API response failed");
      data = await res.json();
      setCachedData(cacheKey, data);
    }

    // Exclude the current search city if returned
    const list = data.list.slice(1, 5); // Take 4 closest cities

    nearbyCitiesContainer.innerHTML = list.map(city => {
      const temp = Math.round(city.main.temp);
      const icon = city.weather[0].icon;
      const condition = city.weather[0].main;
      const humidity = city.main.humidity;

      return `
        <div class="nearby-card" onclick="document.getElementById('cityInput').value='${city.name}'; getWeatherByCity('${city.name}')">
          <div class="nb-city-row">
            <h4>${city.name}</h4>
            <span>${city.sys.country}</span>
          </div>
          <div class="nb-temp-row">
            <img src="${CONFIG.ICON_URL}/${icon}.png" alt="${condition}">
            <span class="nb-temp">${temp}°C</span>
          </div>
          <div class="nb-meta-row">
            <span>${condition}</span>
            <span><i class="fa-solid fa-droplet"></i> ${humidity}%</span>
          </div>
        </div>`;
    }).join("");

  } catch (err) {
    console.warn("Failed to find nearby cities, generating fallbacks based on search context.", err);
    nearbyCitiesContainer.innerHTML = `<p class="no-data">Nearby weather details unavailable.</p>`;
  }
}

/* ══════════════════════════════════════
   SEARCH HISTORY STORAGE
   ══════════════════════════════════════ */
function saveHistory(city) {
  let history = getHistory();
  // Keep unique searches
  history = history.filter(c => c.toLowerCase() !== city.toLowerCase());
  history.unshift(city);
  history = history.slice(0, CONFIG.HISTORY_LIMIT);
  localStorage.setItem("weatherHistory", JSON.stringify(history));
  renderHistory();
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem("weatherHistory")) || [];
  } catch {
    return [];
  }
}

function renderHistory() {
  if (!historySelect) return;
  const history = getHistory();
  historySelect.innerHTML = `<option value="">Option</option>` +
    history.map(city => `<option value="${city}">${city}</option>`).join("");
}

function clearHistory() {
  localStorage.removeItem("weatherHistory");
  renderHistory();
}

/* ══════════════════════════════════════
   FAVORITE CITIES STORAGE (Phase 14)
   ══════════════════════════════════════ */
function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem("weatherFavorites")) || [];
  } catch {
    return [];
  }
}

function saveFavorites(favs) {
  localStorage.setItem("weatherFavorites", JSON.stringify(favs));
}

function toggleFavorite(city) {
  if (!city) return;
  let favs = getFavorites();
  const idx = favs.findIndex(c => c.toLowerCase() === city.toLowerCase());

  if (idx > -1) {
    favs.splice(idx, 1);
  } else {
    if (favs.length >= CONFIG.FAVORITES_LIMIT) favs.pop();
    favs.unshift(city);
  }

  saveFavorites(favs);
  updateFavoritesPanel();
  updateFavoriteBtnUI();
}

function isFavorite(city) {
  if (!city) return false;
  return getFavorites().some(c => c.toLowerCase() === city.toLowerCase());
}

function updateFavoriteBtnUI() {
  if (!addFavoriteBtn || !currentCityName) return;
  const isFav = isFavorite(currentCityName);
  addFavoriteBtn.innerHTML = isFav
    ? '<i class="fa-solid fa-star"></i> Saved to Favorites'
    : '<i class="fa-regular fa-star"></i> Add to Favorites';
  addFavoriteBtn.classList.toggle("is-fav", isFav);
}

function updateFavoritesPanel() {
  if (!favoritesListEl) return;
  const favs = getFavorites();

  if (favs.length === 0) {
    favoritesListEl.innerHTML = `<li class="empty-list">No favorites saved.</li>`;
    return;
  }

  favoritesListEl.innerHTML = favs.map(city => `
    <li class="fav-item">
      <button class="fav-city-btn" data-city="${city}">
        <i class="fa-solid fa-star"></i> ${city}
      </button>
      <button class="fav-remove-btn" data-city="${city}" aria-label="Remove ${city}">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </li>`
  ).join("");

  // Bind clicks
  favoritesListEl.querySelectorAll(".fav-city-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      cityInput.value = btn.dataset.city;
      getWeatherByCity(btn.dataset.city);
    });
  });

  favoritesListEl.querySelectorAll(".fav-remove-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      toggleFavorite(btn.dataset.city);
    });
  });
}

/* ══════════════════════════════════════
   MULTI-CITY COMPARISON ENGINE (Phase 6)
   ══════════════════════════════════════ */
function initComparisonDashboard() {
  // Load saved comparison list or defaults
  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem("weatherCompareCities")) || [];
  } catch {
    saved = [];
  }

  if (saved.length === 0) {
    saved = CONFIG.DEFAULT_COMPARISON_CITIES;
    localStorage.setItem("weatherCompareCities", JSON.stringify(saved));
  }

  comparisonCities = saved;

  if (addComparisonBtn && comparisonInput) {
    addComparisonBtn.addEventListener("click", () => {
      const cityVal = comparisonInput.value.trim();
      if (cityVal && !comparisonCities.some(c => c.toLowerCase() === cityVal.toLowerCase())) {
        comparisonCities.push(cityVal);
        localStorage.setItem("weatherCompareCities", JSON.stringify(comparisonCities));
        renderComparisonTable();
        comparisonInput.value = "";
      }
    });

    comparisonInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addComparisonBtn.click();
    });
  }

  if (refreshComparisonBtn) {
    refreshComparisonBtn.addEventListener("click", () => {
      renderComparisonTable();
    });
  }

  // Sorting header bindings
  document.querySelectorAll("#comparisonTable th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const field = th.dataset.sort;
      if (currentSortField === field) {
        currentSortAscending = !currentSortAscending;
      } else {
        currentSortField = field;
        currentSortAscending = true;
      }
      sortAndRenderComparisonTable();
    });
  });

  renderComparisonTable();
}

async function renderComparisonTable() {
  if (!comparisonBody) return;
  comparisonBody.innerHTML = `<tr><td colspan="6" class="loading-cell">Loading comparisons...</td></tr>`;

  const apiKey = getActiveApiKey();
  const weatherRows = [];

  // Parallel fetches for efficiency
  const promises = comparisonCities.map(async (city) => {
    const cacheKey = `weather_city_${city.toLowerCase()}`;
    const cached = getCachedData(cacheKey);

    try {
      let data;
      if (cached) {
        data = cached;
      } else {
        const url = `${CONFIG.BASE_URL}/weather?q=${encodeURIComponent(city)}&units=${CONFIG.UNITS}&appid=${apiKey}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Fetch failed");
        data = await res.json();
        setCachedData(cacheKey, data);
      }
      weatherRows.push({
        city: data.name,
        temp: Math.round(data.main.temp),
        humidity: data.main.humidity,
        wind: (data.wind.speed * 3.6),
        condition: data.weather[0].main,
        icon: data.weather[0].icon
      });
    } catch {
      weatherRows.push({
        city: city,
        temp: null,
        humidity: null,
        wind: null,
        condition: "N/A",
        icon: null
      });
    }
  });

  await Promise.all(promises);
  comparisonBody.dataList = weatherRows;
  sortAndRenderComparisonTable();
}

function sortAndRenderComparisonTable() {
  if (!comparisonBody || !comparisonBody.dataList) return;
  const list = [...comparisonBody.dataList];

  const field = currentSortField;
  const asc = currentSortAscending;

  list.sort((a, b) => {
    let valA = a[field];
    let valB = b[field];

    if (valA === null) return 1;
    if (valB === null) return -1;

    if (typeof valA === "string") {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    if (valA < valB) return asc ? -1 : 1;
    if (valA > valB) return asc ? 1 : -1;
    return 0;
  });

  // Render sorted rows
  comparisonBody.innerHTML = list.map(item => {
    const tempText = item.temp !== null ? `${item.temp}°C` : "––";
    const humidText = item.humidity !== null ? `${item.humidity}%` : "––";
    const windText = item.wind !== null ? `${item.wind.toFixed(1)} km/h` : "––";
    const iconHTML = item.icon ? `<img src="${CONFIG.ICON_URL}/${item.icon}.png" width="30" height="30" alt="${item.condition}">` : "";

    return `
      <tr>
        <td class="comparison-city-name" onclick="document.getElementById('cityInput').value='${item.city}'; getWeatherByCity('${item.city}')">${item.city}</td>
        <td><strong>${tempText}</strong></td>
        <td>${humidText}</td>
        <td>${windText}</td>
        <td>
          <div class="td-weather-flex">
            ${iconHTML}
            <span>${item.condition}</span>
          </div>
        </td>
        <td>
          <button class="remove-comp-btn" data-city="${item.city}" aria-label="Remove comparison city">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </td>
      </tr>`;
  }).join("");

  // Remove binders
  comparisonBody.querySelectorAll(".remove-comp-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const city = btn.dataset.city;
      comparisonCities = comparisonCities.filter(c => c.toLowerCase() !== city.toLowerCase());
      localStorage.setItem("weatherCompareCities", JSON.stringify(comparisonCities));
      renderComparisonTable();
    });
  });

  // Update header indicators
  document.querySelectorAll("#comparisonTable th.sortable").forEach(th => {
    const sortField = th.dataset.sort;
    const icon = th.querySelector("i");
    if (icon) {
      if (sortField === currentSortField) {
        icon.className = currentSortAscending ? "fa-solid fa-sort-up" : "fa-solid fa-sort-down";
      } else {
        icon.className = "fa-solid fa-sort";
      }
    }
  });
}

/* ══════════════════════════════════════
   GEOLOCATION CONTROLLER
   ══════════════════════════════════════ */
function initGeolocationController() {
  if (!locationBtn) return;
  locationBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
      showError("Geolocation is not supported by your browser.");
      return;
    }
    locationBtn.classList.add("loading");
    locationBtn.disabled = true;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        locationBtn.classList.remove("loading");
        locationBtn.disabled = false;
        await getWeatherByCoords(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      (err) => {
        locationBtn.classList.remove("loading");
        locationBtn.disabled = false;
        const errMsgs = {
          1: "Location access denied. Please allow location permissions in settings.",
          2: "Position unavailable. Please search manually.",
          3: "Location request timed out. Try again.",
        };
        showError(errMsgs[err.code] || "Could not retrieve current location.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  });
}

/* ══════════════════════════════════════
   INITIALIZATION & SETUP
   ══════════════════════════════════════ */
window.addEventListener("DOMContentLoaded", () => {
  renderHistory();
  updateFavoritesPanel();
  showEmpty();
  initializeWeatherMap();
  initChartToggles();
  initComparisonDashboard();
  initGeolocationController();
  initSettingsPanel();

  // Bind keydown events
  if (cityInput) {
    cityInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && cityInput.value.trim()) {
        getWeatherByCity(cityInput.value.trim());
      }
    });
  }

  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      if (cityInput && cityInput.value.trim()) {
        getWeatherByCity(cityInput.value.trim());
      }
    });
  }

  if (addFavoriteBtn) {
    addFavoriteBtn.addEventListener("click", () => {
      if (currentCityName) toggleFavorite(currentCityName);
    });
  }

  if (historySelect) {
    historySelect.addEventListener("change", () => {
      if (historySelect.value) {
        if (cityInput) cityInput.value = historySelect.value;
        getWeatherByCity(historySelect.value);
        historySelect.value = "";
      }
    });
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", clearHistory);
  }

  // Load last searched city
  const history = getHistory();
  if (history.length > 0) {
    if (cityInput) cityInput.value = history[0];
    getWeatherByCity(history[0]);
  }
});
