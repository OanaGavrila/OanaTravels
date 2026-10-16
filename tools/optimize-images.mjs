/* One-shot / re-runnable image optimizer.
   Converts PNG sources to WebP variants next to the original (originals are kept).
   Usage: npm run optimize
   Skips outputs that are already newer than their source.

   Each job lists `variants`, i.e. the output widths to produce.
   A variant suffix of '' keeps the plain "<name>.webp" name; any other suffix
   (e.g. '-480') is appended before the extension: "<name>-480.webp".
   Widths larger than the source are never upscaled. */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KB = 1024;

const HERO_WIDTHS = [640, 960, 1280, 1920];
const heroVariants = HERO_WIDTHS.map((w) => ({ width: w, suffix: '-' + w }));

/* name, source(s), variants[{width,suffix}], quality, optional maxHeight */
const JOBS = [
  { files: ['assets/images/hero-center.png'], variants: heroVariants, quality: 80 },
  { files: ['assets/images/hero-left.png', 'assets/images/hero-right.png'], variants: heroVariants, quality: 80 },
  { files: ['assets/images/about-me.png'], variants: [{ width: 1200, suffix: '' }], quality: 80 },
  { files: ['assets/images/logo.png'], variants: [{ width: 208, suffix: '' }], quality: 90, maxHeight: 208 },
  /* Posters: keep "<name>.webp" (960w) + add "<name>-480.webp" for small cards. */
  { dir: 'assets/posters', recursive: true, variants: [{ width: 960, suffix: '' }, { width: 480, suffix: '-480' }], quality: 80 },
];

async function collectPngs(job) {
  if (job.files) return job.files.map((f) => path.join(ROOT, f));
  const out = [];
  async function walk(dir) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.name.toLowerCase().endsWith('.png')) out.push(full);
    }
  }
  await walk(path.join(ROOT, job.dir));
  return out;
}

function fmt(bytes) { return (bytes / KB).toFixed(1) + ' KB'; }

let totalBefore = 0;
let totalAfter = 0;
const rows = [];

for (const job of JOBS) {
  for (const src of await collectPngs(job)) {
    const rel = path.relative(ROOT, src);

    let srcStat;
    try { srcStat = await fs.stat(src); } catch { continue; }

    const meta = await sharp(src).metadata();
    const srcWidth = meta.width || 0;

    let beforeForSource = 0;
    let afterForSource = 0;
    let processed = 0;

    for (const variant of job.variants) {
      if (variant.width && srcWidth && variant.width > srcWidth) continue;
      const dest = src.replace(/\.png$/i, variant.suffix + '.webp');

      let destStat = null;
      try { destStat = await fs.stat(dest); } catch { /* not converted yet */ }
      if (destStat && destStat.mtimeMs >= srcStat.mtimeMs) {
        afterForSource += destStat.size;
        continue;
      }

      let pipeline = sharp(src).webp({ quality: job.quality });
      pipeline = pipeline.resize({
        width: variant.width || undefined,
        height: job.maxHeight || undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
      await pipeline.toFile(dest);

      afterForSource += (await fs.stat(dest)).size;
      processed += 1;
    }

    beforeForSource = srcStat.size;
    totalBefore += beforeForSource;
    totalAfter += afterForSource;

    const saved = beforeForSource ? ((1 - afterForSource / beforeForSource) * 100).toFixed(1) : '0.0';
    rows.push([rel, fmt(beforeForSource), fmt(afterForSource), '-' + saved + '%', processed ? '' : 'cached']);
  }
}

const w = (s, n) => String(s).padEnd(n);
console.log(w('SOURCE', 60) + w('PNG', 12) + w('WEBP(all)', 14) + w('SAVED', 10) + 'NOTE');
for (const r of rows) console.log(w(r[0], 60) + w(r[1], 12) + w(r[2], 14) + w(r[3], 10) + r[4]);
console.log('-'.repeat(96));
console.log(w('TOTAL', 60) + w(fmt(totalBefore), 12) + w(fmt(totalAfter), 14) +
  '-' + ((1 - totalAfter / totalBefore) * 100).toFixed(1) + '%');
console.log(rows.length + ' sources processed (originals kept).');
