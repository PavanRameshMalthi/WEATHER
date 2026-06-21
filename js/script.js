/**
 * Weather App Pro – Main Application Script
 * ═══════════════════════════════════════════════════════════
 * Features:
 *  • Current weather with full data bindings
 *  • 5-day forecast
 *  • Hourly forecast strip (next 5 slots)
 *  • Air Quality Index (AQI)
 *  • Sunrise / Sunset card with day length
 *  • Geolocation support
 *  • Search history (localStorage)
 *  • Favorite cities (localStorage)
 *  • Interactive map (Leaflet + OpenStreetMap)
 *  • Dynamic weather backgrounds & animations
 *  • Live clock & date
 *  • Skeleton loaders
 *  • Debounced search autocomplete
 * ═══════════════════════════════════════════════════════════
 */

"use strict";

/* ══════════════════════════════════════
   DOM ELEMENT REFERENCES
══════════════════════════════════════ */
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelector(sel);

const cityInput      = $("cityInput");
const searchBtn      = $("searchBtn");
const locationBtn    = $("locationBtn");
const historySelect  = $("historySelect");
const clearHistoryBtn = $("clearHistoryBtn");
const forecastContainer = $("forecastContainer");
const hourlyContainer   = $("hourlyContainer");
const dateEl         = $("date");
const timeEl         = $("time");
const animationLayer = $("animation-layer");

// Weather data elements
const cityEl        = $$(".city");
const countryEl     = $$(".country");
const tempEl        = $$(".temp");
const descriptionEl = $$(".description");
const feelsLikeEl   = $$(".feels-like");
const humidityEl    = $$(".humidity");
const windEl        = $$(".wind");
const pressureEl    = $$(".pressure");
const sunriseEl     = $$(".sunrise");
const sunsetEl      = $$(".sunset");
const dayLengthEl   = $$(".day-length");
const visibilityEl  = $$(".visibility");
const weatherIconEl = $$(".weather-icon-img");

// UI state elements
const emptyState    = $("emptyState");
const loadingState  = $("loadingState");
const errorState    = $("errorState");
const errorMsg      = $("errorMsg");
const weatherContent = $("weatherContent");

// AQI
const aqiValue      = $("aqiValue");
const aqiLabel      = $("aqiLabel");
const aqiBar        = $("aqiBar");

// Favorites
const favoritesListEl = $("favoritesList");
const addFavoriteBtn  = $("addFavoriteBtn");

// Map
let weatherMap = null;
let mapMarker  = null;

// State
let currentCity = null;
let currentLat  = null;
let currentLon  = null;
let searchDebounceTimer = null;

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
  if (errorMsg)      errorMsg.textContent = message || "Something went wrong. Please try again.";
}

function showWeather() {
  if (emptyState)    emptyState.classList.add("hidden");
  if (loadingState)  loadingState.classList.add("hidden");
  if (errorState)    errorState.classList.add("hidden");
  if (weatherContent) weatherContent.classList.remove("hidden");
}

/* ══════════════════════════════════════
   WEATHER FETCH (Current)
══════════════════════════════════════ */
async function getWeatherByCity(city) {
  if (!city || !city.trim()) return;
  showLoading();
  try {
    const url = `${CONFIG.BASE_URL}/weather?q=${encodeURIComponent(city)}&units=${CONFIG.UNITS}&appid=${CONFIG.API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) throw new Error(`City "${city}" not found. Please check the spelling.`);
      throw new Error("Failed to fetch weather data. Please try again.");
    }
    const data = await res.json();
    currentLat = data.coord.lat;
    currentLon = data.coord.lon;
    currentCity = data.name;
    updateWeatherUI(data);
    saveHistory(data.name);
    updateFavoritesPanel();
    await Promise.all([
      getForecast(city),
      getAQI(data.coord.lat, data.coord.lon),
    ]);
    updateMap(data.coord.lat, data.coord.lon, data.name);
    showWeather();
  } catch (err) {
    showError(err.message);
  }
}

async function getWeatherByCoords(lat, lon) {
  showLoading();
  try {
    const url = `${CONFIG.BASE_URL}/weather?lat=${lat}&lon=${lon}&units=${CONFIG.UNITS}&appid=${CONFIG.API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Could not retrieve weather for your location.");
    const data = await res.json();
    currentLat = lat;
    currentLon = lon;
    currentCity = data.name;
    if (cityInput) cityInput.value = data.name;
    updateWeatherUI(data);
    saveHistory(data.name);
    updateFavoritesPanel();
    await Promise.all([
      getForecast(data.name),
      getAQI(lat, lon),
    ]);
    updateMap(lat, lon, data.name);
    showWeather();
  } catch (err) {
    showError(err.message);
  }
}

/* ══════════════════════════════════════
   UPDATE WEATHER UI
══════════════════════════════════════ */
function updateWeatherUI(data) {
  safeSet(cityEl,        data.name);
  safeSet(countryEl,     data.sys.country);
  safeSet(tempEl,        `${Math.round(data.main.temp)}°C`);
  safeSet(descriptionEl, capitalize(data.weather[0].description));
  safeSet(feelsLikeEl,   `${Math.round(data.main.feels_like)}°C`);
  safeSet(humidityEl,    `${data.main.humidity}%`);
  safeSet(windEl,        `${(data.wind.speed * 3.6).toFixed(1)} km/h`);
  safeSet(pressureEl,    `${data.main.pressure} hPa`);
  safeSet(visibilityEl,  `${((data.visibility || 0) / 1000).toFixed(1)} km`);

  const sunrise = new Date(data.sys.sunrise * 1000);
  const sunset  = new Date(data.sys.sunset  * 1000);
  const dayMs   = data.sys.sunset * 1000 - data.sys.sunrise * 1000;
  const hours   = Math.floor(dayMs / 3600000);
  const minutes = Math.floor((dayMs % 3600000) / 60000);
  safeSet(sunriseEl,    sunrise.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));
  safeSet(sunsetEl,     sunset.toLocaleTimeString("en-US",  { hour: "2-digit", minute: "2-digit" }));
  safeSet(dayLengthEl,  `${hours}h ${minutes}m`);

  // Weather icon
  const iconCode = data.weather[0].icon;
  if (weatherIconEl) {
    weatherIconEl.src = `${CONFIG.ICON_URL}/${iconCode}@2x.png`;
    weatherIconEl.alt = data.weather[0].description;
  }

  // Favorite button state
  updateAddFavBtn();

  // Dynamic background
  setWeatherBackground(data.weather[0].main, data.weather[0].id);
}

function safeSet(el, value) {
  if (el) el.textContent = value;
}

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ══════════════════════════════════════
   DYNAMIC WEATHER BACKGROUND
══════════════════════════════════════ */
const WEATHER_THEMES = {
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

function setWeatherBackground(condition, id) {
  const theme = WEATHER_THEMES[condition] || { cls: "bg-sunny", anim: "anim-sun" };

  // Remove all bg-* classes from body
  document.body.className = document.body.className
    .replace(/\bbg-\S+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  document.body.classList.add(theme.cls);

  // Animation layer
  if (animationLayer) {
    animationLayer.className = "animation-layer " + theme.anim;
    animationLayer.innerHTML = buildAnimationParticles(theme.anim, id);
  }
}

function buildAnimationParticles(animClass, id) {
  if (animClass === "anim-rain" || animClass === "anim-lightning") {
    return Array.from({ length: 60 }, (_, i) =>
      `<div class="drop" style="left:${Math.random()*100}%;animation-delay:${(Math.random()*2).toFixed(2)}s;animation-duration:${(0.6+Math.random()*0.6).toFixed(2)}s"></div>`
    ).join("") + (animClass === "anim-lightning" ? '<div class="lightning"></div>' : "");
  }
  if (animClass === "anim-snow") {
    return Array.from({ length: 50 }, (_, i) =>
      `<div class="flake" style="left:${Math.random()*100}%;width:${(4+Math.random()*8).toFixed(0)}px;height:${(4+Math.random()*8).toFixed(0)}px;animation-delay:${(Math.random()*5).toFixed(2)}s;animation-duration:${(4+Math.random()*4).toFixed(2)}s"></div>`
    ).join("");
  }
  if (animClass === "anim-clouds") {
    return Array.from({ length: 6 }, (_, i) =>
      `<div class="cloud" style="top:${5+i*10}%;animation-delay:${i*3}s;width:${100+i*40}px;opacity:${0.3+i*0.08}"></div>`
    ).join("");
  }
  if (animClass === "anim-sun") {
    return '<div class="sun-ray-container"><div class="sun-core"></div>' +
      Array.from({ length: 12 }, (_, i) =>
        `<div class="sun-ray" style="transform:rotate(${i*30}deg)"></div>`
      ).join("") + '</div>';
  }
  if (animClass === "anim-mist") {
    return Array.from({ length: 5 }, (_, i) =>
      `<div class="mist-band" style="top:${10+i*15}%;animation-delay:${i*1.5}s"></div>`
    ).join("");
  }
  return "";
}

/* ══════════════════════════════════════
   5-DAY FORECAST
══════════════════════════════════════ */
async function getForecast(city) {
  if (!forecastContainer) return;
  try {
    const url = `${CONFIG.BASE_URL}/forecast?q=${encodeURIComponent(city)}&units=${CONFIG.UNITS}&appid=${CONFIG.API_KEY}`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error("Forecast unavailable");
    const data = await res.json();

    // Daily: one reading per day at ~12:00
    const daily = {};
    data.list.forEach(item => {
      const date = item.dt_txt.split(" ")[0];
      if (!daily[date] && item.dt_txt.includes("12:00:00")) {
        daily[date] = item;
      }
    });

    // Fallback: if 12:00 not available for a day, take first available
    data.list.forEach(item => {
      const date = item.dt_txt.split(" ")[0];
      if (!daily[date]) daily[date] = item;
    });

    const days = Object.values(daily).slice(1, 6); // skip today, take 5

    forecastContainer.innerHTML = days.map(day => {
      const d = new Date(day.dt_txt);
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      const dateNum  = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const temp     = Math.round(day.main.temp);
      const tempMin  = Math.round(day.main.temp_min);
      const icon     = day.weather[0].icon;
      const desc     = capitalize(day.weather[0].description);
      return `
        <div class="forecast-card">
          <div class="fc-day">${dayName}</div>
          <div class="fc-date">${dateNum}</div>
          <img class="fc-icon" src="${CONFIG.ICON_URL}/${icon}@2x.png" alt="${desc}">
          <div class="fc-temp">${temp}°<span class="fc-min">${tempMin}°</span></div>
          <div class="fc-desc">${desc}</div>
        </div>`;
    }).join("");

    // Hourly strip (next 5 3-hour slots)
    if (hourlyContainer) {
      const hourly = data.list.slice(0, 8);
      hourlyContainer.innerHTML = hourly.map(slot => {
        const t    = new Date(slot.dt * 1000);
        const time = t.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
        const temp = Math.round(slot.main.temp);
        const icon = slot.weather[0].icon;
        const desc = capitalize(slot.weather[0].description);
        return `
          <div class="hourly-card">
            <div class="hc-time">${time}</div>
            <img class="hc-icon" src="${CONFIG.ICON_URL}/${icon}@2x.png" alt="${desc}">
            <div class="hc-temp">${temp}°C</div>
            <div class="hc-desc">${desc}</div>
          </div>`;
      }).join("");
    }
  } catch (e) {
    if (forecastContainer) forecastContainer.innerHTML = `<p class="no-data">Forecast data unavailable</p>`;
  }
}

/* ══════════════════════════════════════
   AIR QUALITY INDEX
══════════════════════════════════════ */
const AQI_CONFIG = [
  { label: "Good",        color: "#22c55e", bg: "rgba(34,197,94,0.2)",   max: 1 },
  { label: "Fair",        color: "#84cc16", bg: "rgba(132,204,22,0.2)",  max: 2 },
  { label: "Moderate",    color: "#eab308", bg: "rgba(234,179,8,0.2)",   max: 3 },
  { label: "Poor",        color: "#f97316", bg: "rgba(249,115,22,0.2)",  max: 4 },
  { label: "Very Poor",   color: "#ef4444", bg: "rgba(239,68,68,0.2)",   max: 5 },
];

async function getAQI(lat, lon) {
  if (!aqiValue || !aqiLabel || !aqiBar) return;
  try {
    const url = `${CONFIG.BASE_URL}/air_pollution?lat=${lat}&lon=${lon}&appid=${CONFIG.API_KEY}`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error("AQI unavailable");
    const data = await res.json();
    const aqi  = data.list[0].main.aqi; // 1–5
    const cfg  = AQI_CONFIG[aqi - 1] || AQI_CONFIG[0];
    aqiValue.textContent = aqi;
    aqiLabel.textContent = cfg.label;
    aqiLabel.style.color = cfg.color;
    aqiBar.style.width   = `${(aqi / 5) * 100}%`;
    aqiBar.style.background = cfg.color;

    const aqiCard = $("aqiCard");
    if (aqiCard) aqiCard.style.setProperty("--aqi-glow", cfg.color);

    // PM2.5 & PM10
    const comp = data.list[0].components;
    safeSet($("pm25"), `PM2.5: ${comp.pm2_5.toFixed(1)} μg/m³`);
    safeSet($("pm10"), `PM10: ${comp.pm10.toFixed(1)} μg/m³`);
  } catch {
    safeSet(aqiLabel, "Unavailable");
  }
}

/* ══════════════════════════════════════
   WEATHER MAP (Leaflet)
══════════════════════════════════════ */
function initMap() {
  if (weatherMap || !$("weatherMap")) return;
  try {
    weatherMap = L.map("weatherMap", { zoomControl: true, scrollWheelZoom: false }).setView([20, 78], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(weatherMap);

    // Weather tile overlay from OWM
    L.tileLayer(
      `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${CONFIG.API_KEY}`,
      { opacity: 0.5, maxZoom: 18 }
    ).addTo(weatherMap);
  } catch (e) {
    console.warn("Map init failed:", e);
  }
}

function updateMap(lat, lon, name) {
  if (!weatherMap) initMap();
  if (!weatherMap) return;
  try {
    weatherMap.setView([lat, lon], 10, { animate: true });
    if (mapMarker) mapMarker.remove();
    const customIcon = L.divIcon({
      className: "map-marker",
      html: `<div class="marker-pin"><i class="fa-solid fa-location-dot"></i></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 40],
    });
    mapMarker = L.marker([lat, lon], { icon: customIcon })
      .addTo(weatherMap)
      .bindPopup(`<b>${name}</b>`)
      .openPopup();
  } catch (e) {
    console.warn("Map update failed:", e);
  }
}

/* ══════════════════════════════════════
   SEARCH HISTORY
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
  } catch { return []; }
}

function renderHistory() {
  if (!historySelect) return;
  const history = getHistory();
  historySelect.innerHTML = `<option value="">🕑 Recent Searches</option>` +
    history.map(city => `<option value="${city}">${city}</option>`).join("");
}

function clearHistory() {
  localStorage.removeItem("weatherHistory");
  renderHistory();
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

/* ══════════════════════════════════════
   FAVORITE CITIES
══════════════════════════════════════ */
function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem("weatherFavorites")) || [];
  } catch { return []; }
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
  updateAddFavBtn();
}

function isFavorite(city) {
  if (!city) return false;
  return getFavorites().some(c => c.toLowerCase() === city.toLowerCase());
}

function updateAddFavBtn() {
  if (!addFavoriteBtn || !currentCity) return;
  const fav = isFavorite(currentCity);
  addFavoriteBtn.innerHTML = fav
    ? '<i class="fa-solid fa-star"></i> Saved'
    : '<i class="fa-regular fa-star"></i> Add';
  addFavoriteBtn.classList.toggle("is-fav", fav);
}

function updateFavoritesPanel() {
  if (!favoritesListEl) return;
  const favs = getFavorites();
  if (favs.length === 0) {
    favoritesListEl.innerHTML = `<li class="empty-list">No favorites yet. Search a city and tap Add.</li>`;
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

  // City click
  favoritesListEl.querySelectorAll(".fav-city-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (cityInput) cityInput.value = btn.dataset.city;
      getWeatherByCity(btn.dataset.city);
    });
  });

  // Remove click
  favoritesListEl.querySelectorAll(".fav-remove-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      toggleFavorite(btn.dataset.city);
    });
  });
}

if (addFavoriteBtn) {
  addFavoriteBtn.addEventListener("click", () => {
    if (currentCity) toggleFavorite(currentCity);
  });
}

/* ══════════════════════════════════════
   GEOLOCATION
══════════════════════════════════════ */
if (locationBtn) {
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
        await getWeatherByCoords(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        locationBtn.classList.remove("loading");
        locationBtn.disabled = false;
        const msgs = {
          1: "Location access denied. Please allow location in browser settings.",
          2: "Location unavailable. Try searching manually.",
          3: "Location request timed out. Try again.",
        };
        showError(msgs[err.code] || "Could not retrieve location.");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  });
}

/* ══════════════════════════════════════
   SEARCH EVENTS
══════════════════════════════════════ */
if (searchBtn) {
  searchBtn.addEventListener("click", () => {
    if (cityInput && cityInput.value.trim()) {
      getWeatherByCity(cityInput.value.trim());
    }
  });
}

if (cityInput) {
  cityInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && cityInput.value.trim()) {
      getWeatherByCity(cityInput.value.trim());
    }
  });
}

/* ══════════════════════════════════════
   INITIALISATION
══════════════════════════════════════ */
window.addEventListener("DOMContentLoaded", () => {
  renderHistory();
  updateFavoritesPanel();
  showEmpty();
  initMap();

  // Load last searched city
  const history = getHistory();
  if (history.length > 0) {
    if (cityInput) cityInput.value = history[0];
    getWeatherByCity(history[0]);
  }
});
