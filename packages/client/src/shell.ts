// App chrome: header (brand + nav + identity chip) and footer. Pages render into
// `outlet`. During a live session the runner adds `body.focus`, which hides the
// chrome so the anchor owns the screen.

import { el } from './ui';
import { getOperatorPubKey, shortId } from './identity';
import { fetchPsi } from './api';
import { COMING_SOON } from './config';

export interface Shell {
  root: HTMLElement;
  outlet: HTMLElement;
  setActive(path: string): void;
}

const NAV_FULL: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/experiments', label: 'Experiments' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/about', label: 'How it works' },
  { href: '/docs', label: 'Docs' },
  { href: '/faq', label: 'FAQ' },
];

// The public "coming soon" build hides the server-backed sections, leaving the
// how-it-works and documentation pages that work without a backend.
const NAV_SOON: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/about', label: 'How it works' },
  { href: '/docs', label: 'Docs' },
  { href: '/faq', label: 'FAQ' },
];

const NAV = COMING_SOON ? NAV_SOON : NAV_FULL;

export function buildShell(): Shell {
  const navLinks = NAV.map((n) =>
    el('a', { href: n.href, 'data-link': true, 'data-path': n.href }, n.label),
  );

  // Live build: the identity chip is the always-visible score and the link to
  // the player's profile. Coming-soon build: there's no live score or profile,
  // so it becomes a simple "launching soon" badge.
  const chip = COMING_SOON
    ? el('span', { class: 'soon-badge', title: 'The interactive platform is not live yet' }, 'Launching soon')
    : buildIdentityChip();

  const header = el('header', { class: 'site-header' }, [
    el('a', { href: '/', 'data-link': true, class: 'brand' }, [
      el('img', { class: 'brand-logo', src: '/psi_logo.png', alt: '', width: '28', height: '19' }),
      el('span', { class: 'brand-name' }, 'PsiMeter'),
    ]),
    el('nav', { class: 'nav' }, navLinks),
    chip,
  ]);

  const outlet = el('main', { class: 'site-main' });

  const footer = el('footer', { class: 'site-footer' }, [
    el('div', { class: 'footer-links' }, [
      el('a', { href: '/about', 'data-link': true }, 'How it works'),
      el('a', { href: '/docs', 'data-link': true }, 'Docs'),
      el('a', { href: '/faq', 'data-link': true }, 'FAQ'),
      el('a', { href: 'https://github.com/psimeter/psimeter', target: '_blank', rel: 'noopener' }, 'GitHub'),
      el('a', { href: 'https://opencollective.com/psimeter', target: '_blank', rel: 'noopener' }, 'Open Collective'),
      el('a', { href: 'mailto:contact@psimeter.org' }, 'contact@psimeter.org'),
    ]),
    el('div', { class: 'footer-note' }, [
      el('span', {}, 'Open source · the experimenter is untrusted by design · a single session is never evidence'),
      el('span', { class: 'sep' }, '·'),
      el('span', { class: 'faint' }, 'MIT / CC BY 4.0'),
    ]),
  ]);

  const root = el('div', { class: 'site' }, [header, outlet, footer]);

  function setActive(path: string): void {
    for (const a of navLinks) {
      const target = a.getAttribute('data-path');
      // The Docs link owns the whole /docs/* subtree; others match exactly.
      const isActive = target === '/docs' ? path.startsWith('/docs') : target === path;
      a.classList.toggle('active', isActive);
    }
    chip.classList.toggle('active', path === '/profile' || path === '/history');
  }

  return { root, outlet, setActive };
}

// The identity chip (live build): the always-visible psi score plus a link to
// the player's profile. The score fills in once the in-browser key is derived
// (async WebCrypto) and the live score loads.
function buildIdentityChip(): HTMLElement {
  const scoreBadge = el('span', { class: 'chip-score tier-0' }, 'ψ –');
  const chipId = el('span', { class: 'chip-id' }, '…');
  const chip = el(
    'a',
    {
      class: 'identity-chip',
      href: '/profile',
      'data-link': true,
      title: 'Your profile — score, history, and ranking, tied to this browser key',
    },
    [scoreBadge, chipId],
  );

  void getOperatorPubKey()
    .then(async (pub) => {
      chipId.textContent = `${shortId(pub)}…`;
      try {
        const psi = await fetchPsi(pub);
        scoreBadge.textContent = `ψ ${psi.points}`;
        scoreBadge.className = `chip-score tier-${psi.tier}`;
        if (psi.isCandidate) scoreBadge.classList.add('candidate');
      } catch { /* score is best-effort; the chip still links to the profile */ }
    })
    .catch(() => { chipId.textContent = 'key error'; });

  return chip;
}
