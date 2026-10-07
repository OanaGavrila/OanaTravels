/* ============================================================
   OanaTravels — main.js
   - Loads country/pack data
   - Renders destinations grid + packs grid + map dots
   - Handles navbar, cart badge, scroll animations
   ============================================================ */

(function () {
  'use strict';

  /* ---------- Data ---------- */

  // Map positions in % (computed from real lat/lon on the amCharts mercator projection)
  var CITY_POSITIONS = {
    'Da Nang': { x: 77.2, y: 64.2 },
    'Hue': { x: 77.1, y: 64.0 },
    'Ho Chi Minh': { x: 76.8, y: 66.6 },
    'Hanoi': { x: 76.6, y: 61.9 },
    'Hoi An': { x: 77.3, y: 64.3 },
    'Ninh Binh': { x: 76.7, y: 62.3 },
    'Bangkok': { x: 75.1, y: 65.3 },
    'Northern Thailand': { x: 74.7, y: 62.9 },
    'Ubon Ratchathani': { x: 76.3, y: 64.6 },
    'Phuket': { x: 74.5, y: 67.9 },
    'Krabi': { x: 74.6, y: 67.8 },
    'Athens': { x: 53.8, y: 53.2 },
    'Aegina': { x: 54.0, y: 53.6 },
    'Abu Dhabi': { x: 62.3, y: 60.2 },
    'East Java': { x: 78.5, y: 74.7 },
    'Bali': { x: 79.2, y: 75.3 },
    'Kuala Lumpur': { x: 75.4, y: 70.1 },
    'Coron': { x: 80.6, y: 66.1 },
    'El Nido': { x: 80.3, y: 66.4 },
    'Hong Kong': { x: 78.9, y: 61.3 },
    'Macao': { x: 78.7, y: 61.3 },
    'Bucharest': { x: 54.4, y: 49.4 },
    'Brasov': { x: 54.3, y: 48.6 }
  };

  var FLAG_CODES = {
    vietnam: 'vn',
    thailand: 'th',
    greece: 'gr',
    uae: 'ae',
    indonesia: 'id',
    malaysia: 'my',
    philippines: 'ph',
    hongkong: 'hk',
    macau: 'mo',
    romania: 'ro'
  };

  // ISO country code -> catalog id + display name (for the interactive world map)
  var MAP_COUNTRIES = {
    VN: { id: 'vietnam', name: 'Vietnam' },
    TH: { id: 'thailand', name: 'Thailand' },
    GR: { id: 'greece', name: 'Greece' },
    AE: { id: 'uae', name: 'United Arab Emirates' },
    ID: { id: 'indonesia', name: 'Indonesia' },
    MY: { id: 'malaysia', name: 'Malaysia' },
    PH: { id: 'philippines', name: 'Philippines' },
    RO: { id: 'romania', name: 'Romania' }
  };

  var mapCatalogById = {};
  var mapCountryNodes = [];

  function getMapCountry(iso) {
    var mapping = MAP_COUNTRIES[iso];
    return mapping ? mapCatalogById[mapping.id] || null : null;
  }

  function setMapCatalog(countries) {
    mapCatalogById = {};
    (countries || []).forEach(function (country) {
      mapCatalogById[country.id] = country;
    });
    mapCountryNodes.forEach(function (entry) {
      var country = getMapCountry(entry.iso);
      var name = country ? country.name : entry.name;
      entry.path.setAttribute('aria-label', 'Zoom to ' + name);
    });
  }

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
        dot.title = moreSoon ? city + ' (Coming soon)' : city + ', ' + country.name;
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

  function initWorldMap() {
    fetch('assets/images/world-map.svg')
      .then(function (res) {
        if (!res.ok) throw new Error('Unable to load world map');
        return res.text();
      })
      .then(function (svgText) {
        if (!els.mapCanvas) return;
        var wrap = document.getElementById('mapZoomWrap');
        if (!wrap) return;
        wrap.insertAdjacentHTML('afterbegin', svgText);
        var svg = wrap.querySelector('svg');
        if (!svg) return;
        svg.setAttribute('class', 'world-map-svg');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        var tooltip = document.createElement('div');
        tooltip.className = 'map-tooltip';
        tooltip.hidden = true;
        els.mapCanvas.appendChild(tooltip);

        var countries = svg.querySelectorAll('.land');
        Array.prototype.forEach.call(countries, function (path) {
          var iso = path.getAttribute('id') || '';
          var mapping = MAP_COUNTRIES[iso];
          var fallbackName = path.getAttribute('title') || mapping && mapping.name || iso || 'Country';
          var entry = { path: path, iso: iso, name: fallbackName };
          mapCountryNodes.push(entry);
          path.classList.add('map-country');
          path.setAttribute('role', 'button');
          path.setAttribute('tabindex', '0');

          var countryName = function () {
            var country = getMapCountry(iso);
            return country ? country.name : fallbackName;
          };

          path.setAttribute('aria-label', 'Zoom to ' + countryName());

          var show = function () {
            tooltip.innerHTML = '<span class="map-tooltip-flag">' + flagEmoji(iso) + '</span>' + countryName();
            tooltip.hidden = false;
          };
          var hide = function () { tooltip.hidden = true; };
          var activate = function () {
            if (mapController && mapController.isClickSuppressed()) return;
            if (mapController) mapController.zoomToElement(path);
            showCities(getMapCountry(iso) || {
              name: countryName(),
              cities: [],
              moreSoon: true
            }, false);
          };

          path.addEventListener('mouseenter', function (e) {
            show();
            moveTooltip(e);
          });
          path.addEventListener('mousemove', moveTooltip);
          path.addEventListener('mouseleave', hide);
          path.addEventListener('focus', function () {
            show();
            positionTooltip(path);
          });
          path.addEventListener('blur', hide);
          path.addEventListener('click', activate);
          path.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              activate();
            }
          });
        });

        function moveTooltip(e) {
          var rect = els.mapCanvas.getBoundingClientRect();
          tooltip.style.left = (e.clientX - rect.left) + 'px';
          tooltip.style.top = (e.clientY - rect.top) + 'px';
        }

        function positionTooltip(path) {
          var canvasRect = els.mapCanvas.getBoundingClientRect();
          var pathRect = path.getBoundingClientRect();
          tooltip.style.left = (pathRect.left + pathRect.width / 2 - canvasRect.left) + 'px';
          tooltip.style.top = (pathRect.top + pathRect.height / 2 - canvasRect.top) + 'px';
        }
      })
      .catch(function () {
        console.warn('Could not load interactive world map');
      });
  }

  var mapZoom = 1;
  var panX = 0;
  var panY = 0;
  var MIN_ZOOM = 1;
  var MAX_ZOOM = 12;
  var ZOOM_STEP = 0.5;
  var mapController = null;

  function initMapZoom() {
    var zoomIn = document.getElementById('mapZoomIn');
    var zoomOut = document.getElementById('mapZoomOut');
    var zoomReset = document.getElementById('mapZoomReset');
    var canvas = document.getElementById('mapCanvas');
    var wrap = document.getElementById('mapZoomWrap');
    if (!canvas || !wrap || !zoomIn || !zoomOut || !zoomReset) return;

    var activePointers = [];
    var dragState = null;
    var pinchState = null;
    var suppressClick = false;
    var wheelFrame = null;
    var wheelPending = null;
    var requestFrame = window.requestAnimationFrame || function (callback) {
      return window.setTimeout(callback, 16);
    };

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function applyPan() {
      var width = wrap.clientWidth || canvas.clientWidth || 1;
      var height = wrap.clientHeight || canvas.clientHeight || 1;
      var limitX = Math.max(0, (width * mapZoom - width) / 2);
      var limitY = Math.max(0, (height * mapZoom - height) / 2);
      panX = clamp(panX, -limitX, limitX);
      panY = clamp(panY, -limitY, limitY);
      wrap.style.transform = 'translate(' + panX + 'px, ' + panY + 'px) scale(' + mapZoom + ')';
    }

    function renderMap() {
      applyPan();
      wrap.style.setProperty('--map-dot-scale', (1 / mapZoom).toFixed(4));
      zoomOut.disabled = mapZoom <= MIN_ZOOM;
      zoomIn.disabled = mapZoom >= MAX_ZOOM;
    }

    function setZoom(nextZoom, anchor, animate) {
      var previousZoom = mapZoom;
      if (!isFinite(nextZoom)) nextZoom = previousZoom;
      var next = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
      if (anchor && previousZoom > 0 && next !== previousZoom) {
        var canvasRect = canvas.getBoundingClientRect();
        var pointX = (anchor.clientX !== undefined ? anchor.clientX : canvasRect.left + canvasRect.width / 2) - canvasRect.left;
        var pointY = (anchor.clientY !== undefined ? anchor.clientY : canvasRect.top + canvasRect.height / 2) - canvasRect.top;
        var ratio = next / previousZoom;
        panX = pointX - (pointX - panX) * ratio;
        panY = pointY - (pointY - panY) * ratio;
      }
      mapZoom = next;
      wrap.style.transition = animate ? 'transform 0.25s ease' : 'none';
      renderMap();
    }

    function resetMap() {
      wheelPending = null;
      mapZoom = MIN_ZOOM;
      panX = 0;
      panY = 0;
      wrap.style.transition = 'transform 0.3s ease';
      renderMap();
    }

    function getWheelDelta(e) {
      var delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16;
      if (e.deltaMode === 2) delta *= canvas.clientHeight || 1;
      return clamp(delta, -120, 120);
    }

    function scheduleWheelZoom() {
      if (wheelFrame !== null) return;
      wheelFrame = requestFrame(function () {
        wheelFrame = null;
        var next = wheelPending;
        wheelPending = null;
        if (!next) return;
        setZoom(mapZoom * Math.exp(-next.delta * 0.0015), next, false);
      });
    }

    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var delta = getWheelDelta(e);
      if (!delta) return;
      wheelPending = {
        delta: delta,
        clientX: e.clientX,
        clientY: e.clientY
      };
      scheduleWheelZoom();
    }, { passive: false });

    function findPointer(id) {
      for (var i = 0; i < activePointers.length; i++) {
        if (activePointers[i].id === id) return activePointers[i];
      }
      return null;
    }

    function isControlTarget(target) {
      return target && target.closest && target.closest('.map-zoom-controls');
    }

    function capturePointer(id) {
      try {
        canvas.setPointerCapture(id);
      } catch (err) {}
    }

    function getPointerPair() {
      return activePointers.length >= 2 ? [activePointers[0], activePointers[1]] : null;
    }

    function getDistance(pair) {
      return Math.sqrt(
        Math.pow(pair[0].x - pair[1].x, 2) +
        Math.pow(pair[0].y - pair[1].y, 2)
      );
    }

    function getMidpoint(pair) {
      return {
        clientX: (pair[0].x + pair[1].x) / 2,
        clientY: (pair[0].y + pair[1].y) / 2
      };
    }

    function endPointer(e) {
      var pointer = findPointer(e.pointerId);
      if (!pointer) return;
      var wasPinching = !!pinchState;
      activePointers.splice(activePointers.indexOf(pointer), 1);
      if (activePointers.length === 1) {
        var remaining = activePointers[0];
        pinchState = null;
        dragState = {
          id: remaining.id,
          startX: remaining.x,
          startY: remaining.y,
          panX: panX,
          panY: panY,
          moved: true
        };
        return;
      }
      if (activePointers.length > 1) return;
      dragState = null;
      pinchState = null;
      canvas.style.cursor = '';
      wrap.style.transition = 'transform 0.2s ease';
      if (wasPinching || suppressClick) {
        suppressClick = true;
        window.setTimeout(function () { suppressClick = false; }, 300);
      }
    }

    canvas.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (isControlTarget(e.target) || activePointers.length >= 2) return;
      var pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      activePointers.push(pointer);
      if (activePointers.length === 1) {
        dragState = {
          id: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
          panX: panX,
          panY: panY,
          moved: false
        };
        suppressClick = false;
        wrap.style.transition = 'none';
        canvas.style.cursor = 'grabbing';
      } else {
        var pair = getPointerPair();
        pinchState = {
          distance: getDistance(pair),
          x: getMidpoint(pair).clientX,
          y: getMidpoint(pair).clientY
        };
        capturePointer(activePointers[0].id);
        capturePointer(activePointers[1].id);
        if (dragState) dragState.moved = true;
        suppressClick = true;
      }
      if (e.cancelable && e.pointerType !== 'mouse') e.preventDefault();
    });

    canvas.addEventListener('pointermove', function (e) {
      var pointer = findPointer(e.pointerId);
      if (!pointer) return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      var pair = getPointerPair();
      if (pair) {
        if (!pinchState) return;
        var distance = getDistance(pair);
        var midpoint = getMidpoint(pair);
        if (pinchState.distance > 0 && distance > 0) {
          setZoom(mapZoom * distance / pinchState.distance, midpoint, false);
        }
        pinchState.distance = distance;
        pinchState.x = midpoint.clientX;
        pinchState.y = midpoint.clientY;
        suppressClick = true;
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (!dragState || dragState.id !== e.pointerId) return;
      var dx = e.clientX - dragState.startX;
      var dy = e.clientY - dragState.startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) {
        dragState.moved = true;
        suppressClick = true;
        capturePointer(e.pointerId);
      }
      panX = dragState.panX + dx;
      panY = dragState.panY + dy;
      applyPan();
      if (e.cancelable) e.preventDefault();
    });

    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('click', function (e) {
      if (!suppressClick || isControlTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    zoomIn.addEventListener('click', function () {
      wheelPending = null;
      setZoom(mapZoom + ZOOM_STEP, null, true);
    });
    zoomOut.addEventListener('click', function () {
      wheelPending = null;
      setZoom(mapZoom - ZOOM_STEP, null, true);
    });
    zoomReset.addEventListener('click', resetMap);

    canvas.setAttribute('tabindex', '0');
    canvas.addEventListener('keydown', function (e) {
      var step = 40;
      if (e.key === '+' || e.key === '=') {
        setZoom(mapZoom + ZOOM_STEP, null, true);
        e.preventDefault();
      } else if (e.key === '-' || e.key === '_') {
        setZoom(mapZoom - ZOOM_STEP, null, true);
        e.preventDefault();
      } else if (e.key === '0') {
        resetMap();
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
        panX += step;
        wrap.style.transition = 'transform 0.2s ease';
        applyPan();
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        panX -= step;
        wrap.style.transition = 'transform 0.2s ease';
        applyPan();
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        panY += step;
        wrap.style.transition = 'transform 0.2s ease';
        applyPan();
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        panY -= step;
        wrap.style.transition = 'transform 0.2s ease';
        applyPan();
        e.preventDefault();
      }
    });

    function zoomToElement(element) {
      wheelPending = null;
      var canvasRect = canvas.getBoundingClientRect();
      var elementRect = element.getBoundingClientRect();
      if (!elementRect.width || !elementRect.height) return;
      wrap.style.transition = 'none';
      canvasRect = canvas.getBoundingClientRect();
      elementRect = element.getBoundingClientRect();
      var localWidth = elementRect.width / mapZoom;
      var localHeight = elementRect.height / mapZoom;
      var padding = Math.min(48, Math.max(16, Math.min(canvas.clientWidth, canvas.clientHeight) * 0.08));
      var fitZoom = Math.min(
        Math.max(1, canvas.clientWidth - padding * 2) / localWidth,
        Math.max(1, canvas.clientHeight - padding * 2) / localHeight
      );
      if (!isFinite(fitZoom) || fitZoom <= 0) fitZoom = MIN_ZOOM;
      var targetZoom = clamp(fitZoom, MIN_ZOOM, MAX_ZOOM);
      var centerX = elementRect.left + elementRect.width / 2;
      var centerY = elementRect.top + elementRect.height / 2;
      var localCenterX = (centerX - canvasRect.left - canvasRect.width / 2 - panX) / mapZoom;
      var localCenterY = (centerY - canvasRect.top - canvasRect.height / 2 - panY) / mapZoom;
      setZoom(targetZoom, { clientX: centerX, clientY: centerY }, true);
      panX = -localCenterX * targetZoom;
      panY = -localCenterY * targetZoom;
      renderMap();
    }

    function handleResize() {
      applyPan();
    }

    mapController = {
      zoomToElement: zoomToElement,
      isClickSuppressed: function () { return suppressClick; },
      getZoom: function () { return mapZoom; }
    };

    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(handleResize).observe(canvas);
    }
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    wrap.style.transformOrigin = '50% 50%';
    wrap.style.transition = 'transform 0.2s ease';
    renderMap();
  }

  /* ---------- Cities panel ---------- */
  function showCities(country, shouldScroll) {
    var data = country || {};
    var cities = Array.isArray(data.cities) ? data.cities : [];
    var name = data.name || 'Selected country';
    var availableCities = cities.filter(function (city) {
      return !isMoreSoon(data, city);
    });
    var comingSoonCount = cities.length - availableCities.length;
    var cityWord = availableCities.length === 1 ? 'city' : 'cities';
    els.citiesTitle.textContent = name;
    if (!cities.length) {
      els.citiesDesc.textContent = 'No cities are mapped for this country yet.';
    } else if (data.moreSoon || availableCities.length === 0) {
      els.citiesDesc.textContent = cities.length + ' ' + (cities.length === 1 ? 'city' : 'cities') + ' coming soon';
    } else if (comingSoonCount) {
      els.citiesDesc.textContent = availableCities.length + ' mapped ' + cityWord + ' available · ' + comingSoonCount + ' coming soon';
    } else {
      els.citiesDesc.textContent = cities.length + ' mapped ' + (cities.length === 1 ? 'city' : 'cities') + ' available';
    }
    els.citiesList.innerHTML = '';
    cities.forEach(function (city) {
      var moreSoon = isMoreSoon(data, city);
      var li = el('li');
      if (moreSoon) {
        var span = el('span', null, city);
        span.setAttribute('aria-disabled', 'true');
        span.title = city + ' (Coming soon)';
        li.appendChild(span);
      } else {
        var btn = el('button', null, city);
        btn.type = 'button';
        btn.title = 'View ' + city + ' in the shop';
        btn.addEventListener('click', function () { window.location.href = 'shop.html'; });
        li.appendChild(btn);
      }
      els.citiesList.appendChild(li);
    });
    els.citiesPanel.hidden = false;
    if (shouldScroll !== false) {
      els.citiesPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /* ---------- Destinations grid ---------- */
  function renderDestinations(countries, container) {
    var fragment = document.createDocumentFragment();
    countries.forEach(function (country, index) {
      var moreSoon = country.moreSoon;
      var card = el('article', 'country-card reveal' + (moreSoon ? ' country-card-more-soon' : ''));
      card.style.transitionDelay = (index * 60) + 'ms';

      if (moreSoon) {
        card.setAttribute('aria-label', country.name + ', coming soon');
      }

      var image = el('div', 'country-card-image');
      var flag = el('div', 'flag-placeholder');
      var flagIcon = el('span', 'fi fi-' + (FLAG_CODES[country.id] || 'xx'));
      flag.appendChild(flagIcon);
      image.appendChild(flag);
      var posterSrc = Oana.countryPosterSrc(country);
      if (posterSrc) {
        var poster = document.createElement('img');
        poster.className = 'country-card-poster';
        poster.src = posterSrc;
        poster.alt = country.name;
        poster.loading = 'lazy';
        poster.addEventListener('error', function () { poster.remove(); });
        image.appendChild(poster);
var flagBadge = el('span', 'country-card-flag fi fi-' + (FLAG_CODES[country.id] || 'xx') + ' fis');
      image.appendChild(flagBadge);
      }
      card.appendChild(image);

      var body = el('div', 'country-card-body');
      var nameRow = el('div', 'country-card-name');
      nameRow.textContent = country.name;
      if (moreSoon) {
        var moreBadge = el('span', 'more-soon-badge', 'More Soon');
        nameRow.appendChild(moreBadge);
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

      if (!moreSoon) {
        var cardBtn = el('button', 'country-card-btn');
        cardBtn.type = 'button';
        cardBtn.setAttribute('aria-label', country.name + ', see the cities we\'ve mapped');
        cardBtn.addEventListener('click', function () { showCities(country); });
        card.appendChild(cardBtn);
      }

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

      var image = el('div', 'pack-card-image');
      var badge = el('span', 'pack-badge', 'Best Value');
      var flagIcon = el('span', 'fi fi-' + (FLAG_CODES[pack.countryId] || 'xx') + ' fis pack-card-flag');
      image.appendChild(flagIcon);
      if (pack.posterSrc) {
        var poster = document.createElement('img');
        poster.className = 'pack-card-poster';
        poster.src = pack.posterSrc;
        poster.alt = pack.name;
        poster.loading = 'lazy';
        poster.addEventListener('error', function () { poster.remove(); });
        image.appendChild(poster);
      }
      image.appendChild(badge);
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
      var email = (els.newsletterEmail.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (els.newsletterMsg) {
          els.newsletterMsg.textContent = 'That email address doesn\u2019t look right.';
          els.newsletterMsg.hidden = false;
        }
        return;
      }

      var payload = { type: 'newsletter', email: email };
      if (Oana.APPS_SCRIPT_URL) {
        fetch(Oana.APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        }).then(showNewsletterMsg).catch(showNewsletterMsg);
      } else {
        setTimeout(showNewsletterMsg, 600);
      }
      els.newsletterForm.reset();
    });
  }

  function showNewsletterMsg() {
    if (!els.newsletterMsg) return;
    els.newsletterMsg.textContent = 'Thanks for subscribing! 🌏';
    els.newsletterMsg.hidden = false;
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
    initMapZoom();
    initWorldMap();

    Oana.loadCatalog(function (data) {
      if (!data) return;
      setMapCatalog(data.countries);

      var available = data.countries.filter(function (c) { return hasAvailableCities(c); });
      var moreSoon = data.countries.filter(function (c) { return c.moreSoon; });

      renderDestinations(available, els.destinationsGrid);
      renderDestinations(moreSoon, els.moreSoonGrid);

      renderPacks(available.filter(function (c) { return !c.noPack; }).map(function (c) {
        var displayCities = c.moreSoonCities
          ? c.cities.filter(function (city) { return c.moreSoonCities.indexOf(city) === -1; })
          : c.cities;
        return {
          id: c.id + '-pack',
          type: 'pack',
          countryId: c.id,
          countryName: c.name,
          posterSrc: Oana.countryPosterSrc(c),
          name: c.name + ' Pack',
          title: c.name + ' Pack',
          includes: displayCities.join(', ') + ' + ' + c.guide.name,
          cities: displayCities,
          price: Oana.packPriceFor(c)
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