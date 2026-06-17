// Post-build: add Subresource Integrity (SRI) to the emitted index.html.
//
// Pins each bundled asset (JS/CSS) by its sha384 digest, so a browser will
// refuse to run a script or apply a stylesheet whose bytes don't match — turning
// the build into a tamper-evident artifact and closing the last CDN/supply-chain
// gap from spec §7.6. Zero dependencies: just Node's crypto over the build output.
//
// Runs from the client package dir (npm --workspace ... runs there), so the build
// output is ./dist.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const indexPath = resolve(dist, 'index.html');

if (!existsSync(indexPath)) {
  console.error('sri: dist/index.html not found — run `vite build` first');
  process.exit(1);
}

let count = 0;
const html = readFileSync(indexPath, 'utf8').replace(/<(script|link)\b([^>]*)>/g, (full, tag, attrs) => {
  const ref = attrs.match(/\b(?:src|href)="(\/[^"]+\.(?:js|css))"/);
  if (!ref || /\bintegrity=/.test(attrs)) return full;
  const assetPath = resolve(dist, '.' + ref[1]);
  if (!existsSync(assetPath)) return full;

  const digest = createHash('sha384').update(readFileSync(assetPath)).digest('base64');
  const integrity = ` integrity="sha384-${digest}"`;
  const crossorigin = /\bcrossorigin\b/.test(attrs) ? '' : ' crossorigin="anonymous"';
  count += 1;
  return `<${tag}${attrs}${integrity}${crossorigin}>`;
});

writeFileSync(indexPath, html);
console.log(`sri: pinned ${count} asset reference(s) with sha384 integrity in dist/index.html`);
