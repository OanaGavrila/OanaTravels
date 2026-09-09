/* ============================================================
   OanaTravels — country.js
   Shared script for individual country pages (vietnam.html, etc.).
   Reads the country ID from the URL filename, loads product data,
   and renders: hero, pack card, city map rows, guide row.
   ============================================================ */

(function () {
  'use strict';

  var O = window.Oana;

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
    var packCost = pricing.packBase + pricing.packPerCity * country.cities.length;
    var mapCost = pricing.map;
    var guideCost = pricing.guide;

    var content = document.getElementById('countryContent');
    if (!content) return;

    var gradClass = 'flag-' + country.id;
    var isMoreSoon = !!country.moreSoon;
    var moreSoonCities = country.moreSoonCities || [];

    function card(image, badge, type, name, desc, price, actions, extraClass) {
      return (
        '<div class="product-card reveal' + (extraClass ? ' ' + extraClass : '') + '">' +
        '  <div class="product-card-media ' + gradClass + '">' +
        (badge ? '    <span class="product-card-badge">' + badge + '</span>' : '') +
        '    <span class="product-card-type">' + type + '</span>' +
        '    <span class="pack-emoji">' + image + '</span>' +
        '  </div>' +
        '  <div class="product-card-body">' +
        '    <h3 class="product-card-name">' + name + '</h3>' +
        '    <p class="product-card-desc">' + desc + '</p>' +
        '    <div class="product-card-footer">' +
        '      <span class="product-card-price">' + fmt(price) + '</span>' +
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
      '    <span class="hero-eyebrow reveal">' + country.flag + ' ' + country.name + '</span>' +
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
    var displayPackCost = pricing.packBase + pricing.packPerCity * displayCities.length;
    html += card(
      (country.emoji || '\uD83C\uDF0D'),
      'Best Value',
      'Pack',
      country.name + ' Pack',
      'Everything in one bundle \u2014 all ' + displayCities.length + ' city maps plus the country guide.',
      displayPackCost,
      '<button class="btn btn-outline btn-sm" data-action="add-pack">Add</button>' +
      '<button class="btn btn-primary btn-sm" data-action="buy-pack">Buy</button>'
    );

    /* City map cards — grey out moreSoonCities */
    country.cities.forEach(function (city) {
      var cityMoreSoon = moreSoonCities.indexOf(city) !== -1;
      var actions = cityMoreSoon
        ? '<span class="more-soon-label">Coming Soon</span>'
        : '<button class="btn btn-outline btn-sm" data-action="add-map" data-city="' + city + '">Add</button>' +
          '<button class="btn btn-primary btn-sm" data-action="buy-map" data-city="' + city + '">Buy</button>';
      html += card(
        '\uD83D\uDDFA\uFE0F',
        cityMoreSoon ? 'Coming Soon' : 'Map',
        'City',
        city + ' Map',
        'A detailed, offline digital map of ' + city + ', ' + country.name + ' \u2014 top spots, hidden gems, and route-ready pins.',
        mapCost,
        actions,
        cityMoreSoon ? 'product-card-more-soon' : ''
      );
    });

    /* Guide card */
    html += card(
      '\uD83D\uDCD6',
      'Guide',
      'Guide',
      country.guide.name,
      'An honest, detailed travel guide for ' + country.name + ' \u2014 where to go, what to eat, and local tips you won\'t find elsewhere.',
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
    bindActions(country, pricing);
  }

  function bindActions(country, pricing) {
    var packCost = pricing.packBase + pricing.packPerCity * country.cities.length;

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
