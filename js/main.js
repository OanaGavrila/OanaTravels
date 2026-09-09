/* ============================================================
   OanaTravels — main.js
   - Loads country/pack data
   - Renders destinations grid + packs grid + map dots
   - Handles navbar, cart badge, scroll animations
   ============================================================ */

(function () {
  'use strict';

  /* ---------- Data ---------- */
  var dataUrl = 'data/products.json';
  var DATA = null;

  // Map positions in % (computed from real lat/lon on the amCharts mercator projection)
  var CITY_POSITIONS = {
    'Da Nang': { x: 77.2, y: 64.2 },
    'Hue': { x: 77.1, y: 64.0 },
    'Ho Chi Minh': { x: 76.8, y: 66.6 },
    'Hanoi': { x: 76.6, y: 61.9 },
    'Hoi An': { x: 77.3, y: 64.3 },
    'Ninh Binh': { x: 76.7, y: 62.3 },
    'Bangkok': { x: 75.1, y: 65.3 },
    'Chiang Mai': { x: 74.7, y: 62.9 },
    'Ubon': { x: 76.3, y: 64.6 },
    'Phuket': { x: 74.5, y: 67.9 },
    'Krabi': { x: 74.6, y: 67.8 },
    'Athens': { x: 53.8, y: 53.2 },
    'Aegina': { x: 54.0, y: 53.6 },
    'Abu Dhabi': { x: 62.3, y: 60.2 },
    'Surabaya': { x: 78.5, y: 74.7 },
    'Bali': { x: 79.2, y: 75.3 },
    'Kuala Lumpur': { x: 75.4, y: 70.1 },
    'Coron': { x: 80.6, y: 66.1 },
    'El Nido': { x: 80.3, y: 66.4 },
    'Hong Kong': { x: 78.9, y: 61.3 },
    'Macau': { x: 78.7, y: 61.3 },
    'Bucharest': { x: 54.4, y: 49.4 },
    'Brasov': { x: 54.3, y: 48.6 }
  };

  var EMOJIS = {
    vietnam: '🛵',
    thailand: '🌴',
    greece: '🏛️',
    uae: '🏙️',
    indonesia: '🌋',
    malaysia: '🗼',
    philippines: '🏝️',
    hongkong: '🌃',
    macau: '🎰',
    romania: '🏰'
  };

  var GRADIENTS = {
    vietnam: 'flag-vietnam',
    thailand: 'flag-thailand',
    greece: 'flag-greece',
    uae: 'flag-uae',
    indonesia: 'flag-indonesia',
    malaysia: 'flag-malaysia',
    philippines: 'flag-philippines',
    hongkong: 'flag-hongkong',
    macau: 'flag-macau',
    romania: 'flag-romania'
  };

  // ISO country code -> catalog id + display name (for the interactive world map)
  var MAP_COUNTRIES = {
    VN: { id: 'vietnam', name: 'Vietnam' },
    TH: { id: 'thailand', name: 'Thailand' },
    GR: { id: 'greece', name: 'Greece' },
    AE: { id: 'uae', name: 'United Arab Emirates' },
    ID: { id: 'indonesia', name: 'Indonesia' },
    MY: { id: 'malaysia', name: 'Malaysia' },
    RO: { id: 'romania', name: 'Romania' }
  };

  // Flag emoji from ISO 3166-1 alpha-2 (regional indicator symbols)
  function flagEmoji(iso) {
    if (!iso || iso.length !== 2) return '🌍';
    return iso.toUpperCase().split('').map(function (ch) {
      return String.fromCodePoint(127397 + ch.charCodeAt(0));
    }).join('');
  }

  function isMoreSoon(country, city) {
    if (country.moreSoon) return true;
    if (country.moreSoonCities && country.moreSoonCities.indexOf(city) !== -1) return true;
    return false;
  }

  function hasAvailableCities(country) {
    if (country.moreSoon) return false;
    if (!country.moreSoonCities || country.moreSoonCities.length === 0) return true;
    return country.cities.some(function (c) {
      return country.moreSoonCities.indexOf(c) === -1;
    });
  }

  /* ---------- State ---------- */

  /* ---------- DOM refs ---------- */
  var els = {
    mapCanvas: document.getElementById('mapCanvas'),
    citiesPanel: document.getElementById('citiesPanel'),
    citiesClose: document.getElementById('citiesClose'),
    citiesTitle: document.getElementById('citiesTitle'),
    citiesDesc: document.getElementById('citiesDesc'),
    citiesList: document.getElementById('citiesList'),
    destinationsGrid: document.getElementById('destinationsGrid'),
    moreSoonGrid: document.getElementById('moreSoonGrid'),
    packsGrid: document.getElementById('packsGrid'),
    newsletterForm: document.getElementById('newsletterForm'),
    newsletterEmail: document.getElementById('newsletterEmail'),
    newsletterMsg: document.getElementById('newsletterMsg'),
    instaGrid: document.getElementById('instaGrid')
  };

  /* ---------- Utilities ---------- */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function loadData(cb) {
    fetch(dataUrl)
      .then(function (res) { return res.json(); })
      .then(cb)
      .catch(function () {
        // Fallback if fetch fails on file:// — render empty-ish
        els.mapCanvas.innerHTML = '';
        console.warn('Could not load product data:', dataUrl);
      });
  }

  /* ---------- Map dots ---------- */
  function renderMapDots(countries) {
    var wrap = document.getElementById('mapZoomWrap');
    if (!wrap) return;
    var fragment = document.createDocumentFragment();
    countries.forEach(function (country) {
      country.cities.forEach(function (city) {
        var pos = CITY_POSITIONS[city];
        if (!pos) return;
        var moreSoon = isMoreSoon(country, city);
        var dot = el('button', 'map-dot' + (moreSoon ? ' map-dot-more' : ''));
        dot.style.left = pos.x + '%';
        dot.style.top = pos.y + '%';
        dot.dataset.city = city;
        dot.dataset.country = country.name;
        dot.title = moreSoon ? city + ' — Coming soon' : city + ' — ' + country.name;
        if (!moreSoon) {
          dot.addEventListener('click', function () {
            window.location.href = country.id + '.html';
          });
        }
        fragment.appendChild(dot);
      });
    });
    wrap.appendChild(fragment);
  }

  /* ---------- Interactive world map ----------
     Loads the SVG inline so each highlighted country is a real,
     clickable element. Clicking a country opens the shop filtered
     to that country's pack; hovering shows the name + flag. */
  function initWorldMap() {
    fetch('assets/images/world-map.svg')
      .then(function (res) { return res.text(); })
      .then(function (svgText) {
        if (!els.mapCanvas) return;
        var wrap = document.getElementById('mapZoomWrap');
        if (!wrap) return;
        wrap.insertAdjacentHTML('afterbegin', svgText);
        var svg = wrap.querySelector('svg');
        if (!svg) return;
        svg.setAttribute('class', 'world-map-svg');
        // Give the ocean a transparent fill so it sits on the CSS background
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        var tooltip = document.createElement('div');
        tooltip.className = 'map-tooltip';
        tooltip.hidden = true;
        els.mapCanvas.appendChild(tooltip);

        var available = svg.querySelectorAll('.land.available');
        Array.prototype.forEach.call(available, function (path) {
          var iso = path.getAttribute('id');
          var info = MAP_COUNTRIES[iso];
          if (!info) {
            path.classList.remove('available');
            return;
          }
          path.setAttribute('role', 'link');
          path.setAttribute('tabindex', '0');
          path.setAttribute('aria-label', info.name + ' — view shop');

          var show = function () {
            tooltip.innerHTML = '<span class="map-tooltip-flag">' + flagEmoji(iso) + '</span>' + info.name;
            tooltip.hidden = false;
          };
          var hide = function () { tooltip.hidden = true; };

          path.addEventListener('mouseenter', function (e) {
            show();
            moveTooltip(e);
          });
          path.addEventListener('mousemove', moveTooltip);
          path.addEventListener('mouseleave', hide);
          path.addEventListener('focus', show);
          path.addEventListener('blur', hide);
          path.addEventListener('click', function () {
            window.location.href = info.id + '.html';
          });
          path.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              window.location.href = info.id + '.html';
            }
          });
        });

        function moveTooltip(e) {
          var rect = els.mapCanvas.getBoundingClientRect();
          tooltip.style.left = (e.clientX - rect.left) + 'px';
          tooltip.style.top = (e.clientY - rect.top) + 'px';
        }
      })
      .catch(function () {
        // Fallback: keep non-interactive map (empty canvas styling from CSS)
        console.warn('Could not load interactive world map');
      });
  }

  /* ---------- Map zoom + pan ---------- */
  var mapZoom = 1;
  var panX = 0;
  var panY = 0;
  var MIN_ZOOM = 1;
  var MAX_ZOOM = 4;
  var ZOOM_STEP = 0.4;
  var PAN_LIMIT = 180;

  function initMapZoom() {
    var zoomIn = document.getElementById('mapZoomIn');
    var zoomOut = document.getElementById('mapZoomOut');
    var zoomReset = document.getElementById('mapZoomReset');
    var canvas = document.getElementById('mapCanvas');
    var wrap = document.getElementById('mapZoomWrap');
    if (!canvas || !wrap) return;

    function applyPan() {
      var lim = PAN_LIMIT * mapZoom;
      panX = Math.max(-lim, Math.min(lim, panX));
      panY = Math.max(-lim, Math.min(lim, panY));
      wrap.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + mapZoom + ')';
    }

    function applyZoom() {
      applyPan();
      wrap.style.setProperty('--map-dot-scale', (1 / mapZoom).toFixed(4));
      zoomOut.disabled = mapZoom <= MIN_ZOOM;
      zoomIn.disabled = mapZoom >= MAX_ZOOM;
    }

    zoomIn.addEventListener('click', function () {
      mapZoom = Math.min(MAX_ZOOM, +(mapZoom + ZOOM_STEP).toFixed(2));
      applyZoom();
    });
    zoomOut.addEventListener('click', function () {
      mapZoom = Math.max(MIN_ZOOM, +(mapZoom - ZOOM_STEP).toFixed(2));
      applyZoom();
    });
    zoomReset.addEventListener('click', function () {
      mapZoom = 1;
      panX = 0;
      panY = 0;
      wrap.style.transition = 'transform 0.3s ease';
      applyZoom();
      setTimeout(function () { wrap.style.transition = 'transform 0.2s ease'; }, 320);
    });

    // Zoom with Ctrl/⌘ + wheel (plus plain wheel is disabled to avoid hijack)
    canvas.addEventListener('wheel', function (e) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      mapZoom = +(mapZoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)).toFixed(2);
      mapZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, mapZoom));
      applyPan();
      zoomIn.disabled = mapZoom >= MAX_ZOOM;
      zoomOut.disabled = mapZoom <= MIN_ZOOM;
    }, { passive: false });

    // Pan: click-drag on the map, or arrow keys when focused
    var dragging = false;
    var startX = 0, startY = 0, startPanX = 0, startPanY = 0;

    canvas.addEventListener('mousedown', function (e) {
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      startPanX = panX; startPanY = panY;
      canvas.style.cursor = 'grabbing';
      wrap.style.transition = 'none';
    });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      panX = startPanX + (e.clientX - startX);
      panY = startPanY + (e.clientY - startY);
      applyPan();
    });
    document.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false;
      canvas.style.cursor = '';
      wrap.style.transition = 'transform 0.2s ease';
    });
    canvas.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) {
        dragging = true;
        startX = e.touches[0].clientX; startY = e.touches[0].clientY;
        startPanX = panX; startPanY = panY;
      }
    }, { passive: true });
    canvas.addEventListener('touchmove', function (e) {
      if (!dragging || e.touches.length !== 1) return;
      panX = startPanX + (e.touches[0].clientX - startX);
      panY = startPanY + (e.touches[0].clientY - startY);
      applyPan();
    }, { passive: true });
    canvas.addEventListener('touchend', function () { dragging = false; }, { passive: true });

    // Arrow-key panning when the map canvas (or wrapper) is focused
    canvas.setAttribute('tabindex', '0');
    canvas.addEventListener('keydown', function (e) {
      var step = 40;
      if (e.key === 'ArrowLeft') { panX += step; applyPan(); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { panX -= step; applyPan(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { panY += step; applyPan(); e.preventDefault(); }
      else if (e.key === 'ArrowDown') { panY -= step; applyPan(); e.preventDefault(); }
    });

    wrap.style.transformOrigin = '50% 50%';
    wrap.style.transition = 'transform 0.2s ease';
    applyPan();
    zoomIn.disabled = mapZoom >= MAX_ZOOM;
    zoomOut.disabled = mapZoom <= MIN_ZOOM;
  }

  /* ---------- Cities panel ---------- */
  function showCities(country) {
    els.citiesTitle.textContent = country.name;
    els.citiesDesc.textContent = country.cities.length + ' mapped ' + (country.cities.length === 1 ? 'city' : 'cities') + ' available';
    els.citiesList.innerHTML = '';
    country.cities.forEach(function (city) {
      var li = el('li', null, city);
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.title = 'View ' + city + ' in the shop';
      var go = function () { window.location.href = 'shop.html'; };
      li.addEventListener('click', go);
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });
      els.citiesList.appendChild(li);
    });
    els.citiesPanel.hidden = false;
    els.citiesPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---------- Destinations grid ---------- */
  function renderDestinations(countries, container) {
    var fragment = document.createDocumentFragment();
    countries.forEach(function (country, index) {
      var moreSoon = country.moreSoon;
      var card = el('article', 'country-card reveal' + (moreSoon ? ' country-card-more-soon' : ''));
      card.style.transitionDelay = (index * 60) + 'ms';

      if (moreSoon) {
        card.setAttribute('aria-label', country.name + ' — coming soon');
      } else {
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', country.name + ' — see the cities we\'ve mapped');
        var openCities = function () { showCities(country); };
        card.addEventListener('click', openCities);
        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCities(); }
        });
      }

      var image = el('div', 'country-card-image');
      var flag = el('div', 'flag-placeholder ' + (GRADIENTS[country.id] || ''));
      flag.appendChild(el('span', 'pack-emoji', EMOJIS[country.id] || '🌍'));
      image.appendChild(flag);
      card.appendChild(image);

      var body = el('div', 'country-card-body');
      var nameRow = el('div', 'country-card-name');
      nameRow.textContent = country.name;
      if (moreSoon) {
        var badge = el('span', 'more-soon-badge', 'More Soon');
        nameRow.appendChild(badge);
      } else {
        var arrow = el('span', 'card-arrow', '→');
        nameRow.appendChild(arrow);
      }
      body.appendChild(nameRow);

      body.appendChild(el('p', 'country-card-count', country.cities.length + ' ' + (country.cities.length === 1 ? 'city' : 'cities')));

      var chips = el('div', 'country-card-cities');
      country.cities.forEach(function (city) {
        chips.appendChild(el('span', null, city));
      });
      body.appendChild(chips);
      card.appendChild(body);

      fragment.appendChild(card);
    });
    container.appendChild(fragment);
  }

  /* ---------- Packs grid ---------- */
  function renderPacks(packs) {
    var fragment = document.createDocumentFragment();
    packs.forEach(function (pack, index) {
      var card = el('article', 'pack-card reveal');
      card.style.transitionDelay = (index * 60) + 'ms';

      var image = el('div', 'pack-card-image ' + (GRADIENTS[pack.country] || ''));
      var badge = el('span', 'pack-badge', 'Best Value');
      var emoji = el('span', 'pack-emoji', EMOJIS[pack.country] || '🌍');
      image.appendChild(badge);
      image.appendChild(emoji);
      card.appendChild(image);

      var body = el('div', 'pack-card-body');
      body.appendChild(el('h3', 'pack-card-title', pack.name));
      body.appendChild(el('p', 'pack-card-includes', pack.includes));

      var footer = el('div', 'pack-card-footer');
      footer.appendChild(el('span', 'pack-price', '€' + pack.price));
      var actions = el('div', 'pack-actions');
      var addBtn = el('button', 'btn btn-sm btn-outline', 'Add to Cart');
      addBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        Oana.addToCart(pack);
        flashButton(addBtn, '✓ Added');
      });
      var buyBtn = el('button', 'btn btn-sm btn-primary', 'Buy Now');
      buyBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        Oana.buyNow(pack);
        window.location.href = 'pay.html';
      });
      actions.appendChild(addBtn);
      actions.appendChild(buyBtn);
      footer.appendChild(actions);
      body.appendChild(footer);

      card.appendChild(body);
      fragment.appendChild(card);
    });
    els.packsGrid.appendChild(fragment);
  }

  function flashButton(btn, msg) {
    var original = btn.textContent;
    btn.textContent = msg;
    btn.classList.add('btn-added');
    setTimeout(function () {
      btn.textContent = original;
      btn.classList.remove('btn-added');
    }, 1600);
  }

  /* ---------- Newsletter ---------- */
  function initNewsletter() {
    if (!els.newsletterForm) return;
    els.newsletterForm.addEventListener('submit', function (e) {
      e.preventDefault();
      els.newsletterMsg.hidden = false;
      els.newsletterForm.reset();
    });
  }

  /* ---------- Instagram preview tiles ---------- */
  function initInstaGrid() {
    if (!els.instaGrid) return;
    els.instaGrid.innerHTML = '';
    (Oana.IG_TILES || []).forEach(function (tile, i) {
      var wrap = el('div', 'insta-tile reveal');
      wrap.style.transitionDelay = (i * 100) + 'ms';
      wrap.innerHTML = Oana.igTileHTML(tile);
      els.instaGrid.appendChild(wrap);
    });
  }

  /* ---------- Cities close ---------- */
  function initCitiesClose() {
    if (!els.citiesClose) return;
    els.citiesClose.addEventListener('click', function () {
      els.citiesPanel.hidden = true;
    });
  }

  /* ---------- Init ---------- */
  function init() {
    initNewsletter();
    initInstaGrid();
    initCitiesClose();
    initWorldMap();
    initMapZoom();

    loadData(function (data) {
      DATA = data;

      var available = data.countries.filter(function (c) { return hasAvailableCities(c); });
      var moreSoon = data.countries.filter(function (c) { return c.moreSoon; });

      renderDestinations(available, els.destinationsGrid);
      renderDestinations(moreSoon, els.moreSoonGrid);

      renderPacks(available.map(function (c) {
        var displayCities = c.moreSoonCities
          ? c.cities.filter(function (city) { return c.moreSoonCities.indexOf(city) === -1; })
          : c.cities;
        return {
          id: c.id + '-pack',
          type: 'pack',
          countryId: c.id,
          name: c.name + ' Pack',
          title: c.name + ' Pack',
          includes: displayCities.join(', ') + ' + ' + c.guide.name,
          cities: displayCities,
          price: data.pricing.packBase + data.pricing.packPerCity * displayCities.length
        };
      }));

      renderMapDots(data.countries);
      Oana.initReveal();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();