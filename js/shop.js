/* ============================================================
   OanaTravels — shop.js
   Renders the browse page: one clickable card per country.
   Each card links to its dedicated country page
   (vietnam.html, thailand.html, ...) where you can buy
   individual city maps, the country pack and the guide.
   ============================================================ */

(function () {
  'use strict';

  var O = window.Oana;
  var els = {};

  function init() {
    els.countryGrid = document.getElementById('countryGrid');

    O.loadCatalog(function (data) {
      if (!data) return;
      var available = data.countries.filter(function (c) { return !c.moreSoon; });
      renderCountries(available);
      O.initReveal();
      highlightDeepLink(available);
    });
  }

  function flagOf(id) {
    var codes = {
      vietnam: 'vn', thailand: 'th', greece: 'gr', uae: 'ae',
      indonesia: 'id', malaysia: 'my', philippines: 'ph',
      hongkong: 'hk', macau: 'mo', romania: 'ro'
    };
    return codes[id] || 'xx';
  }

  function renderCountries(countries) {
    els.countryGrid.innerHTML = '';
    countries.forEach(function (country, i) {
      var cityWord = country.cities.length === 1 ? 'city' : 'cities';

      var card = O.em('a', 'shop-country-card reveal');
      card.style.transitionDelay = (i * 60) + 'ms';
      card.href = country.id + '.html';
      card.setAttribute('data-country', country.id);

      /* --- media area --- */
      var media = O.em('div', 'shop-country-media');
      var flag = O.em('span', 'shop-country-media-flag fi fi-' + flagOf(country.id));
      media.appendChild(flag);
      var posterSrc = O.countryPosterSrc(country);
      if (posterSrc) {
        var poster = document.createElement('img');
        poster.className = 'shop-country-media-poster';
        poster.src = posterSrc;
        poster.alt = country.name;
        poster.loading = 'lazy';
        poster.addEventListener('error', function () { poster.remove(); });
        media.appendChild(poster);
      }

      /* --- body area --- */
      var body = O.em('div', 'shop-country-body');
      var name = O.em('h3', 'shop-country-name', country.name);
      var meta = O.em('p', 'shop-country-meta', country.cities.length + ' ' + cityWord + ' maps \u00B7 guide included');
      var cta = O.em('span', 'shop-country-cta', 'View ');
      var arrow = O.em('span', 'shop-country-arrow', '\u2192');
      cta.appendChild(arrow);
      body.appendChild(name);
      body.appendChild(meta);
      body.appendChild(cta);

      card.appendChild(media);
      card.appendChild(body);
      els.countryGrid.appendChild(card);
    });
  }

  // If arriving from the map (shop.html?country=romania), scroll to that card
  function highlightDeepLink(countries) {
    var params = new URLSearchParams(window.location.search);
    var id = params.get('country');
    if (!id) return;
    var card = document.querySelector('[data-country="' + id + '"]');
    if (!card) return;
    card.classList.add('shop-country-flash');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();