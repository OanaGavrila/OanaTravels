/**
 * OanaTravels — Order, Delivery & Newsletter Automation
 * ==========================================================
 * WHAT THIS DOES
 *   When your website checkout succeeds, it POSTs a JSON
 *   message here.
 *
 *   PAID ORDERS (the normal flow)
 *     1. The order is ONLY logged to your spreadsheet with
 *        Status = "Pending" and the "Paid?" column empty.
 *        No access is granted yet and no email is sent.
 *     2. You receive the payment, then open the spreadsheet and
 *        type the word "paid" (or PAID) into COLUMN 1 of that row,
 *        overwriting the product names. Your note IS the
 *        confirmation. (Filling the old "Paid?" column also works.)
 *     3. A scheduled job (every 10 minutes) scans the sheet and,
 *        for every confirmed row, adds the buyer's email as
 *        VIEWER of ONLY those Drive files (map / guide / pack),
 *        emails the buyer their per-product links, and marks the
 *        row Status = "Completed" + fills "Date send".
 *
 *   FREE ORDERS (€0, the "Get My Free Maps" button)
 *     Delivered instantly: access granted + email sent + logged
 *     as "Completed" in the same pass.
 *
 *   CONTACT form from the About page.
 *
 *   NEWSLETTER form from the homepage: emails are logged to the
 *   same spreadsheet in a "Newsletter" tab.
 *
 * SETUP (do this once, ~5 min)
 *   1. Keep every product file inside the "OanaTravels" Drive
 *      folder (country subfolders are fine). The mapping of
 *      product -> file ID lives below in PRODUCT_FILES.
 *      To get a file's ID: open the file in Drive -> the URL is
 *      https://drive.google.com/file/d/<THIS_IS_THE_ID>/view
 *
 *   2. The spreadsheet for order logging is already configured
 *      below (SPREADSHEET_ID). The first time you place an order
 *      it auto-creates the header row if missing. Columns:
 *      Pachet | Mail | Status | Date send | Notes | Paid? | Items JSON
 *      -> COLUMN 1 ("Pachet") is YOUR signal column: write the word
 *         "paid" in it to confirm the payment (this overwrites the
 *         product names — that's fine, delivery uses "Items JSON").
 *         The next scan will deliver that order within 10 minutes.
 *
 *   3. Paste THIS FILE into a new Apps Script project:
 *      script.google.com -> New project -> paste -> save.
 *
 *   4. Deploy:
 *      Deploy -> New deployment -> type "Web app"
 *      + "Execute as: Me"
 *      + "Who has access: Anyone"  (needed so the site can POST)
 *      -> Deploy -> copy the "Web app URL".
 *
 *   5. Put that URL into js/components.js as APPS_SCRIPT_URL.
 *
 *   6. After any change to this file, re-deploy:
 *      Deploy -> Manage deployments -> Edit -> New version.
 *
 *   7. Add the delivery scheduler ONCE (run now, then never again):
 *      in Apps Script open the "Triggers" tab (clock icon) ->
 *      "Add Trigger" -> choose function
 *      scanAndDeliverPendingOrders -> Time-driven ->
 *      Every 10 minutes. (Or just run createTimerTrigger()
 *      once from the editor — it does the same thing.)
 *
 * SECURITY NOTE
 *   "Anyone" access is required for your static site to reach
 *   this script. The script only grants VIEW access to the
 *   specific purchased files, and only to the buyer's email.
 *   A forwarded link alone is not enough — Google requires the
 *   email on the file. Emails aren't verified — for hard payment
 *   proof, upgrade to PayPal Business later.
 * ========================================================== */

/** CONFIG — fill these in */
var SPREADSHEET_ID  = '1GJkqrrO9gCepmxvlHI9ZrJC3PdIJ1mp7DQUfktNuOlk'; // order log spreadsheet
var CONTACT_EMAIL   = 'hi@oanatravels.com';

/**
 * PAID_WORD — the word Oana types into COLUMN 1 ("Pachet") of a
 * Pending order row to confirm the payment. Matching is case-
 * insensitive, so "paid", "Paid", or "PAID" all work.
 */
var PAID_WORD = 'paid';

/**
 * THANKS_DOC_ID — the Google Doc with the thank-you emails.
 * The script sends only the ENG section. Edit the doc anytime and
 * future emails automatically use the new text.
 */
var THANKS_DOC_ID = '1bOqHAFyp8za6gbYyNdbrlP_yODseGq0BH_bfDYnx_Fc';

/** Display name per country id (used to fill [Country Name]). */
var COUNTRY_NAMES = {
  'vietnam': 'Vietnam',
  'thailand': 'Thailand',
  'greece': 'Greece',
  'uae': 'United Arab Emirates',
  'indonesia': 'Indonesia',
  'malaysia': 'Malaysia',
  'philippines': 'Philippines',
  'hongkong': 'Hong Kong',
  'macau': 'Macao',
  'romania': 'Romania'
};

/** Template header lines inside THANKS_DOC_ID (ENG section). */
var TPL_ONE_CITY  = 'FOR ONE CITY';
var TPL_MULTI     = 'FOR MULTIPLE CITIES';
var TPL_PACK      = 'FOR PACK COUNTRY';
var TPL_GUIDE     = 'FOR GUIDE COUNTRY';

/**
 * PRODUCT_FILES — the deliverable file IDs on Google Drive.
 * Structure: country id -> {
 *     maps:  { '<city name as on the website>': '<Drive file ID>' },
 *     guide: '<Drive file ID of the country guide>'  ('' = not uploaded yet)
 *   }
 *
 * To add a new map: upload it to Drive, copy its file ID, add a
 * line below (one per city). Packs automatically include every
 * city listed here + the guide.
 */
var PRODUCT_FILES = {
  'greece': {
    maps: {
      'Athens': '13DVcc4SwNP43dHkaDyHg9vEuUrBpV8k',
      'Aegina': '1qPfxq2enQOwl-Wddu67jRhhiShn64BA'   // Drive file is named "Egina"
    },
    guide: '12lYXQw1p2WG1ReaEY-JXUHO4HDFt4AuUx4X7onoLq30'
  },
  'indonesia': {
    maps: {
      'East Java': '1dEZrkPkz1bSF0G_EDpto5aPuW7IrsE4'  // Drive file is a Google My Maps map
    },
    guide: '1jCMJKXlnOUoUvQ7AKv7_Gg19xBKt4ZQcFWLmyuSLMyA'
  },
  'malaysia': {
    maps: {
      'Kuala Lumpur': '1kkSC4l0dGCiXEgYO2HR88wHBGZOteuQ'
    },
    guide: '1PR8a5dVEqtzMQ3FeFlZm6gOw7qJoxmmZhjp6LPRYCJw'
  },
  'romania': {
    maps: {
      'Bucharest': '1O-W3-8VmtwpP5UoFPUSW1H6NNKN4DrE'
    },
    guide: '17nvMUnDm7jvXm3Mn72uyzYqUecrcIIzHhr1A_TXW2OM'
  },
  'uae': {
    maps: {
      'Abu Dhabi': '11GexcQMJpzCRoktdHYu9xIE14F3VLaA'
    },
    guide: '1_cmMAsjsqCZZadZAzysvWbQA7a6lqap3sjpZxHgewsY'
  },
  'vietnam': {
    maps: {
      'Hue': '1vV9TPATEBGjgzyNIOMxHgHqOtH3lJ6g',
      'Ninh Binh': '1P6FqEw4t1gC0r_ixPyS0mxYjh5Q4U80'  // Drive file is named "Ninh Bình"
    },
    guide: '1XsdxzHOFGCeJzpEF1uT76-cXnLL4E_GdctX5YpvZB1U'
  },
  'thailand': {
    maps: {
      'Bangkok': '1yp6OoVEA-8amxGnhDO90p6kTkuZblXE',
      'Krabi': '1XTURmVYes8UsaYlwJsIpON2NjBoEUiw',
      'Northern Thailand': '126LlXL73jPpDheADsJByQzcckIT5ZNs', // Drive file is named "Northern Thailand"
      'Phuket': '1hhdVwZXmkMuMZUO_iwWRIZ-NU8CXgkI',
      'Ubon Ratchathani': '1RsUKfopCdAqAvcC9WZCnYNJD8_w44AY' // Drive file is named "Ubon Ratchathani"
    },
    guide: '1Sy_9Z24Slqfc0hfJxK00Gp_vNd7qK3IWzhuVtVbWeIA'
  }
};

/** A shared secret only you know — used to arm the delivery trigger
 *  by visiting ?setup <SECRET>. Keep it secret.
 */
var SETUP_KEY = 'oana-2026';

/** Return a JSON text output for the web app. Defined at the top on
 *  purpose: some Apps Script environments fail to resolve helpers
 *  declared further down the same file. */
function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Entry point #1 — a GET to this web app URL can (re)arm the delivery
 * trigger so you never have to open the Apps Script editor again:
 *
 *   <WEB_APP_URL>?setup=oana-2026
 *
 * Visiting that returns a small JSON saying the 10-min trigger is
 * running (or was recreated). A missing/wrong key returns an error
 * object instead.
 */
function doGet(e) {
  if (!e || e.parameter.setup !== SETUP_KEY) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: 'Setup key missing or wrong' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === 'scanAndDeliverPendingOrders') {
        ScriptApp.deleteTrigger(t);
      }
    });
    ScriptApp.newTrigger('scanAndDeliverPendingOrders')
      .timeBased()
      .everyMinutes(10)
      .create();
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, message: 'Delivery trigger is active.' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Entry point #2 — receives POSTs from the website.
 * Every incoming order also makes sure the 10-minute delivery trigger
 * exists, so even if it was deleted/expired the next order re-arms it.
 */
function doPost(e) {
  ensureTimerTrigger_();

  var data = {};
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Bad JSON' });
  }

  if (data.type === 'contact') {
    return handleContact(data);
  }

  if (data.type === 'newsletter') {
    return handleNewsletter(data);
  }

  if (data.type === 'order') {
    return handleOrder(data);
  }

  return json_({ ok: false, error: 'Unknown type' });
}

/**
 * handleOrder — log the order, then EITHER deliver it right away
 * (free €0 orders) OR leave it "Pending" until the "Paid?" signal
 * column is filled in the spreadsheet.
 */
function handleOrder(data) {
  var email = string_(data.email).toLowerCase().trim();
  var total = string_(data.total);

  if (!isEmail_(email)) {
    return json_({ ok: false, error: 'Invalid email' });
  }

  try {
    var items = parseItems_(data.items);
    var resolved = resolveItems_(items);
    var totalNum = Number(data.total) || 0;

    if (totalNum <= 0) {
      // Free order → deliver instantly, exactly like before.
      grantAccess_(resolved, email);
      sendOrderEmail_(email, resolved, total);
      logOrder_(email, resolved, total, items, 'Completed');
      return json_({ ok: true, free: true });
    }

    // Paid order → park it until Oana confirms payment in the sheet.
    logOrder_(email, resolved, total, items, 'Pending');
    return json_({ ok: true, pending: true });
  } catch (err) {
    // Even if something fails, never lose contact with the buyer
    try {
      var fallbackItems = parseItems_(data.items);
      var fallback = resolveItems_(fallbackItems);
      logOrder_(email, fallback, total, fallbackItems, 'Failed');
    } catch (err2) {}
    return json_({ ok: true, warning: String(err) });
  }
}

/**
 * scanAndDeliverPendingOrders — run on a time trigger (every 10 min).
 * Delivers every order whose "Paid?" signal column is filled in but
 * whose Status is still "Pending". Marks each row Completed after.
 */
function scanAndDeliverPendingOrders() {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (err) {
    return json_({ ok: false, error: 'Could not acquire lock' });
  }

  var delivered = 0;
  try {
    var sheet = getOrdersSheet_();
    if (sheet.getLastRow() < 1) return json_({ ok: true, delivered: 0 });

    var col = {
      pachet: 1, mail: 2, status: 3, dateSend: 4,
      notes: 5, paid: 6, items: 7
    };

    var lastRow = sheet.getLastRow();
    for (var r = lastRow; r >= 2; r--) {
      var status = string_(sheet.getRange(r, col.status).getValue());
      var pachet = string_(sheet.getRange(r, col.pachet).getValue()).trim();
      var paidLegacy = string_(sheet.getRange(r, col.paid).getValue()).trim();
      var email = string_(sheet.getRange(r, col.mail).getValue()).toLowerCase().trim();
      var itemsJson = string_(sheet.getRange(r, col.items).getValue()).trim();

      if (status !== 'Pending') continue;        // already handled
      // Confirmed when Oana typed PAID_WORD into column 1 (Pachet),
      // or when the older "Paid?" column is filled in.
      var confirmed = (pachet.toLowerCase() === PAID_WORD.toLowerCase()) || paidLegacy !== '';
      if (!confirmed) continue;                   // not confirmed by Oana yet
      if (!isEmail_(email)) continue;             // malformed row

      var items = [];
      try {
        items = JSON.parse(itemsJson);
      } catch (err) {
        sheet.getRange(r, col.status).setValue('Needs review');
        continue;
      }
      if (!items.length) continue;

      var resolved = resolveItems_(parseItems_(items));
      grantAccess_(resolved, email);
      var notes = string_(sheet.getRange(r, col.notes).getValue());
      sendOrderEmail_(email, resolved, notes);
      var date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d/yyyy');
      sheet.getRange(r, col.status).setValue('Completed');
      sheet.getRange(r, col.dateSend).setValue(date);
      delivered++;
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }

  return json_({ ok: true, delivered: delivered });
}

/**
 * createTimerTrigger — run once from the Apps Script editor (or just
 * visit the web app URL with ?setup=oana-2026) to add a recurring
 * 10-minute trigger for scanAndDeliverPendingOrders(). Calling it again
 * is safe — if the scanner trigger already exists, it is kept instead
 * of being recreated. It also self-heals: any wrongly scheduled trigger
 * calling createTimerTrigger is deleted on the next run.
 */
function createTimerTrigger() {
  var ok = ensureTimerTrigger_();
  return json_({ ok: ok, message: ok ? '10-minute delivery trigger created.' : 'Could not create the delivery trigger.' });
}

/**
 * ensureTimerTrigger_ — idempotent: keeps an existing 10-minute
 * delivery trigger if present, otherwise creates one. Also deletes any
 * stray trigger that calls createTimerTrigger. Returns true on success.
 */
function ensureTimerTrigger_() {
  try {
    var handlers = ScriptApp.getProjectTriggers();
    var hasDelivery = false;
    handlers.forEach(function (t) {
      var fn = t.getHandlerFunction();
      if (fn === 'scanAndDeliverPendingOrders') {
        hasDelivery = true;
      } else if (fn === 'createTimerTrigger') {
        ScriptApp.deleteTrigger(t);   // self-heal: remove stray hourly trigger
      }
    });
    if (hasDelivery) return true;     // keep existing 10-min scanner
    ScriptApp.newTrigger('scanAndDeliverPendingOrders')
      .timeBased()
      .everyMinutes(10)
      .create();
    return true;
  } catch (err) {
    return false;
  }
}

/** Give the buyer VIEW access to exactly the files they bought. */
function grantAccess_(resolved, email) {
  resolved.forEach(function (r) {
    r.ids.forEach(function (id) {
      try {
        if (!id) return;
        DriveApp.getFileById(id).addViewer(email);
      } catch (err) {
        r.undelivered = true; // one bad file must not block the rest
        r.failedIds = r.failedIds || [];
        r.failedIds.push(id);
      }
    });
  });
}

/** Send the customer their per-product download links (HTML + plain-text). */
function sendOrderEmail_(email, resolved, total) {
  var subject = 'Your OanaTravels maps & guides are ready! 🌏';
  MailApp.sendEmail({
    to: email,
    subject: subject,
    body: buildOrderEmail_(email, resolved),
    htmlBody: buildOrderEmailHtml_(email, resolved)
  });
}

function buildOrderEmail_(email, resolved) {
  var doc = '';
  try {
    doc = DocumentApp.openById(THANKS_DOC_ID).getBody().getText();
  } catch (err) {
    return fallbackBody_(email, resolved); // doc not reachable → built-in message
  }

  var eng = engSection_(doc);
  var choice = chooseTemplate_(resolved);
  var block = extractBlock_(eng, choice.key);
  if (!block) return fallbackBody_(email, resolved);

  return fillTemplate_(block, choice, resolved);
}

/** HTML version of the delivery email (nicer in inbox, avoids spam filters). */
function buildOrderEmailHtml_(email, resolved) {
  var doc = '';
  try {
    doc = DocumentApp.openById(THANKS_DOC_ID).getBody().getText();
  } catch (err) {
    return fallbackBodyHtml_(email, resolved); // doc not reachable → built-in message
  }

  var eng = engSection_(doc);
  var choice = chooseTemplate_(resolved);
  var block = extractBlock_(eng, choice.key);
  if (!block) return fallbackBodyHtml_(email, resolved);

  var country = COUNTRY_NAMES[choice.countryId] || choice.countryId;
  var city = choice.maps.length ? choice.maps[0] : country;

  var text = htmlEsc_(block);
  text = text.replace(/\[insert link\]\.?\s*/i, linksHtmlBlock_(resolved));
  text = text.replace(/\[Country Name\]/gi, htmlEsc_(country));
  text = text.replace(/\[City Name\]/gi, htmlEsc_(choice.kind === 'guide' ? country : city));
  text = text.replace(/\[City 1\][^.\n]*/i,
    htmlEsc_(nameList_(choice.maps.length ? choice.maps : [country])));

  // Strip the obsolete "reply with your email" lines if still in the doc
  text = text.replace(/\n?\s*To give you access, I need the email address linked to your Google account[.!]?\s*\n?/gi, '\n');
  text = text.replace(/\n?\s*Please reply to this message with your email[.!]?\s*\n?/gi, '\n');

  text = text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n/g, '<br>')
    .trim();

  var hasComingSoon = resolved.some(function (r) { return !r.ids.length; });
  if (hasComingSoon) {
    text += '<p style="color:#8a6d3d;background:#fcf8e3;border:1px solid #faebcc;padding:10px 12px;border-radius:8px;font-size:13px;margin:14px 0 0;">One or more of your products is still being prepared. You will get its link in a follow-up email when it is ready.</p>';
  }

  return htmlShell_(text, orderFooter_(email));
}

/** Keep only the ENG part of the thanks document. */
function engSection_(doc) {
  var engIdx = doc.search(/ENG\s+VERSION/i);
  var roIdx = doc.search(/RO\s+VERSION/i);
  var from = engIdx >= 0 ? engIdx : 0;
  var to = roIdx > from ? roIdx : doc.length;
  return doc.slice(from, to);
}

/** Pick which template to use based on what was bought. */
function chooseTemplate_(resolved) {
  var hasPack = false;
  var hasGuide = false;
  var maps = [];
  var countryId = '';

  resolved.forEach(function (r) {
    var it = r.item;
    if (it.type === 'pack') {
      hasPack = true;
      if (!countryId) countryId = it.countryId;
    } else if (it.type === 'guide') {
      hasGuide = true;
      if (!countryId) countryId = it.countryId;
    } else if (r.ids.length) {
      maps.push(it.name);
      if (!countryId) countryId = it.countryId;
    }
  });

  if (hasPack) return { key: TPL_PACK, kind: 'pack', maps: maps, countryId: countryId };
  if (hasGuide && !maps.length) {
    return { key: TPL_GUIDE, kind: 'guide', maps: maps, countryId: countryId };
  }
  if (maps.length > 1) return { key: TPL_MULTI, kind: 'multi', maps: maps, countryId: countryId };
  return { key: TPL_ONE_CITY, kind: 'one', maps: maps, countryId: countryId };
}

/** Extract one template block from the ENG section by its header. */
function extractBlock_(zone, header) {
  var start = zone.search(new RegExp(plain_(header), 'i'));
  if (start < 0) return '';

  var after = zone.slice(start + header.length);
  var headers = [TPL_ONE_CITY, TPL_MULTI, TPL_PACK, TPL_GUIDE];
  var end = after.length;
  for (var i = 0; i < headers.length; i++) {
    if (headers[i].toLowerCase() === header.toLowerCase()) continue;
    var m = after.toLowerCase().indexOf(headers[i].toLowerCase());
    if (m > -1 && m < end) end = m;
  }

  var block = zone.slice(start, start + header.length + end);
  var nl = block.indexOf('\n');
  if (nl > -1) block = block.slice(nl + 1); // drop the header line
  return block;
}

/** Fill the placeholders ([insert link], [City Name], ...). */
function fillTemplate_(block, choice, resolved) {
  var country = COUNTRY_NAMES[choice.countryId] || choice.countryId;
  var city = choice.maps.length ? choice.maps[0] : country;

  var text = block;
  text = text.replace(/\[insert link\]\.?\s*/i, linksBlock_(resolved) + '\n');
  text = text.replace(/\[Country Name\]/gi, country);
  text = text.replace(/\[City Name\]/gi, choice.kind === 'guide' ? country : city);
  text = text.replace(/\[City 1\][^.\n]*/i,
    nameList_(choice.maps.length ? choice.maps : [country]));

  // Strip the obsolete "reply with your email" lines if still in the doc
  text = text.replace(/\n?\s*To give you access, I need the email address linked to your Google account[.!]?\s*\n?/gi, '\n');
  text = text.replace(/\n?\s*Please reply to this message with your email[.!]?\s*\n?/gi, '\n');

  return text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** One Drive link line per purchased product. */
function linksBlock_(resolved) {
  var out = [];
  resolved.forEach(function (r) {
    if (r.item && r.item.type === 'pack') {
      var cname = COUNTRY_NAMES[r.item.countryId] || r.item.countryId;
      var entry = PRODUCT_FILES[r.item.countryId];
      if (entry) {
        Object.keys(entry.maps).forEach(function (city) {
          var fid = entry.maps[city];
          if (fid) out.push('• ' + city + ', ' + cname + '\n' + fileLink_(fid));
        });
        if (entry.guide) {
          out.push('• ' + cname + ' Travel Guide\n' + fileLink_(entry.guide));
        }
        return;
      }
    }
    if (!r.ids.length) {
      out.push('• ' + r.label + ', coming soon (you will get the link by email when it is ready)');
    } else {
      r.ids.forEach(function (id) {
        out.push('• ' + r.label + '\n' + fileLink_(id));
      });
    }
  });
  return out.join('\n');
}

/** "A, B, and C" style list, matching the templates. */
function nameList_(names) {
  if (names.length <= 1) return names.join('');
  if (names.length === 2) return names[0] + ' and ' + names[1];
  return names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
}

function fallbackBody_(email, resolved) {
  return 'Hi there,\n\n' +
    'Thank you for your order! Your links are below.\n' +
    'Each link only works with this email (' + email + '). Open it while signed in to Google with the same address.\n\n' +
    'Your products:\n\n' +
    linksBlock_(resolved);
}

function plain_(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fileLink_(id) {
  return 'https://drive.google.com/file/d/' + id + '/view';
}

/** Full HTML email shell with OanaTravels branding. */
function htmlShell_(content, footer) {
  return '' +
    '<div style="background:#f5efe6;padding:28px 16px;font-family:Arial,Helvetica,sans-serif;">' +
    '  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #ede3d5;">' +
    '    <div style="background:#2d3a47;padding:22px 28px;">' +
    '      <span style="color:#ffffff;font-size:20px;font-weight:800;">Oana<span style="color:#cd3c12;">Travels</span></span>' +
    '    </div>' +
    '    <div style="padding:28px 28px 24px;">' + content + '</div>' +
    '    <div style="padding:18px 28px;background:#faf6f0;border-top:1px solid #ede3d5;font-size:12px;color:#6b7280;line-height:1.6;">' + footer + '</div>' +
    '  </div>' +
    '</div>';
}

/** Footer used on order delivery emails. */
function orderFooter_(email) {
  return '' +
    '<p style="margin:0 0 8px;"><strong>How to open your files:</strong> sign in on Google with <strong>' + htmlEsc_(email) + '</strong>. Each link only works with the email used for your order.</p>' +
    '<p style="margin:0 0 8px;">To make sure future emails from us don\u2019t end up in spam, please add <a href="mailto:hi@oanatravels.com" style="color:#cd3c12;">hi@oanatravels.com</a> to your contacts.</p>' +
    '<p style="margin:0;">Happy travels,<br>Oana from OanaTravels</p>';
}

/** One clickable product card in the HTML email. */
function linkRow_(label, url) {
  return '' +
    '<div style="margin:12px 0;padding:14px 16px;border:1px solid #f0e2d2;border-radius:10px;background:#fdf9f4;">' +
    '  <div style="font-weight:700;color:#2d3a47;font-size:14px;margin-bottom:10px;">' + htmlEsc_(label) + '</div>' +
    '  <a href="' + url + '" style="display:inline-block;padding:9px 18px;background:#cd3c12;color:#ffffff;text-decoration:none;border-radius:6px;font-size:13px;font-weight:700;">Open in Google Drive</a>' +
    '</div>';
}

/** HTML version of the per-product download links block. */
function linksHtmlBlock_(resolved) {
  var out = [];
  resolved.forEach(function (r) {
    if (r.item && r.item.type === 'pack') {
      var cname = COUNTRY_NAMES[r.item.countryId] || r.item.countryId;
      var entry = PRODUCT_FILES[r.item.countryId];
      if (entry) {
        Object.keys(entry.maps).forEach(function (city) {
          var fid = entry.maps[city];
          if (fid) out.push(linkRow_(city + ', ' + cname, fileLink_(fid)));
        });
        if (entry.guide) {
          out.push(linkRow_(cname + ' Travel Guide', fileLink_(entry.guide)));
        }
        return;
      }
    }
    if (!r.ids.length) {
      out.push('<p style="color:#8a6d3d;font-size:13px;margin:10px 0;">• ' + htmlEsc_(r.label) + ', coming soon (you will get the link by email when it is ready)</p>');
    } else {
      r.ids.forEach(function (id) {
        out.push(linkRow_(r.label, fileLink_(id)));
      });
    }
  });
  return out.join('\n');
}

/** HTML fallback delivered when the thanks doc can't be reached. */
function fallbackBodyHtml_(email, resolved) {
  return htmlShell_(
    '<h2 style="color:#2d3a47;font-size:20px;margin:0 0 12px;">Thank you for your order!</h2>' +
    '<p style="color:#4a5568;font-size:14px;line-height:1.7;margin:0;">Hi there,<br>Your links are below. Each link only works with this email (' + htmlEsc_(email) + '). Open it while signed in to Google with the same address.</p>' +
    '<h3 style="color:#2d3a47;font-size:15px;margin:18px 0 6px;">Your products:</h3>' +
    linksHtmlBlock_(resolved),
    orderFooter_(email)
  );
}

/** Very small HTML-escape for safe embedding of user/template text. */
function htmlEsc_(s) {
  return string_(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Log one row per order to the spreadsheet.
 * Columns: Pachet | Mail | Status | Date send | Notes | Paid? | Items JSON
 *   - "Paid?" stays empty here — Oana fills it by hand to confirm payment.
 *   - "Date send" is only set once the order is actually delivered.
 *   - "Items JSON" stores the raw payload so the delivery scan can
 *     re-resolve the exact Drive files later.
 */
function logOrder_(email, resolved, total, items, status) {
  if (!SPREADSHEET_ID) return;
  try {
    var sheet = getOrdersSheet_();
    var pachet = resolved.map(logLabel_).join(', ');
    var date = utilitiesDate_();
    var dateSend = (status === 'Completed') ? date : '';
    var notes = total ? '€' + total : '';
    var failed = resolved
      .filter(function (r) { return r.failedIds && r.failedIds.length; })
      .map(function (r) { return r.label + ' (Drive access failed)'; })
      .join('; ');
    if (failed) notes = (notes ? notes + '; ' : '') + failed;
    sheet.appendRow([pachet, email, status, dateSend, notes, '', JSON.stringify(items)]);
  } catch (err) { /* logging must never break delivery */ }
}

/**
 * logLabel_ — the product name written to the order log.
 * A pack is expanded so the sheet shows every file it includes
 * (each map + the country guide), e.g.
 *   "Malaysia Pack (Kuala Lumpur + Malaysia Travel Guide)".
 */
function logLabel_(r) {
  if (r.item && r.item.type === 'pack') {
    var entry = PRODUCT_FILES[r.item.countryId];
    if (entry) {
      var cname = COUNTRY_NAMES[r.item.countryId] || r.item.countryId;
      var parts = Object.keys(entry.maps).filter(function (city) {
        return entry.maps[city];
      });
      if (entry.guide) parts.push(cname + ' Travel Guide');
      if (parts.length) return r.label + ' (' + parts.join(' + ') + ')';
    }
  }
  return r.label;
}

/** The order-log sheet, creating + updating its header row if missing. */
function getOrdersSheet_() {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0];

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(ORDER_HEADER_);
    return sheet;
  }

  var first = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (c) { return string_(c); });

  if (first.length < ORDER_HEADER_.length) {
    // Append the missing trailing columns; existing rows stay in place.
    for (var i = first.length; i < ORDER_HEADER_.length; i++) {
      sheet.getRange(1, i + 1).setValue(ORDER_HEADER_[i]);
    }
  }

  return sheet;
}

var ORDER_HEADER_ = ['Pachet', 'Mail', 'Status', 'Date send', 'Notes', 'Paid?', 'Items JSON'];

function utilitiesDate_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d/yyyy');
}

/** Handle the contact form from the About page. */
function handleContact(data) {
  try {
    var name = string_(data.name);
    var email = string_(data.email);
    var message = string_(data.message);

    var subject = 'New contact message from ' + name;
    var body =
      "Name: " + name + "\n" +
      "Email: " + email + "\n\n" +
      "Message:\n" + message;
    var html = htmlShell_(
      '<h2 style="color:#2d3a47;font-size:20px;margin:0 0 12px;">New contact message</h2>' +
      '<p style="color:#4a5568;font-size:14px;line-height:1.7;margin:0;"><strong>Name:</strong> ' + htmlEsc_(name) + '</p>' +
      '<p style="color:#4a5568;font-size:14px;line-height:1.7;margin:0;"><strong>Email:</strong> ' + htmlEsc_(email) + '</p>' +
      '<p style="color:#4a5568;font-size:14px;line-height:1.7;margin:14px 0 0;"><strong>Message:</strong></p>' +
      '<p style="color:#4a5568;font-size:14px;line-height:1.7;margin:0;">' + htmlEsc_(message).replace(/\n/g, '<br>') + '</p>',
      '<p style="margin:0;">Sent from the OanaTravels contact form.</p>'
    );

    MailApp.sendEmail({
      to: CONTACT_EMAIL,
      subject: subject,
      body: body,
      htmlBody: html
    });

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/**
 * handleNewsletter — log a homepage subscribe email to the
 * "Newsletter" tab of the same spreadsheet as the orders.
 */
function handleNewsletter(data) {
  try {
    var email = string_(data.email).toLowerCase().trim();
    if (!isEmail_(email)) {
      return json_({ ok: false, error: 'Invalid email' });
    }

    var spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = spreadsheet.getSheetByName('Newsletter');
    if (!sheet) {
      sheet = spreadsheet.insertSheet('Newsletter');
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Email', 'Date']);
    }
    var item = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1)
      .getValues();
    var exists = item.some(function (row) {
      return string_(row[0]).toLowerCase().trim() === email;
    });
    if (exists) {
      return json_({ ok: true, duplicate: true });
    }

    sheet.appendRow([email, utilitiesDate_()]);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ---------- helpers ---------- */

/** Accept the website payload as an array of item objects. */
function parseItems_(raw) {
  if (!Array.isArray(raw)) {
    var text = string_(raw);
    return text ? [{ type: '', countryId: '', name: '', title: text }] : [];
  }
  return raw.map(function (it) {
    if (typeof it === 'string') {
      return { type: '', countryId: '', name: '', title: it };
    }
    return {
      type: string_(it.type),
      countryId: string_(it.countryId),
      name: string_(it.name),
      title: string_(it.title) || string_(it.name)
    };
  });
}

/** Resolve every purchased item to its Drive file ID(s). */
function resolveItems_(items) {
  return items.map(function (it) {
    var entry = PRODUCT_FILES[it.countryId];
    var ids = [];

    if (entry) {
      if (it.type === 'pack') {
        Object.keys(entry.maps).forEach(function (city) {
          if (entry.maps[city]) ids.push(entry.maps[city]);
        });
        if (entry.guide) ids.push(entry.guide);
      } else if (it.type === 'guide') {
        if (entry.guide) ids.push(entry.guide);
      } else {
        var fid = entry.maps[it.name];
        if (fid) ids.push(fid);
      }
    }

    return { item: it, label: it.title, ids: ids, undelivered: false };
  });
}

function string_(v) {
  return (v === undefined || v === null) ? '' : String(v);
}

function isEmail_(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}