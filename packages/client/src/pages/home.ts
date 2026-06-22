// Landing page: the hook. A showy, high-energy pitch that dares a stranger to
// test their mind — wrapped around an honest fine-print line so the claim never
// overreaches (the rigor protects against self-deception). Mounts an ambient
// three.js "network" animation behind the content and tears it down on navigate.

import { el } from '../ui';
import type { Disposer } from '../router';
import { NetworkBackground } from '../viz/network-bg';
import { COMING_SOON } from '../config';

export function renderHome(outlet: HTMLElement): Disposer {
  const canvas = el('canvas', { class: 'home-bg', 'aria-hidden': 'true' });
  const veil = el('div', { class: 'home-veil', 'aria-hidden': 'true' });

  outlet.append(
    el('div', { class: 'home' }, [
      canvas,
      veil,
      el('div', { class: 'page home-page' }, [
        el('section', { class: 'hero' }, [
          el('img', { class: 'hero-logo', src: '/psi_logo.png', alt: 'PsiMeter', width: '512', height: '351' }),
          el('span', { class: 'eyebrow' }, 'Free · anonymous · no sign-up'),
          el('h1', {}, ['Can your mind ', el('span', { class: 'grad' }, 'beat chance'), '?']),
          el('p', { class: 'lede' },
            'PsiMeter is an open platform of experiments built around one old, unsettled question: can a person, by intention alone, influence — or foresee — a genuinely physical random process? The randomness is real (quantum and thermal noise, not a pseudo-random algorithm), and every result is sealed before it exists, so anyone can check it. Pick an experiment and find out.'),
          COMING_SOON
            ? el('div', { class: 'cta-row' }, [
                el('a', { class: 'btn primary lg', href: '/about', 'data-link': true }, 'How it works →'),
                el('a', { class: 'btn lg ghost', href: '/docs', 'data-link': true }, 'Read the docs'),
              ])
            : el('div', { class: 'cta-row' }, [
                el('a', { class: 'btn primary lg', href: '/experiments', 'data-link': true }, 'Pick an experiment →'),
                el('a', { class: 'btn lg ghost', href: '/about', 'data-link': true }, 'How it works'),
              ]),
          el('p', { class: 'hero-note' },
            COMING_SOON
              ? 'The platform is launching soon. The methodology and source are open now — read how it works, then check it yourself.'
              : 'No sign-up. No app. Different experiments, one promise: make your call, then watch the live feed react.'),
          el('p', { class: 'hero-meta' }, [
            el('a', { href: 'https://github.com/psimeter/psimeter', target: '_blank', rel: 'noopener' }, 'GitHub'),
            el('span', { class: 'sep' }, '·'),
            el('a', { href: 'https://opencollective.com/psimeter', target: '_blank', rel: 'noopener' }, 'Open Collective'),
            el('span', { class: 'sep' }, '·'),
            el('a', { href: 'mailto:contact@psimeter.org' }, 'contact@psimeter.org'),
          ]),
        ]),

        el('div', { class: 'pillars' }, [
          pillar('◆', 'Locked before you start',
            'Your call is frozen and cryptographically sealed before a single random bit exists. No takebacks, no fudging — not even by us.'),
          pillar('→', 'It can\'t see you',
            'The generator never reads your screen. The feed is one-way, so there is no back channel to game. The isolation is built in, not promised.'),
          pillar('✓', 'Check it yourself',
            'Every run lands in a public, tamper-evident ledger. Don\'t believe the result? Re-run the math on the raw data and get the same numbers.'),
        ]),

        el('p', {
          class: 'faint',
          style: 'text-align:center;margin:38px auto 0;max-width:64ch;position:relative;z-index:2',
        },
          'One session is not evidence — by pure chance, some runs will look remarkable, and in a large study that\'s expected. The real science is a pre-registered aggregate across many sessions. Your score today is just a score; the data accumulates on its own.'),
      ]),
    ]),
  );

  let bg: NetworkBackground | null = null;
  try {
    bg = new NetworkBackground(canvas);
  } catch {
    // WebGL unavailable — the page is fully usable without the ambient backdrop.
    canvas.remove();
  }

  return () => { bg?.dispose(); bg = null; };
}

function pillar(ico: string, title: string, body: string): HTMLElement {
  return el('div', { class: 'pillar card' }, [
    el('div', { class: 'ico' }, ico),
    el('h3', {}, title),
    el('p', {}, body),
  ]);
}
