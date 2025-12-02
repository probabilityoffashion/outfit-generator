/* CONFIG - update if needed */
const SPREADSHEET_ID = "1v4ByekCi0_qduYlmNCxMD1wljTsWIOHV4dB40Hb_Tsc";
const SHEET_GID = "0"; // first tab
const 314b8f4d1cc944b997be7d1aeca67c5f = ""; // <-- paste your OpenWeather API key here (optional but recommended)

/* DOM shortcuts */
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

/* GLOBAL STATE */
let closet = [];
let activeTemperature = null;
let tripDailyTemps = [];

/* Fetch Google Sheet -> JSON */
async function fetchCloset() {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&gid=${SHEET_GID}`;
  const res = await fetch(url);
  const text = await res.text();
  const json = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
  const cols = json.table.cols.map(c => (c.label || "").trim());
  const rows = json.table.rows || [];
  const items = rows.map(r => {
    const obj = {};
    r.c.forEach((cell, idx) => {
      const key = cols[idx] || `col${idx}`;
      obj[key] = cell && cell.v != null ? cell.v : "";
    });
    return obj;
  });
  return items;
}

/* Init closet */
(async function initCloset(){
  try {
    closet = await fetchCloset();
    console.log("Closet loaded:", closet);
  } catch (err) {
    console.error("Could not load closet. Ensure sheet is shared to 'Anyone with link'.", err);
  }
})();

/* Mode toggle */
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

/* --- Weather utilities --- */
async function fetchLocalWeather() {
  let pos;
  try {
    pos = await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{timeout:10000}));
  } catch (err) { throw new Error("Geolocation failed or blocked."); }
  const lat = pos.coords.latitude, lon = pos.coords.longitude;
  if (OPENWEATHER_API_KEY) {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${OPENWEATHER_API_KEY}`;
    const res = await fetch(url); const data = await res.json();
    const tempF = Math.round(data.main.temp);
    const feels = data.main.feels_like != null ? Math.round(data.main.feels_like) : null;
    const desc = data.weather && data.weather[0] && data.weather[0].description ? data.weather[0].description : "";
    return { tempF, feelsLikeF: feels, description: desc };
  } else {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
    const res = await fetch(url); const data = await res.json();
    const tempC = data.current_weather.temperature;
    const tempF = Math.round((tempC*9/5)+32);
    return { tempF, feelsLikeF: null, description: "" };
  }
}

/* Trip forecast for date range */
async function fetchTripForecastForRange(locationName, startDateStr, endDateStr) {
  let lat, lon, displayName;
  if (OPENWEATHER_API_KEY) {
    const geoURL = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(locationName)}&limit=1&appid=${OPENWEATHER_API_KEY}`;
    const geoRes = await fetch(geoURL); const geo = await geoRes.json();
    if (!geo || !geo.length) throw new Error("Location not found (OpenWeather).");
    lat = geo[0].lat; lon = geo[0].lon; displayName = (geo[0].name + (geo[0].country ? ', ' + geo[0].country : ''));
  } else {
    const geoURL = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1`;
    const geoRes = await fetch(geoURL); const geoJson = await geoRes.json();
    if (!geoJson || !geoJson.results || !geoJson.results.length) throw new Error("Location not found (Open-Meteo).");
    lat = geoJson.results[0].latitude; lon = geoJson.results[0].longitude; displayName = geoJson.results[0].name;
  }

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (OPENWEATHER_API_KEY) {
    const forecastURL = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${OPENWEATHER_API_KEY}`;
    const fRes = await fetch(forecastURL); const fJson = await fRes.json();
    const map = {};
    fJson.list.forEach(item => {
      const dt = new Date(item.dt * 1000);
      const dateKey = dt.toISOString().slice(0,10);
      if (dt >= start && dt <= end) {
        map[dateKey] = map[dateKey] || [];
        const val = item.main && item.main.feels_like != null ? item.main.feels_like : item.main.temp;
        map[dateKey].push(val);
      }
    });
    const out = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
      const key = d.toISOString().slice(0,10);
      const arr = map[key] || [];
      const avg = arr.length ? Math.round(arr.reduce((a,b)=>a+b,0)/arr.length) : null;
      out.push({ date: new Date(key).toDateString(), temp: avg });
    }
    return { place: displayName, daily: out };
  } else {
    const startISO = start.toISOString().slice(0,10);
    const endISO = end.toISOString().slice(0,10);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=apparent_temperature_max,apparent_temperature_min&timezone=auto&start_date=${startISO}&end_date=${endISO}`;
    const res = await fetch(url); const jd = await res.json();
    const daily = [];
    if (jd && jd.daily && jd.daily.time) {
      for (let i=0;i<jd.daily.time.length;i++){
        const tmax = jd.daily.apparent_temperature_max[i];
        const tmin = jd.daily.apparent_temperature_min[i];
        const avgC = (tmax + tmin)/2;
        const avgF = Math.round((avgC * 9/5) + 32);
        daily.push({ date: new Date(jd.daily.time[i]).toDateString(), temp: avgF });
      }
    }
    const full = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
      const ds = new Date(d).toDateString();
      const found = daily.find(x => x.date === ds);
      full.push(found || { date: ds, temp: null });
    }
    return { place: displayName, daily: full };
  }
}

/* Map tempF -> sheet Suitability label */
function tempToSuitability(tempF) {
  if (tempF == null) return null;
  if (tempF >= 80) return "hot 80 F or higher";
  if (tempF >= 68) return "warm 68-79 F";
  if (tempF >= 58) return "mild 58-67 F";
  if (tempF >= 45) return "cool 45-57 F";
  if (tempF >= 32) return "cold 32-44 F";
  return "freezing below 32";
}

/* Color theory helper (very basic).
   Assign color families and accept if same family, neutral, or complementary-ish.
*/
function colorFamily(name) {
  if (!name) return "neutral";
  const n = name.toString().toLowerCase();
  if (n.includes("black")||n.includes("grey")||n.includes("brown")||n.includes("beige")||n.includes("white")||n.includes("pearl")) return "neutral";
  if (n.includes("blue")) return "blue";
  if (n.includes("green")) return "green";
  if (n.includes("pink")) return "pink";
  if (n.includes("red")) return "red";
  if (n.includes("orange")) return "orange";
  if (n.includes("purple")) return "purple";
  if (n.includes("yellow")) return "yellow";
  if (n.includes("multicolor")||n.includes("patterned")||n.includes("leopard")||n.includes("denim")) return "patterned";
  return "neutral";
}
function compatibleColors(a,b) {
  if (!a || !b) return true;
  const A = colorFamily(a), B = colorFamily(b);
  if (A === "neutral" || B === "neutral") return true;
  if (A === B) return true;
  // simple complementary-ish pairs (not exhaustive)
  const complements = { red: "green", blue: "orange", purple: "yellow" };
  if (complements[A] === B || complements[B] === A) return true;
  // patterned plays with most neutrals
  if (A === "patterned" || B === "patterned") return true;
  return false;
}

/* Select items from closet with filters */
function selectItems({ categoryFilter=null, suitableWeatherLabel=null, occasionFilter=null }) {
  if (!closet || !closet.length) return [];
  return closet.filter(item => {
    const cat = (item["Category (pants, skirt, top, dress, layers, accessories, purse, shoes, pair eyewear)"] || "").toString().toLowerCase();
    const occ = (item["Occasion (Dressy/Sunday), Workday, casual, loungewear)"] || "").toString();
    const suitable = (item["Suitable weather (hot 80 F or higher, warm 68-79 F, mild 58-67 F, cool 45-57 F, cold 32-44 F, freezing below 32)"] || "").toString();
    if (categoryFilter) {
      if (!cat.includes(categoryFilter.toLowerCase())) return false;
    }
    if (suitableWeatherLabel) {
      if (!suitable.toLowerCase().includes(suitableWeatherLabel.toLowerCase())) return false;
    }
    if (occasionFilter) {
      if (!occ) return false;
      if (!occ.toLowerCase().includes(occasionFilter.toLowerCase())) return false;
    }
    return true;
  });
}

/* Build one outfit obeying the rules you requested */
function buildOutfit(tempF, occasion="") {
  const label = tempToSuitability(tempF);
  // results are objects from the sheet
  const result = { top:null, bottom:null, dress:null, layer:null, shoes:null, accessories:[], purse:null };

  // prefer dress for Dressy/Sunday or if no top/bottom available
  const dresses = selectItems({categoryFilter:"dress", suitableWeatherLabel:label, occasionFilter:occasion});
  const tops = selectItems({categoryFilter:"top", suitableWeatherLabel:label, occasionFilter:occasion});
  const pants = selectItems({categoryFilter:"pants", suitableWeatherLabel:label, occasionFilter:occasion});
  const skirts = selectItems({categoryFilter:"skirt", suitableWeatherLabel:label, occasionFilter:occasion});
  const layers = selectItems({categoryFilter:"layers", suitableWeatherLabel:label, occasionFilter:occasion});
  const shoes = selectItems({categoryFilter:"shoes", suitableWeatherLabel:label, occasionFilter:occasion});
  const purses = selectItems({categoryFilter:"purse", suitableWeatherLabel:label, occasionFilter:occasion});
  const accs = selectItems({categoryFilter:"accessories", suitableWeatherLabel:label, occasionFilter:occasion});

  // Decide between dress or top+bottom:
  let useDress = false;
  if (occasion && /dressy/i.test(occasion) && dresses.length) useDress = true;
  if (!useDress) {
    // if very few tops or bottoms, prefer dress if available
    if ((!tops.length || (!pants.length && !skirts.length)) && dresses.length) useDress = true;
    // 20% chance to wear a dress when available
    if (!useDress && dresses.length && Math.random() < 0.2) useDress = true;
  }

  if (useDress) {
    result.dress = dresses[Math.floor(Math.random()*dresses.length)];
  } else {
    // pick top
    if (tops.length) result.top = tops[Math.floor(Math.random()*tops.length)];
    // pick bottom: prefer pants over skirts unless occasion suggests skirt/dressy
    if (skirts.length && /dressy/i.test(occasion) && Math.random()>0.3) {
      result.bottom = skirts[Math.floor(Math.random()*skirts.length)];
    } else if (pants.length) {
      result.bottom = pants[Math.floor(Math.random()*pants.length)];
    } else if (skirts.length) {
      result.bottom = skirts[Math.floor(Math.random()*skirts.length)];
    }
  }

  // layers: zero or one
  if (layers.length && Math.random() > 0.4) { // 60% chance to add layer if available and needed
    // add layer more often in cool/cold
    if (["cool 45-57 F","cold 32-44 F","freezing below 32"].includes(label) || Math.random()>0.5) {
      result.layer = layers[Math.floor(Math.random()*layers.length)];
    }
  }

  // shoes
  if (shoes.length) result.shoes = shoes[Math.floor(Math.random()*shoes.length)];

  // accessory rules: max 3 total; belts mutual exclusivity; only one necklace/bracelet/earrings
  // We'll parse the Accessories column of each accessory item to find its type
  const accessorySlots = { necklace:0, bracelet:0, earrings:0, belt_over:0, belt_under:0, other:0 };
  const chosenAcc = [];
  // shuffle accessories array
  const shuffledAcc = accs.sort(()=>Math.random()-0.5);
  for (let a of shuffledAcc) {
    if (chosenAcc.length >= 3) break;
    const accTypesRaw = (a["Accessories (over the clothes belt, under the clothes belt, earrings, bracelet, necklace)"] || "").toString().toLowerCase();
    const types = accTypesRaw.split(',').map(s=>s.trim());
    // determine primary type
    let primary = "other";
    if (types.some(t=>t.includes("under"))) primary="belt_under";
    else if (types.some(t=>t.includes("over"))) primary="belt_over";
    else if (types.some(t=>t.includes("neck"))) primary="necklace";
    else if (types.some(t=>t.includes("brace"))) primary="bracelet";
    else if (types.some(t=>t.includes("ear"))) primary="earrings";
    // enforce single-per-type rules and belt mutual excl
    if ((primary==="belt_over" && accessorySlots.belt_under>0) || (primary==="belt_under" && accessorySlots.belt_over>0)) continue;
    if (primary==="necklace" && accessorySlots.necklace>0) continue;
    if (primary==="bracelet" && accessorySlots.bracelet>0) continue;
    if (primary==="earrings" && accessorySlots.earrings>0) continue;
    // accept
    chosenAcc.push(a);
    accessorySlots[primary] = (accessorySlots[primary] || 0) + 1;
  }
  result.accessories = chosenAcc;

  // purse
  if (purses.length) result.purse = purses[Math.floor(Math.random()*purses.length)];

  // Color coordination: if items conflict, try to swap bottoms/top with compatible color
  // get color fields
  function itemColor(it) { return it && (it["Color"] || it["Pattern"] || "").toString(); }
  let topColor = itemColor(result.top), bottomColor = itemColor(result.bottom), dressColor = itemColor(result.dress);
  if (result.top && result.bottom && !compatibleColors(topColor, bottomColor)) {
    // try to find alternative bottom compatible with top
    const altBottom = (pants.concat(skirts)).find(b => compatibleColors(topColor, (b["Color"]||b["Pattern"])));
    if (altBottom) result.bottom = altBottom;
  }
  if (result.dress) {
    // try to match layer/purse to dress
    if (result.layer && !compatibleColors(dressColor, itemColor(result.layer))) {
      const altLayer = layers.find(l => compatibleColors(dressColor, (l["Color"]||l["Pattern"])));
      if (altLayer) result.layer = altLayer;
    }
  }

  return { label: tempToSuitability(tempF), result };
}

/* UI: local weather button */
getWeatherBtn.addEventListener("click", async () => {
  weatherOutput.textContent = "Loading local weather...";
  try {
    const w = await fetchLocalWeather();
    const display = w.feelsLikeF != null ? `${w.feelsLikeF}°F (feels like) — ${w.description}` : `${w.tempF}°F — ${w.description || 'current'}`;
    weatherOutput.textContent = display;
    activeTemperature = w.feelsLikeF != null ? w.feelsLikeF : w.tempF;
  } catch (err) {
    weatherOutput.textContent = "Could not load local weather: " + (err.message||"");
    activeTemperature = null;
  }
});

/* UI: vacation forecast */
getVacationWeatherBtn.addEventListener("click", async () => {
  const location = document.getElementById("vacationLocation").value.trim();
  const start = document.getElementById("vacationStart").value;
  const end = document.getElementById("vacationEnd").value;
  if (!location || !start || !end) {
    vacationWeatherOutput.textContent = "Please enter destination + start + end dates.";
    return;
  }
  vacationWeatherOutput.textContent = "Loading trip forecast...";
  try {
    const forecast = await fetchTripForecastForRange(location, start, end);
    tripDailyTemps = forecast.daily;
    vacationWeatherOutput.textContent = `Forecast loaded for ${forecast.place}. ${tripDailyTemps.length} day(s).`;
    const temps = tripDailyTemps.map(d=>d.temp).filter(t=>t!=null);
    activeTemperature = temps.length ? Math.round(temps.reduce((a,b)=>a+b,0)/temps.length) : null;
    renderDailyTabs(tripDailyTemps);
  } catch (err) {
    vacationWeatherOutput.textContent = "Unable to load trip forecast: " + (err.message||"");
    tripDailyTemps = [];
    activeTemperature = null;
  }
});

/* Render daily tabs */
function renderDailyTabs(daily) {
  tabsContainer.innerHTML = "";
  tabContent.innerHTML = "";
  if (!daily || !daily.length) {
    dailyTabsSection.classList.add("hidden");
    return;
  }
  dailyTabsSection.classList.remove("hidden");
  daily.forEach((d, idx) => {
    const t = document.createElement("button");
    t.className = "tab";
    t.textContent = d.date;
    t.dataset.idx = idx;
    t.addEventListener("click", () => {
      Array.from(t.parentElement.children).forEach(c=>c.classList.remove("active"));
      t.classList.add("active");
      showDayContent(idx);
    });
    tabsContainer.appendChild(t);
  });
  if (tabsContainer.firstChild) tabsContainer.firstChild.click();
}

/* Show day content with suggestions for each occasion */
function showDayContent(idx) {
  const day = tripDailyTemps[idx];
  if (!day) { tabContent.innerHTML = "No data"; return; }
  const temp = day.temp;
  const label = tempToSuitability(temp);
  const occasions = ["Dressy/Sunday","Workday","casual","loungewear"];
  let html = `<h3>${day.date} — ${temp!=null?temp+'°F':'No data'} (${label || 'unknown'})</h3>`;
  occasions.forEach(occ => {
    const s = buildOutfit(temp, occ);
    const out = s.result;
    html += `<h4>${occ}</h4><ul>`;
    if (out.dress) html += `<li>Dress: ${out.dress["Item Name"] || "—"}</li>`;
    else {
      if (out.top) html += `<li>Top: ${out.top["Item Name"] || "—"}</li>`;
      if (out.bottom) html += `<li>Bottom: ${out.bottom["Item Name"] || "—"}</li>`;
    }
    if (out.layer) html += `<li>Layer: ${out.layer["Item Name"]}</li>`;
    if (out.shoes) html += `<li>Shoes: ${out.shoes["Item Name"]}</li>`;
    if (out.accessories && out.accessories.length) out.accessories.forEach(a=> html += `<li>Accessory: ${a["Item Name"]}</li>`);
    if (out.purse) html += `<li>Purse: ${out.purse["Item Name"]}</li>`;
    html += `</ul>`;
  });
  tabContent.innerHTML = html;
}

/* Single outfit suggestion */
generateOutfitBtn.addEventListener("click", () => {
  if (activeTemperature == null) { outfitOutput.textContent = "Please load weather (local or vacation) first."; return; }
  const occ = occasionSelect.value || "";
  const s = buildOutfit(activeTemperature, occ);
  const out = s.result;
  let html = `<strong>Weather suitability:</strong> ${s.label}<br/><ul>`;
  if (out.dress) html += `<li>Dress: ${out.dress["Item Name"]}</li>`;
  else {
    if (out.top) html += `<li>Top: ${out.top["Item Name"]}</li>`;
    if (out.bottom) html += `<li>Bottom: ${out.bottom["Item Name"]}</li>`;
  }
  if (out.layer) html += `<li>Layer: ${out.layer["Item Name"]}</li>`;
  if (out.shoes) html += `<li>Shoes: ${out.shoes["Item Name"]}</li>`;
  if (out.accessories && out.accessories.length) out.accessories.forEach(a=> html += `<li>Accessory: ${a["Item Name"]}</li>`);
  if (out.purse) html += `<li>Purse: ${out.purse["Item Name"]}</li>`;
  html += "</ul>";
  outfitOutput.innerHTML = html;
});

/* Packing list generator - counts items across days and occasions */
generatePackingBtn.addEventListener("click", async () => {
  if (!tripDailyTemps || !tripDailyTemps.length) { packingOutput.textContent = "Load trip forecast first."; return; }
  const counts = {};
  tripDailyTemps.forEach(day => {
    const temp = day.temp;
    ["Dressy/Sunday","Workday","casual","loungewear"].forEach(occ => {
      const s = buildOutfit(temp, occ);
      const out = s.result;
      function add(it) { if (!it) return; const key = (it["Item Name"]||"Unnamed"); counts[key] = (counts[key]||0)+1; }
      if (out.dress) add(out.dress); else { add(out.top); add(out.bottom); }
      add(out.layer); add(out.shoes);
      (out.accessories||[]).forEach(a=>add(a));
      add(out.purse);
    });
  });
  // group by category
  const grouped = {};
  Object.entries(counts).forEach(([name,count]) => {
    const found = closet.find(it => (it["Item Name"]||"")==name);
    const cat = found ? (found["Category (pants, skirt, top, dress, layers, accessories, purse, shoes, pair eyewear)"] || "other") : "other";
    grouped[cat] = grouped[cat] || []; grouped[cat].push({ name, count });
  });
  let html = `<h3>Packing Summary</h3>`;
  Object.entries(grouped).forEach(([cat,list]) => {
    html += `<h4>${cat}</h4><ul>`;
    list.forEach(it => html += `<li>${it.count} × ${it.name}</li>`);
    html += `</ul>`;
  });
  packingOutput.innerHTML = html;
});

/* --- IG Post creation (Canvas) ---
   - Loads up to 4 item images (top/bottom/dress/shoes/accessories) and arranges them
   - Adds caption with hashtags (derived from items and occasion)
   - Exports PNG and offers download link
*/
createIGBtn.addEventListener("click", async () => {
  igOutput.textContent = "Building IG image...";
  // get current single outfit (based on activeTemperature & occasion)
  if (activeTemperature == null) { igOutput.textContent = "Please load weather first."; return; }
  const occ = occasionSelect.value || "";
  const s = buildOutfit(activeTemperature, occ);
  const out = s.result;

  // collect images (prioritize top, bottom or dress, layer, shoes, first 2 accessories, purse)
  const imgs = [];
  function pushImageFromItem(item) {
    if (!item) return;
    const url = item["Image"] || item["Image URL"] || item["ImageURL"] || "";
    const name = item["Item Name"] || "";
    if (url) imgs.push({ url, name, item });
  }
  pushImageFromItem(out.top);
  pushImageFromItem(out.bottom);
  pushImageFromItem(out.dress);
  pushImageFromItem(out.layer);
  pushImageFromItem(out.shoes);
  if (out.accessories && out.accessories.length) pushImageFromItem(out.accessories[0]);
  if (out.accessories && out.accessories.length>1) pushImageFromItem(out.accessories[1]);
  pushImageFromItem(out.purse);

  // limit to 6 images to keep layout tidy
  const imagesToLoad = imgs.slice(0,6);

  // load images with crossOrigin to avoid taint if possible
  const loaded = await Promise.all(imagesToLoad.map(info => new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve({ success:true, img, info });
    img.onerror = () => resolve({ success:false, img:null, info });
    img.src = info.url;
  })));

  // check if at least one image succeeded
  const anyLoaded = loaded.some(r=>r.success);
  if (!anyLoaded) {
    igOutput.textContent = "Could not load any images for the outfit (CORS or invalid URLs). The IG image cannot be created.";
    return;
  }

  // prepare canvas
  const cw = igCanvas.width, ch = igCanvas.height;
  const ctx = igCanvas.getContext("2d");
  // background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0,0,cw,ch);

  // layout grid for images: dynamic based on count
  const good = loaded.filter(r=>r.success);
  const n = good.length;
  // choose grid pattern
  let positions = [];
  if (n===1) positions = [{x:90,y:90,w:900,h:900}];
  else if (n===2) positions = [{x:90,y:180,w:420,h:900},{x:570,y:180,w:420,h:900}];
  else if (n===3) positions = [{x:60,y:180,w:960,h:520},{x:60,y:730,w:300,h:360},{x:360,y:730,w:660,h:360}];
  else if (n===4) positions = [{x:60,y:160,w:420,h:520},{x:600,y:160,w:420,h:520},{x:60,y:700,w:420,h:420},{x:600,y:700,w:420,h:420}];
  else if (n===5) positions = [{x:60,y:140,w:400,h:480},{x:490,y:140,w:400,h:480},{x:60,y:650,w:280,h:300},{x:360,y:650,w:280,h:300},{x:660,y:650,w:280,h:300}];
  else positions = [{x:60,y:110,w:300,h:360},{x:380,y:110,w:300,h:360},{x:700,y:110,w:300,h:360},{x:60,y:520,w:460,h:520},{x:540,y:520,w:460,h:520},{x:300,y:980,w:480,h:360}];

  // draw images into positions
  for (let i=0;i<good.length;i++){
    const {img, info} = good[i];
    const p = positions[i] || positions[positions.length-1];
    // scale to cover area preserving aspect ratio (cover)
    const ar = img.width / img.height;
    const targetAr = p.w / p.h;
    let drawW, drawH, dx, dy;
    if (ar > targetAr) { // image is wider
      drawH = p.h; drawW = drawH * ar;
      dx = p.x - (drawW - p.w)/2;
      dy = p.y;
    } else {
      drawW = p.w; drawH = drawW / ar;
      dx = p.x;
      dy = p.y - (drawH - p.h)/2;
    }
    ctx.drawImage(img, dx, dy, drawW, drawH);
    // small label
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.fillRect(p.x+8, p.y + p.h - 36, Math.min(400, p.w-16), 28);
    ctx.fillStyle = "#222";
    ctx.font = "18px sans-serif";
    ctx.fillText(info.name || "", p.x+14, p.y + p.h - 14);
  }

  // Draw top caption area
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0,0,cw,120);
  ctx.fillStyle = "#222";
  ctx.font = "38px system-ui, sans-serif";
  ctx.fillText("Today's Outfit", 40, 48);
  ctx.font = "20px system-ui, sans-serif";
  const dateStr = new Date().toLocaleDateString();
  ctx.fillText(dateStr + (occasionSelect.value ? " • " + occasionSelect.value : ""), 40, 80);

  // Caption + hashtags area at bottom
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0,ch-200,cw,200);
  ctx.fillStyle = "#222";
  ctx.font = "20px system-ui, sans-serif";
  let captionLines = [];
  // Compose caption from item names
  const names = [];
  function pushName(it){ if (!it) return; names.push(it["Item Name"] || it["Item"] || ""); }
  if (out.top) pushName(out.top); if (out.bottom) pushName(out.bottom); if (out.dress) pushName(out.dress);
  if (out.layer) pushName(out.layer); if (out.shoes) pushName(out.shoes);
  if (out.accessories && out.accessories.length) out.accessories.forEach(a=>pushName(a));
  if (out.purse) pushName(out.purse);
  captionLines.push(names.filter(Boolean).slice(0,8).join(" • "));
  // build hashtags from colors and occasion
  const hashtags = new Set();
  if (occasionSelect.value) hashtags.add("#" + occasionSelect.value.replace(/\s+/g,''));
  (out.top && out.top["Color"]) && hashtags.add("#" + out.top["Color"].toString().replace(/\s+/g,''));
  (out.bottom && out.bottom["Color"]) && hashtags.add("#" + out.bottom["Color"].toString().replace(/\s+/g,''));
  (out.dress && out.dress["Color"]) && hashtags.add("#" + out.dress["Color"].toString().replace(/\s+/g,''));
  hashtags.add("#OOTD");
  hashtags.add("#OutfitInspo");
  const hs = Array.from(hashtags).slice(0,10).join(" ");
  captionLines.push(hs);

  // draw caption lines
  ctx.font = "18px system-ui, sans-serif";
  let y = ch - 140;
  for (let i=0;i<captionLines.length;i++){
    ctx.fillText(captionLines[i], 40, y + i*26);
  }

  // export
  try {
    const dataURL = igCanvas.toDataURL("image/jpeg", 0.92);
    // create download link
    const a = document.createElement("a");
    a.href = dataURL;
    a.download = `outfit_${(new Date()).toISOString().slice(0,10)}.jpg`;
    a.textContent = "Download IG post image";
    a.style.display = "inline-block";
    a.style.marginTop = "8px";
    // Add preview
    const imgPreview = new Image();
    imgPreview.src = dataURL;
    imgPreview.style.maxWidth = "240px";
    imgPreview.style.display = "block";
    igOutput.innerHTML = "";
    igOutput.appendChild(imgPreview);
    igOutput.appendChild(a);
    // caption text under preview
    const captionEl = document.createElement("div");
    captionEl.style.marginTop = "8px";
    captionEl.innerText = captionLines.join("\n");
    igOutput.appendChild(captionEl);
  } catch (err) {
    igOutput.textContent = "Could not export image. This often happens when one or more images block cross-origin access. Try hosting your images on a CORS-friendly host (imgur, your server) or enable public sharing on Google Drive with direct image URLs.";
  }
});
getVacationWeatherBtn.addEventListener("click", async () => {
    const location = document.getElementById("vacationLocation").value.trim();

    if (!location) {
        vacationWeatherResult.textContent = "Please enter a location.";
        return;
    }

    try {
        vacationWeatherResult.textContent = "Loading...";

        const weather = await fetchVacationWeather(location);

        if (!weather) {
            vacationWeatherResult.textContent = "Unable to get weather. Check your spelling.";
            return;
        }

        const temp = weather.main?.temp;
        const condition = weather.weather?.[0]?.main;

        vacationWeatherResult.textContent =
            `Weather in ${location}: ${temp}°F, ${condition}`;
    } catch (error) {
        vacationWeatherResult.textContent = "Error fetching vacation weather.";
        console.error(error);
    }
});
