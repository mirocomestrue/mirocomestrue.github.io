const GOOGLE_MAPS_API_KEY = "AIzaSyD9VuXNbVvifzE7MCd-x7GIM1OWtskXT8g";
const MAP_CAMERA = { center: { lat: 36, lng: 127.7 }, zoom: 6 };
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
let content;
let map;
let projectIndex = 0;
let dialogPlaceId = "";
let dialogPhotoIndex = 0;
let revealObserver = null;

function renderPage() {
  document.documentElement.lang = "en";
  document.title = content.ui.siteTitle;
  $("meta[name='description']").content = content.ui.siteDescription;

  const profileImage = $(".avatar");
  profileImage.src = content.profile.photo;
  profileImage.alt = content.profile.name;
  $(".verified-badge").setAttribute("aria-label", content.ui.verifiedLabel);
  $(".profile-content h1").textContent = content.profile.name;
  $(".bio").textContent = content.profile.bio;

  const whatsapp = $(".whatsapp-link");
  whatsapp.href = "https://wa.me/" + content.profile.whatsapp.replace(/\D/g, "");
  whatsapp.setAttribute("aria-label", "Message on WhatsApp: " + content.profile.whatsapp);
  $(".whatsapp-number", whatsapp).textContent = content.profile.whatsapp;

  const emailButton = $(".email-copy");
  emailButton.setAttribute("aria-label", content.ui.copyEmail);
  $(".email-address", emailButton).textContent = content.profile.email;
  $(".find-me .eyebrow").textContent = content.ui.findMe;
  $(".social-links").innerHTML = content.profile.socials.map(social =>
    '<a href="' + escapeHTML(social.url) + '"><span class="social-mark social-mark-' + escapeHTML(social.icon) + '" aria-hidden="true">' + renderSocialIcon(social.icon) + '</span> ' + escapeHTML(social.name) + '</a>'
  ).join("");

  $("#places .section-heading h2").textContent = content.ui.galleryTitle;
  $("#map").setAttribute("aria-label", content.ui.mapLabel);
  const mapLoadingLabel = $(".map-fallback strong");
  if (mapLoadingLabel) mapLoadingLabel.textContent = content.ui.mapLoading;

  $("#bio .section-heading h2").textContent = content.ui.bio;
  renderBio();
  renderProjects();

  $(".dialog-close").setAttribute("aria-label", content.ui.close);
  $(".email-copy").addEventListener("click", copyEmail);
  $(".dialog-close").addEventListener("click", () => $("#photoDialog").close());
  $(".dialog-photo-prev").addEventListener("click", () => moveDialogPhoto(-1));
  $(".dialog-photo-next").addEventListener("click", () => moveDialogPhoto(1));
  enableHorizontalSwipe($(".dialog-image"), () => moveDialogPhoto(-1), () => moveDialogPhoto(1));
  $("#photoDialog").addEventListener("click", event => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });
}

function renderSocialIcon(icon) {
  if (icon === "instagram") {
    return '<svg viewBox="0 0 24 24" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8"/></svg>';
  }
  return escapeHTML(icon);
}

function renderBio() {
  $(".bio-entries").innerHTML = content.bio.map(entry =>
    '<div class="bio-entry"><time>' + escapeHTML(entry.period) + '</time><strong>' + escapeHTML(entry.title) + '</strong></div>'
  ).join("");
}

function renderProjects() {
  $("#projects .section-heading h2").textContent = content.ui.projects;
  $(".project-prev").setAttribute("aria-label", content.ui.previousProject);
  $(".project-next").setAttribute("aria-label", content.ui.nextProject);
  $(".project-prev").addEventListener("click", () => showProject(projectIndex - 1, -1));
  $(".project-next").addEventListener("click", () => showProject(projectIndex + 1, 1));
  enableHorizontalSwipe($(".project-carousel"), () => showProject(projectIndex - 1, -1), () => showProject(projectIndex + 1, 1));
  showProject(0, 0);
}

function showProject(index, direction = 1) {
  projectIndex = (index + content.projects.length) % content.projects.length;
  const project = content.projects[projectIndex];
  const slide = $(".project-slide");
  slide.dataset.direction = direction > 0 ? "next" : direction < 0 ? "previous" : "";
  const projectImages = (project.images || []).map(image =>
    '<img class="project-preview" src="' + escapeHTML(image.src) + '" alt="' + escapeHTML(image.alt || project.title) + '">'
  ).join("");
  const subtitle = project.subtitle ? '<p class="project-subtitle">' + escapeHTML(project.subtitle) + '</p>' : '';
  const quote = project.quote ? '<blockquote class="project-quote">' + escapeHTML(project.quote) + '</blockquote>' : '';
  slide.innerHTML =
    '<article class="project-card">' +
      '<div class="project-banner project-' + (projectIndex + 1) + ' project-banner--' + escapeHTML(project.layout || "single") + '">' +
        projectImages +
      '</div>' +
      '<div class="project-copy"><small>' + escapeHTML(project.category) + '</small>' + subtitle +
      '<h3>' + escapeHTML(project.title) + '</h3><p>' + escapeHTML(project.description) + '</p>' + quote + '</div>' +
    '</article>';
  observeProjectReveal();
}

function openPhoto(placeId, photoIndex) {
  const place = content.places.find(item => item.id === placeId);
  if (!place || !place.photos.length) return;
  dialogPlaceId = placeId;
  dialogPhotoIndex = photoIndex;
  renderDialogPhoto();
  $("#photoDialog").showModal();
}

function renderDialogPhoto() {
  const place = content.places.find(item => item.id === dialogPlaceId);
  const photo = place && place.photos[dialogPhotoIndex];
  if (!place || !photo) return;
  const dialog = $("#photoDialog");
  const image = $(".dialog-image", dialog);
  image.src = photo.image;
  image.alt = photo.alt;
  $(".dialog-copy small", dialog).textContent = place.name + " · " + content.ui.photoNote;
  $(".dialog-copy h2", dialog).textContent = photo.title;
  $(".dialog-copy p", dialog).textContent = photo.description;
  const multiple = place.photos.length > 1;
  $(".dialog-photo-prev", dialog).hidden = !multiple;
  $(".dialog-photo-next", dialog).hidden = !multiple;
}

function moveDialogPhoto(direction) {
  const place = content.places.find(item => item.id === dialogPlaceId);
  if (!place || place.photos.length < 2) return;
  dialogPhotoIndex = (dialogPhotoIndex + direction + place.photos.length) % place.photos.length;
  renderDialogPhoto();
}

function enableHorizontalSwipe(element, onPrevious, onNext) {
  let startX = 0;
  let startY = 0;
  element.addEventListener("touchstart", event => {
    if (event.touches.length !== 1) return;
    startX = event.touches[0].clientX;
    startY = event.touches[0].clientY;
  }, { passive: true });
  element.addEventListener("touchend", event => {
    if (!event.changedTouches.length) return;
    const deltaX = event.changedTouches[0].clientX - startX;
    const deltaY = event.changedTouches[0].clientY - startY;
    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
    if (deltaX < 0) onNext();
    else onPrevious();
  }, { passive: true });
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
  feedback.textContent = content.ui.copied;
  button.classList.add("copied");
  button.setAttribute("aria-label", content.ui.copied);
  window.clearTimeout(copyEmail.timer);
  copyEmail.timer = window.setTimeout(() => {
    feedback.textContent = "";
    button.classList.remove("copied");
    button.setAttribute("aria-label", content.ui.copyEmail);
  }, 1800);
}

function observeReveal(element, delay = 0, variant = "rise") {
  if (!revealObserver || !element) return;
  element.classList.add("scroll-reveal", "scroll-reveal--" + variant);
  element.style.setProperty("--reveal-delay", delay + "ms");
  revealObserver.observe(element);
}

function observeProjectReveal() {
  if (!revealObserver) return;
  const isMobile = window.matchMedia("(max-width: 520px)").matches;
  observeReveal($(".project-banner"), 0, "image");
  observeReveal($(".project-copy"), isMobile ? 80 : 140);
}

function setupScrollReveal() {
  if (!("IntersectionObserver" in window) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -44px 0px" });

  const isMobile = window.matchMedia("(max-width: 520px)").matches;
  $$(".section-heading").forEach(heading => observeReveal(heading));
  $$(".bio-entry").forEach((entry, index) => observeReveal(entry, index * (isMobile ? 65 : 100)));
  observeProjectReveal();
}

function showMapError() {
  const fallback = $(".map-fallback");
  if (fallback) $("strong", fallback).textContent = content.ui.mapError;
}

window.initPersonalMap = function () {
  map = new google.maps.Map($("#map"), {
    center: MAP_CAMERA.center,
    zoom: MAP_CAMERA.zoom,
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

  class PhotoPreviewOverlay extends google.maps.OverlayView {
    constructor(place, index) {
      super();
      this.place = place;
      this.index = index;
      this.position = new google.maps.LatLng(place.coordinates);
      this.setMap(map);
    }

    onAdd() {
      const marker = document.createElement("button");
      marker.type = "button";
      marker.className = "map-photo-marker";
      marker.setAttribute("aria-label", this.place.name + " photo preview");
      marker.title = this.place.name + " · " + this.place.photos.length + " photo" + (this.place.photos.length === 1 ? "" : "s");

      const image = document.createElement("img");
      image.src = this.place.photos[0].image;
      image.alt = this.place.photos[0].alt;
      image.loading = "eager";
      marker.appendChild(image);

      if (this.place.photos.length > 1) {
        const count = document.createElement("span");
        count.className = "map-photo-count";
        count.textContent = "+" + (this.place.photos.length - 1);
        marker.appendChild(count);
      }

      marker.addEventListener("click", event => {
        event.stopPropagation();
        openPhoto(this.place.id, 0);
      });
      this.element = marker;
      this.getPanes().overlayMouseTarget.appendChild(marker);
      const pinDelay = window.matchMedia("(max-width: 520px)").matches ? 60 : 90;
      observeReveal(marker, this.index * pinDelay, "pin");
    }

    draw() {
      const pixel = this.getProjection().fromLatLngToDivPixel(this.position);
      if (!pixel || !this.element) return;
      this.element.style.left = (pixel.x - this.element.offsetWidth / 2) + "px";
      this.element.style.top = (pixel.y - this.element.offsetHeight - 15) + "px";
    }

    onRemove() {
      this.element?.remove();
      this.element = null;
    }
  }

  content.places.forEach((place, index) => new PhotoPreviewOverlay(place, index));
  if (content.places.length > 1) {
    const bounds = new google.maps.LatLngBounds();
    content.places.forEach(place => bounds.extend(place.coordinates));
    map.fitBounds(bounds, 48);
  } else if (content.places.length === 1) {
    map.setCenter(content.places[0].coordinates);
    map.setZoom(10);
  }
};

function loadGoogleMaps() {
  if (!GOOGLE_MAPS_API_KEY) return;
  const script = document.createElement("script");
  script.src = "https://maps.googleapis.com/maps/api/js?key=" + encodeURIComponent(GOOGLE_MAPS_API_KEY) +
    "&language=en&callback=initPersonalMap&loading=async";
  script.async = true;
  script.onerror = showMapError;
  document.head.appendChild(script);
}

async function start() {
  try {
    const response = await fetch("./content.json?v=12", { cache: "no-store" });
    if (!response.ok) throw new Error("Content file could not be loaded.");
    content = await response.json();
    renderPage();
    setupScrollReveal();
    loadGoogleMaps();
  } catch (error) {
    console.error(error);
  }
}

start();
