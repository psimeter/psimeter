// Leaderboard (spec §10 §3, D15 / H1) — ranks PEOPLE, not sessions. Written for
// the player first: lead with the game (climb by beating chance consistently),
// keep the honesty as a light touch with a link out to the FAQ for the detail.

import { el } from '../ui';
import type { Disposer } from '../router';
import { fetchLeaderboard, type Leaderboard, type OperatorRanking, type SelfRanking } from '../api';
import { getOperatorPubKey } from '../identity';
import { loading, errorBox, stat, shortKey, psiBadge } from '../widgets';

/** Mirrors the server's top-N leaderboard size (readModel.ts LEADERBOARD_SIZE). */
const LEADERBOARD_SHOWN = 25;

export function renderLeaderboard(outlet: HTMLElement): Disposer {
  let disposed = false;
  const body = el('div', { class: 'stack-lg' }, loading());
  outlet.append(
    el('div', { class: 'page' }, [
      el('div', { class: 'page-head' }, [
        el('span', { class: 'eyebrow' }, 'Leaderboard'),
        el('h1', {}, 'Top players'),
      ]),
      el('p', { class: 'section-lede' },
        'Your psi score climbs when you beat chance in the direction you chose — and keep doing it, run after run. One lucky session won\'t move it; consistency will. Everyone starts at 0.'),
      el('p', { class: 'faint', style: 'margin:-12px 0 4px' }, [
        'A top score is a flag worth a closer look, not proof on its own — that takes a careful re-test. ',
        el('a', { href: '/faq', 'data-link': true }, 'How scoring works →'),
      ]),
      body,
    ]),
  );

  void (async () => {
    try {
      const me = await getOperatorPubKey().catch(() => '');
      const board = await fetchLeaderboard(me);
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
      stat(String(m.totalOperators), 'players'),
      stat(String(m.eligibleOperators), `in the running (≥${m.candidateMinSessions} sessions)`),
      stat(String(m.candidates), 'candidates'),
    ]),
  ]);

  const ranked = board.operators.filter((o) => o.psi.scoredSessions > 0);
  const list = el('div', { class: 'card' }, [
    ranked.length
      ? table(ranked, me, m.candidateMinSessions)
      : el('p', { class: 'dim', style: 'margin:0' }, 'No scoring sessions yet — be the first on the board.'),
  ]);

  const blocks = [overview, list];

  // Pin the viewer's own standing when they're not already in the shown top-N (D18),
  // so a player always sees where they stand without any pagination.
  const shown = new Set(board.operators.map((o) => o.operatorPubKey));
  if (board.self && me && !shown.has(me)) {
    blocks.push(el('div', { class: 'card' }, [
      el('span', { class: 'eyebrow' }, 'Your standing'),
      selfRow(board.self, m.candidateMinSessions),
    ]));
  }

  // Honest look-elsewhere note, kept small and friendly (D4/D15).
  if (m.eligibleOperators > 0) {
    blocks.push(el('p', { class: 'faint', style: 'margin:2px 0 0;font-size:12.5px' },
      `With ${m.eligibleOperators} player(s) in the running, you'd expect roughly ${m.expectedFalseCandidates.toFixed(2)} to reach “candidate” by luck alone — which is exactly why candidates get re-tested before anything is claimed.`));
  }
  return blocks;
}

function selfRow(self: SelfRanking, minSessions: number): HTMLElement {
  const r = self.ranking;
  const toGo = Math.max(0, minSessions - r.psi.scoredSessions);
  const sub = self.rank === null
    ? `${r.psi.scoredSessions} session${r.psi.scoredSessions === 1 ? '' : 's'}${toGo > 0 ? ` · ${toGo} more to qualify` : ''}`
    : `${r.psi.scoredSessions} sessions · outside the top ${LEADERBOARD_SHOWN} — keep climbing`;
  return el('div', { class: 'rows' }, [
    el('div', { class: 'psi-row me' }, [
      el('span', { class: 'rank' }, self.rank ? `#${self.rank}` : '—'),
      el('span', { class: 'psi-pts tnum' }, String(r.psi.points)),
      el('div', { class: 'psi-who' }, [
        el('div', { class: 'psi-who-top' }, [
          el('span', { class: 'mono' }, shortKey(r.operatorPubKey)),
          el('span', { class: 'you-tag' }, 'you'),
        ]),
        el('span', { class: 'faint psi-sub' }, sub),
      ]),
      psiBadge(r.psi),
    ]),
  ]);
}

function table(rows: OperatorRanking[], me: string, minSessions: number): HTMLElement {
  const wrap = el('div', { class: 'rows' });
  rows.forEach((r, i) => {
    const isMe = r.operatorPubKey === me;
    const toGo = Math.max(0, minSessions - r.psi.scoredSessions);
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
            `${r.psi.scoredSessions} session${r.psi.scoredSessions === 1 ? '' : 's'}${toGo > 0 ? ` · ${toGo} to qualify` : ''}`),
        ]),
        psiBadge(r.psi),
      ]),
    );
  });
  return wrap;
}
