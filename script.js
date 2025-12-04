// =======================
// script.js — Outfit Generator (complete)
// Uses Google Sheets (headers you provided) and OpenWeather
// =======================

/* ========== CONFIG ========== */
const OPENWEATHER_API_KEY = ""; // 314b8f4d1cc944b997be7d1aeca67c5f<-- paste your OpenWeather API key here
const SPREADSHEET_ID = "1v4ByekCi0_qduYlmNCxMD1wljTsWIOHV4dB40Hb_Tsc";
const SHEET_GID = "0"; // first tab
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=${SHEET_GID}`;

/* ========== DOM ========== */
const vacationToggle = document.getElementById("vacationModeToggle");
const currentBlock = document.getElementById("current-block");
const vacationBlock = document.getElementById("vacation-block");
const getWeatherBtn = document.getElementById("getWeatherBtn");
const getVacationWeatherBtn = document.getElementById("getVacationWeatherBtn");
const weatherOutput = document.getElementById("weather-output");
const vacationWeatherOutput = document.getElementById("vacation-weather-output");

const generateOutfitBtn = document.getElementById("generateOutfitBtn");
const outfitOutput = document.getElementById("outfit-output");
const occasionSelect = document.getElementById("occasionSelect");

const generatePackingBtn = document.getElementById("generatePackingBtn");
const packingOutput = document.getElementById("packing-output");

const dailyTabsSection = document.getElementById("daily-tabs-section");
const tabsContainer = document.getElementById("tabs");
const tabContent = document.getElementById("tab-content");

const createIGBtn = document.getElementById("createIGBtn");
const igOutput = document.getElementById("ig-output");
const igCanvas = document.getElementById("igCanvas");

/* ========== APP STATE ========== */
let closet = []; // array of items (objects)
let activeTemperature = null; // single temp used for suggestions
let tripDailyTemps = []; // [{date:"Wed ...", temp:72}, ...]

// localStorage key for repeat prevention (keeps entries with timestamp)
const REPEAT_KEY = "outfit_history_v1"; // stores [{name, ts}]
const REPEAT_WINDOW_DAYS = 180; // 6 months

/* ========== UTIL: localStorage repeat helper ========== */
function loadHistory() {
  try {
    const raw = localStorage.getItem(REPEAT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    // purge older than window
    const cutoff = Date.now() - REPEAT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const fresh = arr.filter(e => e.ts >= cutoff);
    localStorage.setItem(REPEAT_KEY, JSON.stringify(fresh));
    return fresh;
  } catch (e) {
    return [];
  }
}
function saveHistory(arr) {
  localStorage.setItem(REPEAT_KEY, JSON.stringify(arr));
}
function addToHistory(names) {
  const arr = loadHistory();
  const now = Date.now();
  names.forEach(n => {
    if (!n) return;
    arr.push({ name: n, ts: now });
  });
  // keep only recent (prevent unlimited growth)
  const cutoff = Date.now() - REPEAT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const trimmed = arr.filter(e => e.ts >= cutoff);
  // limit to 1000 entries
  while (trimmed.length > 1000) trimmed.shift();
  saveHistory(trimmed);
}
function isRepeated(name) {
  if (!name) return false;
  const arr = loadHistory();
  return arr.some(e => e.name === name);
}

/* ========== Load closet from Google Sheet ========== */
async function fetchCloset() {
  try {
    const res = await fetch(SHEET_URL);
    const txt = await res.text();
    // GVIZ response is: someFunction({...});
    const json = JSON.parse(txt.substring(txt.indexOf("{"), txt.lastIndexOf("}") + 1));
    const cols = json.table.cols.map(c => (c.label || "").trim());
    const rows = json.table.rows || [];
    const items = rows.map(r => {
      const obj = {};
      (r.c || []).forEach((cell, idx) => {
        obj[cols[idx] || `col${idx}`] = cell && cell.v != null ? cell.v : "";
      });
      // Normalize keys to your headers (safe access)
      return {
        timestamp: obj["Timestamp"] || "",
        name: obj["Item Name"] || obj["Item"] || "",
        category: obj["Category"] || "",
        pantsType: obj["Pants Type"] || "",
        skirtType: obj["Skirt Type"] || "",
        topType: obj["Top Type"] || "",
        dressType: obj["Dress Type"] || "",
        layersType: obj["Layers Type"] || obj["Layers"] || "",
        accessoriesType: obj["Accessories Type"] || obj["Accessories"] || "",
        purseType: obj["Purse Type"] || obj["Purse"] || "",
        shoesType: obj["Shoes Type"] || obj["Shoes"] || "",
        pattern: obj["Pattern"] || "",
        fabric: obj["Fabric Weight"] || obj["Fabric"] || "",
        colors: obj["Colors"] || obj["Color"] || "",
        occasion: obj["Occasion"] || "",
        suitableWeather: obj["Suitable Weather"] || "",
        link: obj["Online purchase link"] || obj["Online Link"] || "",
        image: obj["Image"] || ""
      };
    });
    closet = items;
    console.log("Closet loaded:", closet.length);
  } catch (err) {
    console.error("Failed to load sheet:", err);
    closet = [];
  }
}

/* ========== Temperature -> Suitability label ========== */
function tempToLabel(tempF) {
  if (tempF == null) return null;
  if (tempF >= 80) return "hot 80 F or higher";
  if (tempF >= 68) return "warm 68-79 F";
  if (tempF >= 58) return "mild 58-67 F";
  if (tempF >= 45) return "cool 45-57 F";
  if (tempF >= 32) return "cold 32-44 F";
  return "freezing below 32";
}

/* ========== Color family helper (basic) ========== */
function colorFamily(name) {
  if (!name) return "neutral";
  const n = name.toString().toLowerCase();
  if (n.includes("black")||n.includes("grey")||n.includes("gray")||n.includes("brown")||n.includes("beige")||n.includes("white")||n.includes("pearl")) return "neutral";
  if (n.includes("blue")) return "blue";
  if (n.includes("green")) return "green";
  if (n.includes("pink")||n.includes("rose")) return "pink";
  if (n.includes("red")) return "red";
  if (n.includes("orange")) return "orange";
  if (n.includes("purple")||n.includes("violet")) return "purple";
  if (n.includes("yellow")) return "yellow";
  if (n.includes("multicolor")||n.includes("patterned")||n.includes("leopard")||n.includes("denim")) return "patterned";
  return "neutral";
}
function compatibleColors(a,b) {
  if (!a || !b) return true;
  const A = colorFamily(a), B = colorFamily(b);
  if (A === "neutral" || B === "neutral") return true;
  if (A === B) return true;
  const complements = { red: "green", blue: "orange", purple: "yellow" };
  if (complements[A] === B || complements[B] === A) return true;
  if (A === "patterned" || B === "patterned") return true;
  return false;
}

/* ========== Select items with filters ========== */
function selectItems({ category=null, subtype=null, suitableLabel=null, occasion=null, excludeRepeated=true }) {
  if (!closet.length) return [];
  return closet.filter(it => {
    if (category && (!it.category || it.category.toLowerCase() !== category.toLowerCase())) return false;
    if (subtype) {
      // check subtype in any of the subtype columns
      const subs = [it.pantsType, it.skirtType, it.topType, it.dressType, it.layersType, it.accessoriesType, it.purseType, it.shoesType].join("|").toLowerCase();
      if (!subs.includes(subtype.toLowerCase())) return false;
    }
    if (suitableLabel && it.suitableWeather) {
      if (!it.suitableWeather.toLowerCase().includes(suitableLabel.toLowerCase())) return false;
    }
    if (occasion && it.occasion) {
      if (!it.occasion.toLowerCase().includes(occasion.toLowerCase())) return false;
    }
    if (excludeRepeated && isRepeated(it.name)) return false;
    return true;
  });
}

/* ========== Outfit builder with rules ========== */
function buildOutfitForTemp(tempF, occasionFilter="") {
  const label = tempToLabel(tempF);

  // candidates (exclude repeated items by default)
  const dresses = selectItems({ category: "Dress", suitableLabel: label, occasion: occasionFilter });
  const tops = selectItems({ category: "Top", suitableLabel: label, occasion: occasionFilter });
  const pants = selectItems({ category: "Pants", suitableLabel: label, occasion: occasionFilter });
  const skirts = selectItems({ category: "Skirt", suitableLabel: label, occasion: occasionFilter });
  const layers = selectItems({ category: "Layers", suitableLabel: label, occasion: occasionFilter });
  const shoes = selectItems({ category: "Shoes", suitableLabel: label, occasion: occasionFilter });
  const purses = selectItems({ category: "Purse", suitableLabel: label, occasion: occasionFilter });
  const accs = selectItems({ category: "Accessories", suitableLabel: label, occasion: occasionFilter });

  const result = { top:null, bottom:null, dress:null, layer:null, shoes:null, accessories:[], purse:null, label };

  // Decide dress vs top+bottom
  let chooseDress = false;
  if (occasionFilter && /dressy/i.test(occasionFilter) && dresses.length) chooseDress = true;
  if (!chooseDress) {
    if ((!tops.length || (!pants.length && !skirts.length)) && dresses.length) chooseDress = true;
    if (!chooseDress && dresses.length && Math.random() < 0.25) chooseDress = true;
  }

  if (chooseDress) {
    result.dress = dresses[Math.floor(Math.random() * dresses.length)];
  } else {
    if (tops.length) result.top = tops[Math.floor(Math.random() * tops.length)];
    // choose bottom: prefer pants, but allow skirt
    if (pants.length && Math.random() > 0.3) result.bottom = pants[Math.floor(Math.random() * pants.length)];
    else if (skirts.length) result.bottom = skirts[Math.floor(Math.random() * skirts.length)];
    else if (pants.length) result.bottom = pants[Math.floor(Math.random() * pants.length)];
  }

  // layer optional (one)
  if (layers.length && (Math.random() > 0.5 || ["cool 45-57 F","cold 32-44 F","freezing below 32"].includes(label))) {
    result.layer = layers[Math.floor(Math.random() * layers.length)];
  }

  // shoes & purse
  if (shoes.length) result.shoes = shoes[Math.floor(Math.random() * shoes.length)];
  if (purses.length) result.purse = purses[Math.floor(Math.random() * purses.length)];

  // accessories up to 3, enforce mutual exclusivity rules
  const chosenAcc = [];
  for (let a of accs.sort(() => Math.random() - 0.5)) {
    if (chosenAcc.length >= 3) break;
    const t = (a.accessoriesType || a.accessories || "").toString().toLowerCase() + "|" + (a.name || "").toString().toLowerCase();

    // belts: under vs over (mutually exclusive)
    const isUnderBelt = t.includes("under");
    const isOverBelt = t.includes("over");
    if (isUnderBelt && chosenAcc.some(x => (x.accessoriesType || x.accessories || "").toLowerCase().includes("over"))) continue;
    if (isOverBelt && chosenAcc.some(x => (x.accessoriesType || x.accessories || "").toLowerCase().includes("under"))) continue;

    // single necklace/bracelet/earrings
    if (t.includes("neck") && chosenAcc.some(x => (x.accessoriesType || x.accessories || "").toLowerCase().includes("neck"))) continue;
    if (t.includes("brace") && chosenAcc.some(x => (x.accessoriesType || x.accessories || "").toLowerCase().includes("brace"))) continue;
    if (t.includes("ear") && chosenAcc.some(x => (x.accessoriesType || x.accessories || "").toLowerCase().includes("ear"))) continue;

    // accept accessory
    chosenAcc.push(a);
  }
  result.accessories = chosenAcc;

  // color coordination fix: if top+bottom conflict, attempt swap
  try {
    const tc = result.top ? result.top.colors : null;
    const bc = result.bottom ? result.bottom.colors : null;
    const dc = result.dress ? result.dress.colors : null;
    if (result.top && result.bottom && !compatibleColors(tc, bc)) {
      // try find alt bottom compatible
      const alt = selectItems({ category: "Pants", suitableLabel: label, occasion: occasionFilter }).concat(selectItems({category:"Skirt", suitableLabel:label, occasion:occasionFilter}))
                  .find(b => compatibleColors(tc, b.colors));
      if (alt) result.bottom = alt;
    }
    if (result.dress && result.layer && !compatibleColors(dc, result.layer.colors)) {
      const altL = selectItems({ category: "Layers", suitableLabel: label, occasion: occasionFilter }).find(l => compatibleColors(dc, l.colors));
      if (altL) result.layer = altL;
    }
  } catch (e) { /* silent */ }

  return result;
}

/* ========== Render outfit to UI ========== */
function renderOutfitToUI(outfit) {
  const o = outfitOutput;
  if (!o) return;
  let html = `<strong>Suitability:</strong> ${outfit.label || ""}<br/><div>`;
  function pieceHtml(title, it) {
    if (!it) return "";
    return `
      <div class="piece">
        <strong>${title}:</strong> ${it.name || it.item || ""}<br/>
        ${it.colors ? `<small>Color: ${it.colors}</small><br/>` : ""}
        ${it.image ? `<img src="${it.image}" style="max-width:140px;display:block;margin-top:6px;border-radius:6px">` : ""}
        ${it.link ? `<div><a href="${it.link}" target="_blank">Buy</a></div>` : ""}
      </div>
    `;
  }
  if (outfit.dress) html += pieceHtml("Dress", outfit.dress);
  else {
    html += pieceHtml("Top", outfit.top);
    html += pieceHtml("Bottom", outfit.bottom);
  }
  html += pieceHtml("Layer", outfit.layer);
  html += pieceHtml("Shoes", outfit.shoes);
  html += pieceHtml("Purse", outfit.purse);
  if (outfit.accessories && outfit.accessories.length) {
    html += `<div><strong>Accessories:</strong><ul>`;
    outfit.accessories.forEach(a => html += `<li>${a.name || a.item}</li>`);
    html += `</ul></div>`;
  }
  html += `</div>`;
  o.innerHTML = html;
}

/* ========== Weather functions ========== */
async function fetchLocalWeather() {
  // geolocation (secure origin required)
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 10000 }));
    const lat = pos.coords.latitude, lon = pos.coords.longitude;
    if (OPENWEATHER_API_KEY) {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${OPENWEATHER_API_KEY}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error("Weather fetch failed");
      const d = await r.json();
      return { temp: Math.round(d.main.temp), feels: Math.round(d.main.feels_like), desc: d.weather?.[0]?.description || "" };
    } else {
      // fallback to open-meteo (no feels_like)
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
      const r = await fetch(url); const d = await r.json();
      const tempC = d.current_weather.temperature;
      return { temp: Math.round(tempC * 9/5 + 32), feels: null, desc: "" };
    }
  } catch (err) {
    throw err;
  }
}

async function fetchTripForecastForRange(locationName, startDateStr, endDateStr) {
  // returns {place, daily:[{date,temp}]}
  try {
    // geocode first
    let lat, lon, placeName;
    if (OPENWEATHER_API_KEY) {
      const geoURL = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(locationName)}&limit=1&appid=${OPENWEATHER_API_KEY}`;
      const geoR = await fetch(geoURL); const geo = await geoR.json();
      if (!geo || !geo.length) throw new Error("Location not found");
      lat = geo[0].lat; lon = geo[0].lon; placeName = geo[0].name + (geo[0].country ? (", " + geo[0].country) : "");
      // fetch 5-day forecast (OpenWeather returns 3-hour points)
      const forecastURL = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${OPENWEATHER_API_KEY}`;
      const fr = await fetch(forecastURL); const fj = await fr.json();
      const map = {};
      (fj.list || []).forEach(point => {
        const d = new Date(point.dt * 1000);
        const key = d.toISOString().slice(0,10);
        map[key] = map[key] || [];
        const val = point.main && point.main.feels_like != null ? point.main.feels_like : point.main.temp;
        map[key].push(val);
      });
      const start = new Date(startDateStr), end = new Date(endDateStr);
      const out = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
        const key = d.toISOString().slice(0,10);
        const arr = map[key] || [];
        const avg = arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : null;
        out.push({ date: new Date(key).toDateString(), temp: avg });
      }
      return { place: placeName, daily: out };
    } else {
      // fallback geocoding and daily apparent temps
      const geoURL = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1`;
      const gr = await fetch(geoURL); const gj = await gr.json();
      if (!gj || !gj.results || !gj.results.length) throw new Error("Location not found");
      lat = gj.results[0].latitude; lon = gj.results[0].longitude; placeName = gj.results[0].name;
      const startISO = (new Date(startDateStr)).toISOString().slice(0,10);
      const endISO = (new Date(endDateStr)).toISOString().slice(0,10);
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=apparent_temperature_max,apparent_temperature_min&timezone=auto&start_date=${startISO}&end_date=${endISO}`;
      const r = await fetch(url); const jd = await r.json();
      const out = [];
      if (jd && jd.daily && jd.daily.time) {
        for (let i=0;i<jd.daily.time.length;i++){
          const tmax = jd.daily.apparent_temperature_max[i];
          const tmin = jd.daily.apparent_temperature_min[i];
          const avgC = (tmax + tmin) / 2;
          const avgF = Math.round((avgC * 9/5) + 32);
          out.push({ date: new Date(jd.daily.time[i]).toDateString(), temp: avgF });
        }
      }
      return { place: placeName, daily: out };
    }
  } catch (e) {
    throw e;
  }
}

/* ========== UI: Mode toggle ========== */
vacationToggle.addEventListener("change", () => {
  if (vacationToggle.checked) {
    currentBlock.classList.add("hidden");
    vacationBlock.classList.remove("hidden");
    dailyTabsSection.classList.remove("hidden");
  } else {
    currentBlock.classList.remove("hidden");
    vacationBlock.classList.add("hidden");
    dailyTabsSection.classList.add("hidden");
  }
  weatherOutput.textContent = "";
  vacationWeatherOutput.textContent = "";
  outfitOutput.textContent = "";
  packingOutput.textContent = "";
  tripDailyTemps = [];
  activeTemperature = null;
  tabsContainer.innerHTML = "";
  tabContent.innerHTML = "";
});

/* ========== UI: Get Local Weather ========== */
getWeatherBtn.addEventListener("click", async () => {
  weatherOutput.textContent = "Loading local weather (requesting location)...";
  try {
    const w = await fetchLocalWeather();
    weatherOutput.textContent = w.feels != null ? `${w.feels}°F (feels like) — ${w.desc}` : `${w.temp}°F — ${w.desc || ''}`;
    activeTemperature = w.feels != null ? w.feels : w.temp;
  } catch (err) {
    weatherOutput.textContent = "Could not load local weather: " + (err.message || "");
    activeTemperature = null;
  }
});

/* ========== UI: Vacation Forecast ========== */
getVacationWeatherBtn.addEventListener("click", async () => {
  const location = document.getElementById("vacationLocation").value.trim();
  const start = document.getElementById("vacationStart").value;
  const end = document.getElementById("vacationEnd").value;
  if (!location || !start || !end) {
    vacationWeatherOutput.textContent = "Enter location + start + end dates.";
    return;
  }
  vacationWeatherOutput.textContent = "Loading trip forecast...";
  try {
    const forecast = await fetchTripForecastForRange(location, start, end);
    tripDailyTemps = forecast.daily || [];
    vacationWeatherOutput.textContent = `Forecast loaded for ${forecast.place}. ${tripDailyTemps.length} day(s).`;
    // set activeTemperature to average for quick outfit suggestion
    const temps = tripDailyTemps.map(d => d.temp).filter(t => t != null);
    activeTemperature = temps.length ? Math.round(temps.reduce((a,b)=>a+b,0)/temps.length) : null;
    renderDailyTabs(tripDailyTemps);
  } catch (err) {
    vacationWeatherOutput.textContent = "Unable to load trip forecast: " + (err.message || "");
    tripDailyTemps = [];
    activeTemperature = null;
    renderDailyTabs([]);
  }
});

/* ========== Render daily tabs (vacation) ========== */
function renderDailyTabs(daily) {
  tabsContainer.innerHTML = "";
  tabContent.innerHTML = "";
  if (!daily || !daily.length) {
    dailyTabsSection.classList.add("hidden");
    return;
  }
  dailyTabsSection.classList.remove("hidden");
  daily.forEach((d, idx) => {
    const b = document.createElement("button");
    b.className = "tab";
    b.textContent = d.date;
    b.dataset.idx = idx;
    b.addEventListener("click", () => {
      Array.from(b.parentElement.children).forEach(c => c.classList.remove("active"));
      b.classList.add("active");
      showDayContent(idx);
    });
    tabsContainer.appendChild(b);
  });
  if (tabsContainer.firstChild) tabsContainer.firstChild.click();
}

/* ========== Show suggestions for a day (all occasions) ========== */
function showDayContent(idx) {
  const day = tripDailyTemps[idx];
  if (!day) { tabContent.innerHTML = "No data"; return; }
  const t = day.temp;
  const label = tempToLabel(t);
  const occs = ["Dressy/Sunday","Workday","casual","loungewear"];
  let html = `<h3>${day.date} — ${t!=null? t + "°F" : "No data"} (${label||""})</h3>`;
  occs.forEach(o => {
    const outfit = buildOutfitForTemp(t, o);
    html += `<h4>${o}</h4><ul>`;
    if (outfit.dress) html += `<li>Dress: ${outfit.dress.name || outfit.dress.item}</li>`;
    else {
      if (outfit.top) html += `<li>Top: ${outfit.top.name || outfit.top.item}</li>`;
      if (outfit.bottom) html += `<li>Bottom: ${outfit.bottom.name || outfit.bottom.item}</li>`;
    }
    if (outfit.layer) html += `<li>Layer: ${outfit.layer.name || outfit.layer.item}</li>`;
    if (outfit.shoes) html += `<li>Shoes: ${outfit.shoes.name || outfit.shoes.item}</li>`;
    if (outfit.accessories && outfit.accessories.length) outfit.accessories.forEach(a => html += `<li>Accessory: ${a.name || a.item}</li>`);
    if (outfit.purse) html += `<li>Purse: ${outfit.purse.name || outfit.purse.item}</li>`;
    html += `</ul>`;
  });
  tabContent.innerHTML = html;
}

/* ========== Single Outfit (button) ========== */
generateOutfitBtn.addEventListener("click", () => {
  if (activeTemperature == null) { outfitOutput.textContent = "Load weather (local or vacation) first."; return; }
  const occ = occasionSelect.value || "";
  // build one outfit (exclude repeated items)
  const outfit = buildOutfitForTemp(activeTemperature, occ);
  renderOutfitToUI(outfit);
  // add used item names to history so they won't repeat for 6 months
  const names = [];
  if (outfit.dress) names.push(outfit.dress.name || outfit.dress.item);
  else { names.push(outfit.top?.name || outfit.top?.item); names.push(outfit.bottom?.name || outfit.bottom?.item); }
  names.push(outfit.layer?.name || outfit.layer?.item);
  names.push(outfit.shoes?.name || outfit.shoes?.item);
  (outfit.accessories||[]).forEach(a => names.push(a.name || a.item));
  addToHistory(names.filter(Boolean));
});

/* ========== Packing list generator ========== */
/*
  - For vacation mode: user may be prompted for counts of dressy/casual/loungewear/work.
  - Packing algorithm: reuse items across days as much as possible while meeting outfit rules,
    preferring not-to-repeat items but allowing repeats when necessary to minimize overall pack size.
*/
generatePackingBtn.addEventListener("click", () => {
  if (!tripDailyTemps || !tripDailyTemps.length) {
    packingOutput.textContent = "Load trip forecast first (Vacation Mode).";
    return;
  }

  // Ask the user how many of each occasion they'd like, default: infer evenly
  const totalDays = tripDailyTemps.length;
  let suggested = { dressy:0, work:0, casual:0, lounge:0 };
  // naive equal distribution
  suggested.casual = Math.floor(totalDays * 0.5);
  suggested.work = Math.floor(totalDays * 0.2);
  suggested.dressy = Math.floor(totalDays * 0.1);
  suggested.lounge = totalDays - (suggested.casual + suggested.work + suggested.dressy);
  // prompt user (single prompt with CSV) — example "dressy:2,work:3,casual:4,lounge:1"
  const user = prompt(`Trip is ${totalDays} days. Enter counts as CSV (dressy:work:casual:lounge)\nExample: 2:3:4:1\nOr press Cancel to use suggested: ${suggested.dressy}:${suggested.work}:${suggested.casual}:${suggested.lounge}`);
  let counts = { dressy: suggested.dressy, work: suggested.work, casual: suggested.casual, lounge: suggested.lounge };
  if (user) {
    const parts = user.split(":").map(s=>s.trim());
    if (parts.length === 4) {
      const [d,w,c,l] = parts.map(p => parseInt(p) || 0);
      counts = { dressy:d, work:w, casual:c, lounge:l };
    } else {
      alert("Input not recognized. Using suggested distribution.");
    }
  }

  packingOutput.innerHTML = "Generating optimized packing list...";

  // Strategy:
  // 1) For each occasion type, generate the minimal set of outfits that cover the requested count,
  //    reusing items across outfits when possible.
  // 2) Try to reuse top/bottom combos (pick a small pool per occasion).
  // 3) Collect unique items and present counts.

  const occasionMap = [
    ...Array(counts.dressy).fill("Dressy/Sunday"),
    ...Array(counts.work).fill("Workday"),
    ...Array(counts.casual).fill("casual"),
    ...Array(counts.lounge).fill("loungewear")
  ];

  // Build small pools per occasion (prefer non-repeated items)
  function buildPoolForOcc(occ, needed) {
    const pool = [];
    // prefer dresses for dressy
    if (/dressy/i.test(occ)) {
      const candidates = selectItems({ category: "Dress", occasion: occ, excludeRepeated: true });
      for (let c of candidates) { if (pool.length >= Math.max(1, Math.ceil(needed/2))) break; pool.push(c); }
    }
    // tops/pants
    const tops = selectItems({ category: "Top", occasion: occ, excludeRepeated: false });
    const bottoms = selectItems({ category: "Pants", occasion: occ, excludeRepeated: false }).concat(selectItems({category:"Skirt", occasion:occ, excludeRepeated:false}));
    // pick a few tops & bottoms to mix-and-match, size = min(needed, 3)
    const topTake = Math.min(3, Math.max(1, Math.ceil(needed/2)));
    const botTake = Math.min(3, Math.max(1, Math.ceil(needed/2)));
    for (let i=0;i<topTake && i<tops.length;i++) pool.push(tops[i]);
    for (let i=0;i<botTake && i<bottoms.length;i++) pool.push(bottoms[i]);
    // layers/shoes/accessories
    const layerCandidates = selectItems({ category: "Layers", occasion: occ, excludeRepeated: false });
    if (layerCandidates.length) pool.push(layerCandidates[0]);
    const shoeCandidates = selectItems({ category: "Shoes", occasion: occ, excludeRepeated: false });
    if (shoeCandidates.length) pool.push(shoeCandidates[0]);
    return pool.filter(Boolean);
  }

  // For each requested day/occasion, choose a pragmatic outfit from the pool ensuring rules:
  const usedItems = new Map(); // name -> count
  occasionMap.forEach(occ => {
    const pool = buildPoolForOcc(occ, 1);
    // try dress first
    let outfit = null;
    const dresses = selectItems({ category: "Dress", occasion: occ, excludeRepeated: false });
    if (dresses.length && Math.random() < 0.35) {
      outfit = { dress: dresses[ Math.floor(Math.random() * dresses.length) ] };
    } else {
      const tops = selectItems({ category: "Top", occasion: occ, excludeRepeated: false });
      const bottoms = selectItems({ category: "Pants", occasion: occ, excludeRepeated: false }).concat(selectItems({category:"Skirt", occasion:occ, excludeRepeated:false}));
      const top = tops.length ? tops[Math.floor(Math.random() * tops.length)] : null;
      const bottom = bottoms.length ? bottoms[Math.floor(Math.random() * bottoms.length)] : null;
      outfit = { top, bottom };
    }
    // optional layer/shoes/accessories
    const layers = selectItems({ category: "Layers", occasion: occ, excludeRepeated: false });
    if (layers.length && Math.random() > 0.5) outfit.layer = layers[Math.floor(Math.random() * layers.length)];
    const shoes = selectItems({ category: "Shoes", occasion: occ, excludeRepeated: false });
    if (shoes.length) outfit.shoes = shoes[Math.floor(Math.random() * shoes.length)];
    const accs = selectItems({ category: "Accessories", occasion: occ, excludeRepeated: false });
    outfit.accessories = [];
    for (let a of accs) {
      if (outfit.accessories.length >= 2) break;
      outfit.accessories.push(a);
    }

    // add item counts
    const names = [
      outfit.dress?.name || outfit.dress?.item,
      outfit.top?.name || outfit.top?.item,
      outfit.bottom?.name || outfit.bottom?.item,
      outfit.layer?.name || outfit.layer?.item,
      outfit.shoes?.name || outfit.shoes?.item
    ].filter(Boolean);
    (outfit.accessories||[]).forEach(a => names.push(a.name || a.item));
    names.forEach(n => usedItems.set(n, (usedItems.get(n)||0)+1));
  });

  // produce packing list minimal unique items with counts
  const grouped = {};
  for (let [name, count] of usedItems.entries()) {
    const found = closet.find(it => (it.name || it.item) == name || it.name == name);
    const cat = found ? found.category : "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ name, count });
  }

  // render
  let outHtml = `<h3>Packing list (optimized)</h3>`;
  Object.entries(grouped).forEach(([cat, list]) => {
    outHtml += `<h4>${cat}</h4><ul>`;
    list.forEach(it => outHtml += `<li>${it.count} × ${it.name}</li>`);
    outHtml += `</ul>`;
  });
  packingOutput.innerHTML = outHtml;
});

/* ========== IG Post creation (canvas) ========== */
createIGBtn.addEventListener("click", async () => {
  igOutput.textContent = "Creating IG image...";
  if (activeTemperature == null) { igOutput.textContent = "Load weather first."; return; }
  const occ = occasionSelect.value || "";
  const outfit = buildOutfitForTemp(activeTemperature, occ);

  // collect up to 6 images
  const imgs = [];
  function pushImg(it, title) {
    if (!it) return;
    const url = it.image || it.Image || "";
    const label = it.name || it.item || title || "";
    if (url) imgs.push({ url, label });
  }
  pushImg(outfit.top, "Top");
  pushImg(outfit.bottom, "Bottom");
  pushImg(outfit.dress, "Dress");
  pushImg(outfit.layer, "Layer");
  pushImg(outfit.shoes, "Shoes");
  (outfit.accessories||[]).slice(0,2).forEach(a => pushImg(a, "Accessory"));
  pushImg(outfit.purse, "Purse");

  const toLoad = imgs.slice(0,6);
  const loaded = await Promise.all(toLoad.map(i => new Promise(resolve => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => resolve({ ok:true, img:im, info:i });
    im.onerror = () => resolve({ ok:false, img:null, info:i });
    im.src = i.url;
  })));

  if (!loaded.some(r=>r.ok)) {
    igOutput.textContent = "Could not load images (CORS or invalid URLs). IG image cannot be created.";
    return;
  }

  // canvas layout
  const ctx = igCanvas.getContext("2d");
  const cw = igCanvas.width = 1080;
  const ch = igCanvas.height = 1350;
  ctx.fillStyle = "#fff"; ctx.fillRect(0,0,cw,ch);

  const good = loaded.filter(r=>r.ok);
  const n = good.length;
  const positions = (n===1) ? [{x:90,y:160,w:900,h:900}] :
                    (n===2) ? [{x:90,y:200,w:420,h:900},{x:570,y:200,w:420,h:900}] :
                    (n===3) ? [{x:60,y:200,w:960,h:520},{x:60,y:740,w:300,h:360},{x:360,y:740,w:660,h:360}] :
                    (n===4) ? [{x:60,y:180,w:420,h:520},{x:600,y:180,w:420,h:520},{x:60,y:720,w:420,h:420},{x:600,y:720,w:420,h:420}] :
                    (n===5) ? [{x:60,y:140,w:400,h:480},{x:490,y:140,w:400,h:480},{x:60,y:650,w:280,h:300},{x:360,y:650,w:280,h:300},{x:660,y:650,w:280,h:300}] :
                              [{x:60,y:110,w:300,h:360},{x:380,y:110,w:300,h:360},{x:700,y:110,w:300,h:360},{x:60,y:520,w:460,h:520},{x:540,y:520,w:460,h:520},{x:300,y:980,w:480,h:360}];

  // draw images
  for (let i=0;i<good.length;i++) {
    const p = positions[i] || positions[positions.length - 1];
    const im = good[i].img;
    // cover fit
    const ar = im.width / im.height;
    const tar = p.w / p.h;
    let drawW, drawH, dx, dy;
    if (ar > tar) { drawH = p.h; drawW = drawH * ar; dx = p.x - (drawW - p.w)/2; dy = p.y; }
    else { drawW = p.w; drawH = drawW / ar; dx = p.x; dy = p.y - (drawH - p.h)/2; }
    ctx.drawImage(im, dx, dy, drawW, drawH);
    // label
    ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fillRect(p.x+8, p.y + p.h - 36, Math.min(420, p.w-16), 28);
    ctx.fillStyle = "#222"; ctx.font = "18px sans-serif"; ctx.fillText(good[i].info.label || "", p.x+14, p.y + p.h - 14);
  }

  // top title
  ctx.fillStyle = "#fff"; ctx.fillRect(0,0,cw,140);
  ctx.fillStyle = "#222"; ctx.font = "36px system-ui, sans-serif"; ctx.fillText("Today's Outfit", 40, 48);
  ctx.font = "20px system-ui, sans-serif"; ctx.fillText(new Date().toLocaleDateString() + (occasionSelect.value ? " • " + occasionSelect.value : ""), 40, 82);

  // caption & hashtags bottom
  ctx.fillStyle = "#fff"; ctx.fillRect(0,ch-220,cw,220);
  ctx.fillStyle = "#222"; ctx.font = "18px system-ui, sans-serif";
  const names = [];
  if (outfit.top) names.push(outfit.top.name || outfit.top.item);
  if (outfit.bottom) names.push(outfit.bottom.name || outfit.bottom.item);
  if (outfit.dress) names.push(outfit.dress.name || outfit.dress.item);
  if (outfit.layer) names.push(outfit.layer.name || outfit.layer.item);
  if (outfit.shoes) names.push(outfit.shoes.name || outfit.shoes.item);
  (outfit.accessories||[]).forEach(a => names.push(a.name || a.item));
  const captionMain = names.filter(Boolean).slice(0,8).join(" • ");
  const hashtags = new Set();
  if (occasionSelect.value) hashtags.add("#" + occasionSelect.value.replace(/\s+/g,''));
  (outfit.top && outfit.top.colors) && hashtags.add("#" + outfit.top.colors.replace(/\s+/g,''));
  (outfit.bottom && outfit.bottom.colors) && hashtags.add("#" + outfit.bottom.colors.replace(/\s+/g,''));
  (outfit.dress && outfit.dress.colors) && hashtags.add("#" + outfit.dress.colors.replace(/\s+/g,''));
  hashtags.add("#OOTD"); hashtags.add("#OutfitInspo");
  const hs = Array.from(hashtags).slice(0,10).join(" ");
  ctx.fillText(captionMain, 40, ch-160);
  ctx.fillText(hs, 40, ch-130);

  // export
  try {
    const dataURL = igCanvas.toDataURL("image/jpeg", 0.92);
    const imgPreview = new Image();
    imgPreview.src = dataURL;
    imgPreview.style.maxWidth = "240px";
    igOutput.innerHTML = "";
    igOutput.appendChild(imgPreview);
    const a = document.createElement("a");
    a.href = dataURL; a.download = `outfit_${(new Date()).toISOString().slice(0,10)}.jpg`; a.textContent = "Download IG post image";
    a.style.display = "inline-block"; a.style.marginTop = "8px";
    igOutput.appendChild(a);
    // also show caption text
    const cap = document.createElement("pre"); cap.textContent = `${captionMain}\n\n${hs}`; cap.style.whiteSpace = "pre-wrap"; cap.style.marginTop = "8px";
    igOutput.appendChild(cap);
  } catch (err) {
    igOutput.textContent = "Could not export image (likely CORS). Host images on a CORS-friendly host to export.";
  }
});

/* ========== Initialize on load ========== */
(async function init() {
  await fetchCloset();
  loadHistory(); // purge old entries
})();
