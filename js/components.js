/* ============================================================
   OanaTravels — shared components & site-wide state
   - Injects header (nav + cart) and footer into every page
   - sessionStorage-based cart (clears when tab closes)
   - Pricing helpers + product catalog access
   - Apps Script delivery hook placeholder
   ============================================================ */

(function () {
  'use strict';

  var SITE_URL = 'https://oanatravels.com';
  var IG_URL = 'https://instagram.com/oanagavrila19';
  var CONTACT_EMAIL = 'hi@oanatravels.com';

  /* ---------- CONFIG: fill in after setup ---------- */
  // Google Apps Script web app URL (delivery + contact forms).
  // Leave empty to run the site in "demo" mode.
  //
  // SETUP CHECKLIST (one-time, ~10 min):
  //   1. Google Drive: every product maps to its Drive file ID in
  //      apps-script/Code.gs (PRODUCT_FILES). New map = open the
  //      file in Drive → copy the <ID> from .../file/d/<ID>/view →
  //      add one line to PRODUCT_FILES.
  //   2. The order-log spreadsheet is already wired via
  //      SPREADSHEET_ID in Code.gs (columns: Pachet/Mail/Status/
  //      Date send/Notes/Paid?/Items JSON). "Paid?" is Oana's
  //      signal column: fill it to confirm a payment, and the
  //      scheduled scan sends that order's maps within 10 min.
  //   3. Paste the whole Code.gs into script.google.com → Deploy →
  //      New deployment → Web app → Execute as: Me → Who has
  //      access: Anyone. Copy the Web app URL below.
  var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx0bsyq3rKsNh-dUVD5SYnGcMWcteFwo9OOU_yrDUgz8XDxvi31FzhvGApPt20FiZaVMQ/exec';

  // PayPal & Revolut (your personal-account handles)
  var PAYPAL_ME = 'Oanatravels';
  var REVOLUT_LINK = 'oanagavrila';

  // Instagram preview tiles.
  // Each tile: { thumb: path to thumbnail image, post: full Instagram post URL, label: alt text }
  // Thumbnails pulled from Instagram; post links go to the real reels.
  var IG_TILES = [
    { thumb: 'assets/images/ig-1.jpg', post: 'https://www.instagram.com/p/DLXkXI1M87u/', label: 'Instagram reel: map preview' },
    { thumb: 'assets/images/ig-2.jpg', post: 'https://www.instagram.com/p/Dc8eoHHzxP_/', label: 'Instagram reel: travel guide' },
    { thumb: 'assets/images/ig-3.jpg', post: 'https://www.instagram.com/p/DbdGACpTbZv/', label: 'Instagram reel: travel tips' }
  ];

  /* ---------- Cart (sessionStorage) ---------- */
  var CART_KEY = 'ot_cart_v1';

  function getCart() {
    try {
      return JSON.parse(sessionStorage.getItem(CART_KEY)) || [];
    } catch {
      return [];
    }
  }

  function setCart(items) {
    sessionStorage.setItem(CART_KEY, JSON.stringify(items));
    emitCartChanged();
  }

  function addToCart(item) {
    var cart = getCart();
    cart.push(item);
    setCart(cart);
  }

  function buyNow(item) {
    setCart([item]);
  }

  function removeFromCart(index) {
    var cart = getCart();
    cart.splice(index, 1);
    setCart(cart);
  }

  function clearCart() {
    setCart([]);
  }

  var cartListeners = [];
  function onCartChange(fn) { cartListeners.push(fn); }
  function emitCartChanged() {
    cartListeners.forEach(function (fn) { fn(getCart()); });
  }

  /* ---------- Catalog helpers ---------- */
  var DATA = null;

  function loadCatalog(cb) {
    if (DATA) { cb(DATA); return; }
    fetch('data/products.json')
      .then(function (res) { return res.json(); })
      .then(function (d) {
        DATA = d;
        cb(DATA);
      })
      .catch(function () {
        console.warn('Could not load catalog');
        cb(null);
      });
  }

  function packPrice(cities) {
    return DATA ? DATA.pricing.packBase + DATA.pricing.packPerCity * cities : 0;
  }

  /* Single source of truth for pack pricing:
     uses the per-country packPrice override when present (vietnam 13, romania 7),
     otherwise prices the displayed (moreSoonCities-filtered) city set so the
     number shown on the shop/country page always equals the pay-page total. */
  function packPriceFor(country) {
    if (!DATA || !country) return 0;
    if (country.packPrice != null) return country.packPrice;
    var moreSoon = country.moreSoonCities || [];
    var display = moreSoon.length > 0
      ? country.cities.filter(function (c) { return moreSoon.indexOf(c) === -1; })
      : country.cities;
    return DATA.pricing.packBase + DATA.pricing.packPerCity * display.length;
  }
  function mapPrice() { return DATA ? DATA.pricing.map : 0; }
  function guidePrice() { return DATA ? DATA.pricing.guide : 0; }

  /* Per-city price: free maps are listed in country.freeCities */
  function cityPrice(country, cityName) {
    var free = (country.freeCities || []).indexOf(cityName) !== -1;
    return free ? 0 : mapPrice();
  }

  function countryById(id) {
    return DATA ? DATA.countries.filter(function (c) { return c.id === id; })[0] : null;
  }

  /* ---------- Poster resolution ----------
     Rules:
       - an explicit Drive URL in country.drivePoster always wins;
       - "coming soon" countries have no local poster yet, so they show
         only the flag until a Drive poster is added;
        - otherwise use the local file in assets/posters/<Country>/<poster>.webp */

  /* Accepts a direct image URL, a Drive "/file/d/<ID>/view" link, or a
     bare Drive file ID, and returns something usable in an <img src>. */
  function driveImage(value) {
    var s = (value === undefined || value === null) ? '' : String(value).trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s) && s.indexOf('drive.google.com') === -1) return s;
    var m = s.match(/\/file\/d\/([^/?#]+)/) || s.match(/[?&]id=([^&]+)/);
    var id = m ? m[1] : (/^[\w-]{20,}$/.test(s) ? s : '');
    if (id) return 'https://drive.google.com/thumbnail?id=' + id + '&sz=w1200';
    return s;
  }

  function countryPosterSrc(country) {
    if (!country) return '';
    if (country.drivePoster) return driveImage(country.drivePoster);
    if (country.moreSoon) return '';
    return country.poster
      ? 'assets/posters/' + country.name + '/' + country.poster + '.webp'
      : '';
  }

  /* Same idea for a single city map inside a country. */
  function cityPosterSrc(country, city) {
    if (!country) return '';
    var drive = country.driveCityPosters && country.driveCityPosters[city];
    if (drive) return driveImage(drive);
    return 'assets/posters/' + country.name + '/' + city + '.webp';
  }

  /* ---------- Cart item builders ---------- */
  function cityItem(country, cityName) {
    return {
      type: 'map',
      countryId: country.id,
      name: cityName,
      title: cityName + ' Map: ' + country.name,
      price: cityPrice(country, cityName)
    };
  }

  function guideItem(country) {
    return {
      type: 'guide',
      countryId: country.id,
      name: country.guide.name,
      title: country.guide.name,
      price: guidePrice()
    };
  }

  function packItem(country) {
    return {
      type: 'pack',
      countryId: country.id,
      name: country.name + ' Pack',
      title: country.name + ' Pack',
      price: packPriceFor(country)
    };
  }

  /* ---------- Header / Footer injection ---------- */
  function iconCart() {
    return '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>';
  }
  function iconInsta() {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>';
  }
  function iconMail() {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
  }

  function pageKey() {
    var p = location.pathname.split('/').pop() || 'index.html';
    return p.toLowerCase();
  }

  function headerHTML() {
    var current = pageKey();
    var isActive = function (path) { return current === path ? 'active' : ''; };
    return (
      '<header class="navbar" id="navbar">' +
      '  <div class="container navbar-inner">' +
      '    <a href="index.html" class="brand">' +
      '      <img src="assets/images/logo.webp" alt="OanaTravels" class="brand-logo">' +
      '      <span class="brand-name">Oana<span class="accent">Travels</span></span>' +
      '    </a>' +
      '    <nav class="nav-links" id="navLinks">' +
      '      <a href="index.html" class="nav-link ' + isActive('index.html') + '">Home</a>' +
      '      <a href="shop.html" class="nav-link ' + isActive('shop.html') + '">Shop</a>' +
      '      <a href="about.html" class="nav-link ' + isActive('about.html') + '">About</a>' +
      '    </nav>' +
      '    <div class="nav-actions">' +
      '      <a href="pay.html" class="cart-btn" aria-label="Shopping cart">' + iconCart() +
      '        <span class="cart-badge" id="cartBadge">0</span>' +
      '      </a>' +
      '      <button class="menu-toggle" id="menuToggle" aria-label="Toggle menu"><span></span><span></span><span></span></button>' +
      '    </div>' +
      '  </div>' +
      '</header>'
    );
  }

  function footerHTML() {
    return (
      '<footer class="footer" id="about">' +
      '  <div class="container footer-inner">' +
      '    <div class="footer-col footer-brand">' +
      '      <a href="index.html" class="brand brand-footer">' +
      '        <img src="assets/images/logo.webp" alt="OanaTravels" class="brand-logo brand-logo-footer">' +
      '        <span class="brand-name">Oana<span class="accent">Travels</span></span>' +
      '      </a>' +
      '      <p class="footer-about">Digital travel maps & guides crafted with love. Explore the world one map at a time.</p>' +
      '      <div class="footer-social">' +
      '        <a href="' + IG_URL + '" target="_blank" rel="noopener" class="social-link" aria-label="Instagram">' + iconInsta() + '</a>' +
      '        <a href="mailto:' + CONTACT_EMAIL + '" class="social-link" aria-label="Email">' + iconMail() + '</a>' +
      '      </div>' +
      '    </div>' +
      '    <div class="footer-col">' +
      '      <h4 class="footer-heading">Explore</h4>' +
      '      <a href="index.html#world" class="footer-link">World Map</a>' +
      '      <a href="shop.html" class="footer-link">Shop</a>' +
      '      <a href="index.html#destinations" class="footer-link">Destinations</a>' +
      '    </div>' +
      '    <div class="footer-col">' +
      '      <h4 class="footer-heading">Connect</h4>' +
      '      <a href="about.html" class="footer-link">About</a>' +
      '      <a href="about.html#contact" class="footer-link">Contact</a>' +
      '      <a href="' + IG_URL + '" target="_blank" rel="noopener" class="footer-link">Instagram</a>' +
      '    </div>' +
      '    <div class="footer-col footer-contact">' +
      '      <h4 class="footer-heading">Get in Touch</h4>' +
      '      <a href="mailto:' + CONTACT_EMAIL + '" class="footer-link">' + CONTACT_EMAIL + '</a>' +
      '      <a href="' + IG_URL + '" target="_blank" rel="noopener" class="footer-link">@oanagavrila19</a>' +
      '    </div>' +
      '    <div class="footer-col">' +
      '      <h4 class="footer-heading">Legal</h4>' +
      '      <a href="terms.html" class="footer-link">Terms &amp; Conditions</a>' +
      '      <a href="privacy.html" class="footer-link">Privacy Policy</a>' +
      '    </div>' +
      '  </div>' +
      '  <div class="footer-bottom"><div class="container">' +
      '    <p>&copy; 2026 OanaTravels. All rights reserved.</p>' +
      '  </div></div>' +
      '</footer>'
    );
  }

  function injectChrome() {
    var headerSlot = document.querySelector('[data-header]');
    var footerSlot = document.querySelector('[data-footer]');
    if (headerSlot) headerSlot.outerHTML = headerHTML();
    if (footerSlot) footerSlot.outerHTML = footerHTML();
    initNavbar();
    initCartBadge();
    initReveal();
  }

  function initNavbar() {
    var navbar = document.getElementById('navbar');
    var toggle = document.getElementById('menuToggle');
    var links = document.getElementById('navLinks');
    if (!navbar || !toggle || !links) return;
    var onScroll = function () {
      if (window.scrollY > 40) navbar.classList.add('scrolled');
      else navbar.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    toggle.addEventListener('click', function () { links.classList.toggle('open'); });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { links.classList.remove('open'); });
    });
  }

  function initCartBadge() {
    var badge = document.getElementById('cartBadge');
    if (!badge) return;
    var refresh = function (cart) { badge.textContent = cart.reduce(function (n, it) { return n + 1; }, 0); };
    refresh(getCart());
    onCartChange(refresh);
  }

  /* ---------- Reveal animations (shared) ---------- */
  function initReveal() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach(function (n) { n.classList.add('visible'); });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(function (n) { obs.observe(n); });
  }

  /* ---------- Instagram video tile (thumbnail + play + link) ---------- */
  function igTileHTML(tile, className) {
    var cls = className || 'ig-video-tile';
    var img = tile.thumb;
    var fallback = (tile.fallback || ((tile.label || 'Instagram preview') + '. Watch on @oanagavrila19').toUpperCase());
    return (
      '<a href="' + tile.post + '" target="_blank" rel="noopener" class="' + cls + ' ig-tile-grad" aria-label="' + (tile.label || 'Instagram video') + '">' +
      '  <span class="ig-tile-text">' + fallback + '</span>' +
      '  <img src="' + img + '" alt="' + (tile.label || 'Instagram video') + '" loading="lazy" onerror="var p=this.parentNode; this.remove(); p.classList.add(\'ig-tile-fallback\');">' +
      '  <span class="play-icon">▶</span>' +
      '</a>'
    );
  }

  /* ---------- Pub API ---------- */
  window.Oana = {
    SITE_URL: SITE_URL,
    IG_URL: IG_URL,
    CONTACT_EMAIL: CONTACT_EMAIL,
    APPS_SCRIPT_URL: APPS_SCRIPT_URL,
    PAYPAL_ME: PAYPAL_ME,
    REVOLUT_LINK: REVOLUT_LINK,
    IG_TILES: IG_TILES,
    igTileHTML: igTileHTML,
    loadCatalog: loadCatalog,
    packPrice: packPrice,
    packPriceFor: packPriceFor,
    mapPrice: mapPrice,
    guidePrice: guidePrice,
    cityPrice: cityPrice,
    countryById: countryById,
    countryPosterSrc: countryPosterSrc,
    cityPosterSrc: cityPosterSrc,
    cityItem: cityItem,
    guideItem: guideItem,
    packItem: packItem,
    getCart: getCart,
    setCart: setCart,
    addToCart: addToCart,
    buyNow: buyNow,
    removeFromCart: removeFromCart,
    clearCart: clearCart,
    onCartChange: onCartChange,
    initReveal: initReveal,
    em: function (tag, klass, text) {
      var n = document.createElement(tag);
      if (klass) n.className = klass;
      if (text !== undefined) n.textContent = text;
      return n;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectChrome);
  } else {
    injectChrome();
  }
})();