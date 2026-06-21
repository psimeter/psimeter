// Small prose helpers so the content chapters read like prose, not DOM plumbing.
// Everything goes through the `el()` hyperscript helper, so the wiki keeps the
// project's no-innerHTML, type-checked, injection-free markup convention.

import { el } from '../../ui';
import type { Child } from '../../ui';

/** Section heading with an `id` so deep links (e.g. /docs/crypto#merkle) work. */
export function h2(id: string, ...text: Child[]): HTMLElement {
  return el('h2', { id }, text);
}
export function h3(...text: Child[]): HTMLElement {
  return el('h3', {}, text);
}
export function p(...kids: Child[]): HTMLElement {
  return el('p', {}, kids);
}
export function lead(...kids: Child[]): HTMLElement {
  return el('p', { class: 'lede' }, kids);
}
export function b(...kids: Child[]): HTMLElement {
  return el('strong', {}, kids);
}
export function em(...kids: Child[]): HTMLElement {
  return el('em', {}, kids);
}
export function code(t: string): HTMLElement {
  return el('code', {}, t);
}
/** Fenced code/command block. */
export function pre(t: string): HTMLElement {
  return el('pre', { class: 'codeblock' }, el('code', {}, t));
}
/** Bulleted list; each item is an array of inline children. */
export function ul(items: Child[][]): HTMLElement {
  return el('ul', {}, items.map((i) => el('li', {}, i)));
}
/** Numbered list; each item is an array of inline children. */
export function ol(items: Child[][]): HTMLElement {
  return el('ol', {}, items.map((i) => el('li', {}, i)));
}
/** External link — opens in a new tab, no referrer/opener leak. */
export function ext(href: string, text: string): HTMLElement {
  return el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);
}
/** Internal SPA link (router intercepts `data-link`). */
export function link(href: string, ...kids: Child[]): HTMLElement {
  return el('a', { href, 'data-link': true }, kids);
}
/** Accent callout box. */
export function callout(...kids: Child[]): HTMLElement {
  return el('div', { class: 'callout' }, kids);
}
/** Amber "watch out" callout box. */
export function warn(...kids: Child[]): HTMLElement {
  return el('div', { class: 'callout warn' }, kids);
}
/** A definition row used in the glossary / key-value tables. */
export function defs(rows: [Child, Child[]][]): HTMLElement {
  return el('dl', { class: 'guarantees' }, rows.flatMap(([term, body]) => [
    el('dt', {}, term),
    el('dd', {}, body),
  ]));
}
