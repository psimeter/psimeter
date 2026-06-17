// Your sessions (spec §10, section 2): the visitor's own run history, filtered by
// their browser-held operator key (D6). Each row links to in-browser verification.

import { el } from '../ui';
import type { Disposer } from '../router';
import { fetchSessions, type SessionSummary } from '../api';
import { getOperatorPubKey, shortId } from '../identity';
import { loading, errorBox, fmtZ } from '../widgets';

export function renderHistory(outlet: HTMLElement): Disposer {
  let disposed = false;
  const body = el('div', { class: 'stack-lg' }, loading());
  const who = el('span', { class: 'mono' }, '…');
  outlet.append(
    el('div', { class: 'page' }, [
      el('div', { class: 'page-head' }, [
        el('span', { class: 'eyebrow' }, 'Your history'),
        el('h1', {}, 'Your sessions'),
      ]),
      el('p', { class: 'dim' }, [
        'Tied to your in-browser operator key ',
        who,
        ' — pseudonymous, no account, no personal data (spec D6).',
      ]),
      body,
    ]),
  );

  void (async () => {
    try {
      const pub = await getOperatorPubKey();
      who.textContent = `${shortId(pub)}…`;
      const sessions = await fetchSessions(pub);
      if (disposed) return;
      if (!sessions.length) {
        body.replaceChildren(
          el('div', { class: 'card center-card' }, [
            el('p', { class: 'dim' }, 'No sessions yet on this browser key.'),
            el('a', { class: 'btn primary', href: '/run', 'data-link': true }, 'Run your first session'),
          ]),
        );
        return;
      }
      body.replaceChildren(list(sessions));
    } catch (e) {
      if (!disposed) body.replaceChildren(errorBox(e));
    }
  })();

  return () => { disposed = true; };
}

function list(rows: SessionSummary[]): HTMLElement {
  const wrap = el('div', { class: 'rows' });
  for (const r of rows) {
    wrap.append(
      el('a', { class: 'rowlink', href: `/verify?session=${r.sessionId}`, 'data-link': true }, [
        el('span', { class: 'mono anchorcell' }, r.anchor),
        el('span', { class: 'badge' }, r.intention),
        el('span', { class: `z ${Math.abs(r.zDisplay ?? 0) > 2 ? 'warn' : ''}` }, fmtZ(r.zDisplay)),
        el('span', { class: 'faint' }, r.sealed ? 'sealed' : 'open'),
        el('span', { class: 'faint nowrap' }, new Date(r.ts).toLocaleDateString()),
        el('span', { class: 'go' }, 'verify →'),
      ]),
    );
  }
  return wrap;
}
