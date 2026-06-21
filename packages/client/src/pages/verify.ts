// In-browser verification view (spec §7.3) — the showcase for "don't trust us".
// Fetches a session's revealed fields and recomputes/verifies them locally with
// @psimeter/core + @noble/ed25519, reporting each check.

import { el } from '../ui';
import type { Disposer } from '../router';
import { fetchSessionDetail, type SessionDetail, type OpenPayload, type SealPayload } from '../api';
import { verifySession, type Check } from '../verify';
import { loading, errorBox, witnessBadge } from '../widgets';

export function renderVerify(outlet: HTMLElement, query: URLSearchParams): Disposer {
  let disposed = false;
  const id = query.get('session') ?? '';
  const page = el('div', { class: 'page' });
  outlet.append(page);

  const head = el('div', { class: 'page-head' }, [
    el('span', { class: 'eyebrow' }, 'Verify'),
    el('h1', {}, 'Verify a session'),
  ]);

  if (!id) {
    page.append(head, el('p', { class: 'dim' }, [
      'Open a session from your ',
      el('a', { href: '/profile', 'data-link': true }, 'profile'),
      ' or the leaderboard to verify it here.',
    ]));
    return () => { disposed = true; };
  }

  const body = el('div', { class: 'stack-lg' }, loading('Fetching and verifying locally…'));
  page.append(head, body);

  void (async () => {
    try {
      const detail = await fetchSessionDetail(id);
      const checks = await verifySession(detail);
      if (disposed) return;
      body.replaceChildren(...render(detail, checks));
    } catch (e) {
      if (!disposed) body.replaceChildren(errorBox(e));
    }
  })();

  return () => { disposed = true; };
}

function render(detail: SessionDetail, checks: Check[]): HTMLElement[] {
  const o = detail.open.payload as OpenPayload;
  const s = detail.seal ? (detail.seal.payload as SealPayload) : null;
  const allOk = checks.every((c) => c.ok);

  const verdict = el('div', { class: `verdict ${allOk ? 'ok' : 'bad'}` }, [
    el('span', { class: 'big-anchor mono' }, o.anchor),
    el('div', {}, [
      el('div', { class: 'verdict-title' }, allOk ? 'Verified in your browser' : 'Verification failed'),
      el('div', { class: 'dim', style: 'font-size:13px' }, allOk
        ? 'Every check below was recomputed locally with @psimeter/core — the server was not trusted for any of it.'
        : 'One or more checks did not match; this record may be inconsistent.'),
      s?.witnessed ? el('div', { style: 'margin-top:8px' }, witnessBadge()) : false,
    ]),
  ]);

  const checklist = el('div', { class: 'checks' }, checks.map((c) =>
    el('div', { class: `check ${c.ok ? 'ok' : 'bad'}` }, [
      el('span', { class: 'ico' }, c.ok ? '✓' : '✗'),
      el('div', {}, [
        el('div', {}, c.label),
        c.note ? el('div', { class: 'faint mono note' }, c.note) : false,
      ]),
    ])));

  const isPrecog = typeof s?.trials === 'number';
  const fields = el('dl', { class: 'kv' });
  const rows: Array<[string, string]> = [
    isPrecog
      ? ['result', s ? `${s.hits} / ${s.trials} hits` : '—']
      : ['intention', o.intention || '—'],
    ['operator', o.operatorPubKey],
    ['beacon', `${o.beacon.source} · round ${o.beacon.round}`],
    ['entropy', `${o.entropySource.id} (${o.entropySource.confirmatory ? 'confirmatory' : 'non-confirmatory'})`],
    ['pre-commitment', o.precommit],
    ['output commitment', s ? s.outputCommitment : '—'],
    ['raw data', s ? s.rawBlobRef : '—'],
  ];
  for (const [k, v] of rows) fields.append(el('dt', {}, k), el('dd', { class: 'mono' }, v));

  const closing = isPrecog
    ? el('p', { class: 'faint' }, 'Every trial above — each choice signed before its target existed, and each target re-derived from the public beacon — was verified here in your browser. Nothing was taken on trust.')
    : el('p', { class: 'faint' }, [
        'The raw-bit Merkle root is checked against the full multi-megabyte raw blob in ',
        el('code', {}, 'analysis/analyze.py'),
        '; everything else was just verified above, in your browser.',
      ]);

  return [
    verdict,
    el('div', { class: 'card' }, [el('h2', { style: 'margin:0 0 12px;font-size:16px' }, 'Checks'), checklist]),
    el('div', { class: 'card' }, [el('h2', { style: 'margin:0 0 12px;font-size:16px' }, 'Revealed fields'), fields]),
    closing,
  ];
}
