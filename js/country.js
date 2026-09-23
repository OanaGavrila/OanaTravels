/* ============================================================
   OanaTravels — country.js
   Shared script for individual country pages (vietnam.html, etc.).
   Reads the country ID from the URL filename, loads product data,
   and renders: hero, pack card, city map rows, guide row.
   ============================================================ */

(function () {
  'use strict';

  var O = window.Oana;

  var FLAG_CODES = {
    vietnam: 'vn', thailand: 'th', greece: 'gr', uae: 'ae',
    indonesia: 'id', malaysia: 'my', philippines: 'ph',
    hongkong: 'hk', macau: 'mo', romania: 'ro'
  };

  function getCountryId() {
    var file = location.pathname.split('/').pop() || '';
    return file.replace('.html', '').toLowerCase();
  }

  function fmt(n) { return '\u20AC' + n.toFixed(2).replace(/\.00$/, ''); }

  function init() {
    var countryId = getCountryId();
    if (!countryId) return;

    O.loadCatalog(function (data) {
      if (!data) return;
      var country = data.countries.filter(function (c) { return c.id === countryId; })[0];
      if (!country) {
        document.getElementById('countryContent').innerHTML =
          '<div class="container" style="text-align:center;padding:80px 24px;">' +
          '<h2>Country not found</h2>' +
          '<p style="color:var(--text-soft);margin:12px 0 24px;">We couldn\'t find that country in our catalogue.</p>' +
          '<a href="shop.html" class="btn btn-primary">Back to Shop</a>' +
          '</div>';
        return;
      }
      render(country, data.pricing);
    });
  }

  function render(country, pricing) {
    var mapCost = pricing.map;
    var guideCost = pricing.guide;

    var content = document.getElementById('countryContent');
    if (!content) return;

    var flagClass = 'fi fi-' + (FLAG_CODES[country.id] || 'xx');
    var isMoreSoon = !!country.moreSoon;
    var moreSoonCities = country.moreSoonCities || [];

    function card(media, badge, type, name, desc, price, actions, extraClass) {
      var mediaHTML;
      if (media && media.type === 'poster') {
        mediaHTML =
          '    <span class="' + flagClass + ' fis product-card-flag"></span>' +
          '    <img src="' + media.src + '" alt="' + name + '" loading="lazy" class="product-card-poster" onerror="this.remove()">';
      } else {
        mediaHTML = '    <span class="' + flagClass + ' fis product-card-flag"></span>';
      }
      return (
        '<div class="product-card reveal' + (extraClass ? ' ' + extraClass : '') + '">' +
        '  <div class="product-card-media">' +
        mediaHTML +
        (badge ? '    <span class="product-card-badge">' + badge + '</span>' : '') +
        '    <span class="product-card-type">' + type + '</span>' +
        '  </div>' +
        '  <div class="product-card-body">' +
        '    <h3 class="product-card-name">' + name + '</h3>' +
        '    <p class="product-card-desc">' + desc + '</p>' +
        '    <div class="product-card-footer">' +
        '      <span class="product-card-price">' + (typeof price === 'number' ? fmt(price) : price) + '</span>' +
        '      <div class="product-card-actions">' + actions + '</div>' +
        '    </div>' +
        '  </div>' +
        '</div>'
      );
    }

    var html = '';

    /* ---------- Hero ---------- */
    html +=
      '<section class="page-hero">' +
      '  <div class="container">' +
      '    <span class="hero-eyebrow reveal"><span class="' + flagClass + ' fis"></span> ' + country.name + '</span>' +
      '    <h1 class="page-hero-title reveal">' + country.name + '</h1>' +
      '  </div>' +
      '</section>';

    /* ---------- More Soon override ---------- */
    if (isMoreSoon) {
      html +=
        '<section class="section">' +
        '  <div class="container" style="text-align:center;padding:60px 24px;">' +
        '    <span style="font-size:3rem;display:block;margin-bottom:16px;">' + (country.emoji || '\uD83C\uDF0D') + '</span>' +
        '    <h2 class="reveal" style="margin-bottom:12px;">Coming Soon</h2>' +
        '    <p class="reveal" style="color:var(--text-soft);max-width:480px;margin:0 auto 24px;">We\'re currently working on mapping ' + country.name + '. Stay tuned for detailed city maps and a travel guide!</p>' +
        '    <a href="shop.html" class="btn btn-primary reveal">Browse Available Destinations</a>' +
        '  </div>' +
        '</section>';
      content.innerHTML = html;
      O.initReveal();
      return;
    }

    /* ---------- Country description ---------- */
    html +=
      '<section class="section" style="padding-bottom:0;">' +
      '  <div class="container">' +
      '    <p class="country-desc reveal">Explore ' + country.name + ' with our handcrafted digital maps and travel guide. Every product is a detailed, offline-ready resource designed to make your trip effortless.</p>' +
      '  </div>' +
      '</section>';

    /* ---------- Product grid ---------- */
    html +=
      '<section class="section">' +
      '  <div class="container">' +
      '    <div class="product-grid">';

    /* Pack card — filter out moreSoonCities from display */
    var displayCities = moreSoonCities.length > 0
      ? country.cities.filter(function (c) { return moreSoonCities.indexOf(c) === -1; })
      : country.cities;
    var displayPackCost = O.packPriceFor(country);
    var packPosterSrc = O.countryPosterSrc(country);
    var packPosterMedia = packPosterSrc
      ? { type: 'poster', src: packPosterSrc }
      : null;

    if (!country.noPack) {
      html += card(
        packPosterMedia,
        'Best Value',
        'Pack',
        country.name + ' Pack',
        'Everything in one bundle: all ' + displayCities.length + ' city maps plus the country guide.',
        displayPackCost,
        '<button class="btn btn-outline btn-sm" data-action="add-pack">Add</button>' +
        '<button class="btn btn-primary btn-sm" data-action="buy-pack">Buy</button>'
      );
    }

    /* City map cards — grey out moreSoonCities */
    country.cities.forEach(function (city) {
      var cityMoreSoon = moreSoonCities.indexOf(city) !== -1;
      var isFree = !cityMoreSoon && (country.freeCities || []).indexOf(city) !== -1;
      var widgetPrice = isFree ? 'FREE' : mapCost;
      var badge = isFree ? 'Free' : (cityMoreSoon ? 'Coming Soon' : 'Map');
      var desc = isFree
        ? 'A free digital map of ' + city + ', ' + country.name + '. Top spots, hidden gems, and route-ready pins. Grab it and try it out.'
        : 'A detailed, offline digital map of ' + city + ', ' + country.name + '. Top spots, hidden gems, and route-ready pins.';
      var actions = cityMoreSoon
        ? '<span class="more-soon-label">Coming Soon</span>'
        : '<button class="btn btn-outline btn-sm" data-action="add-map" data-city="' + city + '">Add</button>' +
          '<button class="btn btn-primary btn-sm" data-action="buy-map" data-city="' + city + '">' + (isFree ? 'Get' : 'Buy') + '</button>';
      var cityPoster = O.cityPosterSrc(country, city);
      html += card(
        cityPoster ? { type: 'poster', src: cityPoster } : null,
        badge,
        'City',
        city + ' Map',
        desc,
        widgetPrice,
        actions,
        cityMoreSoon ? 'product-card-more-soon' : ''
      );
    });

    /* Guide card */
    html += card(
      packPosterMedia,
      'Guide',
      'Guide',
      country.guide.name,
      'An honest, detailed travel guide for ' + country.name + ': where to go, what to eat, and local tips you won\'t find elsewhere.',
      guideCost,
      '<button class="btn btn-outline btn-sm" data-action="add-guide">Add</button>' +
      '<button class="btn btn-primary btn-sm" data-action="buy-guide">Buy</button>'
    );

    html +=
      '    </div>' +
      '  </div>' +
      '</section>';

    content.innerHTML = html;
    O.initReveal();
    bindActions(country);
  }

  function bindActions(country) {
    document.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.dataset.action;
        var item;

        if (action === 'add-pack' || action === 'buy-pack') {
          item = O.packItem(country);
        } else if (action === 'add-map' || action === 'buy-map') {
          var city = btn.dataset.city;
          item = O.cityItem(country, city);
        } else if (action === 'add-guide' || action === 'buy-guide') {
          item = O.guideItem(country);
        }

        if (!item) return;

        if (action.indexOf('buy') === 0) {
          O.buyNow(item);
          window.location.href = 'pay.html';
        } else {
          O.addToCart(item);
          var original = btn.textContent;
          btn.textContent = '\u2713 Added';
          btn.classList.add('btn-added');
          setTimeout(function () {
            btn.textContent = original;
            btn.classList.remove('btn-added');
          }, 1600);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();