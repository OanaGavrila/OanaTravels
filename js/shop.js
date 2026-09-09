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
      vietnam: 'VN', thailand: 'TH', greece: 'GR', uae: 'AE',
      indonesia: 'ID', malaysia: 'MY', philippines: 'PH',
      hongkong: 'HK', macau: 'MO', romania: 'RO'
    };
    var iso = codes[id] || '';
    if (!iso) return '\uD83C\uDF0D';
    return iso.toUpperCase().split('').map(function (ch) {
      return String.fromCodePoint(127397 + ch.charCodeAt(0));
    }).join('');
  }

  function renderCountries(countries) {
    els.countryGrid.innerHTML = '';
    countries.forEach(function (country, i) {
      var imgSrc = 'assets/images/' + country.id + '.svg';
      var cityWord = country.cities.length === 1 ? 'city' : 'cities';

      var card = O.em('a', 'shop-country-card reveal');
      card.style.transitionDelay = (i * 60) + 'ms';
      card.href = country.id + '.html';
      card.setAttribute('data-country', country.id);

      /* --- media area --- */
      var media = O.em('div', 'shop-country-media');

      var img = document.createElement('img');
      img.src = imgSrc;
      img.alt = country.name;
      img.loading = 'lazy';
      img.addEventListener('error', function () {
        var fallback = O.em('div', 'flag-placeholder flag-' + country.id);
        var emoji = O.em('span', 'pack-emoji', flagOf(country.id));
        fallback.appendChild(emoji);
        media.replaceChild(fallback, img);
      });
      media.appendChild(img);

      var flagBadge = O.em('span', 'shop-country-flag', flagOf(country.id));
      media.appendChild(flagBadge);

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
