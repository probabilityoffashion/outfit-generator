// -------------------------------------------------------
// API KEY (replace with your own OpenWeather API key)
// -------------------------------------------------------
const API_KEY = "YOUR_OPENWEATHER_API_KEY";

// -------------------------------------------------------
// DOM ELEMENTS
// -------------------------------------------------------

// Mode blocks
const vacationToggle = document.getElementById("vacationModeToggle");
const currentWeatherBlock = document.getElementById("current-location-weather");
const vacationWeatherBlock = document.getElementById("vacation-weather");

// Weather buttons + outputs
const getWeatherBtn = document.getElementById("getWeatherBtn");
const getVacationWeatherBtn = document.getElementById("getVacationWeatherBtn");
const weatherOutput = document.getElementById("weather-output");
const vacationWeatherOutput = document.getElementById("vacation-weather-output");

// Outfit generator
const generateOutfitBtn = document.getElementById("generateOutfitBtn");
const outfitOutput = document.getElementById("outfit-output");

// Packing list elements
const packingSection = document.getElementById("packing-section");
const generatePackingBtn = document.getElementById("generatePackingBtn");
const packingOutput = document.getElementById("packing-output");

// This variable stores the temperature to be used for outfit generation
let activeTemperature = null;

// -------------------------------------------------------
// MODE SWITCHING (Vacation Mode ON/OFF)
// -------------------------------------------------------
vacationToggle.addEventListener("change", () => {
    if (vacationToggle.checked) {
        currentWeatherBlock.classList.add("hidden");
        vacationWeatherBlock.classList.remove("hidden");
        packingSection.classList.remove("hidden");   // Show packing list
    } else {
        currentWeatherBlock.classList.remove("hidden");
        vacationWeatherBlock.classList.add("hidden");
        packingSection.classList.add("hidden");      // Hide packing list
    }

    // Reset outputs
    weatherOutput.textContent = "";
    vacationWeatherOutput.textContent = "";
    outfitOutput.textContent = "";
    packingOutput.textContent = "";
    activeTemperature = null;
});

// -------------------------------------------------------
// GET CURRENT WEATHER (Normal Mode)
// -------------------------------------------------------
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

// -------------------------------------------------------
// GET VACATION WEATHER (Average Over Selected Dates)
// -------------------------------------------------------
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
        // Convert location → coordinates
        const geoURL = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${API_KEY}`;
        const geoRes = await fetch(geoURL);
        const geoData = await geoRes.json();

        if (!geoData.length) {
            vacationWeatherOutput.textContent = "Location not found.";
            return;
        }

        const lat = geoData[0].lat;
        const lon = geoData[0].lon;

        // Get forecast
        const forecastURL = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${API_KEY}`;
        const forecastRes = await fetch(forecastURL);
        const forecastData = await forecastRes.json();

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

// -------------------------------------------------------
// OUTFIT GENERATOR
// -------------------------------------------------------
generateOutfitBtn.addEventListener("click", () => {
    if (activeTemperature === null) {
        outfitOutput.textContent = "Get the weather first!";
        return;
    }

    let outfit = "";

    if (activeTemperature > 75) {
        outfit = "T-shirt, shorts, sunglasses, sandals";
    } else if (activeTemperature > 60) {
        outfit = "Long-sleeve top, jeans, light cardigan or jacket";
    } else if (activeTemperature > 45) {
        outfit = "Sweater, jeans, mid-weight jacket, sneakers";
    } else {
        outfit = "Heavy coat, warm layers, scarf, boots";
    }

    outfitOutput.textContent = `Recommended outfit: ${outfit}`;
});

// -------------------------------------------------------
// PACKING LIST GENERATOR (Vacation Mode Only)
// -------------------------------------------------------
generatePackingBtn.addEventListener("click", async () => {
    const location = document.getElementById("vacationLocation").value.trim();
    const startDate = document.getElementById("vacationStart").value;
    const endDate = document.getElementById("vacationEnd").value;

    if (!location || !startDate || !endDate) {
        packingOutput.textContent = "Please complete the destination and dates above.";
        return;
    }

    packingOutput.textContent = "Creating packing list...";

    try {
        // Convert location → coordinates
        const geoURL = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${API_KEY}`;
        const geoRes = await fetch(geoURL);
        const geoData = await geoRes.json();

        const lat = geoData[0].lat;
        const lon = geoData[0].lon;

        // Fetch 5-day / 3-hour forecast
        const forecastURL = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${API_KEY}`;
        const forecastRes = await fetch(forecastURL);
        const forecastData = await forecastRes.json();

        let dayTemps = [];
        const start = new Date(startDate);
        const end = new Date(endDate);

        // Build per-day temps
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const startDay = new Date(d);
            const endDay = new Date(d);
            endDay.setHours(23, 59, 59);

            let temps = [];

            forecastData.list.forEach((item) => {
                const dt = new Date(item.dt * 1000);
                if (dt >= startDay && dt <= endDay) temps.push(item.main.temp);
            });

            let avg = temps.length
                ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length)
                : null;

            dayTemps.push({
                date: new Date(d).toDateString(),
                temp: avg
            });
        }

        // COUNTS OF PACKING ITEMS
        let packingCounts = {
            tshirt: 0,
            shorts: 0,
            longSleeve: 0,
            jeans: 0,
            sweater: 0,
            jacket: 0,
            coat: 0,
            socks: 0,
            underwear: 0
        };

        let html = `<h3>Daily Forecast</h3><ul>`;

        dayTemps.forEach((day) => {
            html += `<li>${day.date}: ${day.temp ? day.temp + "°F" : "No data"}</li>`;

            if (!day.temp) return;

            // Clothing rules
            if (day.temp > 75) {
                packingCounts.tshirt++;
                packingCounts.shorts++;
            } else if (day.temp > 60) {
                packingCounts.longSleeve++;
                packingCounts.jeans++;
            } else if (day.temp > 45) {
                packingCounts.sweater++;
                packingCounts.jeans++;
            } else {
                packingCounts.coat++;
                packingCounts.sweater++;
                packingCounts.jeans++;
            }

            packingCounts.socks++;
            packingCounts.underwear++;
        });

        html += `</ul><h3>Packing Summary</h3><ul>`;

        Object.entries(packingCounts).forEach(([item, count]) => {
            if (count > 0) {
                html += `<li>${count} × ${item}</li>`;
            }
        });

        html += "</ul>";

        packingOutput.innerHTML = html;

    } catch (err) {
        packingOutput.textContent = "Error generating packing list.";
    }
});
