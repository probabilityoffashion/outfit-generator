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
        packingSection.classList.remove("hidden");   // Show packing l
