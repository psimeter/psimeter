// Your sessions + your psi score (spec §10 §2, D15). Tied to the visitor's
// browser-held operator key (D6) — pseudonymous, no account. The psi score is the
// gamified, anytime-valid measure of whether *you* beat chance consistently; if it
// crosses the candidate threshold, an opt-in form lets you (and only you) choose to
// reach out to the researcher — the single, voluntary break in anonymity.

import { canonicalize } from '@psymeter/core';
import { el } from '../ui';
import type { Disposer } from '../router';
import { fetchSessions, submitContact, type SessionSummary, type PsiScore } from '../api';
import { getOperatorPubKey, shortId, signMessage } from '../identity';
import { loading, errorBox, fmtZ, fmtOdds, psiBadge, psiLadder, stat } from '../widgets';

export function renderHistory(outlet: HTMLElement): Disposer {
  let disposed = false;
  const body = el('div', { class: 'stack-lg' }, loading());
  const who = el('span', { class: 'mono' }, '…');
  outlet.append(
    el('div', { class: 'page' }, [
      el('div', { class: 'page-head' }, [
        el('span', { class: 'eyebrow' }, 'Your history'),
        el('h1', {}, 'Your sessions & psi score'),
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
      const { sessions, psi } = await fetchSessions(pub);
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
      const blocks: HTMLElement[] = [];
      if (psi) blocks.push(psiPanel(psi));
      if (psi?.isCandidate) blocks.push(contactCard(pub));
      blocks.push(list(sessions));
      body.replaceChildren(...blocks);
    } catch (e) {
      if (!disposed) body.replaceChildren(errorBox(e));
    }
  })();

  return () => { disposed = true; };
}

function psiPanel(psi: PsiScore): HTMLElement {
  return el('div', { class: 'card psi-panel' }, [
    el('div', { class: 'psi-head' }, [
      el('div', {}, [
        el('div', { class: 'psi-score-num tnum' }, String(psi.points)),
        el('div', { class: 'lbl' }, 'psi score'),
      ]),
      el('div', { class: 'psi-meta' }, [
        psiBadge(psi),
        el('div', { class: 'stat-row tight' }, [
          stat(fmtOdds(psi.wealth), 'odds vs chance'),
          stat(psi.sigma > 0 ? `${fmtZ(psi.sigma)}σ` : '—', 'sigma-equivalent'),
          stat(String(psi.scoredSessions), 'scored sessions'),
        ]),
      ]),
    ]),
    psiLadder(psi),
    el('p', { class: 'faint', style: 'margin:10px 0 0' },
      'Anytime-valid (you may stop whenever): under pure chance this score stays near 0 no matter how many sessions you run. It only climbs if you move outcomes your way, repeatedly. Screening only — not proof (D15).'),
  ]);
}

function contactCard(pub: string): HTMLElement {
  const contact = el('input', { type: 'text', class: 'fld', maxlength: '300', placeholder: 'email or handle' }) as HTMLInputElement;
  const message = el('textarea', { class: 'fld', maxlength: '2000', rows: '3', placeholder: '(optional) anything you want to tell the researcher' }) as HTMLTextAreaElement;
  const consent = el('input', { type: 'checkbox' }) as HTMLInputElement;
  const status = el('p', { class: 'faint', style: 'margin:8px 0 0' });
  const btn = el('button', { class: 'btn primary', type: 'button' }, 'Send to the researcher') as HTMLButtonElement;

  const sync = (): void => { btn.disabled = !(consent.checked && contact.value.trim().length > 0); };
  sync();
  consent.addEventListener('change', sync);
  contact.addEventListener('input', sync);

  btn.addEventListener('click', () => {
    void (async () => {
      btn.disabled = true;
      status.className = 'faint';
      status.textContent = 'Signing & sending…';
      try {
        const c = contact.value.trim();
        const m = message.value.trim();
        // Sign the SAME canonical challenge the server rebuilds — proves this
        // browser holds the operator key whose public score earned eligibility.
        const challenge = canonicalize({ type: 'psi.contact', operatorPubKey: pub, contact: c, message: m });
        const operatorSig = await signMessage(challenge);
        await submitContact({ operatorPubKey: pub, contact: c, message: m, operatorSig });
        status.className = 'good-text';
        status.textContent = 'Sent. Thank you — the researcher may reach out. Your contact detail was stored privately, never on the public ledger.';
        contact.disabled = message.disabled = consent.disabled = true;
      } catch (e) {
        status.className = 'danger-text';
        status.textContent = e instanceof Error ? e.message : String(e);
        sync();
      }
    })();
  });

  return el('div', { class: 'card psi-candidate' }, [
    el('div', { class: 'psi-candidate-head' }, [
      el('span', { class: 'psi-badge tier-4 candidate' }, 'Candidate ★'),
      el('h2', { style: 'margin:8px 0 0;font-size:18px' }, 'You’ve been flagged as a candidate'),
    ]),
    el('p', { class: 'dim', style: 'margin:8px 0 0' },
      'Your psi score crossed the threshold. This is a screening flag, not proof — the next step is a separate, pre-registered replication. If you’d like to be part of that, you can voluntarily share a way to reach you.'),
    el('div', { class: 'callout', style: 'margin:14px 0' }, [
      el('strong', {}, 'This breaks your anonymity, on purpose. '),
      'Everything up to here is pseudonymous. Submitting reveals your chosen contact detail to the researcher (and nobody else). It is stored privately, off the public ledger, and you can ignore this entirely.',
    ]),
    el('label', { class: 'fld-row' }, [el('span', { class: 'fld-lbl' }, 'Contact'), contact]),
    el('label', { class: 'fld-row' }, [el('span', { class: 'fld-lbl' }, 'Message'), message]),
    el('label', { class: 'consent' }, [consent, el('span', {}, 'I understand this reveals my contact detail to the researcher and breaks my anonymity.')]),
    el('div', { style: 'margin-top:12px' }, btn),
    status,
  ]);
}

function list(rows: SessionSummary[]): HTMLElement {
  const wrap = el('div', { class: 'rows' });
  for (const r of rows) {
    wrap.append(
      el('a', { class: 'rowlink', href: `/verify?session=${r.sessionId}`, 'data-link': true }, [
        el('span', { class: 'mono anchorcell' }, r.anchor),
        el('span', { class: 'badge' }, r.choice || '—'),
        el('span', { class: `z ${Math.abs(r.zDisplay ?? 0) > 2 ? 'warn' : ''}` }, fmtZ(r.zDisplay)),
        el('span', { class: 'faint' }, r.sealed ? 'sealed' : 'open'),
        el('span', { class: 'faint nowrap' }, new Date(r.ts).toLocaleDateString()),
        el('span', { class: 'go' }, 'verify →'),
      ]),
    );
  }
  return wrap;
}
