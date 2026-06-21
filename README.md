# 🌤️ Weather App Pro

A modern, portfolio-quality weather dashboard built with vanilla HTML, CSS, and JavaScript. Features real-time weather data, 5-day forecasts, air quality index, interactive maps, geolocation, and much more.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🌡️ Current Weather | Temperature, feels-like, humidity, wind, pressure, visibility |
| 📅 5-Day Forecast | Daily forecast cards with weather icons |
| ⏰ Hourly Forecast | Next 8 three-hour forecast slots |
| 🍃 Air Quality Index (AQI) | Color-coded AQI (1–5) with PM2.5 and PM10 values |
| 🌅 Sunrise & Sunset | Sun times with calculated day length |
| 📍 Geolocation | One-click weather for your current location |
| 🗺️ Interactive Map | Leaflet + OpenStreetMap with weather temperature overlay |
| ⭐ Favorite Cities | Save/remove cities, quick access weather |
| 🕑 Search History | Last 8 searches stored, selectable from dropdown |
| 🌙 Dark / Light Mode | Smooth theme toggle, persisted in localStorage |
| 🎨 Dynamic Backgrounds | Animated backgrounds per weather condition (rain, snow, sun, clouds, mist, thunderstorm) |
| 📱 Fully Responsive | Mobile-first design, works on all screen sizes |
| 🔴 Live Clock | Auto-updating date and time display |

---

## 🚀 Getting Started

### 1. Clone or Download

```bash
git clone https://github.com/your-username/weather-app-pro.git
cd weather-app-pro
```

### 2. Configure Your API Key

Open `js/config.js` and replace the API key:

```js
const CONFIG = {
  API_KEY: "your_openweathermap_api_key_here",
  ...
};
```

> **Get a free API key:** [https://openweathermap.org/api](https://openweathermap.org/api)
>
> The free tier includes:
> - Current Weather API
> - 5-Day / 3-Hour Forecast API
> - Air Pollution API
>
> ⚠️ New keys may take up to 2 hours to activate.

### 3. Open in Browser

Simply open `index.html` in any modern browser. No build step required.

```bash
# Option A: double-click index.html
# Option B: use Live Server in VS Code
# Option C: use any local HTTP server
npx serve .
```

---

## 📁 Project Structure

```
weather-app-pro/
│
├── index.html              ← Main HTML page
│
├── css/
│   ├── style.css           ← Main styles (glassmorphism, animations, all components)
│   └── responsive.css      ← Mobile-first responsive breakpoints
│
├── js/
│   ├── config.js           ← API key and configuration
│   ├── theme.js            ← Dark/light theme manager
│   └── script.js           ← Main application logic
│
├── assets/
│   └── images/             ← Local weather condition images
│       ├── clear.png
│       ├── clouds.png
│       ├── rain.png
│       ├── snow.png
│       └── ...
│
└── README.md
```

---

## 🎨 Weather Backgrounds

The app changes its background gradient and animated particles based on the live weather condition:

| Condition | Background | Animation |
|---|---|---|
| Clear / Sunny | Blue gradient | Animated sun rays |
| Clouds | Slate gradient | Drifting cloud shapes |
| Rain / Drizzle | Dark blue gradient | Falling rain drops |
| Thunderstorm | Near-black gradient | Rain + lightning flash |
| Snow | Light blue gradient | Falling snowflakes |
| Mist / Fog / Haze | Grey gradient | Drifting mist bands |

---

## 🔐 Security Note

> ⚠️ This is a **client-side only** application. The API key is visible in the browser's source code.
>
> For a **production deployment**, use a backend proxy server (Node.js, Python, etc.) that holds the API key server-side and forwards requests.

---

## 🌐 APIs Used

| API | Documentation |
|---|---|
| OpenWeatherMap – Current Weather | [docs](https://openweathermap.org/current) |
| OpenWeatherMap – 5-Day Forecast | [docs](https://openweathermap.org/forecast5) |
| OpenWeatherMap – Air Pollution | [docs](https://openweathermap.org/api/air-pollution) |
| OpenWeatherMap – Weather Tiles | [docs](https://openweathermap.org/api/weathermaps) |
| Leaflet.js | [leafletjs.com](https://leafletjs.com) |
| OpenStreetMap | [openstreetmap.org](https://openstreetmap.org) |

---

## 📱 Browser Support

| Browser | Support |
|---|---|
| Chrome 90+ | ✅ Full |
| Firefox 90+ | ✅ Full |
| Safari 14+ | ✅ Full |
| Edge 90+ | ✅ Full |
| Mobile Chrome/Safari | ✅ Full |

---

## 📄 License

MIT License – free for personal and commercial use.
