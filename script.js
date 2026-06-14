const API_KEY = "d6423fba36e4b31f8259fff92dd65842";

const weatherUrl =
"https://api.openweathermap.org/data/2.5/weather";


const forecastUrl =
"https://api.openweathermap.org/data/2.5/forecast";

// Elements
const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const locationBtn = document.getElementById("locationBtn");
const historySelect = document.getElementById("historySelect");
const themeToggle = document.getElementById("themeToggle");

const weatherBox = document.querySelector(".weather");
const loading = document.querySelector(".loading");
const error = document.querySelector(".error");
const alerts = document.querySelector(".alerts");

const card = document.querySelector(".card");
const animationLayer =
document.getElementById("animation-layer");

const weatherIcon =
document.querySelector(".weather-icon");

// Date & Time
function updateDateTime() {

    const now = new Date();

    document.getElementById("date").innerText =
        now.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric"
        });

    document.getElementById("time").innerText =
        now.toLocaleTimeString();
}

setInterval(updateDateTime, 1000);
updateDateTime();

// Theme
themeToggle.addEventListener("click", () => {

    document.body.classList.toggle("light-theme");

    const isLight =
        document.body.classList.contains("light-theme");

    localStorage.setItem("theme", isLight);
});

if (localStorage.getItem("theme") === "true") {
    document.body.classList.add("light-theme");
}

// Weather Fetch
async function getWeather(city) {

    if (!city.trim()) {
        alert("Please enter a city name");
        return;
    }

    try {

        loading.style.display = "block";
        error.style.display = "none";
        weatherBox.style.display = "none";
        alerts.innerHTML = "";

        const response =
            await fetch(
                `${weatherUrl}?q=${city}&units=metric&appid=${API_KEY}`
            );

        if (!response.ok) {
            throw new Error("City not found");
        }

        const data = await response.json();

        updateWeatherUI(data);

        saveHistory(city);

        getForecast(city);

    } catch (err) {

        error.style.display = "block";

    } finally {

        loading.style.display = "none";
    }
}

// UI Update
function updateWeatherUI(data) {

    document.querySelector(".city").innerText =
        data.name;

    document.querySelector(".country").innerText =
        data.sys.country;

    document.querySelector(".temp").innerText =
        Math.round(data.main.temp) + "°C";

    document.querySelector(".humidity").innerText =
        data.main.humidity + "%";

    document.querySelector(".wind").innerText =
        data.wind.speed + " km/h";

    document.querySelector(".description").innerText =
        data.weather[0].description;

    document.querySelector(".feels-like").innerText =
        Math.round(data.main.feels_like) + "°C";

    document.querySelector(".pressure").innerText =
        data.main.pressure + " hPa";

    document.querySelector(".sunrise").innerText =
        new Date(
            data.sys.sunrise * 1000
        ).toLocaleTimeString();

    document.querySelector(".sunset").innerText =
        new Date(
            data.sys.sunset * 1000
        ).toLocaleTimeString();

    const condition =
        data.weather[0].main;

    setWeatherTheme(condition);

    weatherBox.style.display = "block";
}

// Theme + Animation
function setWeatherTheme(condition) {

    card.className = "card";
    animationLayer.className = "";

    if (condition === "Rain") {

        card.classList.add("rainy");
        animationLayer.classList.add(
            "rain-animation"
        );

        weatherIcon.src =
            "images/rain.png";

    }
    else if (
        condition === "Clouds"
    ) {

        card.classList.add("cloudy");
        animationLayer.classList.add(
            "cloud-animation"
        );

        weatherIcon.src =
            "images/clouds.png";

    }
    else {

        card.classList.add("sunny");
        animationLayer.classList.add(
            "sun-animation"
        );

        weatherIcon.src =
            "images/clear.png";
    }
}

// Forecast
async function getForecast(city) {

    const response =
        await fetch(
            `${forecastUrl}?q=${city}&units=metric&appid=${API_KEY}`
        );

    const data =
        await response.json();

    const forecastContainer =
        document.getElementById(
            "forecastContainer"
        );

    forecastContainer.innerHTML = "";

    const dailyForecast =
        data.list.filter(
            item =>
                item.dt_txt.includes("12:00:00")
        );

    dailyForecast.slice(0, 5)
        .forEach(day => {

            const date =
                new Date(day.dt_txt);

            forecastContainer.innerHTML += `
            <div class="forecast-card">
                <h4>
                    ${date.toLocaleDateString(
                        "en-US",
                        { weekday: "short" }
                    )}
                </h4>

                <img
                src="https://openweathermap.org/img/wn/${day.weather[0].icon}@2x.png">

                <p>
                    ${Math.round(day.main.temp)}°C
                </p>

                <small>
                    ${day.weather[0].main}
                </small>
            </div>
        `;
        });
}

// Search History
function saveHistory(city) {

    let history =
        JSON.parse(
            localStorage.getItem(
                "weatherHistory"
            )
        ) || [];

    history =
        history.filter(
            item => item !== city
        );

    history.unshift(city);

    history = history.slice(0, 5);

    localStorage.setItem(
        "weatherHistory",
        JSON.stringify(history)
    );

    loadHistory();
}

function loadHistory() {

    const history =
        JSON.parse(
            localStorage.getItem(
                "weatherHistory"
            )
        ) || [];

    historySelect.innerHTML =
        `<option value="">
            Select Previous Search
        </option>`;

    history.forEach(city => {

        historySelect.innerHTML += `
            <option value="${city}">
                ${city}
            </option>
        `;
    });
}

historySelect.addEventListener(
    "change",
    () => {

        if (
            historySelect.value
        ) {

            getWeather(
                historySelect.value
            );
        }
    }
);

// Geolocation
locationBtn.addEventListener(
    "click",
    () => {

        navigator.geolocation
            .getCurrentPosition(
                async position => {

                    const lat =
                        position.coords.latitude;

                    const lon =
                        position.coords.longitude;

                    const response =
                        await fetch(
                            `${weatherUrl}?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
                        );

                    const data =
                        await response.json();

                    updateWeatherUI(data);

                    getForecast(
                        data.name
                    );
                }
            );
    }
);

// Search Events
searchBtn.addEventListener(
    "click",
    () => {

        getWeather(
            cityInput.value
        );
    }
);

cityInput.addEventListener(
    "keyup",
    e => {

        if (
            e.key === "Enter"
        ) {

            getWeather(
                cityInput.value
            );
        }
    }
);

// Mock Alerts
function showAlert(message) {

    alerts.innerHTML = `
        <div class="alert-box">
            ⚠ ${message}
        </div>
    `;
}

// Example Alert
showAlert(
    "Weather alerts will appear here when available."
);

// Initial Load
loadHistory();

const lastSearch =
    JSON.parse(
        localStorage.getItem(
            "weatherHistory"
        )
    );

if (
    lastSearch &&
    lastSearch.length
) {

    getWeather(
        lastSearch[0]
    );
}