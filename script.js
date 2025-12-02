// Basic script for outfit generator

// Example clothing database (replace later with Google Sheets API)
const tops = ["T-shirt", "Blouse", "Sweater", "Tank Top"];
const bottoms = ["Jeans", "Skirt", "Shorts", "Leggings"];
const accessories = ["Necklace", "Scarf", "Hat", "Bracelet"];

// Weather categories (you will later replace with real API)
function getFakeWeather() {
  const weatherOptions = ["hot", "warm", "cool", "cold"];
  return weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
}

// Generate an outfit based on the weather
function generateOutfit() {
  const weather = getFakeWeather();
  let top, bottom, accessory;

  if (weather === "hot") {
    top = "Tank Top";
    bottom = "Shorts";
  } else if (weather === "warm") {
    top = "T-shirt";
    bottom = "Jeans";
  } else if (weather === "cool") {
    top = "Blouse";
    bottom = "Jeans";
  } else if (weather === "cold") {
    top = "Sweater";
    bottom = "Leggings";
  }

  accessory = accessories[Math.floor(Math.random() * accessories.length)];

  document.getElementById("outfit-result").innerHTML = `
    <strong>Weather:</strong> ${weather}<br>
    <strong>Top:</strong> ${top}<br>
    <strong>Bottom:</strong> ${bottom}<br>
    <strong>Accessory:</strong> ${accessory}
  `;
}

// Attach button listener
document.addEventListener("DOMContentLoaded", () => {
  const button = document.getElementById("generate-outfit-btn");
  if (button) {
    button.addEventListener("click", generateOutfit);
  }
});

