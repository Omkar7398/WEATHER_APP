const API = "https://api.open-meteo.com/v1/forecast";
const GEO_API = "https://geocoding-api.open-meteo.com/v1/search";

const $ = (id) => document.getElementById(id);
const state = { unit: "C", location: null, weather: null };

const weatherCodes = {
  0: ["Clear sky", "☀️"], 1: ["Mainly clear", "🌤️"], 2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"], 45: ["Fog", "🌫️"], 48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"], 57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"], 67: ["Freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"], 73: ["Snow", "❄️"], 75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "🌨️"], 80: ["Rain showers", "🌦️"], 81: ["Rain showers", "🌧️"],
  82: ["Heavy showers", "⛈️"], 85: ["Snow showers", "🌨️"], 86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"], 96: ["Thunderstorm with hail", "⛈️"], 99: ["Thunderstorm with hail", "⛈️"]
};

function weatherInfo(code) {
  return weatherCodes[code] || ["Weather conditions", "🌤️"];
}

function temperature(value) {
  if (value === null || value === undefined) return "--";
  const converted = state.unit === "F" ? (value * 9 / 5) + 32 : value;
  return `${Math.round(converted)}°`;
}

function timeLabel(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function dayLabel(iso, index) {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  return new Date(`${iso}T12:00:00`).toLocaleDateString([], { weekday: "long" });
}

async function findCity(city) {
  const response = await fetch(`${GEO_API}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
  if (!response.ok) throw new Error("Could not search for that city.");
  const data = await response.json();
  if (!data.results?.length) throw new Error("City not found. Try another spelling.");
  return data.results[0];
}

async function loadWeather(location) {
  $("status").textContent = "Finding the latest forecast…";
  const params = new URLSearchParams({
    latitude: location.latitude,
    longitude: location.longitude,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
    hourly: "temperature_2m,precipitation_probability,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "7"
  });

  const response = await fetch(`${API}?${params}`);
  if (!response.ok) throw new Error("Weather data is temporarily unavailable.");
  const data = await response.json();
  state.location = location;
  state.weather = data;
  renderWeather();
  $("status").textContent = `Updated just now · ${location.country || "Local forecast"}`;
}

function renderWeather() {
  const data = state.weather;
  const current = data.current;
  const daily = data.daily;
  const info = weatherInfo(current.weather_code);
  const today = new Date(`${daily.time[0]}T12:00:00`);

  $("cityName").textContent = `${state.location.name}${state.location.admin1 ? ", " + state.location.admin1 : ""}`;
  $("dateLine").textContent = today.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  $("weatherIcon").textContent = info[1];
  $("temperature").innerHTML = `${temperature(current.temperature_2m).replace("°", "")}<span>°${state.unit}</span>`;
  $("condition").textContent = info[0];
  $("feelsLike").textContent = `Feels like ${temperature(current.apparent_temperature)}`;
  $("highTemp").textContent = temperature(daily.temperature_2m_max[0]);
  $("lowTemp").textContent = temperature(daily.temperature_2m_min[0]);
  $("rainChance").textContent = `${daily.precipitation_probability_max[0] ?? 0}%`;
  $("humidity").textContent = `${current.relative_humidity_2m}%`;
  $("wind").textContent = `${Math.round(current.wind_speed_10m)} km/h`;
  $("feelsDetail").textContent = temperature(current.apparent_temperature);
  $("precipitation").textContent = `${current.precipitation} mm`;
  $("sunrise").textContent = timeLabel(daily.sunrise[0]);
  $("sunset").textContent = timeLabel(daily.sunset[0]);
  renderHourly();
  renderDaily();
}

function renderHourly() {
  const hourly = state.weather.hourly;
  const now = new Date(state.weather.current.time).getTime();
  let start = hourly.time.findIndex(time => new Date(time).getTime() >= now);
  if (start < 0) start = 0;
  $("hourlyList").innerHTML = hourly.time.slice(start, start + 8).map((time, offset) => {
    const index = start + offset;
    const info = weatherInfo(hourly.weather_code[index]);
    const label = offset === 0 ? "Now" : new Date(time).toLocaleTimeString([], { hour: "numeric" });
    return `<div class="hour-item"><span class="hour-time">${label}</span><span class="hour-icon">${info[1]}</span><strong>${temperature(hourly.temperature_2m[index])}</strong></div>`;
  }).join("");
}

function renderDaily() {
  const daily = state.weather.daily;
  $("dailyList").innerHTML = daily.time.map((date, index) => {
    const info = weatherInfo(daily.weather_code[index]);
    return `<div class="day-row">
      <span class="day-name">${dayLabel(date, index)}</span>
      <span class="day-condition"><span>${info[1]}</span>${info[0]}</span>
      <span class="day-rain">💧 ${daily.precipitation_probability_max[index] ?? 0}%</span>
      <span class="day-temps">${temperature(daily.temperature_2m_max[index])}<span>${temperature(daily.temperature_2m_min[index])}</span></span>
    </div>`;
  }).join("");
}

$("searchForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const city = $("cityInput").value.trim();
  if (!city) {
    $("status").textContent = "Please enter a city name.";
    return;
  }
  try {
    const location = await findCity(city);
    await loadWeather(location);
  } catch (error) {
    $("status").textContent = error.message;
  }
});

$("unitToggle").addEventListener("click", () => {
  state.unit = state.unit === "C" ? "F" : "C";
  $("unitToggle").innerHTML = state.unit === "C"
    ? '<span class="active">°C</span> / °F'
    : '°C / <span class="active">°F</span>';
  if (state.weather) renderWeather();
});

async function init() {
  try {
    const location = await findCity("New Delhi");
    await loadWeather(location);
  } catch (error) {
    $("status").textContent = `${error.message} Search for a city to try again.`;
  }
}

init();
