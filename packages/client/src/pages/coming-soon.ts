// "Launching soon" page for the public static build (VITE_COMING_SOON). Shown
// in place of the server-backed routes (live runs, leaderboard, profile,
// verify) before the platform goes live. It keeps the visitor oriented:
// what's coming, and what they can do right now (read the white paper and the
// docs, read the code).

import { el } from '../ui';

export function renderComingSoon(outlet: HTMLElement): void {
  outlet.append(
    el('div', { class: 'page prose narrow' }, [
      el('section', { class: 'soon-hero' }, [
        el('span', { class: 'eyebrow' }, 'Launching soon'),
        el('h1', {}, 'This part isn’t live yet'),
        el('p', { class: 'lede' },
          'The PsiMeter platform is still being built. Running live experiments, the leaderboard, your profile, and in-browser verification all need the server, which isn’t open to the public yet. The science and the cryptographic core are finished — and the methodology is written up in full in the white paper below.'),
        el('div', { class: 'cta-row' }, [
          el('a', {
            class: 'btn primary lg',
            href: '/psimeter-whitepaper.pdf',
            target: '_blank',
            rel: 'noopener',
          }, 'Read the white paper (PDF)'),
          el('a', { class: 'btn lg ghost', href: '/about', 'data-link': true }, 'How it works'),
          el('a', { class: 'btn lg ghost', href: '/docs', 'data-link': true }, 'Read the docs'),
        ]),
      ]),
      el('div', { class: 'pillars' }, [
        card('Read the white paper',
          'A rigorous methodology paper covering the threat model, the cryptographic protocol, the statistics, and the verification procedure — written for scientists, in standard two-column form. Download the PDF.',
          '/psimeter-whitepaper.pdf'),
        card('Read the methodology',
          'The full how-it-works walkthrough and the documentation wiki are available now — pre-commitment, the anchor, the beacon, the ledger, and the verification procedure, all in plain language.',
          '/docs'),
        card('Read the source',
          'The protocol specification, the cryptographic core, and the independent Python verifier are open source and complete. Nothing about the result depends on trusting us.',
          'https://github.com/psimeter/psimeter'),
        card('Help fund it',
          'PsiMeter runs on no budget and is independently fundable. Support on Open Collective brings credible, open-hardware entropy and the public launch closer.',
          'https://opencollective.com/psimeter'),
      ]),
      el('p', {
        class: 'faint',
        style: 'text-align:center;margin:36px auto 0;max-width:60ch',
      }, 'Want to know when it goes live? Email contact@psimeter.org.'),
    ]),
  );
}

function card(title: string, body: string, href: string): HTMLElement {
  const isFile = /\.pdf$/i.test(href);
  const internal = href.startsWith('/') && !isFile;
  const attrs = {
    class: 'pillar card soon-card',
    href,
    ...(internal ? { 'data-link': true } : {}),
    ...(isFile ? { target: '_blank', rel: 'noopener' } : {}),
  };
  return el('a', attrs, [
    el('h3', {}, title),
    el('p', {}, body),
  ]);
}
