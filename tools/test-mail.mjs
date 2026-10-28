/* End-to-end MAIL test.

   Asks the Google Apps Script web app to send one test email to
   hi@oanatravels.com through MailApp (from the Google account that owns
   the script). The domain's inbox is routed via Cloudflare, so if the
   message arrives, outbound sending is working.

   It sends a { type: 'mailtest' } payload armed with SETUP_KEY, which is
   read straight from apps-script/Code.gs. No order is created and no
   sheet row is written.

   IMPORTANT: after pulling this change, re-deploy the Apps Script web
   app (Deploy -> Manage deployments -> Edit -> New version), otherwise
   the old code will answer "Unknown type".

   Usage:
     npm run test-mail
     SETUP_KEY=oana-2026 npm run test-mail   # override only if needed

   The Apps Script URL is read straight from js/components.js, so there
   is only one place to keep it up to date. */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPONENTS = path.join(ROOT, 'js', 'components.js');
const CODE = path.join(ROOT, 'apps-script', 'Code.gs');

async function appScriptUrl() {
  if (process.env.APPS_SCRIPT_URL) return process.env.APPS_SCRIPT_URL;
  const src = await fs.readFile(COMPONENTS, 'utf8');
  const m = src.match(/APPS_SCRIPT_URL\s*=\s*['"]([^'"]+)['"]/);
  if (!m) throw new Error('Could not find APPS_SCRIPT_URL in js/components.js');
  return m[1];
}

async function setupKey() {
  if (process.env.SETUP_KEY) return process.env.SETUP_KEY;
  const src = await fs.readFile(CODE, 'utf8');
  const m = src.match(/SETUP_KEY\s*=\s*['"]([^'"]+)['"]/);
  if (!m) throw new Error('Could not find SETUP_KEY in apps-script/Code.gs');
  return m[1];
}

function followLoginPage(text) {
  return /accounts\.google\.com|choose an account|AccountChooser/i.test(text);
}

async function main() {
  const url = await appScriptUrl();
  const key = await setupKey();
  const payload = { type: 'mailtest', setup: key };

  console.log('POST mail test to: ' + url);
  console.log('This sends one email to hi@oanatravels.com via MailApp.');

  const res = await fetch(url, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });

  /* A healthy public web app answers with a 302 to
     script.googleusercontent.com carrying the JSON result. */
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get('location');
    const final = await fetch(loc, { redirect: 'follow' });
    const text = await final.text();
    console.log('\nHTTP ' + res.status + ' -> ' + final.status);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.log('Response: ' + text.trim());
      console.log('\nCould not parse a JSON result (see above).');
      process.exitCode = 1;
      return;
    }

    if (data.ok) {
      console.log('\nOK — test email accepted by MailApp.');
      console.log('Subject: ' + data.subject);
      console.log('To: ' + data.to);
      console.log('Check that inbox (and spam) within a minute.');
      return;
    }

    console.log('\nFAILED — ' + (data.error || 'the script returned an error.'));
    if (/Unknown type/i.test(data.error || '')) {
      console.log('The deployed web app is still running old code.');
      console.log('Re-deploy: Apps Script -> Deploy -> Manage deployments -> Edit -> New version -> Deploy.');
    } else if (/Setup key/i.test(data.error || '')) {
      console.log('SETUP_KEY in apps-script/Code.gs differs from the deployed version (or is missing).');
      console.log('Re-deploy the latest Code.gs, or pass SETUP_KEY=... to this command.');
    } else {
      console.log('Open Apps Script -> Executions to see the MailApp error details.');
    }
    process.exitCode = 1;
    return;
  }

  const body = await res.text();
  if (res.status === 401 || res.status === 403 || followLoginPage(body)) {
    console.log('\nFAILED — HTTP ' + res.status + '. The web app is not public.');
    console.log('Fix: Apps Script -> Deploy -> Manage deployments -> Edit ->');
    console.log('     "Execute as: Me" and "Who has access: Anyone" -> Deploy.');
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
