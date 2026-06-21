/**
 * Weather App Pro – Configuration
 * ─────────────────────────────────────────────────────────────
 * Replace the API_KEY value below with your OpenWeatherMap key.
 * Get a free key at: https://openweathermap.org/api
 *
 * NOTE: For a production deployment, use a backend proxy so the
 * key is never exposed in client-side JavaScript.
 * ─────────────────────────────────────────────────────────────
 */
const CONFIG = {
  API_KEY: "d6423fba36e4b31f8259fff92dd65842",
  BASE_URL: "https://api.openweathermap.org/data/2.5",
  ICON_URL: "https://openweathermap.org/img/wn",
  UNITS: "metric",
  HISTORY_LIMIT: 8,
  FAVORITES_LIMIT: 10,
  DEFAULT_COMPARISON_CITIES: ["Kakinada", "Hyderabad", "Bangalore", "Chennai", "Delhi"],
  CHART_COLORS: {
    temp: {
      border: "rgba(255, 99, 132, 1)",
      bg: "rgba(255, 99, 132, 0.2)"
    },
    humidity: {
      border: "rgba(54, 162, 235, 1)",
      bg: "rgba(54, 162, 235, 0.2)"
    },
    wind: {
      border: "rgba(75, 192, 192, 1)",
      bg: "rgba(75, 192, 192, 0.2)"
    },
    rain: {
      border: "rgba(153, 102, 255, 1)",
      bg: "rgba(153, 102, 255, 0.4)"
    }
  }
};
