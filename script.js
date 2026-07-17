let map;
let allCourts = [];
let markers = [];
let imageObserver = null;

const filters = ["half", "full"];
const placeholderImage = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

function loadImage(img) {
  if (!img || !img.dataset.src) return;
  const src = img.dataset.src;
  img.src = src;
  delete img.dataset.src;
  img.classList.add("is-loaded");
}

function observeImages(root = document) {
  const images = Array.from(root.querySelectorAll ? root.querySelectorAll("img[data-src]") : []);
  if (!images.length) return;

  if (!("IntersectionObserver" in window)) {
    images.forEach(loadImage);
    return;
  }

  if (!imageObserver) {
    imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          loadImage(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "200px 0px" });
  }

  images.forEach(img => imageObserver.observe(img));
}

let galleryImages = [];
let galleryIndex = 0;

function openImageModal(imageElement) {
  const modal = document.querySelector("#image-modal");
  const modalImage = document.querySelector("#image-modal-image");
  if (!modal || !modalImage || !imageElement) return;

  const allImages = Array.from(document.querySelectorAll("img[data-full-src]"));
  galleryImages = allImages.filter(img => img.dataset.fullSrc);
  galleryIndex = galleryImages.indexOf(imageElement);
  if (galleryIndex < 0) galleryIndex = 0;

  modalImage.src = imageElement.dataset.fullSrc || imageElement.dataset.src || imageElement.src;
  modalImage.alt = imageElement.alt || "Court photo";
  modal.classList.add("is-visible");
  modal.setAttribute("aria-hidden", "false");
}

function showGalleryImage(direction) {
  if (!galleryImages.length) return;
  galleryIndex = (galleryIndex + direction + galleryImages.length) % galleryImages.length;
  const image = galleryImages[galleryIndex];
  const modalImage = document.querySelector("#image-modal-image");
  if (!modalImage || !image) return;
  modalImage.src = image.dataset.fullSrc || image.dataset.src || image.src;
  modalImage.alt = image.alt || "Court photo";
}

function closeImageModal() {
  const modal = document.querySelector("#image-modal");
  if (!modal) return;
  modal.classList.remove("is-visible");
  modal.setAttribute("aria-hidden", "true");
}

function bindImageEvents() {
  document.addEventListener("click", event => {
    const target = event.target.closest("img[data-full-src]");
    if (!target) return;

    event.preventDefault();
    openImageModal(target);
  });

  document.querySelector("#image-modal")?.addEventListener("click", event => {
    if (event.target.id === "image-modal") closeImageModal();
  });

  document.querySelector(".image-modal-close")?.addEventListener("click", closeImageModal);
  document.querySelector("#image-modal-next")?.addEventListener("click", () => showGalleryImage(1));
  document.querySelector("#image-modal-prev")?.addEventListener("click", () => showGalleryImage(-1));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeImageModal();
    if (event.key === "ArrowRight") showGalleryImage(1);
    if (event.key === "ArrowLeft") showGalleryImage(-1);
  });
}

function escapeHtml(value) {
  return String(value ?? "—").replace(/[&<>"']/g, character => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[character]);
}

function collectPhotos(row) {
  const photos = [];
  const addValue = value => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (!trimmed) return;
    if (!photos.includes(trimmed)) photos.push(trimmed);
  };

  addValue(row.photo);
  addValue(row.Photo);
  addValue(row.photos);
  addValue(row.Photos);

  Object.entries(row).forEach(([key, value]) => {
    if (/^photo(?:\s+\d+|\d+)?$/i.test(key)) addValue(value);
  });

  return photos;
}

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
    name: row.name || row.Name || "Basketball court",
    location: row.location || row.Location || "",
    lat: Number(row.lat || row.Latitude || row.latitude || row.latitude),
    lng: Number(row.lng || row.Longitude || row.longitude || row.longitude),
    type: row.type || row.Type || row["Court size"] || "Outdoor",
    surface: row.surface || row.Surface || "",
    hoops: row.hoops || row.Hoops || "",
    nets: row.nets || row.Nets || "",
    condition: row.condition || row.Condition || row["Overall Condition"] || "",
    description: row.description || row.Description || row.Details || "",
    water: row.water || row.Water || "",
    toilets: row.toilets || row.Toilets || "",
    photos: collectPhotos(row),
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
  const type = String(court.type || "").toLowerCase();
  const kind = type.includes("half") ? "half" : type.includes("full") ? "full" : "default";
  return L.divIcon({ className:"", html:`<div class="marker ${kind}">🏀</div>`, iconSize:[28,28], iconAnchor:[14,14], popupAnchor:[0,-15] });
}

function resolvePhotoUrl(photo) {
  if (!photo) return "";
  if (/^https?:\/\//i.test(photo) || photo.startsWith("/")) return photo;
  const trimmed = photo.trim();
  const compressed = trimmed.replace(/^photos\//, "photos/compressed/");
  return new URL(compressed, window.location.href).toString();
}

function makePhotoMarkup(photo, alt, className, index = 0) {
  const resolved = resolvePhotoUrl(photo);
  if (!resolved) return "";
  return `<img class="${className}" loading="lazy" decoding="async" src="${placeholderImage}" data-src="${resolved}" data-full-src="${resolved}" data-index="${index}" alt="${escapeHtml(alt)}" width="640" height="360" />`;
}

function popup(court) {
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${court.lat},${court.lng}`;
  const photosMarkup = court.photos?.length
    ? `<div class="court-photos">${court.photos.slice(0, 4).map((photo, index) => makePhotoMarkup(photo, court.name, "court-popup-photo", index)).join("")}</div>`
    : "";

  return `<div class="court-popup"><h2>${escapeHtml(court.name)}</h2><p>${escapeHtml(court.description || "")}</p><div class="details">
    <span>Type</span><strong>${escapeHtml(court.type)}</strong><span>Surface condition</span><strong>${escapeHtml(court.surface)}</strong>
    <span>Hoops</span><strong>${escapeHtml(court.hoops)}</strong><span>Nets</span><strong>${escapeHtml(court.nets)}</strong>
    <span>Court condition</span><strong>${escapeHtml(court.condition)}</strong>
  </div>${photosMarkup}<a class="directions" target="_blank" rel="noopener" href="${directions}">Get directions</a></div>`;
}

function matches(court) {
  const search = document.querySelector("#search").value.trim().toLowerCase();
  const text = `${court.name} ${court.location || ""}`.toLowerCase();
  if (search && !text.includes(search)) return false;
  const type = String(court.type || "").toLowerCase();
  if (document.querySelector("#half").checked && !type.includes("half")) return false;
  if (document.querySelector("#full").checked && !type.includes("full")) return false;
  return true;
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
    marker.on("popupopen", () => {
      const popupElement = marker.getPopup()?.getElement();
      if (popupElement) observeImages(popupElement);
    });
    markers.push(marker);
    const card = document.createElement("button");
    card.className = "court-card";
    const photoMarkup = court.photos?.length ? makePhotoMarkup(court.photos[0], court.name, "court-photo-thumb") : "";
    card.innerHTML = `${photoMarkup}<div class="court-card-content"><h2>${escapeHtml(court.name)}</h2><p>${escapeHtml(court.location || court.type || "Basketball court")}</p></div>`;
    card.addEventListener("click", () => { map.setView([court.lat, court.lng], 16); marker.openPopup(); });
    list.append(card);
  });

  observeImages();
}

async function start() {
  map = L.map("map", { zoomControl:false }).setView([50.71, -3.51], 12);
  L.control.zoom({ position:"bottomright" }).addTo(map);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom:19, attribution:"© OpenStreetMap contributors" }).addTo(map);
  bindImageEvents();

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
