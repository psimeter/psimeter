// Landing page: the hook. A showy, high-energy pitch that dares a stranger to
// test their mind — wrapped around an honest fine-print line so the claim never
// overreaches (the rigor protects against self-deception). Mounts an ambient
// three.js "network" animation behind the content and tears it down on navigate.

import { el } from '../ui';
import type { Disposer } from '../router';
import { NetworkBackground } from '../viz/network-bg';

export function renderHome(outlet: HTMLElement): Disposer {
  const canvas = el('canvas', { class: 'home-bg', 'aria-hidden': 'true' });
  const veil = el('div', { class: 'home-veil', 'aria-hidden': 'true' });

  outlet.append(
    el('div', { class: 'home' }, [
      canvas,
      veil,
      el('div', { class: 'page home-page' }, [
        el('section', { class: 'hero' }, [
          el('span', { class: 'eyebrow' }, 'Free · anonymous · ~3 minutes'),
          el('h1', {}, ['Can your mind bend ', el('span', { class: 'grad' }, 'pure randomness'), '?']),
          el('p', { class: 'lede' },
            'Deep inside a chip, a true random source flickers — uncaused, unpredictable, beyond anything physics says you should be able to touch. The challenge: think at it, and see if the numbers flinch.'),
          el('div', { class: 'cta-row' }, [
            el('a', { class: 'btn primary lg', href: '/run', 'data-link': true }, 'Test your mind →'),
            el('a', { class: 'btn lg ghost', href: '/about', 'data-link': true }, 'How is this real?'),
          ]),
          el('p', { class: 'hero-note' },
            'No sign-up. No app. Pick a direction, focus, and watch the live feed react.'),
        ]),

        el('div', { class: 'pillars' }, [
          pillar('◆', 'Locked before you start',
            'Your call is frozen and cryptographically sealed before a single random bit exists. No takebacks, no fudging — not even by us.'),
          pillar('→', 'It can’t see you',
            'The generator never reads your screen. The feed is one-way, so there is no back channel to game. The isolation is built in, not promised.'),
          pillar('✓', 'Check it yourself',
            'Every run lands in a public, tamper-evident ledger. Don’t believe the result? Re-run the math on the raw data and get the same numbers.'),
        ]),

        el('p', {
          class: 'faint',
          style: 'text-align:center;margin:38px auto 0;max-width:64ch;position:relative;z-index:2',
        },
          'Straight talk: one session is a game, never proof — extraordinary streaks happen by luck alone. The actual science lives in a pre-registered aggregate across thousands of people. You’re here to play; the data takes care of itself.'),
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
