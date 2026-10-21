const GOOGLE_MAPS_API_KEY = "AIzaSyD9VuXNbVvifzE7MCd-x7GIM1OWtskXT8g";
const ASIA_OVERVIEW = { center: { lat: 32, lng: 102 }, zoom: 2.5 };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
let content;
const requestedLanguage = new URLSearchParams(window.location.search).get("lang");
let language = requestedLanguage === "ko" ? "ko" : "en";
let selectedPlace = "all";
let map;
let infoWindow;

function text(value) {
  return typeof value === "string" ? value : (value?.[language] ?? value?.en ?? "");
}

function renderPage() {
  document.documentElement.lang = language;
  document.title = text(content.profile.name);
  $("meta[name='description']").content = text(content.ui.siteDescription);

  const profileImage = $(".avatar");
  profileImage.src = content.profile.photo;
  profileImage.alt = text(content.profile.name);
  $(".verified-badge").setAttribute("aria-label", text(content.ui.verifiedLabel));
  $(".language").setAttribute("aria-label", text(content.ui.languageSelection));
  $(".profile-content h1").textContent = text(content.profile.name);
  $(".bio").textContent = text(content.profile.bio);
  const emailButton = $(".email-copy");
  emailButton.setAttribute("aria-label", text(content.ui.copyEmail));
  $(".email-address", emailButton).textContent = content.profile.email;
  $(".find-me .eyebrow").textContent = text(content.ui.findMe);
  $(".social-links").innerHTML = content.profile.socials.map(social => `
    <a href="${escapeHTML(social.url)}" target="_blank" rel="noreferrer"><span>${escapeHTML(social.icon)}</span> ${escapeHTML(social.name)}</a>
  `).join("");

  const cat = content.cat;
  const catCard = $(".miro-card");
  catCard.href = cat.videoUrl;
  catCard.setAttribute("aria-label", `${text(cat.name)} · ${text(cat.description)}`);
  $(".miro-card img").src = cat.photo;
  $(".miro-card img").alt = text(cat.name);
  $("#cat-name").textContent = text(cat.name);
  $(".miro-copy > span").textContent = text(cat.description);

  $("#gallery .section-heading h2").textContent = text(content.ui.galleryTitle);
  $("#map").setAttribute("aria-label", text(content.ui.mapLabel));
  const mapLoadingLabel = $(".map-fallback strong");
  if (mapLoadingLabel) mapLoadingLabel.textContent = text(content.ui.mapLoading);
  $(".photo-heading h3").textContent = text(content.ui.photoHeading);
  renderPlaceFilters();
  renderPhotos();

  $("#life .section-heading h2").textContent = text(content.ui.experienceEducation);
  renderResume(".experience-card", content.ui.experience, content.experience);
  renderResume(".education-card", content.ui.education, content.education);
  $(".projects-section .section-heading h2").textContent = text(content.ui.projects);
  renderProjects();

  $$("[data-lang]").forEach(button => button.classList.toggle("active", button.dataset.lang === language));
  $(".dialog-close").textContent = "×";
  $(".dialog-close").setAttribute("aria-label", text(content.ui.close));
  if (map) updateMapLanguage();
}

function renderPlaceFilters() {
  const filters = [{ id: "all", name: content.ui.allPlaces }, ...content.places.map(place => ({ id: place.id, name: place.name }))];
  $(".place-tabs").innerHTML = filters.map(filter => `
    <button type="button" data-place="${escapeHTML(filter.id)}" class="${filter.id === selectedPlace ? "selected" : ""}">${escapeHTML(text(filter.name))}</button>
  `).join("");
  $$(".place-tabs button").forEach(button => button.addEventListener("click", () => selectPlace(button.dataset.place)));
}

function renderPhotos() {
  const cards = content.places.flatMap(place => place.photos.map((photo, index) => ({ place, photo, index })));
  $(".photos").innerHTML = cards.map(({ place, photo, index }) => `
    <button type="button" class="photo-card" data-place="${escapeHTML(place.id)}" data-photo-index="${index}">
      <span class="photo-image"><img src="${escapeHTML(photo.image)}" alt="${escapeHTML(text(photo.alt))}" loading="lazy"><small>${escapeHTML(text(place.name).toUpperCase())} · ${escapeHTML(photo.date)}</small></span>
      <span class="photo-caption"><strong>${escapeHTML(text(photo.title))}</strong><small>${escapeHTML(text(place.name))}, ${escapeHTML(text(content.ui.country))}<b>↗</b></small></span>
    </button>
  `).join("");
  $$(".photo-card").forEach(card => {
    card.hidden = selectedPlace !== "all" && card.dataset.place !== selectedPlace;
    card.addEventListener("click", () => openPhoto(card.dataset.place, Number(card.dataset.photoIndex)));
  });
}

function renderResume(selector, heading, entries) {
  const card = $(selector);
  $(".card-heading h3", card).textContent = text(heading);
  $(".resume-entries", card).innerHTML = entries.map(entry => `
    <div class="resume-entry"><time>${escapeHTML(entry.period)}</time><div><strong>${escapeHTML(text(entry.title))}</strong></div></div>
  `).join("");
}

function renderProjects() {
  $(".projects-grid").innerHTML = content.projects.map((project, index) => `
    <article class="project-card">
      <div class="project-art project-${index + 1}" data-art="${escapeHTML(project.art)}" aria-hidden="true">
        <span>${String(index + 1).padStart(2, "0")}</span>
        <div class="project-artwork"><i></i><i></i><i></i></div>
      </div>
      <div class="project-copy"><small>${escapeHTML(text(project.category))} · ${escapeHTML(project.year)}</small><h3>${escapeHTML(text(project.title))}</h3></div>
    </article>
  `).join("");
}

function setLanguage(next) {
  if (next === language) return;
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set("lang", next);
  window.location.assign(nextUrl.toString());
}

function selectPlace(id) {
  selectedPlace = id;
  $$(".place-tabs button").forEach(button => button.classList.toggle("selected", button.dataset.place === id));
  $$(".photo-card").forEach(card => { card.hidden = id !== "all" && card.dataset.place !== id; });
  const place = content.places.find(item => item.id === id);
  if (place && map) map.setOptions({ center: place.coordinates, zoom: 5 });
  else if (id === "all" && map) map.setOptions(ASIA_OVERVIEW);
}

function openPhoto(placeId, photoIndex) {
  const place = content.places.find(item => item.id === placeId);
  const photo = place?.photos[photoIndex];
  if (!place || !photo) return;
  const dialog = $("#photoDialog");
  const image = $(".dialog-image", dialog);
  image.src = photo.image;
  image.alt = text(photo.alt);
  $(".dialog-copy small", dialog).textContent = `${text(place.name).toUpperCase()} · ${text(content.ui.photoNote)}`;
  $(".dialog-copy h2", dialog).textContent = text(photo.title);
  $(".dialog-copy p", dialog).textContent = text(photo.description);
  dialog.showModal();
}

async function copyEmail() {
  const button = $(".email-copy");
  const feedback = $(".copy-feedback", button);
  try {
    await navigator.clipboard.writeText(content.profile.email);
  } catch {
    const temporaryInput = document.createElement("textarea");
    temporaryInput.value = content.profile.email;
    temporaryInput.style.position = "fixed";
    temporaryInput.style.opacity = "0";
    document.body.appendChild(temporaryInput);
    temporaryInput.select();
    document.execCommand("copy");
    temporaryInput.remove();
  }
  feedback.textContent = text(content.ui.copied);
  button.classList.add("copied");
  button.setAttribute("aria-label", text(content.ui.copied));
  window.clearTimeout(copyEmail.timer);
  copyEmail.timer = window.setTimeout(() => {
    feedback.textContent = "";
    button.classList.remove("copied");
    button.setAttribute("aria-label", text(content.ui.copyEmail));
  }, 1800);
}

function updateMapLanguage() {
  if (!map || !infoWindow) return;
  content.places.forEach(place => {
    const marker = place.marker;
    if (marker) marker.setTitle(text(place.name));
  });
}

function showMapError() {
  const fallback = $(".map-fallback");
  if (fallback) $("strong", fallback).textContent = text(content.ui.mapError);
}

window.initPersonalMap = function () {
  const mapElement = $("#map");
  map = new google.maps.Map(mapElement, {
    center: ASIA_OVERVIEW.center,
    zoom: ASIA_OVERVIEW.zoom,
    isFractionalZoomEnabled: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
    clickableIcons: false,
    gestureHandling: "cooperative",
    styles: [
      { featureType: "poi", stylers: [{ visibility: "off" }] },
      { featureType: "transit", stylers: [{ visibility: "off" }] },
      { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#eef0e8" }] },
      { featureType: "water", elementType: "geometry", stylers: [{ color: "#dce9e7" }] },
      { featureType: "road", elementType: "geometry", stylers: [{ color: "#fff" }] }
    ]
  });
  $(".map-fallback")?.remove();
  infoWindow = new google.maps.InfoWindow();
  content.places.forEach(place => {
    const marker = new google.maps.Marker({
      position: place.coordinates,
      map,
      title: text(place.name),
      icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: "#425d4e", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3, scale: 7 }
    });
    place.marker = marker;
    marker.addListener("click", () => {
      selectPlace(place.id);
      const contentNode = document.createElement("div");
      contentNode.className = "map-info";
      const title = document.createElement("b");
      title.textContent = text(place.name);
      const note = document.createElement("span");
      note.textContent = place.photos.map(photo => text(photo.title)).join(" · ");
      contentNode.append(title, document.createElement("br"), note);
      infoWindow.setContent(contentNode);
      infoWindow.open({ map, anchor: marker });
    });
  });
};

function loadGoogleMaps() {
  if (!GOOGLE_MAPS_API_KEY) return;
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&language=${encodeURIComponent(language)}&callback=initPersonalMap&loading=async`;
  script.async = true;
  script.onerror = showMapError;
  document.head.appendChild(script);
}

async function start() {
  try {
    const response = await fetch("./content.json");
    if (!response.ok) throw new Error("Content file could not be loaded.");
    content = await response.json();
    renderPage();
    $$("[data-lang]").forEach(button => button.addEventListener("click", () => setLanguage(button.dataset.lang)));
    $(".email-copy").addEventListener("click", copyEmail);
    $(".dialog-close").addEventListener("click", () => $("#photoDialog").close());
    $("#photoDialog").addEventListener("click", event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
    loadGoogleMaps();
  } catch (error) {
    console.error(error);
  }
}

start();
