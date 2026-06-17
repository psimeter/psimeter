// Small shared UI bits for the data pages.

import { el } from './ui';

export function loading(label = 'Loading…'): HTMLElement {
  return el('div', { class: 'loading' }, [el('span', { class: 'spinner' }), label]);
}

export function errorBox(err: unknown): HTMLElement {
  const message = err instanceof Error ? err.message : String(err);
  return el('div', { class: 'callout warn' }, `Couldn’t load: ${message}`);
}

export function stat(value: string, label: string): HTMLElement {
  return el('div', { class: 'stat' }, [
    el('div', { class: 'num tnum' }, value),
    el('div', { class: 'lbl' }, label),
  ]);
}

/** Signed, fixed z for display; em-dash for missing values. */
export function fmtZ(z: number | null): string {
  if (z === null) return '—';
  return (z >= 0 ? '+' : '') + z.toFixed(3);
}

export function shortKey(pubKey: string): string {
  return pubKey.replace(/^ed25519:/, '').slice(0, 10);
}
