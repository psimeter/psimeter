// Psi-score leaderboard (spec §10 §3, D15 / H1). The unit is the PERSON, not the
// session: anomalous single sessions are guaranteed by chance (D4), so they prove
// nothing. What is worth surfacing is an operator who beats chance *consistently
// in their declared direction* across many of their own sessions — measured by an
// anytime-valid test martingale (e-value). Honest by construction: candidates are
// flagged for confirmatory replication, never announced as proof.

import { el } from '../ui';
import type { Disposer } from '../router';
import { fetchLeaderboard, type Leaderboard, type OperatorRanking } from '../api';
import { getOperatorPubKey } from '../identity';
import { loading, errorBox, stat, fmtZ, shortKey, fmtOdds, psiBadge } from '../widgets';

export function renderLeaderboard(outlet: HTMLElement): Disposer {
  let disposed = false;
  const body = el('div', { class: 'stack-lg' }, loading());
  outlet.append(
    el('div', { class: 'page' }, [
      el('div', { class: 'page-head' }, [
        el('span', { class: 'eyebrow' }, 'Leaderboard'),
        el('h1', {}, 'Psi-score leaderboard'),
      ]),
      el('p', { class: 'section-lede' }, [
        'A ',
        el('b', {}, 'psi score'),
        ' measures whether a person beats chance ',
        el('i', {}, 'consistently'),
        ', in the direction they declared, across their own sessions — not whether they had one lucky run. ',
        'It is an anytime-valid ',
        el('a', { href: '/faq', 'data-link': true }, 'test-martingale'),
        ' (the “odds against chance” you turned your evidence into), shown in points: every ×10 of evidence is +10 points.',
      ]),
      el('div', { class: 'callout warn' }, [
        el('strong', {}, 'Still not proof — by design. '),
        'Crossing the candidate threshold ',
        el('b', {}, 'flags'),
        ' a person for a separate, pre-registered, fixed-N replication. Across many players, some candidates are expected by chance, which is exactly why a candidate must replicate before anything is claimed (',
        el('a', { href: '/faq', 'data-link': true }, 'why'),
        ').',
      ]),
      body,
    ]),
  );

  void (async () => {
    try {
      const [board, me] = await Promise.all([fetchLeaderboard(), getOperatorPubKey().catch(() => '')]);
      if (!disposed) body.replaceChildren(...render(board, me));
    } catch (e) {
      if (!disposed) body.replaceChildren(errorBox(e));
    }
  })();

  return () => { disposed = true; };
}

function render(board: Leaderboard, me: string): HTMLElement[] {
  const m = board.meta;
  const overview = el('div', { class: 'card' }, [
    el('div', { class: 'stat-row' }, [
      stat(String(m.totalOperators), 'operators'),
      stat(String(m.eligibleOperators), `eligible (≥${m.candidateMinSessions} sessions)`),
      stat(String(m.candidates), 'candidates'),
      stat(`~${m.expectedFalseCandidates.toFixed(2)}`, 'expected by chance'),
    ]),
  ]);

  const ranked = board.operators.filter((o) => o.psi.scoredSessions > 0);
  const list = el('div', { class: 'card' }, [
    el('h2', { style: 'margin:0 0 4px;font-size:16px' }, 'Ranked by consistency'),
    el('p', { class: 'faint', style: 'margin:0 0 12px' },
      'Operators with at least one scoring session, by their test-martingale wealth. The score recomputes from the public ledger — anyone can check it.'),
    ranked.length ? table(ranked, me, m.candidateMinSessions) : el('p', { class: 'dim' }, 'No scoring sessions yet — be the first.'),
  ]);

  return [overview, list];
}

function table(rows: OperatorRanking[], me: string, minSessions: number): HTMLElement {
  const wrap = el('div', { class: 'rows' });
  rows.forEach((r, i) => {
    const isMe = r.operatorPubKey === me;
    const belowFloor = r.psi.scoredSessions < minSessions;
    wrap.append(
      el('div', { class: `psi-row${isMe ? ' me' : ''}` }, [
        el('span', { class: 'rank' }, `#${i + 1}`),
        el('span', { class: 'psi-pts tnum' }, String(r.psi.points)),
        el('div', { class: 'psi-who' }, [
          el('div', { class: 'psi-who-top' }, [
            el('span', { class: 'mono' }, shortKey(r.operatorPubKey)),
            isMe ? el('span', { class: 'you-tag' }, 'you') : null,
          ]),
          el('span', { class: 'faint psi-sub' },
            `${r.psi.scoredSessions} scored • ${fmtOdds(r.psi.wealth)}${belowFloor ? ` • needs ≥${minSessions} to qualify` : ''}`),
        ]),
        el('span', { class: 'z tnum' }, r.psi.sigma > 0 ? `${fmtZ(r.psi.sigma)}σ` : '—'),
        psiBadge(r.psi),
      ]),
    );
  });
  return wrap;
}
