// My profile (spec §10, section 2) — the player's personal dashboard: their live
// psi score and ladder, how it has evolved over their sessions, where they rank
// among everyone, their session history, and — at the candidate threshold — the
// opt-in contact form. Tied to the browser-held operator key (D6), no account.

import { directionalZ, psiScore, canonicalize } from '@psimeter/core';
import { el } from '../ui';
import type { Disposer } from '../router';
import {
  fetchSessions, fetchLeaderboard, submitContact,
  type SessionSummary, type PsiScore, type Leaderboard,
} from '../api';
import { getOperatorPubKey, shortId, signMessage } from '../identity';
import { loading, errorBox, fmtZ, fmtOdds, psiBadge, psiLadder, stat } from '../widgets';

const CANDIDATE_POINTS = 30; // 10·log10(1000) — the candidate threshold, in points

export function renderProfile(outlet: HTMLElement): Disposer {
  let disposed = false;
  const body = el('div', { class: 'stack-lg' }, loading());
  const who = el('span', { class: 'mono' }, '…');
  outlet.append(
    el('div', { class: 'page' }, [
      el('div', { class: 'page-head' }, [
        el('span', { class: 'eyebrow' }, 'My profile'),
        el('h1', {}, 'My profile'),
      ]),
      el('p', { class: 'dim' }, [
        'You are ', who, ' — a private key your browser made and keeps. No name, no email, no account. ',
        'Clear your browser and this profile is gone, so keep using the same browser to keep your score.',
      ]),
      body,
    ]),
  );

  void (async () => {
    try {
      const pub = await getOperatorPubKey();
      who.textContent = `${shortId(pub)}…`;
      const [{ sessions, psi }, board] = await Promise.all([
        fetchSessions(pub, 1000),
        fetchLeaderboard().catch(() => null),
      ]);
      if (disposed) return;
      if (!sessions.length || !psi) {
        body.replaceChildren(emptyState());
        return;
      }
      const blocks: HTMLElement[] = [scoreHero(psi), rankCard(psi, board, pub)];
      const trend = trendCard(sessions);
      if (trend) blocks.push(trend);
      if (psi.isCandidate) blocks.push(contactCard(pub));
      blocks.push(historyCard(sessions));
      body.replaceChildren(...blocks);
    } catch (e) {
      if (!disposed) body.replaceChildren(errorBox(e));
    }
  })();

  return () => { disposed = true; };
}

function emptyState(): HTMLElement {
  return el('div', { class: 'card center-card' }, [
    el('div', { class: 'psi-score-num tnum' }, '0'),
    el('p', { class: 'dim' }, 'Your score starts at 0. Play a session to get it moving.'),
    el('a', { class: 'btn primary', href: '/experiments', 'data-link': true }, 'Choose an experiment'),
  ]);
}

function scoreHero(psi: PsiScore): HTMLElement {
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
          stat(psi.sigma > 0 ? `${fmtZ(psi.sigma)}σ` : '—', 'sigma'),
          stat(String(psi.scoredSessions), 'scored sessions'),
        ]),
      ]),
    ]),
    psiLadder(psi),
    el('p', { class: 'faint', style: 'margin:10px 0 0' }, [
      'Your score is honest: under pure luck it stays near 0 no matter how long you play. It only climbs if you move outcomes your way, again and again. A high score flags you to look closer — it isn\'t proof on its own (',
      el('a', { href: '/faq', 'data-link': true }, 'how scoring works'),
      ').',
    ]),
  ]);
}

function rankCard(psi: PsiScore, board: Leaderboard | null, pub: string): HTMLElement {
  let line: (Node | string)[];
  if (psi.scoredSessions === 0) {
    line = ['You\'re not on the board yet — finish a scoring session to join.'];
  } else if (board) {
    const ranked = board.operators.filter((o) => o.psi.scoredSessions > 0);
    const rank = ranked.findIndex((o) => o.operatorPubKey === pub) + 1;
    const total = ranked.length;
    const pct = total > 1 ? Math.round(((total - rank) / (total - 1)) * 100) : 100;
    line = [
      'You rank ', el('b', {}, `#${rank}`), ' of ', el('b', {}, String(total)), ' players',
      total > 1 ? ` — ahead of ${pct}% of them.` : '.',
    ];
  } else {
    line = ['Ranking is unavailable right now.'];
  }
  const toGo = Math.max(0, CANDIDATE_POINTS - psi.points);
  return el('div', { class: 'card rank-card' }, [
    el('div', { class: 'row-between' }, [
      el('p', { style: 'margin:0' }, line),
      el('a', { class: 'btn ghost sm', href: '/leaderboard', 'data-link': true }, 'See the board →'),
    ]),
    el('p', { class: 'faint', style: 'margin:8px 0 0' },
      psi.isCandidate
        ? 'You\'ve reached candidate status — see below.'
        : toGo > 0
          ? `${toGo} more points (and ${Math.max(0, 5 - psi.scoredSessions)} more scoring sessions, minimum) reaches “candidate”.`
          : 'A few more scoring sessions and you reach “candidate”.'),
  ]);
}

// ---- score-over-time chart -------------------------------------------------

function trendCard(sessions: SessionSummary[]): HTMLElement | null {
  // Replay the score chronologically: points after each session played. The
  // psi score is path-independent in value but this shows the journey.
  const chrono = sessions.slice().reverse();
  const dirzs: number[] = [];
  const series: number[] = [];
  for (const s of chrono) {
    const d = directionalZ(s.choice, s.zDisplay);
    if (d !== null) dirzs.push(d);
    series.push(psiScore(dirzs).points);
  }
  if (series.length < 2) return null;
  return el('div', { class: 'card' }, [
    el('h2', { style: 'margin:0 0 2px;font-size:16px' }, 'How your score has moved'),
    el('p', { class: 'faint', style: 'margin:0 0 12px' }, 'Your psi score after each session you\'ve played.'),
    trendChart(series),
  ]);
}

const SVGNS = 'http://www.w3.org/2000/svg';
function svgEl(tag: string, attrs: Record<string, string>, children: (Node | string)[] = []): SVGElement {
  const node = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}

function trendChart(series: number[]): SVGElement {
  const W = 680, H = 150, padL = 30, padR = 10, padT = 12, padB = 20;
  const n = series.length;
  const maxY = Math.max(CANDIDATE_POINTS, ...series);
  const x = (i: number) => padL + (W - padL - padR) * (n <= 1 ? 0 : i / (n - 1));
  const y = (p: number) => padT + (H - padT - padB) * (1 - p / maxY);
  const pts = series.map((p, i) => `${x(i).toFixed(1)},${y(p).toFixed(1)}`);
  const last = series[n - 1]!;
  const candidate = last >= CANDIDATE_POINTS;
  const stroke = candidate ? 'var(--good)' : 'var(--accent)';

  const area = svgEl('polygon', {
    points: `${x(0).toFixed(1)},${y(0).toFixed(1)} ${pts.join(' ')} ${x(n - 1).toFixed(1)},${y(0).toFixed(1)}`,
    fill: stroke, 'fill-opacity': '0.10', stroke: 'none',
  });
  const line = svgEl('polyline', { points: pts.join(' '), fill: 'none', stroke, 'stroke-width': '2', 'stroke-linejoin': 'round' });
  const dot = svgEl('circle', { cx: x(n - 1).toFixed(1), cy: y(last).toFixed(1), r: '3.5', fill: stroke });

  const children: (Node | string)[] = [
    // baseline + candidate-threshold guides
    svgEl('line', { x1: String(padL), y1: y(0).toFixed(1), x2: String(W - padR), y2: y(0).toFixed(1), stroke: 'var(--line)', 'stroke-width': '1' }),
    svgEl('line', { x1: String(padL), y1: y(CANDIDATE_POINTS).toFixed(1), x2: String(W - padR), y2: y(CANDIDATE_POINTS).toFixed(1), stroke: 'var(--good)', 'stroke-width': '1', 'stroke-dasharray': '4 4', 'stroke-opacity': '0.55' }),
    svgEl('text', { x: String(W - padR), y: (y(CANDIDATE_POINTS) - 4).toFixed(1), 'text-anchor': 'end', fill: 'var(--good)', 'font-size': '10' }, ['candidate · 30']),
    svgEl('text', { x: '4', y: (y(0) + 3).toFixed(1), fill: 'var(--text-faint)', 'font-size': '10' }, ['0']),
    svgEl('text', { x: '4', y: (y(maxY) + 8).toFixed(1), fill: 'var(--text-faint)', 'font-size': '10' }, [String(maxY)]),
    area, line, dot,
  ];
  return svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'trend', role: 'img', 'aria-label': 'Score over time' }, children);
}

// ---- candidate contact form ------------------------------------------------

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
        const challenge = canonicalize({ type: 'psi.contact', operatorPubKey: pub, contact: c, message: m });
        const operatorSig = await signMessage(challenge);
        await submitContact({ operatorPubKey: pub, contact: c, message: m, operatorSig });
        status.className = 'good-text';
        status.textContent = 'Sent. Thank you — the researcher may reach out. Your contact was stored privately, never on the public record.';
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
    el('p', { class: 'dim', style: 'margin:8px 0 0' }, [
      'Your score is unusual enough to be worth a serious, separate test. This is a flag, not proof — the real test is a fresh, agreed-in-advance round (',
      el('a', { href: '/guide', 'data-link': true }, 'what that means'),
      '). If you’d like to take part, you can choose to share a way to reach you.',
    ]),
    el('div', { class: 'callout', style: 'margin:14px 0' }, [
      el('strong', {}, 'This breaks your anonymity, on purpose. '),
      'Everything up to here is anonymous. Submitting reveals your chosen contact detail to the researcher (and nobody else). It is stored privately, off the public record, and you can ignore this entirely.',
    ]),
    el('label', { class: 'fld-row' }, [el('span', { class: 'fld-lbl' }, 'Contact'), contact]),
    el('label', { class: 'fld-row' }, [el('span', { class: 'fld-lbl' }, 'Message'), message]),
    el('label', { class: 'consent' }, [consent, el('span', {}, 'I understand this reveals my contact detail to the researcher and breaks my anonymity.')]),
    el('div', { style: 'margin-top:12px' }, btn),
    status,
  ]);
}

// ---- session history -------------------------------------------------------

function historyCard(rows: SessionSummary[]): HTMLElement {
  const wrap = el('div', { class: 'rows' });
  for (const r of rows) {
    wrap.append(
      el('a', { class: 'rowlink', href: `/verify?session=${r.sessionId}`, 'data-link': true }, [
        el('span', { class: 'mono anchorcell' }, r.anchor),
        el('span', { class: 'badge' }, r.choice || '—'),
        el('span', { class: `z ${Math.abs(r.zDisplay ?? 0) > 2 ? 'warn' : ''}` }, fmtZ(r.zDisplay)),
        el('span', { class: 'faint' }, r.sealed ? 'sealed' : 'open'),
        el('span', { class: 'faint nowrap' }, new Date(r.ts).toLocaleDateString()),
        el('span', { class: 'go' }, 'check →'),
      ]),
    );
  }
  return el('div', {}, [
    el('h2', { style: 'margin:0 0 10px;font-size:16px' }, 'Your sessions'),
    wrap,
  ]);
}
