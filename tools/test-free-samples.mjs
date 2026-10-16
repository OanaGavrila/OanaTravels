/* End-to-end FREE SAMPLES test.

   Mirrors exactly what the homepage "Try Before You Buy" cards do when a
   visitor clicks "Get Free Map": each free city is turned into a €0 map
   item (same shape cityItem() builds in js/components.js) and posted to
   the Apps Script checkout as one free order (total 0). The backend then
   grants Drive access and emails the maps instantly.

   It also validates the free-sample catalogue locally, so it is useful
   even if the Apps Script endpoint is unreachable:
     - every free city exists in its country's city list
     - the free map is not also flagged "coming soon"
     - a local poster file exists for the card image

   The free samples are discovered from data/products.json (the same
   freeCities the homepage reads), so this test never drifts from the site.

   Usage:
     npm run test-free                  # all free samples, buyer = default
     TEST_EMAIL=you@example.com npm run test-free
     FREE_CITY="Ninh Binh" npm run test-free   # just one sample

   The Apps Script URL is read straight from js/components.js, so there
   is only one place to keep it up to date. */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS = path.join(ROOT, 'js', 'components.js');
const PRODUCTS = path.join(ROOT, 'data', 'products.json');

const TEST_EMAIL = process.env.TEST_EMAIL || 'hi@oanatravels.com';
const ONLY_CITY = process.env.FREE_CITY || '';

/* ---------- 1. Find the free samples (same logic as the home page) ---------- */
function collectFreeSamples(data) {
  const samples = [];
  data.countries.forEach((country) => {
    if (country.moreSoon) return;
    const moreSoon = country.moreSoonCities || [];
    (country.freeCities || []).forEach((city) => {
      if (moreSoon.indexOf(city) !== -1) return; // coming soon → not a sample
      samples.push({ country, city });
    });
  });
  return samples;
}

/* ---------- 2. Local catalogue validation (no network needed) ---------- */
async function validateSamples(samples) {
  const problems = [];
  if (samples.length === 0) {
    problems.push('No free samples found — check freeCities in data/products.json.');
  }
  for (const { country, city } of samples) {
    if (country.cities.indexOf(city) === -1) {
      problems.push(`${city} is a free sample of ${country.name} but is not in its city list.`);
    }
    const poster = path.join(ROOT, 'assets', 'posters', country.name, city + '.webp');
    try {
      await fs.access(poster);
    } catch {
      problems.push(`Missing poster image: assets/posters/${country.name}/${city}.webp`);
    }
  }
  return problems;
}

/* ---------- 3. Build the €0 items exactly like cityItem() does ---------- */
function cityItem(country, city) {
  return {
    type: 'map',
    countryId: country.id,
    name: city,
    title: city + ' Map: ' + country.name,
    price: 0,
  };
}

async function appScriptUrl() {
  if (process.env.APPS_SCRIPT_URL) return process.env.APPS_SCRIPT_URL;
  const src = await fs.readFile(COMPONENTS, 'utf8');
  const m = src.match(/APPS_SCRIPT_URL\s*=\s*['"]([^'"]+)['"]/);
  if (!m) throw new Error('Could not find APPS_SCRIPT_URL in js/components.js');
  return m[1];
}

async function sendFreeOrder(url, items) {
  const order = { type: 'order', email: TEST_EMAIL, items, total: 0, paid: { free: true } };
  console.log('\nPOST free order to: ' + url);
  console.log('Payload: ' + JSON.stringify(order));

  const res = await fetch(url, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(order),
  });

  /* A healthy public web app answers with a 302 to script.googleusercontent.com. */
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location');
    const final = await fetch(loc, { redirect: 'follow' });
    const text = await final.text();
    console.log('\nHTTP ' + res.status + ' -> ' + final.status);
    console.log('Response: ' + text.trim());
    try {
      const data = JSON.parse(text);
      if (data.ok && data.free) {
        console.log('\nOK — free order delivered instantly to ' + TEST_EMAIL + '.');
        console.log('Check that inbox: the maps (and access) should arrive within a minute.');
        return true;
      }
      console.log('\nScript responded without { ok:true, free:true } (see above).');
      return false;
    } catch {
      console.log('\nCould not parse a JSON result (see above).');
      return false;
    }
  }

  const body = await res.text();
  if (res.status === 401 || res.status === 403) {
    console.log('\nFAILED — HTTP ' + res.status + '. The web app is not public.');
    console.log('Fix: Apps Script -> Deploy -> Manage deployments -> Edit ->');
    console.log('     "Execute as: Me" and "Who has access: Anyone" -> Deploy.');
    return false;
  }
  console.log('\nUnexpected HTTP ' + res.status + ': ' + body.trim().slice(0, 300));
  return false;
}

async function main() {
  const data = JSON.parse(await fs.readFile(PRODUCTS, 'utf8'));
  let samples = collectFreeSamples(data);

  if (ONLY_CITY) {
    samples = samples.filter((s) => s.city.toLowerCase() === ONLY_CITY.toLowerCase());
    if (samples.length === 0) {
      console.log('No free sample named "' + ONLY_CITY + '". Available: ' +
        collectFreeSamples(data).map((s) => s.city).join(', '));
      process.exitCode = 1;
      return;
    }
  }

  console.log('Free samples found: ' + samples.map((s) => s.city + ' (' + s.country.name + ')').join(', '));

  const problems = await validateSamples(samples);
  if (problems.length) {
    console.log('\nCatalogue problems:');
    problems.forEach((p) => console.log('  ✗ ' + p));
    process.exitCode = 1;
    return;
  }
  console.log('Catalogue: OK — every free city is valid and has a poster image.');

  const items = samples.map((s) => cityItem(s.country, s.city));
  const url = await appScriptUrl();
  const ok = await sendFreeOrder(url, items);

  console.log('\n' + (ok ? 'PASS — free samples test succeeded.' : 'FAIL — free samples test did not complete.'));
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error('\nTest failed: ' + err.message);
  process.exitCode = 1;
});
