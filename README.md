# 🌤️ Advanced Weather Pro Platform

An industry-level, production-ready, interactive Weather Forecast & Analytics Platform built using vanilla HTML5, CSS3, and JavaScript. Designed with premium glassmorphism aesthetics, responsive layouts, dynamic particle systems, and Chart.js dashboards, this project is fully optimized for resume showcases, portfolio highlights, and college project presentations.

---

## ✨ Features

### 1. ⚙️ Secure Settings Panel & API Key Manager
- Prevents hardcoded API key exposure by providing a GUI configuration popup to enter, toggle visibility, and save personal OpenWeatherMap keys in browser `localStorage`.
- Cascades seamlessly to default configurations if no key is entered.

### 2. 📍 Precise Geolocation & Reverse Geocoding
- Obtains live GPS coordinates (latitude/longitude) with browser accuracy radius bounds.
- Interrogates the OSM Nominatim API to resolve exact district, state/region, and country names, falling back to OpenWeatherMap city data when needed.

### 3. 💡 Weather Recommendation Engine
- Smart advisory cards displaying weather-specific outdoor planning tips, clothing layering advice, safety protocols during storms, hydration advisories during heatwaves, and driving visibility warnings.

### 4. ⚠️ Automated Weather Alerts System
- Dynamic local alerts indicating temperature extremes (Heatwave/Freeze warnings), severe wind hazards, poor Air Quality Index levels, active thunderstorms, and flash flood precipitation alerts.
- Displays a green "All Clear" advisory when weather conditions are safe.

### 5. 🎨 Animated CSS Weather Icons
- High-fidelity, lightweight CSS-animated vector weather icons replacing static pixelated imagery:
  - **Sunny**: Rotating sun with radiating aura.
  - **Cloudy**: Overlapping drifting clouds.
  - **Rainy**: Dripping drop particle drops.
  - **Snowy**: Rotating snowflake drop particles.
  - **Thunderstorm**: Flashing thunderclouds and animated lightning bolts.
  - **Misty**: Drifting horizontal fog lines.

### 6. 📊 Multi-City Comparison Dashboard
- Compare weather conditions side-by-side for multiple cities.
- Allows user to search and add custom cities to the comparison list.
- Interactively sort columns (City name, Temp, Humidity, Wind speed) in ascending/descending order.
- Action items to quickly switch focus to the city or remove it.

### 7. 📈 Analytics & Trend Charts (Chart.js Integration)
- **Interactive Trend Chart**: Line/Bar graph visualizing Temperature ranges, Humidity percentages, and Rain Probability over the upcoming forecast.
- **Analytics Dashboard**: Three separate Chart.js instances rendering:
  - Average Temperature Range per day (Bar chart).
  - Humidity Trend analysis (Line chart).
  - Atmospheric Pressure Trend (Smooth bezier curve).
- Includes card metrics tracking Maximum, Minimum, and Average temperature of the forecast window.

### 8. 🗺️ Weather Map & Nearby Cities
- Leaflet.js interactive maps featuring live OpenWeatherMap temperature color contour overlays.
- **Nearby Cities Finder**: Uses OWM `/find` API to look up and display weather summaries for 4 surrounding towns, allowing one-click navigation to their dashboards.

---

## 📁 File Structure

```text
weather-app-pro/
│
├── index.html              ← Main structure (Layout grids, settings, chart wrappers)
├── README.md               ← Documentation & guides
│
├── css/
│   ├── style.css           ← Base glassmorphism, responsive styles, animations, CSS icons
│   └── responsive.css      ← Mobile-first breakpoints (Laptops, Tablets, Phones)
│
├── js/
│   ├── config.js           ← OWM configuration, chart color tokens, default comparison cities
│   ├── theme.js            ← Independent dark/light mode manager (persisted)
│   └── script.js           ← Main controller (fetches, geocoding, comparison logic, Chart.js binds)
│
└── assets/
    └── images/             ← Backup weather icon assets
```

---

## 🚀 Getting Started

### 1. Configure the API Key
Open the application in any web browser. Click the **gear icon (Settings)** in the top right corner:
1. Paste your OpenWeatherMap API Key.
2. Click **Save Key**. The app will immediately refresh and load weather for your last searched city.

> **Get a Free API Key**: Register at [OpenWeatherMap.org](https://openweathermap.org/api) to get a free API key (supports Current Weather, 5-Day Forecast, Air Pollution, and Weather Map layers).

### 2. Run Locally
Simply open `index.html` in any web browser. 

*Highly recommended*: Run via a local web server (e.g. VS Code **Live Server** extension or `npx serve .`) to support geolocation API permissions.

---

## 🌐 APIs and Libraries

| Library / API | Description | Documentation |
|---|---|---|
| **OpenWeatherMap API** | Weather details, 5-Day forecast, AQI, nearby search, weather overlays | [Documentation](https://openweathermap.org/api) |
| **Nominatim API** | Reverse geocoding for precise area/district and state names | [Documentation](https://nominatim.org/) |
| **Chart.js** | Renders temperature range, pressure, humidity trends, and line charts | [Documentation](https://www.chartjs.org/) |
| **Leaflet.js** | Renders the interactive map canvas with OpenStreetMap tiles | [Documentation](https://leafletjs.com/) |
| **Font Awesome** | Rich icons used across recommendations, alerts, and headers | [Documentation](https://fontawesome.com/) |

---

## 🔐 Performance & Production Best Practices

- **Memory Leak Protection**: Active Chart.js instances are tracked and `.destroy()` is systematically called on canvas reload.
- **API Cache**: Implements an in-memory client-side cache with a 5-minute Time-To-Live (TTL) to throttle API requests.
- **Debounced Search**: Throttles search execution and safeguards against concurrent requests.
- **Production Key Security**: For deployment, set up a serverless function proxy (such as Netlify Functions, Vercel Serverless, or AWS Lambda) to forward requests to OpenWeatherMap and conceal your `API_KEY` from client-side inspection.

---

## 📄 License
This project is licensed under the MIT License - feel free to customize and showcase it in your portfolio!
