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
    els.successSub = document.getElementById('successSub');
    els.successEmail = document.getElementById('successEmail');
    els.successDetails = document.getElementById('successDetails');
    els.successCard = els.successView ? els.successView.querySelector('.success-card') : null;
    els.successTitle = els.successView ? els.successView.querySelector('.success-card h2') : null;
    els.successIcon = els.successView ? els.successView.querySelector('.success-icon') : null;
    els.successTitleDefault = els.successTitle ? els.successTitle.textContent : '';

    els.btnFree = document.getElementById('btnFree');
    els.secureNote = document.getElementById('secureNote');

    els.tcAgree.addEventListener('change', refreshCheckout);
    els.btnPaypal.addEventListener('click', onPaypal);
    els.btnRevolut.addEventListener('click', onRevolut);
    if (els.btnFree) els.btnFree.addEventListener('click', onFree);

    render();
  }

  function render() {
    var cart = O.getCart();
    els.cartItems.innerHTML = '';

    if (!cart.length) {
      els.cartEmpty.hidden = false;
      els.subtotal.textContent = fmt(0);
      els.total.textContent = fmt(0);
      setFreeMode(false);
      refreshCheckout();
      return;
    }
    els.cartEmpty.hidden = true;

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
    setFreeMode(total === 0);
    refreshCheckout();
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

  function refreshCheckout() {
    var off = !hasCart() || !els.tcAgree.checked;
    els.btnPaypal.disabled = off;
    els.btnRevolut.disabled = off;
    els.btnPaypal.classList.toggle('disabled', off);
    els.btnRevolut.classList.toggle('disabled', off);
    if (els.btnFree) {
      els.btnFree.disabled = off;
      els.btnFree.classList.toggle('disabled', off);
    }
  }

  function setFreeMode(free) {
    els.btnPaypal.hidden = free;
    els.btnRevolut.hidden = free;
    if (els.btnFree) els.btnFree.hidden = !free;
    if (els.secureNote) els.secureNote.hidden = free;
  }

  function onFree() {
    if (!els.tcAgree.checked) return;
    if (!requireEmail()) return;
    if (orderTotal() !== 0) return;
    var order = {
      email: els.email.value.trim(),
      items: O.getCart(),
      total: 0,
      paid: { free: true }
    };
    completeOrder(order);
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
    openPayment(url);
  }

  function onRevolut() {
    if (!els.tcAgree.checked) return;
    if (!requireEmail()) return;
    var total = orderTotal();
    if (!O.REVOLUT_LINK) {
      alert('Add your Revolut username in js/components.js (REVOLUT_LINK).');
      return;
    }
    var amountCents = Math.round(total * 100);
    var url = 'https://revolut.me/' + O.REVOLUT_LINK + '?currency=EUR&amount=' + amountCents;
    openPayment(url);
  }

  function openPayment(url) {
    var total = orderTotal();
    if (!confirm('Proceed to payment of ' + fmt(total) + '?\n\nChoose how to pay:')) return;

    var order = {
      email: els.email.value.trim(),
      items: O.getCart(),
      total: total,
      paid: { paypal: url.indexOf('paypal.me') > -1 }
    };

    // Log the order straight away. It lands in the sheet as "Pending"
    // and Oana confirms the payment there; the scheduled scan sends the
    // maps once she fills the "Paid?" column.
    var log = postOrder(order);
    if (order.items.length) O.clearCart();

    showPaymentSheet(url, order.total, order.email, log, order.items);
  }

  /* ---------- Payment sheet with link + QR ---------- */
  function showPaymentSheet(url, total, email, log, items) {
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
    qrGroup.appendChild(O.em('div', 'pay-sheet-label', '2. On your phone: scan'));
    var qrImg = O.em('img', 'pay-sheet-qr');
    var qrApi = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=';
    qrImg.src = qrApi + encodeURIComponent(url);
    qrImg.alt = 'Scan with your phone to pay';
    qrGroup.appendChild(qrImg);

    sheet.appendChild(amount);
    sheet.appendChild(linkGroup);
    sheet.appendChild(qrGroup);

    // Cute closing note — no confirmation step, I verify payments by hand.
    var cute = O.em('div', 'pay-sheet-cute');
    cute.appendChild(document.createTextNode('🌏 Once your payment comes through, I\u2019ll personally check it and hand-send your maps & guides to '));
    cute.appendChild(O.em('strong', '', email));
    cute.appendChild(document.createTextNode(' within 24 hours, usually much sooner. Thank you for supporting my small business! ❤️'));
    sheet.appendChild(cute);

    // If the order could not be logged, say so plainly instead of letting
    // the buyer believe it went through. Payment still works; the order
    // just needs to reach Oana by email.
    if (log && typeof log.then === 'function') {
      log.then(function (res) {
        if (res && res.ok) return;
        var warn = O.em('div', 'pay-sheet-warn');
        warn.appendChild(document.createTextNode('Heads up: I couldn\u2019t log your order automatically. After paying, please email '));
        var mail = O.em('a', '', O.CONTACT_EMAIL);
        mail.href = 'mailto:' + O.CONTACT_EMAIL;
        warn.appendChild(mail);
        warn.appendChild(document.createTextNode(' with the items below so nothing gets lost.'));
        var list = O.em('div', 'pay-sheet-warn-items');
        (items || []).forEach(function (it) {
          list.appendChild(O.em('div', '', itemIcon(it) + ' ' + it.title));
        });
        warn.appendChild(list);
        sheet.appendChild(warn);
      });
    }

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
  function postOrder(order) {
    if (!O.APPS_SCRIPT_URL) return Promise.resolve({ ok: true, demo: true });
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
    return O.postToAppsScript(body);
  }

  function completeOrder(order) {
    postOrder(order).then(function (res) {
      if (res && res.ok) {
        if (order.items.length) O.clearCart();
        showSuccess(order);
      } else {
        showDeliveryError(order, res && res.reason);
      }
    });
  }

  function showSuccess(order) {
    if (els.successCard) els.successCard.classList.remove('success-error');
    if (els.successIcon) els.successIcon.textContent = '✓';
    if (els.successTitle && els.successTitleDefault) els.successTitle.textContent = els.successTitleDefault;

    if (els.successSub) {
      els.successSub.innerHTML = (Number(order.total) <= 0)
        ? 'Your maps are on their way to <strong id="successEmail"></strong> — enjoy, and thank you for being here! 🌏'
        : 'Thank you for supporting my small business! ❤️ Every order means the world to me, so I\u2019ll hand-check yours and send your maps &amp; guides to <strong id="successEmail"></strong> within 24 hours, usually much sooner. 🌏';
    }
    var emailNode = document.getElementById('successEmail');
    if (emailNode) emailNode.textContent = order.email;

    renderSuccessItems(order);
    els.successView.hidden = false;
    els.successView.scrollIntoView({ behavior: 'smooth' });
    els.email.value = '';
  }

  function showDeliveryError(order, reason) {
    if (els.successCard) els.successCard.classList.add('success-error');
    if (els.successIcon) els.successIcon.textContent = '!';
    if (els.successTitle) els.successTitle.textContent = 'That didn\u2019t go through';

    if (els.successSub) {
      els.successSub.innerHTML =
        'Sorry, your order couldn\u2019t be submitted automatically' +
        (reason === 'network' ? ' (connection problem)' : '') +
        '. Please email <a href="mailto:' + O.CONTACT_EMAIL + '">' + O.CONTACT_EMAIL + '</a> and I\u2019ll send your maps right away.';
    }

    // Keep the cart so the buyer can simply try again.
    renderSuccessItems(order);
    els.successView.hidden = false;
    els.successView.scrollIntoView({ behavior: 'smooth' });
  }

  function renderSuccessItems(order) {
    els.successDetails.innerHTML = '';
    order.items.forEach(function (it) {
      els.successDetails.appendChild(O.em('div', 'success-item', itemIcon(it) + ' ' + it.title));
    });
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