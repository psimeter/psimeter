// The gamified experiment runner (spec §10).
//
// Flow: choose an intention -> POST /api/sessions (server pre-commits, returns
// the anchor) -> sign the pre-commitment with the in-browser key -> open the
// ONE-WAY stream and render live feedback -> seal summary. The ANCHOR is the
// hero of the live view: in ESP protocols it is the operator's concentration
// target, so it is shown large and central with the feedback arranged around it.
// The framing is "beat the game", but underneath it is faithful participation in
// the real, pre-committed experiment.

import { el, fmtInt } from '../ui';
import type { Disposer } from '../router';
import { getOperatorPubKey, signPrecommit } from '../identity';
import {
  createSession,
  submitSignature,
  openStream,
  type CreatedSession,
  type Intention,
  type Seal,
} from '../api';
import { DeviationViz } from '../viz/deviation';

const EXPERIMENT_ID = 'binary-micropk';
const EXPERIMENT_VERSION = 1;

interface IntentionMeta { glyph: string; name: string; tag: string; goal: string; }
const INTENTIONS: Record<Intention, IntentionMeta> = {
  HIGH: { glyph: '▲', name: 'HIGH', tag: 'push it up', goal: 'Hold HIGH in mind — will the stream drift upward?' },
  LOW: { glyph: '▼', name: 'LOW', tag: 'pull it down', goal: 'Hold LOW in mind — will the stream drift downward?' },
  BASELINE: { glyph: '●', name: 'BASELINE', tag: 'just observe', goal: 'A control run — simply watch. No intention to hold.' },
};

export function renderRun(outlet: HTMLElement): Disposer {
  const inner = el('div', { class: 'runner-inner' });
  outlet.append(el('section', { class: 'runner' }, inner));

  let chosen: Intention = 'HIGH';
  let viz: DeviationViz | null = null;
  let closeStream: (() => void) | null = null;
  let timerId: number | undefined;

  function teardown(): void {
    closeStream?.();
    closeStream = null;
    if (timerId !== undefined) { clearInterval(timerId); timerId = undefined; }
    viz?.dispose();
    viz = null;
    document.body.classList.remove('focus');
  }

  function showSetup(error?: string): void {
    teardown();

    const grid = el('div', { class: 'intentions' });
    const buttons = new Map<Intention, HTMLButtonElement>();
    (Object.keys(INTENTIONS) as Intention[]).forEach((key) => {
      const m = INTENTIONS[key];
      const button = el('button', {
        class: key === chosen ? 'sel' : '',
        onclick: () => {
          chosen = key;
          buttons.forEach((b, k) => b.classList.toggle('sel', k === key));
        },
      }, [
        el('span', { class: 'glyph' }, m.glyph),
        el('span', { class: 'name' }, m.name),
        el('span', { class: 'faint', style: 'font-size:11px' }, m.tag),
      ]);
      buttons.set(key, button);
      grid.append(button);
    });

    const startBtn = el('button', { class: 'btn primary lg', style: 'width:100%;margin-top:8px' }, 'Begin session');
    const status = el(
      'p',
      { class: 'fineprint' },
      'A persistent anonymous key in this browser signs this session as yours. Nothing on this page can influence the generator — the feed is one-way.',
    );
    if (error) { status.textContent = error; status.style.color = 'var(--danger)'; }
    startBtn.addEventListener('click', () => { void begin(startBtn, status); });

    inner.replaceChildren(
      el('div', { class: 'setup card' }, [
        el('span', { class: 'eyebrow' }, 'Binary micro-PK'),
        el('h1', {}, 'Can you bias the stream?'),
        el('p', { class: 'sub' },
          'Pick a direction to push a live random stream, then hold it in mind for three minutes. Your choice is committed cryptographically before any randomness exists, so it can never be changed after the fact.'),
        grid,
        startBtn,
        status,
      ]),
    );
  }

  async function begin(startBtn: HTMLButtonElement, status: HTMLElement): Promise<void> {
    startBtn.disabled = true;
    startBtn.textContent = 'Committing…';
    try {
      const operatorPubKey = await getOperatorPubKey();
      const session = await createSession({
        experimentId: EXPERIMENT_ID,
        version: EXPERIMENT_VERSION,
        intention: chosen,
        operatorPubKey,
      });
      startBtn.textContent = 'Signing…';
      const operatorSig = await signPrecommit(session.precommit);
      await submitSignature(session.signPath, operatorSig);
      goLive(session);
    } catch (e) {
      startBtn.disabled = false;
      startBtn.textContent = 'Begin session';
      status.textContent = `Could not start: ${(e as Error).message}`;
      status.style.color = 'var(--danger)';
    }
  }

  function goLive(session: CreatedSession): void {
    document.body.classList.add('focus');
    const meta = INTENTIONS[session.intention];

    const zVal = el('span', { class: 'v tnum' }, '0.00');
    const timeVal = el('span', { class: 'v tnum' }, fmtTime(session.params.sessionSeconds));
    const canvas = el('canvas');
    const anchorStage = el('div', { class: 'anchor-stage' }, [
      el('div', { class: 'anchor-label' }, 'Your focus anchor'),
      renderAnchor(session.anchor),
    ]);

    const sourceBadge = el(
      'span',
      { class: session.entropy.confirmatory ? 'badge good dot' : 'badge warn dot' },
      session.entropy.confirmatory ? `source · ${session.entropy.id}` : `non-confirmatory · ${session.entropy.id}`,
    );

    inner.replaceChildren(
      el('div', { class: 'stage' }, [
        el('div', { class: 'goal' }, meta.goal),
        anchorStage,
        el('div', { class: 'hud' }, [
          hudItem('intention', el('span', { class: 'v' }, meta.name)),
          hudItem('time left', timeVal),
          hudItem('z (display)', zVal),
          el('div', { class: 'item' }, [el('span', { class: 'k' }, 'source'), sourceBadge]),
          el('span', { class: 'live-dot' }, 'live · one-way'),
        ]),
        el('div', { class: 'viz-wrap' }, [
          canvas,
          el('div', { class: 'viz-caption' },
            'Cumulative deviation from a fair coin · ±1.96σ and ±3σ guides · display only'),
        ]),
      ]),
    );

    viz = new DeviationViz(canvas);
    viz.build(session.params);

    closeStream = openStream(session.wsPath, {
      onStarted: (m) => startCountdown(m.sessionSeconds, timeVal),
      onCheckpoint: (c) => {
        viz?.push({ ones: c.ones, total: c.total, zDisplay: c.zDisplay });
        zVal.textContent = c.zDisplay.toFixed(2);
        const anomalous = Math.abs(c.zDisplay) > 2;
        zVal.classList.toggle('warn', anomalous);
        anchorStage.classList.toggle('anomalous', anomalous);
      },
      onSeal: (s) => showSeal(session, s),
      onError: (message) => showSetup(`Stream error: ${message}`),
    });
  }

  function startCountdown(seconds: number, target: HTMLElement): void {
    let remaining = seconds;
    target.textContent = fmtTime(remaining);
    if (timerId !== undefined) clearInterval(timerId);
    timerId = window.setInterval(() => {
      remaining = Math.max(0, remaining - 1);
      target.textContent = fmtTime(remaining);
      if (remaining === 0 && timerId !== undefined) { clearInterval(timerId); timerId = undefined; }
    }, 1000);
  }

  function showSeal(session: CreatedSession, seal: Seal): void {
    teardown();
    const z = displayZ(seal.ones, seal.nSamples);

    const dl = el('dl');
    const rows: Array<[string, string, boolean]> = [
      ['z (display)', z.toFixed(3), true],
      ['anchor', seal.anchor, false],
      ['intention', session.intention, false],
      ['ones / N', `${fmtInt(seal.ones)} / ${fmtInt(seal.nSamples)}`, false],
      ['output commitment', seal.outputCommitment, false],
      ['raw data', seal.rawBlobRef || '—', false],
      ['seal entry', seal.sealEntryHash, false],
    ];
    for (const [k, v, big] of rows) {
      dl.append(el('dt', {}, k), el('dd', { class: big ? 'big' : '' }, v));
    }

    inner.replaceChildren(
      el('div', { class: 'seal card' }, [
        el('span', { class: 'eyebrow' }, 'Sealed'),
        el('h2', {}, 'Session sealed'),
        el('p', { class: 'seal-sub' }, 'This run is now an immutable entry in the hash-chained ledger.'),
        dl,
        el('div', { class: 'callout warn' }, [
          el('strong', {}, 'This is not evidence. '),
          'A deviation this size happens by chance all the time — a single session has essentially no statistical power (spec D4/D13). The real result is the pre-registered aggregate across many sessions and operators. You can verify this exact record yourself by re-running ',
          el('code', {}, 'analysis/analyze.py'),
          ' over the published ledger.',
        ]),
        el('div', { class: 'actions' }, [
          el('button', { class: 'btn primary', onclick: () => showSetup() }, 'Run another'),
          el('a', { class: 'btn ghost', href: '/about', 'data-link': true }, 'How verification works'),
        ]),
      ]),
    );
  }

  showSetup();
  return teardown;
}

function hudItem(label: string, value: Node): HTMLElement {
  return el('div', { class: 'item' }, [el('span', { class: 'k' }, label), value]);
}

function renderAnchor(anchor: string): HTMLElement {
  const wrap = el('div', {
    class: 'anchor',
    title: 'The fingerprint of your pre-commitment — your concentration target',
  });
  anchor.split('-').forEach((group, i) => {
    if (i > 0) wrap.append(el('span', { class: 'sep' }, '-'));
    wrap.append(el('span', { class: 'grp' }, group));
  });
  return wrap;
}

function displayZ(ones: number, n: number): number {
  return n > 0 ? (ones - n / 2) / Math.sqrt(n * 0.25) : 0;
}

function fmtTime(totalSeconds: number): string {
  const mm = Math.floor(totalSeconds / 60);
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
