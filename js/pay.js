/* ============================================================
   OanaTravels — pay.js
   - Renders session cart
   - Validates email
   - PayPal.me / Revolut checkout (personal-account friendly)
   - On completion: POSTs order to Google Apps Script for
     Drive access + delivery email, then shows success
   ============================================================ */

(function () {
  'use strict';

  var O = window.Oana;
  var els = {};

  function fmt(n) { return '€' + n.toFixed(2).replace(/\.00$/, ''); }

  function init() {
    els.cartItems = document.getElementById('cartItems');
    els.cartEmpty = document.getElementById('cartEmpty');
    els.subtotal = document.getElementById('subtotal');
    els.total = document.getElementById('total');
    els.email = document.getElementById('email');
    els.tcAgree = document.getElementById('tcAgree');
    els.btnPaypal = document.getElementById('btnPaypal');
    els.btnRevolut = document.getElementById('btnRevolut');
    els.successView = document.getElementById('successView');
    els.successEmail = document.getElementById('successEmail');
    els.successDetails = document.getElementById('successDetails');

    els.tcAgree.addEventListener('change', function () {
      disableCheckout(!hasCart());
    });
    els.btnPaypal.addEventListener('click', onPaypal);
    els.btnRevolut.addEventListener('click', onRevolut);

    render();
  }

  function render() {
    var cart = O.getCart();
    els.cartItems.innerHTML = '';

    if (!cart.length) {
      els.cartEmpty.hidden = false;
      els.subtotal.textContent = fmt(0);
      els.total.textContent = fmt(0);
      disableCheckout(true);
      return;
    }
    els.cartEmpty.hidden = true;
    disableCheckout(false);

    var total = 0;
    cart.forEach(function (item, idx) {
      total += item.price;
      var row = O.em('div', 'cart-item');

      var icon = O.em('span', 'cart-item-icon', itemIcon(item));
      var info = O.em('div', 'cart-item-info');
      info.appendChild(O.em('span', 'cart-item-title', item.title));
      info.appendChild(O.em('span', 'cart-item-tag', itemTag(item)));
      var price = O.em('span', 'cart-item-price', fmt(item.price));
      var remove = O.em('button', 'cart-item-remove', '×');
      remove.title = 'Remove';
      remove.addEventListener('click', function () {
        O.removeFromCart(idx);
        render();
      });

      row.appendChild(icon);
      row.appendChild(info);
      row.appendChild(price);
      row.appendChild(remove);
      els.cartItems.appendChild(row);
    });

    els.subtotal.textContent = fmt(total);
    els.total.textContent = fmt(total);
  }

  function itemIcon(item) {
    if (item.type === 'pack') return '🎁';
    if (item.type === 'guide') return '📖';
    return '🗺️';
  }

  function itemTag(item) {
    if (item.type === 'pack') return 'Country Pack';
    if (item.type === 'guide') return 'Guide';
    return 'City Map';
  }

  function disableCheckout(off) {
    var disabled = off || !els.tcAgree.checked;
    els.btnPaypal.disabled = disabled;
    els.btnRevolut.disabled = disabled;
    els.btnPaypal.classList.toggle('disabled', disabled);
    els.btnRevolut.classList.toggle('disabled', disabled);
  }

  function hasCart() {
    return O.getCart().length > 0;
  }

  function emailValid() {
    var val = (els.email.value || '').trim();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }

  function requireEmail() {
    if (!emailValid()) {
      els.email.classList.add('field-error');
      els.email.focus();
      return false;
    }
    els.email.classList.remove('field-error');
    return true;
  }

  /* ---------- Payment handlers ---------- */
  function paypalAmountPath(total) {
    // currency-independent integer/2-decim amount e.g. paypal.me/name/17
    var n = Math.round(total * 100) / 100;
    // paypal.me accepts integer or 2-decimal like /17 or /17.50
    var s = String(n);
    if (n % 1 === 0) s = String(Math.round(n));
    return s;
  }

  function onPaypal() {
    if (!els.tcAgree.checked) return;
    if (!requireEmail()) return;
    var total = orderTotal();
    if (!O.PAYPAL_ME) {
      alert('Add your PayPal username in js/components.js (PAYPAL_ME).');
      return;
    }
    var url = 'https://paypal.me/' + O.PAYPAL_ME + '/' + paypalAmountPath(total);
    openPayment(url, 'After paying via PayPal, confirm on the next screen.');
  }

  function onRevolut() {
    if (!els.tcAgree.checked) return;
    if (!requireEmail()) return;
    var total = orderTotal();
    if (!O.REVOLUT_LINK) {
      alert('Add your Revolut payment link in js/components.js (REVOLUT_LINK).');
      return;
    }
    openPayment(O.REVOLUT_LINK, 'After paying ' + fmt(total) + ' via Revolut, confirm on the next screen.');
  }

  function openPayment(url, note) {
    var order = {
      email: els.email.value.trim(),
      items: O.getCart(),
      total: orderTotal(),
      paid: { paypal: url.indexOf('paypal.me') > -1 }
    };
    sessionStorage.setItem('ot_pending_order', JSON.stringify(order));

    showPaymentSheet(url, order.total, note);
  }

  /* ---------- Payment sheet with link + QR ---------- */
  function showPaymentSheet(url, total, note) {
    if (!confirm('Proceed to payment of ' + fmt(total) + '?\n\nChoose how to pay:')) return;
    // Build a small inline payment panel with a link + scannable QR
    var sheet = O.em('div', 'pay-sheet');
    var amount = O.em('div', 'pay-sheet-amount', 'Pay ' + fmt(total));

    // 1) Direct link (desktop)
    var linkGroup = O.em('div', 'pay-sheet-group');
    linkGroup.appendChild(O.em('div', 'pay-sheet-label', '1. On your computer'));
    var openLink = O.em('a', 'btn btn-primary pay-sheet-open', 'Open payment page');
    openLink.href = url;
    openLink.target = '_blank';
    openLink.rel = 'noopener';
    linkGroup.appendChild(openLink);

    // 2) QR code (phone) — free QR API encodes the paypal.me amount URL
    var qrGroup = O.em('div', 'pay-sheet-group');
    qrGroup.appendChild(O.em('div', 'pay-sheet-label', '2. On your phone — scan'));
    var qrImg = O.em('img', 'pay-sheet-qr');
    var qrApi = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=';
    qrImg.src = qrApi + encodeURIComponent(url);
    qrImg.alt = 'Scan with your phone to pay';
    qrGroup.appendChild(qrImg);

    sheet.appendChild(amount);
    sheet.appendChild(linkGroup);
    sheet.appendChild(qrGroup);

    // 3) Confirm payment done → trigger delivery
    var confirmGroup = O.em('div', 'pay-sheet-group pay-sheet-confirm');
    var confirmBtn = O.em('button', 'btn btn-danger', "I've paid — send my maps");
    confirmBtn.addEventListener('click', function () {
      if (window.__payConfirm) window.__payConfirm();
    });
    confirmGroup.appendChild(confirmBtn);
    sheet.appendChild(confirmGroup);

    // Keep it inside the modal strip at bottom
    var modal = document.getElementById('productModal');
    if (modal) { modal.hidden = false; modal.style.background = 'rgba(45,58,71,0.6)'; }
    // Replace the pay column area with the sheet within a lightbox
    var backdrop = O.em('div', 'modal-backdrop');
    backdrop.addEventListener('click', dismissPaySheet);
    var panel = O.em('div', 'modal-panel pay-sheet-wrap');
    var close = O.em('button', 'modal-close', '×');
    close.addEventListener('click', dismissPaySheet);
    panel.appendChild(close);
    panel.appendChild(sheet);
    backdrop.style.position = 'fixed';

    // host under document body
    var wrap = O.em('div', 'pay-overlay');
    wrap.appendChild(backdrop);
    wrap.appendChild(panel);
    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';
    window.__payWrap = wrap;
    window.__payDismiss = dismissPaySheet;

    // After they pay, call confirm
    window.__payConfirm = function () {
      var stored = sessionStorage.getItem('ot_pending_order');
      if (!stored) { dismissPaySheet(); return; }
      dismissPaySheet();
      completeOrder(JSON.parse(stored));
    };
  }

  function dismissPaySheet() {
    if (window.__payWrap) {
      window.__payWrap.remove();
      window.__payWrap = null;
    }
    document.body.style.overflow = '';
    var modal = document.getElementById('productModal');
    if (modal) { modal.hidden = true; }
  }

  /* ---------- Delivery via Apps Script ---------- */
  function completeOrder(order) {
    var body = {
      type: 'order',
      email: order.email,
      items: order.items.map(function (it) {
        return {
          type: it.type,
          countryId: it.countryId,
          name: it.name,
          title: it.title
        };
      }),
      total: order.total
    };

    if (O.APPS_SCRIPT_URL) {
      fetch(O.APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(body)
      }).catch(function () { /* no-cors swallows response */ });
    }

    if (order.items.length) O.clearCart();

    els.successEmail.textContent = order.email;
    els.successDetails.innerHTML = '';
    order.items.forEach(function (it) {
      els.successDetails.appendChild(O.em('div', 'success-item', itemIcon(it) + ' ' + it.title));
    });
    els.successView.hidden = false;
    els.successView.scrollIntoView({ behavior: 'smooth' });
    els.email.value = '';
  }

  function orderTotal() {
    return O.getCart().reduce(function (sum, it) { return sum + it.price; }, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();