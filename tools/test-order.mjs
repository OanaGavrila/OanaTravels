/* End-to-end order test.
   Sends a fake order (a single city map) to the Google Apps Script
   checkout endpoint, exactly like js/pay.js does. If the script is
   reachable it logs a "Pending" row in the order spreadsheet and emails
   the order notification, so you can watch the whole delivery flow.

   Usage:
     npm run test-order                 # buyer email defaults below
     TEST_EMAIL=you@example.com npm run test-order

   The Apps Script URL is read straight from js/components.js, so there
   is only one place to keep it up to date. */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS = path.join(ROOT, 'js', 'components.js');

const TEST_EMAIL = process.env.TEST_EMAIL || 'hi@oanatravels.com';

/* The map we pretend to buy — must match a city in apps-script/Code.gs
   PRODUCT_FILES so a confirmed delivery actually finds a file. */
const ITEM = { type: 'map', countryId: 'greece', name: 'Athens', title: 'Athens City Map (TEST)' };
const TOTAL = 4;

async function appScriptUrl() {
  if (process.env.APPS_SCRIPT_URL) return process.env.APPS_SCRIPT_URL;
  const src = await fs.readFile(COMPONENTS, 'utf8');
  const m = src.match(/APPS_SCRIPT_URL\s*=\s*['"]([^'"]+)['"]/);
  if (!m) throw new Error('Could not find APPS_SCRIPT_URL in js/components.js');
  return m[1];
}

async function followLoginPage(text) {
  return /accounts\.google\.com|choose an account|AccountChooser/i.test(text);
}

async function main() {
  const url = await appScriptUrl();
  const order = { type: 'order', email: TEST_EMAIL, items: [ITEM], total: TOTAL };

  console.log('POST test order to: ' + url);
  console.log('Payload: ' + JSON.stringify(order));

  const res = await fetch(url, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(order),
  });

  /* A healthy public web app answers with a 302 to
     script.googleusercontent.com carrying the JSON result. */
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location');
    const final = await fetch(loc, { redirect: 'follow' });
    const text = await final.text();
    console.log('\nHTTP ' + res.status + ' -> ' + final.status);
    console.log('Response: ' + text.trim());
    try {
      const data = JSON.parse(text);
      if (data.ok) {
        console.log('\nOK — test order accepted.' + (data.pending ? ' Logged as Pending; the notification email is on its way to ' + TEST_EMAIL + '.' : ''));
        console.log('To finish the delivery test: open the order sheet, type "paid" in column 1 of the TEST row, and the map link will be emailed within 10 minutes.');
        return;
      }
      console.log('\nScript responded with an error object (see above).');
      process.exitCode = 1;
    } catch {
      console.log('\nCould not parse a JSON result (see above).');
      process.exitCode = 1;
    }
    return;
  }

  const body = await res.text();
  if (res.status === 401 || res.status === 403 || (await followLoginPage(body))) {
    console.log('\nFAILED — HTTP ' + res.status + '. The web app is not public.');
    console.log('Fix: Apps Script -> Deploy -> Manage deployments -> Edit ->');
    console.log('     "Execute as: Me" and "Who has access: Anyone" -> Deploy.');
    console.log('     The site can only deliver orders once this is "Anyone".');
    process.exitCode = 1;
    return;
  }

  console.log('\nUnexpected HTTP ' + res.status + ': ' + body.trim().slice(0, 300));
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('\nTest failed: ' + err.message);
  process.exitCode = 1;
});
