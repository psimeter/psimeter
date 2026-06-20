// Hash the presentiment stimulus corpus into the content-addressed experiment
// definition (spec §7.5, D13/D14).
//
// Scans stimuli/<valence>/ for image files, computes each file's SHA-256, and
// writes the `stimuli` manifest into experiments/precognition-presentiment-v1.json
// as { calm: [{path, sha256}], aversive: [{path, sha256}] } (sorted for
// determinism). Because the manifest is part of the definition, the definition's
// content hash — bound into every session's pre-commitment — pins the EXACT pixels
// of every possible stimulus. A skeptic re-derives which image a trial showed from
// the future beacon and confirms its bytes against this manifest.
//
// Run this after adding/removing/replacing images. Any change yields a new
// definition hash (D13): bump `version` before collecting confirmatory data.
//
//   node scripts/build-stimuli.mjs

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEF = resolve(ROOT, 'experiments/precognition-presentiment-v1.json');
const VALENCES = ['calm', 'aversive'];
const IMG = /\.(jpe?g|png|webp)$/i;

function poolFor(valence) {
  const dir = resolve(ROOT, 'stimuli', valence);
  return readdirSync(dir)
    .filter((f) => IMG.test(f))
    .sort() // deterministic order — the beacon indexes into THIS order
    .map((name) => {
      const bytes = readFileSync(resolve(dir, name));
      return { path: `stimuli/${valence}/${name}`, sha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}` };
    });
}

const def = JSON.parse(readFileSync(DEF, 'utf8'));
def.stimuli = Object.fromEntries(VALENCES.map((v) => [v, poolFor(v)]));

for (const v of VALENCES) {
  if (def.stimuli[v].length === 0) throw new Error(`no images in stimuli/${v}/ — add some before building`);
}
if (def.choices.join(',') !== VALENCES.join(',')) {
  throw new Error(`def.choices ${JSON.stringify(def.choices)} must match valences ${JSON.stringify(VALENCES)}`);
}

writeFileSync(DEF, JSON.stringify(def, null, 2) + '\n');
console.log(`wrote ${DEF}`);
for (const v of VALENCES) console.log(`  ${v}: ${def.stimuli[v].length} images`);
