/**
 * OanaTravels — Order & Contact Automation
 * ==========================================================
 * WHAT THIS DOES
 *   When your website checkout succeeds, it POSTs a JSON
 *   message here. This script then, for each product the buyer
 *   actually purchased:
 *     1. Adds the buyer's email as VIEWER of ONLY those Drive
 *        files (map / guide). Nobody else can open them.
 *     2. Emails the buyer the individual link for each product.
 *     3. Logs one row per order in your spreadsheet
 *        (Pachet | Mail | Status | Date send | Notes).
 *   It also handles the "contact" form from the About page.
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
 *      it auto-creates the header row if missing.
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
  'macau': 'Macau',
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
    guide: ''
  },
  'malaysia': {
    maps: {
      'Kuala Lumpur': '1kkSC4l0dGCiXEgYO2HR88wHBGZOteuQ'
    },
    guide: ''
  },
  'romania': {
    maps: {
      'Bucharest': '1O-W3-8VmtwpP5UoFPUSW1H6NNKN4DrE'
    },
    guide: ''
  },
  'uae': {
    maps: {
      'Abu Dhabi': '11GexcQMJpzCRoktdHYu9xIE14F3VLaA'
    },
    guide: ''
  },
  'vietnam': {
    maps: {
      'Hue': '1vV9TPATEBGjgzyNIOMxHgHqOtH3lJ6g',
      'Ninh Binh': '1P6FqEw4t1gC0r_ixPyS0mxYjh5Q4U80'  // Drive file is named "Ninh Bình"
    },
    guide: ''
  },
  'thailand': {
    maps: {
      'Bangkok': '1yp6OoVEA-8amxGnhDO90p6kTkuZblXE',
      'Krabi': '1XTURmVYes8UsaYlwJsIpON2NjBoEUiw',
      'Chiang Mai': '126LlXL73jPpDheADsJByQzcckIT5ZNs', // Drive file is named "Northern Thailand"
      'Phuket': '1hhdVwZXmkMuMZUO_iwWRIZ-NU8CXgkI',
      'Ubon': '1RsUKfopCdAqAvcC9WZCnYNJD8_w44AY'          // Drive file is named "Ubon Ratchathani"
    },
    guide: '1Sy_9Z24Slqfc0hfJxK00Gp_vNd7qK3IWzhuVtVbWeIA'
  }
};

/**
 * Entry point — receives POSTs from the website.
 */
function doPost(e) {
  var data = {};
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Bad JSON' });
  }

  if (data.type === 'contact') {
    return handleContact(data);
  }

  if (data.type === 'order') {
    return handleOrder(data);
  }

  return json_({ ok: false, error: 'Unknown type' });
}

/** Handle an order: grant per-product access + email + log. */
function handleOrder(data) {
  var email = string_(data.email).toLowerCase().trim();
  var total = string_(data.total);

  if (!isEmail_(email)) {
    return json_({ ok: false, error: 'Invalid email' });
  }

  try {
    var resolved = resolveItems_(parseItems_(data.items));
    grantAccess_(resolved, email);
    sendOrderEmail_(email, resolved, total);
    logOrder_(email, resolved, total, 'Completed');
    return json_({ ok: true });
  } catch (err) {
    // Even if something fails, never lose contact with the buyer
    try {
      var fallback = resolveItems_(parseItems_(data.items));
      sendOrderEmail_(email, fallback, total);
      logOrder_(email, fallback, total, 'Failed');
    } catch (err2) {}
    return json_({ ok: true, warning: String(err) });
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
      }
    });
  });
}

/** Send the customer their per-product download links. */
function sendOrderEmail_(email, resolved, total) {
  MailApp.sendEmail(
    email,
    'Your OanaTravels maps & guides are ready! 🌏',
    buildOrderEmail_(email, resolved)
  );
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
          if (fid) out.push('• ' + city + ' — ' + cname + '\n' + fileLink_(fid));
        });
        if (entry.guide) {
          out.push('• ' + cname + ' Travel Guide\n' + fileLink_(entry.guide));
        }
        return;
      }
    }
    if (!r.ids.length) {
      out.push('• ' + r.label + ' — coming soon (you will get the link by email when it is ready)');
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
    'Each link only works with this email (' + email + ') — open it while signed in to Google with the same address.\n\n' +
    'Your products:\n\n' +
    linksBlock_(resolved);
}

function plain_(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fileLink_(id) {
  return 'https://drive.google.com/file/d/' + id + '/view';
}

/** Log one row per order to the spreadsheet. */
function logOrder_(email, resolved, total, status) {
  if (!SPREADSHEET_ID) return;
  try {
    var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Pachet', 'Mail', 'Status', 'Date send', 'Notes']);
    }
    var pachet = resolved.map(function (r) { return r.label; }).join(', ');
    var date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'M/d/yyyy');
    sheet.appendRow([pachet, email, status, date, total ? '€' + total : '']);
  } catch (err) { /* logging must never break delivery */ }
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

    MailApp.sendEmail(CONTACT_EMAIL, subject, body);

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

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function string_(v) {
  return (v === undefined || v === null) ? '' : String(v);
}

function isEmail_(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}