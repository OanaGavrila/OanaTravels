/* ============================================================
   OanaTravels — about.js
   - Contact form (POSTs to Apps Script; falls back gracefully)
   - Reveal animations
   ============================================================ */

(function () {
  'use strict';

  var O = window.Oana;

  function init() {
    var form = document.getElementById('contactForm');
    var msg = document.getElementById('cfMsg');
    var submitBtn = document.getElementById('cfSubmit');

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var name = document.getElementById('cfName').value.trim();
      var email = document.getElementById('cfEmail').value.trim();
      var message = document.getElementById('cfMessage').value.trim();

      if (!name || !email || !message) {
        showMsg(msg, submitBtn, 'Please fill in all fields.', true);
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showMsg(msg, submitBtn, 'That email address doesn\'t look right.', true);
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';

      var payload = { type: 'contact', name: name, email: email, message: message };

      if (O.APPS_SCRIPT_URL) {
        fetch(O.APPS_SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        }).then(function () {
          done(msg, submitBtn);
        }).catch(function () {
          done(msg, submitBtn);
        });
      } else {
        // Demo mode (no Apps Script URL configured yet)
        setTimeout(function () {
          done(msg, submitBtn);
        }, 600);
      }

      form.reset();
    });

    renderIGTiles();
  }

  function renderIGTiles() {
    var grid = document.getElementById('igTilesGrid');
    if (!grid) return;
    (O.IG_TILES || []).forEach(function (tile, i) {
      var wrap = O.em('div', 'insta-tile reveal');
      wrap.style.transitionDelay = (i * 80) + 'ms';
      wrap.innerHTML = O.igTileHTML(tile);
      grid.appendChild(wrap);
    });
    O.initReveal();
  }

  function showMsg(msg, btn, text, isError) {
    msg.textContent = text;
    msg.hidden = false;
    msg.className = 'form-msg' + (isError ? ' form-msg-error' : '');
    if (btn) { btn.disabled = false; btn.textContent = 'Send Message'; }
  }

  function done(msg, submitBtn) {
    showMsg(msg, submitBtn, 'Thanks for reaching out — I\'ll reply soon!', false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();