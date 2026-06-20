// App chrome: header (brand + nav + identity chip) and footer. Pages render into
// `outlet`. During a live session the runner adds `body.focus`, which hides the
// chrome so the anchor owns the screen.

import { el } from './ui';
import { getOperatorPubKey, shortId } from './identity';

export interface Shell {
  root: HTMLElement;
  outlet: HTMLElement;
  setActive(path: string): void;
}

const NAV: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/run', label: 'Run a session' },
  { href: '/experiments', label: 'Experiments' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/about', label: 'How it works' },
  { href: '/faq', label: 'FAQ' },
];

export function buildShell(): Shell {
  const navLinks = NAV.map((n) =>
    el('a', { href: n.href, 'data-link': true, 'data-path': n.href }, n.label),
  );

  const chip = el(
    'a',
    {
      class: 'identity-chip',
      href: '/history',
      'data-link': true,
      title: 'Your sessions — tied to this browser key, kept only here (spec D6)',
    },
    '…',
  );

  const header = el('header', { class: 'site-header' }, [
    el('a', { href: '/', 'data-link': true, class: 'brand' }, [
      el('span', { class: 'brand-mark' }),
      el('span', { class: 'brand-name' }, 'PsyMeter'),
    ]),
    el('nav', { class: 'nav' }, navLinks),
    chip,
  ]);

  const outlet = el('main', { class: 'site-main' });

  const footer = el('footer', { class: 'site-footer' }, [
    el('span', {}, 'Open source · the experimenter is untrusted by design'),
    el('span', { class: 'sep' }, '·'),
    el('a', { href: '/about', 'data-link': true }, 'How verification works'),
    el('span', { class: 'sep' }, '·'),
    el('span', { class: 'faint' }, 'A single session is never evidence (D4/D13)'),
  ]);

  const root = el('div', { class: 'site' }, [header, outlet, footer]);

  // Fill the identity chip once the key is derived (async WebCrypto).
  void getOperatorPubKey()
    .then((pub) => { chip.textContent = `${shortId(pub)}…`; })
    .catch(() => { chip.textContent = 'key error'; });

  function setActive(path: string): void {
    for (const a of navLinks) {
      a.classList.toggle('active', a.getAttribute('data-path') === path);
    }
    chip.classList.toggle('active', path === '/history');
  }

  return { root, outlet, setActive };
}
