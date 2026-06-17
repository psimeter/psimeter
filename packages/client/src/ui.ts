// Tiny hyperscript helper — build DOM without a framework and without
// innerHTML, so the markup is type-checked and free of injection footguns.

export type Child = Node | string | number | false | null | undefined;
export type Children = Child | Child[];

interface Props {
  class?: string;
  dataset?: Record<string, string>;
  [attr: string]: unknown;
}

/** Create an element: `el('a', { href, class }, ['text', child])`. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  children: Children = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = String(v);
    else if (k === 'dataset') Object.assign(node.dataset, v as Record<string, string>);
    else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, String(v));
  }
  append(node, children);
  return node;
}

/** Append one or many children (strings become text nodes). */
export function append(node: HTMLElement, children: Children): void {
  const list = Array.isArray(children) ? children : [children];
  for (const c of list) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Thousands-separated integer for display. */
export function fmtInt(n: number): string {
  return n.toLocaleString('en-US');
}
