let map;
let allCourts = [];
let markers = [];

const filters = ["indoor", "outdoor", "water", "toilets"];
const yes = value => String(value).toLowerCase() === "yes" || value === true;

function parseCsv(text) {
  const rows = [];
  const lines = text.trim().split(/\r?\n/);
  const headers = [];
  let current = [];
  let inQuotes = false;

  const pushField = () => {
    const value = current.join("").trim();
    headers.push(value);
    current = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].trim()) continue;

    current = [];
    const cells = [];
    let field = "";
    let quote = false;

    for (let j = 0; j < lines[i].length; j += 1) {
      const char = lines[i][j];
      if (char === '"') {
        if (quote && lines[i][j + 1] === '"') {
          field += '"';
          j += 1;
        } else {
          quote = !quote;
        }
      } else if (char === "," && !quote) {
        cells.push(field.trim());
        field = "";
      } else {
        field += char;
      }
    }

    cells.push(field.trim());

    if (i === 0) {
      headers.push(...cells);
      continue;
    }

    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ? cells[index].trim() : "";
    });
    rows.push(row);
  }

  return rows.map(row => ({
    ...row,
    name: row.name || "Basketball court",
    location: row.location || "",
    lat: Number(row.lat),
    lng: Number(row.lng),
    type: row.type || "Outdoor",
    surface: row.surface || "",
    hoops: row.hoops || "",
    nets: row.nets || "",
    condition: row.condition || "",
    description: row.description || "",
    water: row.water || "",
    toilets: row.toilets || "",
  }));
}

function buildCsvUrl(file) {
  const url = new URL(file, window.location.href);
  url.searchParams.set("t", String(Date.now()));
  return url.toString();
}

async function loadCourts() {
  const preferredFiles = ["courts.csv", "data.csv", "basketball courts.csv", "basketball-courts.csv"];

  for (const file of preferredFiles) {
    try {
      const response = await fetch(buildCsvUrl(file));
      if (!response.ok) continue;
      const text = await response.text();
      return parseCsv(text);
    } catch (error) {
      console.warn(`Could not load ${file}`, error);
    }
  }

  throw new Error("Failed to load a court CSV file");
}

function markerIcon(court) {
  const kind = court.type === "Indoor" ? "indoor" : court.condition === "Poor" || court.surface === "Poor" ? "poor" : "";
  return L.divIcon({ className:"", html:`<div class="marker ${kind}">🏀</div>`, iconSize:[28,28], iconAnchor:[14,14], popupAnchor:[0,-15] });
}

function popup(court) {
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${court.lat},${court.lng}`;
  const safe = value => String(value ?? "—").replace(/[&<>"']/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[character]);
  return `<div class="court-popup"><h2>${safe(court.name)}</h2><p>${safe(court.description || "")}</p><div class="details">
    <span>Type</span><strong>${safe(court.type)}</strong><span>Surface condition</span><strong>${safe(court.surface)}</strong>
    <span>Hoops</span><strong>${safe(court.hoops)}</strong><span>Nets</span><strong>${safe(court.nets)}</strong>
    <span>Court condition</span><strong>${safe(court.condition)}</strong>
  </div><a class="directions" target="_blank" rel="noopener" href="${directions}">Get directions</a></div>`;
}

function matches(court) {
  const search = document.querySelector("#search").value.trim().toLowerCase();
  const text = `${court.name} ${court.location || ""}`.toLowerCase();
  if (search && !text.includes(search)) return false;
  if (document.querySelector("#indoor").checked && court.type !== "Indoor") return false;
  if (document.querySelector("#outdoor").checked && court.type !== "Outdoor") return false;
  return !["water", "toilets"].some(key => document.querySelector(`#${key}`).checked && !yes(court[key]));
}

function render() {
  markers.forEach(marker => marker.remove());
  markers = [];
  const courts = allCourts.filter(matches);
  const list = document.querySelector("#court-list");
  list.innerHTML = "";
  document.querySelector("#court-count").textContent = `${courts.length} court${courts.length === 1 ? "" : "s"} found`;
  courts.forEach(court => {
    const marker = L.marker([court.lat, court.lng], { icon:markerIcon(court) }).addTo(map).bindPopup(popup(court));
    markers.push(marker);
    const card = document.createElement("button");
    card.className = "court-card";
    card.innerHTML = `<h2>${court.name}</h2><p>${court.location || court.type || "Basketball court"}</p>`;
    card.addEventListener("click", () => { map.setView([court.lat, court.lng], 16); marker.openPopup(); });
    list.append(card);
  });
}

async function start() {
  map = L.map("map", { zoomControl:false }).setView([50.71, -3.51], 12);
  L.control.zoom({ position:"bottomright" }).addTo(map);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom:19, attribution:"© OpenStreetMap contributors" }).addTo(map);
  try {
    allCourts = await loadCourts();
    render();
  }
  catch (error) {
    console.error(error);
    document.querySelector("#court-count").textContent = "Could not load the court list.";
  }
  document.querySelector("#search").addEventListener("input", render);
  filters.forEach(id => document.querySelector(`#${id}`).addEventListener("change", render));
}
start();
