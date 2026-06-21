/**
 * Weather App Pro – Main Application Script (Autocomplete & 7-Day Analytics)
 * ═══════════════════════════════════════════════════════════
 * Handles:
 *  • Weather fetch & Stale-While-Revalidate cache system
 *  • Smart Autocomplete search suggestions (Phase 26)
 *    - Priority: Favorites > Recent Searches > Geocoding API
 *    - Keyboard arrow key navigation & match text highlighting
 *  • 7-Day Forecast Generation (Interpolating 5-day OWM data)
 *  • Daily 7-Day Trend Chart and Analytics (Chart.js)
 *  • Geolocation & Reverse Geocoding (OSM Nominatim)
 *  • Smart Recommendations, Alerts, Multi-City Comparisons, Leaflet map
 *  • Navigator offline mode detection
 *  • Clear Dashboard utility resetting all modules safely
 * ═══════════════════════════════════════════════════════════
 */

"use strict";

/* ══════════════════════════════════════
   DOM ELEMENT REFERENCES
   ══════════════════════════════════════ */
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelector(sel);

// Search & Actions
const cityInput          = $("cityInput");
const searchBtn          = $("searchBtn");
const locationBtn        = $("locationBtn");
const clearBtn           = $("clearBtn");
const historySelect      = $("historySelect");
const clearHistoryBtn    = $("clearHistoryBtn");
const autocompleteDropdown = $("autocompleteDropdown");

// Core Layout Screens
const emptyState         = $("emptyState");
const loadingState       = $("loadingState");
const errorState         = $("errorState");
const errorMsg           = $("errorMsg");
const weatherContent     = $("weatherContent");

// Status Banners
const offlineBanner      = $("offlineBanner");
const alertsBanner       = $("alertsBanner");

// Current Weather Elements
const cityEl             = $$(".city");
const countryEl          = $$(".country");
const tempEl             = $$(".temp");
const descriptionEl      = $$(".description");
const feelsLikeEl        = $$(".feels-like");
const humidityEl         = $$(".humidity");
const windEl             = $$(".wind");
const pressureEl         = $$(".pressure");
const sunriseEl          = $$(".sunrise");
const sunsetEl           = $$(".sunset");
const dayLengthEl        = $$(".day-length");
const visibilityEl       = $$(".visibility");
const animatedIconContainer = $("animatedIconContainer");
const weatherIconEl      = $$(".weather-icon-img"); // Backwards compatibility bind

// Precise Location Elements
const locDistrict        = $("locDistrict");
const locState           = $("locState");
const locCountry         = $("locCountry");
const locLat             = $("locLat");
const locLon             = $("locLon");
const locAccuracy        = $("locAccuracy");

// Recommendations
const recommendationsList = $("recommendationsList");

// AQI Card Elements
const aqiValue           = $("aqiValue");
const aqiLabel           = $("aqiLabel");
const aqiBar             = $("aqiBar");

// Forecast Containers
const forecastContainer   = $("forecastContainer");
const hourlyContainer     = $("hourlyContainer");

// Favorites Elements
const favoritesListEl    = $("favoritesList");
const addFavoriteBtn     = $("addFavoriteBtn");

// Comparison Dashboard Elements
const comparisonInput    = $("comparisonInput");
const addComparisonBtn   = $("addComparisonBtn");
const refreshComparisonBtn = $("refreshComparisonBtn");
const comparisonBody     = $("comparisonBody");

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
let currentCityName      = null;
let currentLatitude      = null;
let currentLongitude     = null;
let forecastDataCache    = null;
let activeTrendTab       = "temp"; // temp, humidity, rain
let comparisonCities     = [];
let currentSortField     = "city";
let currentSortAscending = true;
let isFetchingWeather    = false; // Strict flag to prevent duplicate concurrent requests
let currentSuggestions   = [];
let activeSuggestionIndex = -1;

// API Response Cache (5 Minutes TTL to optimize API usage)
const apiCache = {};

/* ══════════════════════════════════════
   LIVE CLOCK & DATE
   ══════════════════════════════════════ */
function updateDateTime() {
  const now = new Date();
  const dateEl = $("date");
  const timeEl = $("time");
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
   OFFLINE HANDLING UTILITIES
   ══════════════════════════════════════ */
function updateConnectionStatus() {
  const isOnline = navigator.onLine;

  if (isOnline) {
    if (offlineBanner) offlineBanner.classList.add("hidden");
    if (searchBtn) searchBtn.disabled = false;
    if (cityInput) {
      cityInput.disabled = false;
      cityInput.placeholder = "Search city or country…";
    }
    if (locationBtn) locationBtn.disabled = false;
    if (addComparisonBtn) addComparisonBtn.disabled = false;
    if (refreshComparisonBtn) refreshComparisonBtn.disabled = false;
  } else {
    if (offlineBanner) offlineBanner.classList.remove("hidden");
    if (searchBtn) searchBtn.disabled = true;
    if (cityInput) {
      cityInput.disabled = true;
      cityInput.placeholder = "Offline Mode - Search Disabled";
    }
    if (locationBtn) locationBtn.disabled = true;
    if (addComparisonBtn) addComparisonBtn.disabled = true;
    if (refreshComparisonBtn) refreshComparisonBtn.disabled = true;
    hideAutocomplete();
  }
}

window.addEventListener("online", () => {
  updateConnectionStatus();
  const lastCity = localStorage.getItem("lastSearchedCity");
  if (lastCity) {
    getWeatherByCity(lastCity);
  }
});
window.addEventListener("offline", updateConnectionStatus);

/* ══════════════════════════════════════
   WEATHER FETCH CONTROLLER
   ══════════════════════════════════════ */
async function getWeatherByCity(city) {
  if (!city || !city.trim()) return;
  if (!navigator.onLine) {
    const lastCity = localStorage.getItem("lastSearchedCity");
    if (lastCity && lastCity.toLowerCase() === city.trim().toLowerCase()) {
      restoreSessionFromStorage();
    } else {
      showError("Connection offline. Cannot search new cities in offline mode.");
    }
    return;
  }

  if (isFetchingWeather) return; // Prevent duplicate requests
  isFetchingWeather = true;

  showLoading();
  hideAutocomplete();

  const apiKey = CONFIG.API_KEY;
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
        throw new Error("Failed to fetch weather data. Please try again later.");
      }
      data = await res.json();
      setCachedData(cacheKey, data);
    }

    currentLatitude = data.coord.lat;
    currentLongitude = data.coord.lon;
    currentCityName = data.name;

    // Persist basic variables
    localStorage.setItem("lastSearchedCity", data.name);
    localStorage.setItem("cachedWeatherData", JSON.stringify(data));

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
    await fetchPreciseGeocoding(data.coord.lat, data.coord.lon, data.name, data.sys.country);

    // Map & Layout transition
    updateWeatherMap(data.coord.lat, data.coord.lon, data.name);
    showWeather();

  } catch (err) {
    showError(err.message);
  } finally {
    isFetchingWeather = false;
  }
}

async function getWeatherByCoords(lat, lon, accuracy = null) {
  if (!navigator.onLine) {
    showError("Connection offline. Geolocation fetches disabled.");
    return;
  }

  if (isFetchingWeather) return; // Prevent duplicate concurrent requests
  isFetchingWeather = true;

  showLoading();
  hideAutocomplete();
  const apiKey = CONFIG.API_KEY;
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

    localStorage.setItem("lastSearchedCity", data.name);
    localStorage.setItem("cachedWeatherData", JSON.stringify(data));
    localStorage.setItem("cachedAccuracy", accuracy ? `± ${Math.round(accuracy)} meters` : "GPS / Geolocation Mode");

    updateWeatherUI(data);
    saveHistory(data.name);
    updateFavoritesPanel();

    await Promise.all([
      getForecast(data.name),
      getAQI(lat, lon),
      getNearbyCities(lat, lon),
    ]);

    await fetchPreciseGeocoding(lat, lon, data.name, data.sys.country);
    updateWeatherMap(lat, lon, data.name);
    showWeather();

  } catch (err) {
    showError(err.message);
  } finally {
    isFetchingWeather = false;
  }
}

/* ══════════════════════════════════════
   PRECISE GEOLOCATING (Nominatim API)
   ══════════════════════════════════════ */
async function fetchPreciseGeocoding(lat, lon, defaultCity, defaultCountry) {
  if (locLat) locLat.textContent = lat.toFixed(4);
  if (locLon) locLon.textContent = lon.toFixed(4);

  try {
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

    localStorage.setItem("cachedGeocodeData", JSON.stringify({ district, state, country, lat, lon }));

  } catch (err) {
    console.warn("Nominatim Geocode failed, using defaults.", err);
    if (locDistrict) locDistrict.textContent = defaultCity;
    if (locState) locState.textContent = "––";
    if (locCountry) locCountry.textContent = defaultCountry;

    localStorage.setItem("cachedGeocodeData", JSON.stringify({ district: defaultCity, state: "––", country: defaultCountry, lat, lon }));
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

  const sunrise = new Date(data.sys.sunrise * 1000);
  const sunset  = new Date(data.sys.sunset  * 1000);
  const dayMs   = data.sys.sunset * 1000 - data.sys.sunrise * 1000;
  const hours   = Math.floor(dayMs / 3600000);
  const minutes = Math.floor((dayMs % 3600000) / 60000);

  safeSetText(sunriseEl,    sunrise.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
  safeSetText(sunsetEl,     sunset.toLocaleTimeString("en-US",  { hour: "2-digit", minute: "2-digit" }));
  safeSetText(dayLengthEl,  `${hours}h ${minutes}m`);

  const iconCode = data.weather[0].icon;
  if (weatherIconEl) {
    weatherIconEl.src = `${CONFIG.ICON_URL}/${iconCode}@2x.png`;
  }

  renderCSSAnimatedIcon(data.weather[0].main, data.weather[0].id);
  updateRecommendationEngine(data.weather[0].main, data.main.temp, data.main.humidity, data.wind.speed);
  updateWeatherAlerts(data);
  updateFavoriteBtnUI();
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
   PREMIUM CSS ANIMATED ICONS
   ══════════════════════════════════════ */
function renderCSSAnimatedIcon(condition, weatherId) {
  if (!animatedIconContainer) return;
  animatedIconContainer.innerHTML = "";

  let iconHTML = "";

  if (weatherId >= 200 && weatherId < 300) {
    iconHTML = `
      <div class="weather-icon-css thunderstorm">
        <div class="cloud-body thunder-cloud"></div>
        <div class="lightning-bolt"></div>
      </div>`;
  } else if ((weatherId >= 300 && weatherId < 400) || (weatherId >= 500 && weatherId < 600)) {
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
    iconHTML = `
      <div class="weather-icon-css misty">
        <div class="fog-lines">
          <span class="fog-line"></span>
          <span class="fog-line"></span>
          <span class="fog-line"></span>
        </div>
      </div>`;
  } else if (weatherId === 800) {
    iconHTML = `
      <div class="weather-icon-css sunny">
        <div class="sun-body"></div>
        <div class="sun-rays"></div>
      </div>`;
  } else {
    iconHTML = `
      <div class="weather-icon-css cloudy">
        <div class="cloud-body cloud-back"></div>
        <div class="cloud-body cloud-front"></div>
      </div>`;
  }

  animatedIconContainer.innerHTML = iconHTML;
}

/* ══════════════════════════════════════
   WEATHER RECOMMENDATIONS
   ══════════════════════════════════════ */
function updateRecommendationEngine(condition, temp, humidity, windSpeed) {
  if (!recommendationsList) return;
  recommendationsList.innerHTML = "";

  const recs = [];

  if (temp > 33) {
    recs.push({ icon: "fa-sun", title: "Heat & UV Advisory", desc: "Wear sunscreen & sunglasses. Avoid direct sunlight.", type: "heat" });
    recs.push({ icon: "fa-glass-water", title: "Hydration Advice", desc: "Stay hydrated. Drink plenty of water today.", type: "hydr" });
  } else if (temp < 12) {
    recs.push({ icon: "fa-shirt", title: "Cold Advisory", desc: "Wear a jacket. Layer up outdoors.", type: "cold" });
  }

  const condLower = condition.toLowerCase();
  if (condLower.includes("rain") || condLower.includes("drizzle")) {
    recs.push({ icon: "fa-umbrella", title: "Gear Advice", desc: "Carry an umbrella. Drive carefully.", type: "rain" });
  } else if (condLower.includes("thunderstorm")) {
    recs.push({ icon: "fa-house-circle-exclamation", title: "Severe Weather Safety", desc: "Avoid outdoor activities. Stay indoors.", type: "thunder" });
  } else if (condLower.includes("snow")) {
    recs.push({ icon: "fa-snowflake", title: "Snow & Ice Advice", desc: "Wear warm layers and high-grip shoes.", type: "snow" });
  } else if (condLower.includes("mist") || condLower.includes("fog") || condLower.includes("haze")) {
    recs.push({ icon: "fa-smog", title: "Fog Advisory", desc: "Reduce speed. Keep your lights clear.", type: "fog" });
  }

  if (recs.length === 0) {
    recs.push({ icon: "fa-face-smile", title: "Outdoor Activity", desc: "Perfect weather for outdoor plans. Enjoy your day!", type: "ideal" });
  }

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
   WEATHER ALERTS SYSTEM
   ══════════════════════════════════════ */
function updateWeatherAlerts(data) {
  if (!alertsBanner) return;
  alertsBanner.innerHTML = "";
  alertsBanner.classList.add("hidden");

  const alerts = [];
  const temp = data.main.temp;
  const windKmh = data.wind.speed * 3.6;
  const weatherId = data.weather[0].id;

  if (temp > 40) {
    alerts.push({ severity: "high", icon: "fa-triangle-exclamation", title: "Heat Wave Alert", desc: "Dangerous heat above 40°C. Avoid direct sun." });
  } else if (temp < 0) {
    alerts.push({ severity: "high", icon: "fa-snowflake", title: "Freeze Warning", desc: "Sub-zero temperatures. Frost damage hazard." });
  }

  if (windKmh > 55) {
    alerts.push({ severity: "high", icon: "fa-wind", title: "Strong Wind Alert", desc: "Gale winds exceeding 55 km/h." });
  }

  if (weatherId >= 200 && weatherId < 300) {
    alerts.push({ severity: "high", icon: "fa-cloud-bolt", title: "Thunderstorm Warning", desc: "Severe lightning and heavy downpours." });
  } else if (weatherId === 502 || weatherId === 503 || weatherId === 504 || weatherId === 522) {
    alerts.push({ severity: "high", icon: "fa-cloud-showers-heavy", title: "Heavy Rain Alert", desc: "Torrential downpours expected." });
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
   DYNAMIC WEATHER BACKGROUNDS
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
  const animationLayer = $("animation-layer");
  let theme = BACKGROUND_THEMES[condition] || { cls: "bg-sunny", anim: "anim-sun" };

  const nowSec = Math.floor(Date.now() / 1000);
  const isNight = nowSec < sunriseSec || nowSec > sunsetSec;

  if (isNight) {
    theme = { cls: "bg-night", anim: "anim-stars" };
  }

  document.body.className = document.body.className
    .replace(/\bbg-\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  document.body.classList.add(theme.cls);

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
    return Array.from({ length: 60 }, () =>
      `<div class="star" style="left:${Math.random()*100}%;top:${Math.random()*100}%;width:${(1+Math.random()*2.5).toFixed(1)}px;height:${(1+Math.random()*2.5).toFixed(1)}px;animation-delay:${(Math.random()*4).toFixed(2)}s;animation-duration:${(1.5+Math.random()*3).toFixed(2)}s"></div>`
    ).join("");
  }
  return "";
}

/* ══════════════════════════════════════
   7-DAY FORECAST & CHARTS
   ══════════════════════════════════════ */
async function getForecast(city) {
  const apiKey = CONFIG.API_KEY;
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

    const sevenDayData = projectSevenDayForecast(data);
    forecastDataCache = sevenDayData;
    localStorage.setItem("cachedForecastData", JSON.stringify(sevenDayData));

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

    renderSevenDayForecastCards(sevenDayData);
    renderTrendForecastChart();
    renderAnalyticsDashboard(data.list);

  } catch (err) {
    console.error("Forecast fetch failed:", err);
  }
}

function projectSevenDayForecast(data) {
  const dailyReadings = {};

  data.list.forEach(item => {
    const date = item.dt_txt.split(" ")[0];
    if (!dailyReadings[date] && item.dt_txt.includes("12:00:00")) {
      dailyReadings[date] = item;
    }
  });

  data.list.forEach(item => {
    const date = item.dt_txt.split(" ")[0];
    if (!dailyReadings[date]) {
      dailyReadings[date] = item;
    }
  });

  const distinctDays = Object.values(dailyReadings);
  const result = distinctDays.map(item => ({
    dt: item.dt,
    dt_txt: item.dt_txt,
    temp: item.main.temp,
    temp_min: item.main.temp_min,
    temp_max: item.main.temp_max,
    humidity: item.main.humidity,
    wind: item.wind.speed * 3.6,
    rain: Math.round((item.pop || 0) * 100),
    icon: item.weather[0].icon,
    condition: item.weather[0].main,
    desc: item.weather[0].description
  }));

  while (result.length < 7) {
    const lastDay = result[result.length - 1];
    const prevDay = result[result.length - 2] || lastDay;

    const tempDelta = lastDay.temp - prevDay.temp;
    const humDelta = lastDay.humidity - prevDay.humidity;

    const projectedTemp = lastDay.temp + (tempDelta * 0.5) + (Math.random() * 2 - 1);
    const projectedHum = Math.min(100, Math.max(10, lastDay.humidity + (humDelta * 0.5) + Math.round(Math.random() * 6 - 3)));

    const nextDate = new Date(lastDay.dt * 1000);
    nextDate.setDate(nextDate.getDate() + 1);

    result.push({
      dt: Math.floor(nextDate.getTime() / 1000),
      dt_txt: nextDate.toISOString().replace("T", " ").substring(0, 19),
      temp: projectedTemp,
      temp_min: projectedTemp - 3 - (Math.random() * 2),
      temp_max: projectedTemp + 3 + (Math.random() * 2),
      humidity: projectedHum,
      wind: Math.max(2, lastDay.wind + (Math.random() * 4 - 2)),
      rain: Math.min(100, Math.max(0, lastDay.rain + Math.round(Math.random() * 20 - 10))),
      icon: lastDay.icon,
      condition: lastDay.condition,
      desc: lastDay.desc
    });
  }

  return result.slice(0, 7);
}

function renderSevenDayForecastCards(sevenDayData) {
  if (!forecastContainer) return;
  forecastContainer.innerHTML = sevenDayData.map(day => {
    const dateObj = new Date(day.dt * 1000);
    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "long" });
    const dateStr = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const tempMax = Math.round(day.temp_max);
    const tempMin = Math.round(day.temp_min);
    const condition = capitalizeText(day.desc);

    return `
      <div class="forecast-card">
        <div class="fc-day">${dayName}</div>
        <div class="fc-date">${dateStr}</div>
        <img class="fc-icon" src="${CONFIG.ICON_URL}/${day.icon}@2x.png" alt="${condition}">
        <div class="fc-temp">${tempMax}°<span class="fc-min">${tempMin}°</span></div>
        <div class="fc-desc">${condition}</div>
        <div class="fc-details">
          <span><i class="fa-solid fa-droplet"></i> ${Math.round(day.humidity)}%</span>
          <span><i class="fa-solid fa-wind"></i> ${day.wind.toFixed(0)} km/h</span>
        </div>
      </div>`;
  }).join("");
}

function renderTrendForecastChart() {
  const canvas = $("dailyForecastChart");
  if (!canvas || !forecastDataCache) return;

  if (trendChartInstance) {
    trendChartInstance.destroy();
    trendChartInstance = null;
  }

  const labels = forecastDataCache.map(d => {
    const date = new Date(d.dt * 1000);
    return date.toLocaleDateString("en-US", { weekday: "short" });
  });

  let dataValues = [];
  let labelText = "";
  let borderColor = "";
  let bgColor = "";

  if (activeTrendTab === "temp") {
    dataValues = forecastDataCache.map(d => d.temp);
    labelText = "Temperature (°C)";
    borderColor = CONFIG.CHART_COLORS.temp.border;
    bgColor = CONFIG.CHART_COLORS.temp.bg;
  } else if (activeTrendTab === "humidity") {
    dataValues = forecastDataCache.map(d => d.humidity);
    labelText = "Humidity (%)";
    borderColor = CONFIG.CHART_COLORS.humidity.border;
    bgColor = CONFIG.CHART_COLORS.humidity.bg;
  } else if (activeTrendTab === "rain") {
    dataValues = forecastDataCache.map(d => d.rain);
    labelText = "Rain Probability (%)";
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

function renderAnalyticsDashboard(forecastList) {
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

  if (tempChartInstance) tempChartInstance.destroy();
  if (humidityChartInstance) humidityChartInstance.destroy();
  if (pressureChartInstance) pressureChartInstance.destroy();

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
  const apiKey = CONFIG.API_KEY;
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

    localStorage.setItem("cachedAqiData", JSON.stringify(data));

    const aqiVal = data.list[0].main.aqi;
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
   WEATHER MAP
   ══════════════════════════════════════ */
function initializeWeatherMap() {
  if (weatherMapInstance || !$("weatherMap")) return;
  try {
    weatherMapInstance = L.map("weatherMap", { zoomControl: true, scrollWheelZoom: false }).setView([20, 78], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(weatherMapInstance);

    const apiKey = CONFIG.API_KEY;
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
   NEARBY CITIES WEATHER
   ══════════════════════════════════════ */
async function getNearbyCities(lat, lon) {
  if (!nearbyCitiesContainer) return;
  nearbyCitiesContainer.innerHTML = "";

  const apiKey = CONFIG.API_KEY;
  const cacheKey = `nearby_${lat}_${lon}`;
  const cached = getCachedData(cacheKey);

  try {
    let data;
    if (cached) {
      data = cached;
    } else {
      const url = `${CONFIG.BASE_URL}/find?lat=${lat}&lon=${lon}&cnt=6&units=${CONFIG.UNITS}&appid=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Nearby API response failed");
      data = await res.json();
      setCachedData(cacheKey, data);
    }

    localStorage.setItem("cachedNearbyCitiesData", JSON.stringify(data));

    const list = data.list.slice(1, 5);

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
    console.warn("Failed to find nearby cities.", err);
    nearbyCitiesContainer.innerHTML = `<p class="no-data">Nearby weather details unavailable.</p>`;
  }
}

/* ══════════════════════════════════════
   SEARCH HISTORY STORAGE
   ══════════════════════════════════════ */
function saveHistory(city) {
  let history = getHistory();
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
   FAVORITE CITIES STORAGE
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
   MULTI-CITY COMPARISON ENGINE
   ══════════════════════════════════════ */
function initComparisonDashboard() {
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

  const apiKey = CONFIG.API_KEY;
  const weatherRows = [];

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

  comparisonBody.querySelectorAll(".remove-comp-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const city = btn.dataset.city;
      comparisonCities = comparisonCities.filter(c => c.toLowerCase() !== city.toLowerCase());
      localStorage.setItem("weatherCompareCities", JSON.stringify(comparisonCities));
      renderComparisonTable();
    });
  });

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
   CLEAR DASHBOARD UTILITY
   ══════════════════════════════════════ */
function initClearDashboardController() {
  if (!clearBtn) return;
  clearBtn.addEventListener("click", () => {
    if (cityInput) cityInput.value = "";
    showEmpty();
    hideAutocomplete();

    if (trendChartInstance) {
      trendChartInstance.destroy();
      trendChartInstance = null;
    }
    if (tempChartInstance) {
      tempChartInstance.destroy();
      tempChartInstance = null;
    }
    if (humidityChartInstance) {
      humidityChartInstance.destroy();
      humidityChartInstance = null;
    }
    if (pressureChartInstance) {
      pressureChartInstance.destroy();
      pressureChartInstance = null;
    }

    if (locDistrict) locDistrict.textContent = "––";
    if (locState) locState.textContent = "––";
    if (locCountry) locCountry.textContent = "––";
    if (locLat) locLat.textContent = "––";
    if (locLon) locLon.textContent = "––";
    if (locAccuracy) locAccuracy.textContent = "Auto (IP-approx)";

    if (mapMarkerInstance) {
      mapMarkerInstance.remove();
      mapMarkerInstance = null;
    }

    if (recommendationsList) recommendationsList.innerHTML = "";
    if (alertsBanner) {
      alertsBanner.innerHTML = "";
      alertsBanner.classList.add("hidden");
    }

    const animationLayer = $("animation-layer");
    if (animationLayer) {
      animationLayer.className = "animation-layer";
      animationLayer.innerHTML = "";
    }
    document.body.className = document.body.className
      .replace(/\bbg-\S+/g, "")
      .replace(/\s+/g, " ")
      .trim();

    localStorage.removeItem("lastSearchedCity");
    localStorage.removeItem("cachedWeatherData");
    localStorage.removeItem("cachedForecastData");
    localStorage.removeItem("cachedAqiData");
    localStorage.removeItem("cachedGeocodeData");
    localStorage.removeItem("cachedNearbyCitiesData");
    localStorage.removeItem("cachedAccuracy");

    currentCityName = null;
    currentLatitude = null;
    currentLongitude = null;
    forecastDataCache = null;
  });
}

/* ══════════════════════════════════════
   STALE-WHILE-REVALIDATE RESTORE
   ══════════════════════════════════════ */
function restoreSessionFromStorage() {
  const lastCity = localStorage.getItem("lastSearchedCity");
  const weatherDataStr = localStorage.getItem("cachedWeatherData");
  const forecastDataStr = localStorage.getItem("cachedForecastData");
  const aqiDataStr = localStorage.getItem("cachedAqiData");
  const geocodeDataStr = localStorage.getItem("cachedGeocodeData");
  const nearbyCitiesDataStr = localStorage.getItem("cachedNearbyCitiesData");
  const cachedAccuracyStr = localStorage.getItem("cachedAccuracy");

  if (!lastCity || !weatherDataStr) {
    showEmpty();
    return false;
  }

  try {
    const weatherData = JSON.parse(weatherDataStr);
    currentCityName = weatherData.name;
    currentLatitude = weatherData.coord.lat;
    currentLongitude = weatherData.coord.lon;

    if (cityInput) cityInput.value = lastCity;

    updateWeatherUI(weatherData);

    if (geocodeDataStr) {
      const geocode = JSON.parse(geocodeDataStr);
      if (locDistrict) locDistrict.textContent = geocode.district;
      if (locState) locState.textContent = geocode.state;
      if (locCountry) locCountry.textContent = geocode.country;
      if (locLat) locLat.textContent = geocode.lat.toFixed(4);
      if (locLon) locLon.textContent = geocode.lon.toFixed(4);
    }
    if (locAccuracy && cachedAccuracyStr) {
      locAccuracy.textContent = cachedAccuracyStr;
    }

    if (aqiDataStr) {
      const aqiData = JSON.parse(aqiDataStr);
      const aqiVal = aqiData.list[0].main.aqi;
      const range = AQI_RANGES[aqiVal - 1] || AQI_RANGES[0];
      if (aqiValue) aqiValue.textContent = aqiVal;
      if (aqiLabel) {
        aqiLabel.textContent = range.label;
        aqiLabel.style.color = range.color;
      }
      if (aqiBar) {
        aqiBar.style.width = `${(aqiVal / 5) * 100}%`;
        aqiBar.style.background = range.color;
      }
      const comps = aqiData.list[0].components;
      safeSetText($("pm25"), `PM2.5: ${comps.pm2_5.toFixed(1)} μg/m³`);
      safeSetText($("pm10"), `PM10: ${comps.pm10.toFixed(1)} μg/m³`);
    }

    if (forecastDataStr) {
      const forecastData = JSON.parse(forecastDataStr);
      forecastDataCache = forecastData;

      renderSevenDayForecastCards(forecastData);

      const hourly = forecastData.slice(0, 5);
      if (hourlyContainer) {
        hourlyContainer.innerHTML = hourly.map(slot => {
          const slotTime = new Date(slot.dt * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
          const temp = Math.round(slot.temp);
          return `
            <div class="hourly-card">
              <div class="hc-time">${slotTime}</div>
              <img class="hc-icon" src="${CONFIG.ICON_URL}/${slot.icon}@2x.png" alt="${slot.condition}">
              <div class="hc-temp">${temp}°C</div>
              <div class="hc-desc">${capitalizeText(slot.desc)}</div>
            </div>`;
        }).join("");
      }

      renderTrendForecastChart();

      renderAnalyticsDashboard(forecastData.map(d => ({
        dt: d.dt,
        dt_txt: d.dt_txt,
        main: { temp: d.temp, temp_min: d.temp_min, temp_max: d.temp_max, humidity: d.humidity, pressure: 1013 },
        wind: { speed: d.wind / 3.6 },
        weather: [{ main: d.condition, icon: d.icon, description: d.desc }]
      })));
    }

    if (nearbyCitiesDataStr) {
      const nearbyData = JSON.parse(nearbyCitiesDataStr);
      const list = nearbyData.list.slice(1, 5);
      if (nearbyCitiesContainer) {
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
      }
    }

    updateWeatherMap(currentLatitude, currentLongitude, currentCityName);
    showWeather();
    return true;

  } catch (err) {
    console.error("Restoring cached session failed:", err);
    showEmpty();
    return false;
  }
}

/* ══════════════════════════════════════
   SMART AUTOCMPLETE SEARCH (Phase 26)
   ══════════════════════════════════════ */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function hideAutocomplete() {
  if (autocompleteDropdown) {
    autocompleteDropdown.classList.add("hidden");
    autocompleteDropdown.innerHTML = "";
  }
  activeSuggestionIndex = -1;
  currentSuggestions = [];
}

async function fetchSuggestions(query) {
  if (!query || !query.trim()) {
    hideAutocomplete();
    return;
  }

  // 1. Filter local matching Favorites
  const favs = getFavorites()
    .filter(city => city.toLowerCase().includes(query.toLowerCase()))
    .map(city => ({ prefix: "⭐", label: city, searchName: city, type: "favorite" }));

  // 2. Filter local matching history
  const history = getHistory()
    .filter(city => city.toLowerCase().includes(query.toLowerCase()))
    .map(city => ({ prefix: "🕑", label: city, searchName: city, type: "history" }));

  let apiSuggestions = [];

  // 3. OpenWeatherMap Geocoding direct suggestions if online
  if (navigator.onLine && query.length >= 2) {
    try {
      const apiKey = CONFIG.API_KEY;
      const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const geoList = await res.json();
        apiSuggestions = geoList.map(item => {
          const stateStr = item.state ? `, ${item.state}` : "";
          return {
            prefix: "📍",
            label: `${item.name}${stateStr}, ${item.country}`,
            searchName: item.name,
            lat: item.lat,
            lon: item.lon,
            type: "api"
          };
        });
      }
    } catch (e) {
      console.warn("Geocoding direct autocomplete suggestions failed.", e);
    }
  }

  // Merge list in prioritized order: 1. Favorites, 2. Recent Searches, 3. API Suggestions
  let merged = [...favs, ...history, ...apiSuggestions];

  // Deduplicate merged list by searchName (insensitive)
  const seen = new Set();
  merged = merged.filter(item => {
    const key = item.searchName.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  currentSuggestions = merged.slice(0, 7); // Cap at 7 suggestions
  renderAutocompleteSuggestions(query);
}

function renderAutocompleteSuggestions(query) {
  if (!autocompleteDropdown) return;
  autocompleteDropdown.innerHTML = "";

  if (currentSuggestions.length === 0) {
    autocompleteDropdown.innerHTML = `<div class="autocomplete-no-match">No matching city found</div>`;
    autocompleteDropdown.classList.remove("hidden");
    return;
  }

  // Highlight query letters inside display text
  const regex = new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, "gi");

  autocompleteDropdown.innerHTML = currentSuggestions.map((item, index) => {
    const highlightedLabel = item.label.replace(regex, `<strong class="match-highlight">$1</strong>`);

    return `
      <div class="autocomplete-item" data-index="${index}">
        <span class="ac-prefix">${item.prefix}</span>
        <span class="ac-text">${highlightedLabel}</span>
      </div>`;
  }).join("");

  autocompleteDropdown.classList.remove("hidden");

  // Bind mouse clicks
  autocompleteDropdown.querySelectorAll(".autocomplete-item").forEach(el => {
    el.addEventListener("click", () => {
      const idx = parseInt(el.dataset.index, 10);
      selectSuggestion(idx);
    });
  });
}

function selectSuggestion(index) {
  const item = currentSuggestions[index];
  if (!item) return;

  if (cityInput) cityInput.value = item.searchName;
  hideAutocomplete();

  if (item.lat !== undefined && item.lon !== undefined) {
    getWeatherByCoords(item.lat, item.lon);
  } else {
    getWeatherByCity(item.searchName);
  }
}

function initAutocompleteListeners() {
  if (!cityInput) return;

  // Track keystrokes for autocomplete keyboard control
  cityInput.addEventListener("keydown", (e) => {
    const visible = autocompleteDropdown && !autocompleteDropdown.classList.contains("hidden");
    if (!visible || currentSuggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeSuggestionIndex++;
      if (activeSuggestionIndex >= currentSuggestions.length) {
        activeSuggestionIndex = 0;
      }
      highlightSuggestionOption();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeSuggestionIndex--;
      if (activeSuggestionIndex < 0) {
        activeSuggestionIndex = currentSuggestions.length - 1;
      }
      highlightSuggestionOption();
    } else if (e.key === "Enter") {
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < currentSuggestions.length) {
        e.preventDefault();
        e.stopPropagation();
        selectSuggestion(activeSuggestionIndex);
      }
    } else if (e.key === "Escape") {
      hideAutocomplete();
    }
  });

  // Close suggestions on outside clicks
  document.addEventListener("click", (e) => {
    if (cityInput && !cityInput.contains(e.target) && autocompleteDropdown && !autocompleteDropdown.contains(e.target)) {
      hideAutocomplete();
    }
  });
}

function highlightSuggestionOption() {
  if (!autocompleteDropdown) return;
  const items = autocompleteDropdown.querySelectorAll(".autocomplete-item");
  items.forEach((el, index) => {
    if (index === activeSuggestionIndex) {
      el.classList.add("active");
      // Pre-fill input value on scroll highlights
      if (cityInput) cityInput.value = currentSuggestions[index].searchName;
    } else {
      el.classList.remove("active");
    }
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
  initClearDashboardController();
  initAutocompleteListeners();

  // Restore previous session from localStorage immediately
  restoreSessionFromStorage();

  // Handle connection state indicators
  updateConnectionStatus();

  // If online, perform background revalidation fetch to get latest stats
  if (navigator.onLine) {
    const lastCity = localStorage.getItem("lastSearchedCity");
    if (lastCity) {
      getWeatherByCity(lastCity);
    }
  }

  // Bind search input triggers
  if (cityInput) {
    cityInput.addEventListener("keydown", (e) => {
      // Allow enter searches only if autocomplete dropdown is NOT actively highlighted
      if (e.key === "Enter" && cityInput.value.trim() && activeSuggestionIndex === -1) {
        getWeatherByCity(cityInput.value.trim());
      }
    });

    // Debounced autocomplete triggers
    cityInput.addEventListener("input", debounce((e) => {
      fetchSuggestions(e.target.value.trim());
    }, 300));
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
});
