// ---------------------------------------------
// EXAMPLE CLOTHING DATABASE
// (Replace later with Google Sheets data)
// ---------------------------------------------
const tops = ["T-shirt", "Blouse", "Sweater", "Tank Top"];
const bottoms = ["Jeans", "Skirt", "Shorts", "Leggings"];
const accessories = ["Necklace", "Scarf", "Hat", "Bracelet"];


// =====================================================================
// WEATHER FUNCTIONS
// =====================================================================

// ---------------------------------------------
// GET REAL WEATHER BASED ON USER'S GPS
// ---------------------------------------------
async function getWeather() {
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
        });

        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        const url =
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

        const response = await fetch(url);
        const data = await response.json();

        return {
            temperature: data.current_weather.temperature,
            weatherCode: data.current_weather.weathercode,
            wind: data.current_weather.windspeed
        };

    } catch (error) {
        console.error("Weather error:", error);
        return null;
    }
}


// ---------------------------------------------
// GET WEATHER FOR A SPECIFIC CITY (VACATION MODE)
// ---------------------------------------------
async function getWeatherForCity(cityName) {
    try {
        // Convert city → latitude/longitude
        const geoUrl =
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1`;

        const geoResponse = await fetch(geoUrl);
        const geoData = await geoResponse.json();

        if (!geoData.results || geoData.results.length === 0) {
            throw new Error("City not found");
        }

        const { latitude, longitude } = geoData.results[0];

        // Fetch weather
        const weatherUrl =
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;

        const weatherResponse = await fetch(weatherUrl);
        const weatherData = await weatherResponse.json();

        return {
            temperature: weatherData.current_weather.temperature,
            weatherCode: weatherData.current_weather.weathercode,
            wind: weatherData.current_weather.windspeed,
            city: cityName
        };

    } catch (err) {
        console.error(err);
        return null;
    }
}


// =====================================================================
// WEATHER → CATEGORY
// =====================================================================
function categorizeWeather(tempC) {
    if (tempC >= 28) return "hot";
    if (tempC >= 20) return "warm";
    if (tempC >= 12) return "cool";
    return "cold";
}


// =====================================================================
// OUTFIT GENERATORS
// =====================================================================

// ---------------------------------------------
// NORMAL MODE — USES REAL LOCAL WEATHER
// ---------------------------------------------
async function generateOutfit() {
    const weather = await getWeather();

    if (!weather) {
        document.getElementById("outfitResult").innerHTML =
            "Could not get weather data.";
        return;
    }

    const temp = weather.temperature;
    const category = categorizeWeather(temp);

    let top, bottom, accessory;

    if (category === "hot") {
        top = "Tank Top";
        bottom = "Shorts";
    } else if (category === "warm") {
        top = "T-shirt";
        bottom = "Jeans";
    } else if (category === "cool") {
        top = "Blouse";
        bottom = "Jeans";
    } else {
        top = "Sweater";
        bottom = "Leggings";
    }

    accessory = accessories[Math.floor(Math.random() * accessories.length)];

    document.getElementById("outfitResult").innerHTML = `
        <h3>Today's Outfit</h3>
        <strong>Temperature:</strong> ${temp}°C<br>
        <strong>Category:</strong> ${category}<br><br>
        <strong>Top:</strong> ${top}<br>
        <strong>Bottom:</strong> ${bottom}<br>
        <strong>Accessory:</strong> ${accessory}
    `;
}


// ---------------------------------------------
// VACATION MODE — ENTER A CITY
// ---------------------------------------------
async function generateVacationOutfit() {
    const cityInput = document.getElementById("vacationCity").value;

    if (!cityInput) {
        document.getElementById("vacationResult").innerHTML =
            "Please enter a city.";
        return;
    }

    const weather = await getWeatherForCity(cityInput);

    if (!weather) {
        document.getElementById("vacationResult").innerHTML =
            "Could not get weather for that city.";
        return;
    }

    const temp = weather.temperature;
    const category = categorizeWeather(temp);

    let top, bottom, accessory;

    if (category === "hot") {
        top = "Tank Top";
        bottom = "Shorts";
    } else if (category === "warm") {
        top = "T-shirt";
        bottom = "Jeans";
    } else if (category === "cool") {
        top = "Blouse";
        bottom = "Jeans";
    } else {
        top = "Sweater";
        bottom = "Leggings";
    }

    accessory = accessories[Math.floor(Math.random() * accessories.length)];

    document.getElementById("vacationResult").innerHTML = `
        <h3>Vacation Mode</h3>
        <strong>City:</strong> ${weather.city}<br>
        <strong>Temp:</strong> ${temp}°C<br>
        <strong>Category:</strong> ${category}<br><br>
        <strong>Top:</strong> ${top}<br>
        <strong>Bottom:</strong> ${bottom}<br>
        <strong>Accessory:</strong> ${accessory}
    `;
}


// =====================================================================
// OPTIONAL: SEPARATE WEATHER DISPLAY
// =====================================================================
async function displayWeather() {
    const weather = await getWeather();
    const box = document.getElementById("weatherResult");

    if (!weather) {
        box.innerHTML = "Could not load weather.";
        return;
    }

    box.innerHTML = `
        <strong>Temperature:</strong> ${weather.temperature}°C<br>
        <strong>Wind:</strong> ${weather.wind} km/h<br>
        <strong>Code:</strong> ${weather.weatherCode}
    `;
}


// =====================================================================
// BUTTON EVENT LISTENERS
// =====================================================================
document.addEventListener("DOMContentLoaded", () => {
    const weatherBtn = document.getElementById("getWeatherBtn");
    const outfitBtn = document.getElementById("generateOutfitBtn");
    const vacationBtn = document.getElementById("generateVacationOutfitBtn");

    if (weatherBtn) weatherBtn.addEventListener("click", displayWeather);
    if (outfitBtn) outfitBtn.addEventListener("click", generateOutfit);
    if (vacationBtn) vacationBtn.addEventListener("click", generateVacationOutfit);
});
