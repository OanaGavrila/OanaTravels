/* One-shot / re-runnable image optimizer.
   Converts PNG sources to WebP next to the original (originals are kept).
   Usage: npm run optimize
   Skips outputs that are already newer than their source. */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KB = 1024;

/* name, maxWidth (null = only quality), quality */
const JOBS = [
  { dir: 'assets/posters', recursive: true, maxWidth: 960, quality: 80 },
  { files: ['assets/images/hero-center.png'], maxWidth: 1920, quality: 80 },
  { files: ['assets/images/hero-left.png', 'assets/images/hero-right.png'], maxWidth: 1280, quality: 80 },
  { files: ['assets/images/about-me.png'], maxWidth: 1200, quality: 80 },
  { files: ['assets/images/logo.png'], maxWidth: 208, maxHeight: 208, quality: 90 },
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
    const dest = src.replace(/\.png$/i, '.webp');

    let srcStat, destStat = null;
    try { srcStat = await fs.stat(src); } catch { continue; }
    try { destStat = await fs.stat(dest); } catch { /* not converted yet */ }
    if (destStat && destStat.mtimeMs >= srcStat.mtimeMs) {
      totalBefore += srcStat.size;
      totalAfter += destStat.size;
      rows.push([rel, fmt(srcStat.size), fmt(destStat.size), 'cached']);
      continue;
    }

    let pipeline = sharp(src).webp({ quality: job.quality });
    if (job.maxWidth || job.maxHeight) {
      pipeline = pipeline.resize({
        width: job.maxWidth || undefined,
        height: job.maxHeight || undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }
    await pipeline.toFile(dest);

    const after = (await fs.stat(dest)).size;
    totalBefore += srcStat.size;
    totalAfter += after;
    const saved = ((1 - after / srcStat.size) * 100).toFixed(1);
    rows.push([rel, fmt(srcStat.size), fmt(after), '-' + saved + '%']);
  }
}

const w = (s, n) => String(s).padEnd(n);
console.log(w('SOURCE', 60) + w('PNG', 12) + w('WEBP', 12) + 'SAVED');
for (const r of rows) console.log(w(r[0], 60) + w(r[1], 12) + w(r[2], 12) + r[3]);
console.log('-'.repeat(84));
console.log(w('TOTAL', 60) + w(fmt(totalBefore), 12) + w(fmt(totalAfter), 12) +
  '-' + ((1 - totalAfter / totalBefore) * 100).toFixed(1) + '%');
console.log(rows.length + ' images processed (originals kept).');
