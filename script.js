// ---------------------------
// API KEY (replace with your own)
// ---------------------------
const API_KEY = "YOUR_OPENWEATHER_API_KEY";

// ---------------------------
// DOM ELEMENTS
// ---------------------------
const vacationToggle = document.getElementById("vacationModeToggle");
const currentWeatherBlock = document.getElementById("current-location-weather");
const vacationWeatherBlock = document.getElementById("vacation-weather");

const getWeatherBtn = document.getElementById("getWeatherBtn");
const getVacationWeatherBtn = document.getElementById("getVacationWeatherBtn");

const weatherOutput = document.getElementById("weather-output");
const vacationWeatherOutput = document.getElementById("vacation-weather-output");

const generateOutfitBtn = document.getElementById("generateOutfitBtn");
const outfitOutput = document.getElementById("outfit-output");

// A place to hold whichever temperature we retrieved:
let activeTemperature = null;

// ---------------------------
// MODE SWITCHING
// ---------------------------
vacationToggle.addEventListener("change", () => {
    if (vacationToggle.checked) {
        currentWeatherBlock.classList.add("hidden");
        vacationWeatherBlock.classList.remove("hidden");
    } else {
        currentWeatherBlock.classList.remove("hidden");
        vacationWeatherBlock.classList.add("hidden");
    }

    // Clear previous output
    weatherOutput.textContent = "";
    vacationWeatherOutput.textContent = "";
    activeTemperature = null;
});

// ---------------------------
// GET CURRENT WEATHER
// ---------------------------
getWeatherBtn.addEventListener("click", async () => {
    weatherOutput.textContent = "Loading...";

    try {
        const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
        });

        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;

        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${API_KEY}`;

        const res = await fetch(url);
        const data = await res.json();

        const temp = Math.round(data.main.temp);
        const desc = data.weather[0].description;

        weatherOutput.textContent = `Current temp: ${temp}°F — ${desc}`;

        activeTemperature = temp;

    } catch (err) {
        weatherOutput.textContent = "Unable to get weather. Check location settings.";
    }
});

// ---------------------------
// GET VACATION WEATHER (AVERAGE OF DATES)
// ---------------------------
getVacationWeatherBtn.addEventListener("click", async () => {
    const location = document.getElementById("vacationLocation").value.trim();
    const startDate = document.getElementById("vacationStart").value;
    const endDate = document.getElementById("vacationEnd").value;

    if (!location || !startDate || !endDate) {
        vacationWeatherOutput.textContent = "Please enter destination and dates.";
        return;
    }

    vacationWeatherOutput.textContent = "Loading...";

    try {
        // STEP 1: Convert location → coordinates
        const geoURL = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
            location
        )}&limit=1&appid=${API_KEY}`;

        const geoRes = await fetch(geoURL);
        const geoData = await geoRes.json();

        if (!geoData.length) {
            vacationWeatherOutput.textContent = "Location not found.";
            return;
        }

        const lat = geoData[0].lat;
        const lon = geoData[0].lon;

        // STEP 2: Get 7-day forecast (free API limit)
        const forecastURL = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${API_KEY}`;

        const forecastRes = await fetch(forecastURL);
        const forecastData = await forecastRes.json();

        // STEP 3: Average temps over the vacation dates
        const start = new Date(startDate);
        const end = new Date(endDate);

        let temps = [];

        forecastData.list.forEach((item) => {
            const dt = new Date(item.dt * 1000);
            if (dt >= start && dt <= end) {
                temps.push(item.main.temp);
            }
        });

        if (!temps.length) {
            vacationWeatherOutput.textContent =
                "No forecast data available for your trip dates.";
            return;
        }

        const avgTemp = Math.round(
            temps.reduce((sum, t) => sum + t, 0) / temps.length
        );

        vacationWeatherOutput.textContent = `Average forecast temp: ${avgTemp}°F`;

        activeTemperature = avgTemp;

    } catch (err) {
        vacationWeatherOutput.textContent = "Unable to get vacation weather.";
    }
});

// ---------------------------
// GENERATE OUTFIT
// ---------------------------
generateOutfitBtn.addEventListener("click", () => {
    if (activeTemperature === null) {
        outfitOutput.textContent = "Get the weather first!";
        return;
    }

    let outfit = "";

    if (activeTemperature > 75) {
        outfit = "T-shirt, shorts, sunglasses, light sandals";
    } else if (activeTemperature > 60) {
        outfit = "Long-sleeve top, jeans, light jacket or cardigan";
    } else if (activeTemperature > 45) {
        outfit = "Sweater, pants, mid-weight jacket, closed shoes";
    } else {
        outfit = "Coat, warm layers, scarf, boots";
    }

    outfitOutput.textContent = `Recommended outfit: ${outfit}`;
});
