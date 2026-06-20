// One-time seeding helper for the presentiment stimulus corpus (spec §7.5).
//
// Pulls a small set of CC0 / public-domain images per emotional category from the
// Openverse API into stimuli/<category>/, and records attributions in
// stimuli/CREDITS.md. This is a CONVENIENCE for seeding a starter set — the owner
// is expected to review the images and can drop in their own. After fetching (or
// changing) images, run scripts/build-stimuli.mjs to hash them into the
// content-addressed experiment definition.
//
//   node scripts/fetch-stimuli.mjs
//
// Categories map to the experiment's valence vocabulary: `calm` (positive/soothing)
// vs `aversive` (safe-but-unpleasant — no graphic content). Queries are deliberately
// low-risk; still, REVIEW the downloaded set before relying on it.

import { mkdirSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'Mozilla/5.0 PsyMeter/0.1 (open-source psi research)';
const PER_CATEGORY = 10;

const PLAN = {
  calm: ['puppy', 'kitten', 'baby smiling', 'calm landscape', 'flower meadow'],
  aversive: ['spider closeup', 'snake', 'angry face', 'cockroach', 'wasp'],
};

async function openverse(query) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license=cc0,pdm&page_size=8&mature=false`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`openverse ${query}: HTTP ${res.status}`);
  return (await res.json()).results ?? [];
}

function looksLikeImage(buf) {
  return (buf[0] === 0xff && buf[1] === 0xd8) || // JPEG
    (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47); // PNG
}

async function download(u) {
  const res = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(25000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length < 2048 || !looksLikeImage(buf)) throw new Error('not a usable image');
  return buf;
}

const credits = ['# Stimulus corpus credits', '', 'All images CC0 / public domain via the Openverse API. Review before relying on them.', ''];

for (const [category, queries] of Object.entries(PLAN)) {
  const dir = resolve(ROOT, 'stimuli', category);
  mkdirSync(dir, { recursive: true });
  let have = readdirSync(dir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f)).length;
  credits.push(`## ${category}`, '');
  for (const q of queries) {
    if (have >= PER_CATEGORY) break;
    let results;
    try { results = await openverse(q); } catch (e) { console.warn(`skip "${q}": ${e.message}`); continue; }
    for (const r of results) {
      if (have >= PER_CATEGORY) break;
      const ext = (r.url.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z]/g, '').slice(0, 4) || 'jpg';
      const name = `${q.replace(/\s+/g, '-')}-${have + 1}.${ext === 'jpeg' ? 'jpg' : ext}`;
      const path = resolve(dir, name);
      if (existsSync(path)) continue;
      try {
        const buf = await download(r.url);
        writeFileSync(path, buf);
        have += 1;
        credits.push(`- \`${category}/${name}\` — ${r.license.toUpperCase()} — source: ${r.foreign_landing_url || r.url}${r.creator ? ` — by ${r.creator}` : ''}`);
        console.log(`saved ${category}/${name}`);
      } catch (e) { console.warn(`  drop ${r.url}: ${e.message}`); }
    }
  }
  credits.push('');
}

writeFileSync(resolve(ROOT, 'stimuli', 'CREDITS.md'), credits.join('\n'));
console.log('done — review images, then run scripts/build-stimuli.mjs');
