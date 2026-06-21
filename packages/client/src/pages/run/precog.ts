// The presentiment (forced-choice precognition) runner (spec §7.5, §10).
//
// Hypothesis: some people feel an event's emotional valence *before* it happens.
// Each trial the operator is DESTINED (by a future beacon round, so it doesn't
// exist yet) to be shown either a calming or an aversive image. They try to feel
// which is coming, lock + sign their guess, and then the REAL image actually
// appears and hits them. A hit is anticipating the valence that then lands. We
// look for individuals who beat chance consistently (H1) — never one session.
//
// Two-way socket, but sound: the image is bound to a beacon round nobody can
// predict at choice time, so there is no channel to game.

import { el } from '../../ui';
import type { Disposer } from '../../router';
import { getOperatorPubKey, signPrecommit } from '../../identity';
import { witnessBadge } from '../../widgets';
import { trialCommit, hitRateZ } from '@psimeter/core';
import {
  createSession,
  submitSignature,
  openPrecogStream,
  type ExperimentInfo,
  type PrecogSocket,
  type PrecogReveal,
  type PrecogSeal,
} from '../../api';

// Display metadata for the two valence predictions (the buttons). The actual
// emotional payload is the revealed photo, not these labels.
const VALENCE_META: Record<string, { label: string; glyph: string; color: string }> = {
  calm: { label: 'Calm', glyph: '🌿', color: '#2fae8f' },
  aversive: { label: 'Unease', glyph: '⚠', color: '#e5484d' },
};

export function renderPrecogRunner(outlet: HTMLElement, info: ExperimentInfo): Disposer {
  const inner = el('div', { class: 'runner-inner' });
  outlet.append(el('section', { class: 'runner' }, inner));

  const consentKey = `psimeter.consent.${info.id}`;
  const revealHoldMs = Number((info.params as Record<string, number>).revealHoldMs ?? 4000);
  let socket: PrecogSocket | null = null;
  let pubKey = '';
  let sessionId = '';
  let currentChoice: string | null = null;
  let trialsPerSession = Number((info.params as Record<string, number>).trialsPerSession ?? 0);
  let revealUntil = 0;
  let revealTimer: number | undefined;
  let witnessed = false;

  function teardown(): void {
    socket?.close();
    socket = null;
    if (revealTimer !== undefined) { clearTimeout(revealTimer); revealTimer = undefined; }
    document.body.classList.remove('focus');
  }

  // Show the content-warning consent gate once (spec §10 safeguard), then setup.
  function start(): void {
    if (info.contentWarning && localStorage.getItem(consentKey) !== 'yes') { showGate(); return; }
    showSetup();
  }

  function showGate(): void {
    teardown();
    inner.replaceChildren(
      el('div', { class: 'setup card consent' }, [
        el('span', { class: 'eyebrow' }, 'Before you start'),
        el('h1', {}, 'Heads up'),
        el('p', { class: 'sub' }, info.contentWarning ?? ''),
        el('div', { class: 'actions' }, [
          el('button', { class: 'btn primary', onclick: () => { localStorage.setItem(consentKey, 'yes'); showSetup(); } }, 'I’m 18+ — continue'),
          el('a', { class: 'btn ghost', href: '/experiments', 'data-link': true }, 'Not now'),
        ]),
      ]),
    );
  }

  function showSetup(error?: string): void {
    teardown();
    const startBtn = el('button', { class: 'btn primary lg', style: 'width:100%;margin-top:8px' }, 'Begin session');
    const status = el('p', { class: 'fineprint' },
      'Each round, before the image exists, choose the feeling you sense is coming. Your choice is signed and locked to a future public-randomness beacon, so it can never be back-fitted — then the real image appears.');
    if (error) { status.textContent = error; status.style.color = 'var(--danger)'; }
    startBtn.addEventListener('click', () => { void begin(startBtn, status); });

    inner.replaceChildren(
      el('div', { class: 'setup card' }, [
        el('span', { class: 'eyebrow' }, info.title),
        el('h1', {}, 'Can you feel what’s coming?'),
        el('p', { class: 'sub' },
          `${trialsPerSession} quick trials. Each one, sense whether a soothing or an unsettling image is about to appear, lock it in, then see what actually lands.`),
        el('div', { class: 'option-preview' }, info.choices.map(optionChip)),
        startBtn,
        status,
      ]),
    );
  }

  async function begin(startBtn: HTMLButtonElement, status: HTMLElement): Promise<void> {
    startBtn.disabled = true;
    startBtn.textContent = 'Committing…';
    try {
      pubKey = await getOperatorPubKey();
      const session = await createSession({ experimentId: info.id, version: info.version, intention: '', operatorPubKey: pubKey });
      sessionId = session.sessionId;
      startBtn.textContent = 'Signing…';
      const sig = await signPrecommit(session.precommit);
      await submitSignature(session.signPath, sig);
      goLive(session.wsPath, session.anchor);
    } catch (e) {
      startBtn.disabled = false;
      startBtn.textContent = 'Begin session';
      status.textContent = `Could not start: ${(e as Error).message}`;
      status.style.color = 'var(--danger)';
    }
  }

  function goLive(wsPath: string, anchor: string): void {
    document.body.classList.add('focus');

    const progress = el('span', { class: 'v tnum' }, `0 / ${trialsPerSession}`);
    const hitsVal = el('span', { class: 'v tnum' }, '0');
    const liveDot = el('span', { class: 'live-dot' }, 'committed before reveal');
    const stage = el('div', { class: 'precog-stage' });

    inner.replaceChildren(
      el('div', { class: 'stage precog' }, [
        el('div', { class: 'hud' }, [
          hudItem('trial', progress),
          hudItem('hits', hitsVal),
          liveDot,
        ]),
        stage,
        el('div', { class: 'viz-caption' }, `anchor ${anchor} · the image is fixed by a future public beacon · display only`),
      ]),
    );

    socket = openPrecogStream(wsPath, {
      onStarted: (m) => {
        trialsPerSession = m.trialsPerSession;
        progress.textContent = `0 / ${m.trialsPerSession}`;
        witnessed = m.witnessed ?? false;
        if (witnessed) liveDot.textContent = 'witnessed · committed before reveal';
      },
      // Hold the previous reveal on screen for revealHoldMs before the next choice.
      onTrial: (m) => {
        const delay = Math.max(0, revealUntil - Date.now());
        if (revealTimer !== undefined) clearTimeout(revealTimer);
        revealTimer = window.setTimeout(() => showChoice(stage, m.trialIndex), delay);
      },
      onPending: (m) => { void onPending(stage, m.trialIndex, m.targetRound, m.prevBeaconRound); },
      // Witness co-signing the choice before its target round — mask the wait.
      onSensing: () => showSensing(stage),
      onReveal: (m) => { showReveal(stage, m); revealUntil = Date.now() + revealHoldMs; hitsVal.textContent = String(m.hits); progress.textContent = `${m.completed} / ${m.trialsPerSession}`; },
      onSeal: (m) => showSeal(anchor, m),
      onError: (message) => showSetup(`Session error: ${message}`),
    });
  }

  function showChoice(stage: HTMLElement, trialIndex: number): void {
    currentChoice = null;
    const buttons = info.choices.map((c) => {
      const meta = VALENCE_META[c] ?? { label: c, glyph: '?', color: '#6ea8fe' };
      const b = el('button', {
        class: 'option-card',
        style: `--accent:${meta.color}`,
        onclick: () => {
          if (currentChoice) return;
          currentChoice = c;
          buttons.forEach((btn) => { btn.disabled = true; if (btn === b) btn.classList.add('chosen'); });
          socket?.sendChoice(trialIndex, c);
        },
      }, [
        el('span', { class: 'option-glyph' }, meta.glyph),
        el('span', { class: 'option-label' }, meta.label),
      ]);
      return b;
    });
    stage.replaceChildren(
      el('div', { class: 'precog-prompt' }, 'What’s coming? Choose on instinct.'),
      el('div', { class: 'options' }, buttons),
    );
  }

  async function onPending(stage: HTMLElement, trialIndex: number, targetRound: number, prevBeaconRound: number): Promise<void> {
    if (!currentChoice) return;
    stage.replaceChildren(el('div', { class: 'precog-waiting' }, [
      el('div', { class: 'pulse-ring' }),
      el('div', {}, 'Locked. The moment is arriving…'),
    ]));
    const tc = trialCommit({ sessionId, trialIndex, choice: currentChoice, targetRound, prevBeaconRound, operatorPubKey: pubKey });
    const sig = await signPrecommit(tc);
    socket?.sendSign(trialIndex, sig);
  }

  // While an independent witness co-signs the choice before its target round
  // publishes (spec D16) — masks the synchronous witnessing + beacon wait.
  function showSensing(stage: HTMLElement): void {
    stage.replaceChildren(el('div', { class: 'precog-waiting' }, [
      el('div', { class: 'pulse-ring' }),
      el('div', {}, 'An independent witness is sealing your choice…'),
      el('div', { class: 'fineprint' }, 'co-signed to a fresh public beacon round before the image is chosen — so it can never be back-fitted'),
    ]));
  }

  function showReveal(stage: HTMLElement, m: PrecogReveal): void {
    const meta = VALENCE_META[m.targetChoice] ?? { label: m.targetChoice, glyph: '?', color: '#6ea8fe' };
    const hit = m.hit === 1;
    stage.replaceChildren(
      el('div', { class: `precog-reveal ${hit ? 'hit' : 'miss'}`, style: `--accent:${meta.color}` }, [
        el('img', { class: 'reveal-img', src: `/${m.imagePath}`, alt: meta.label, draggable: 'false' }),
        el('div', { class: 'reveal-bar' }, [
          el('span', { class: 'reveal-label' }, meta.label),
          el('span', { class: 'reveal-verdict' }, hit ? 'HIT — you felt it' : 'miss'),
        ]),
      ]),
    );
  }

  function showSeal(anchor: string, m: PrecogSeal): void {
    teardown();
    const z = hitRateZ(m.hits, m.trials, 1 / m.optionsPerTrial);
    const rate = m.trials > 0 ? ((m.hits / m.trials) * 100).toFixed(0) : '0';

    inner.replaceChildren(
      el('div', { class: 'seal card' }, [
        el('span', { class: 'eyebrow' }, 'Sealed'),
        m.witnessed ? el('div', { style: 'margin:6px 0' }, witnessBadge()) : false,
        el('h2', {}, `${m.hits} / ${m.trials} hits`),
        el('p', { class: 'seal-sub' }, `${rate}% this session · chance is ${(100 / m.optionsPerTrial).toFixed(0)}% · z (display) ${z >= 0 ? '+' : ''}${z.toFixed(2)}`),
        el('dl', {}, [
          el('dt', {}, 'anchor'), el('dd', {}, anchor),
          el('dt', {}, 'output commitment'), el('dd', {}, m.outputCommitment),
          el('dt', {}, 'raw trials'), el('dd', {}, m.rawBlobRef || '—'),
          el('dt', {}, 'seal entry'), el('dd', {}, m.sealEntryHash),
        ]),
        el('div', { class: 'callout warn' }, [
          el('strong', {}, 'This is not evidence. '),
          'One session of a few trials is dominated by chance. The real test is whether ',
          el('em', {}, 'you specifically'),
          ' stay above chance across many sessions (split-half reliability) — the pre-registered H1. Verify this exact record yourself.',
        ]),
        el('div', { class: 'actions' }, [
          el('button', { class: 'btn primary', onclick: () => showSetup() }, 'Run another'),
          el('a', { class: 'btn ghost', href: `/verify?session=${m.sessionId}`, 'data-link': true }, 'Verify in your browser'),
          el('a', { class: 'btn ghost', href: '/about', 'data-link': true }, 'How it works'),
        ]),
      ]),
    );
  }

  start();
  return teardown;
}

function optionChip(id: string): HTMLElement {
  const meta = VALENCE_META[id] ?? { label: id, glyph: '?', color: '#6ea8fe' };
  return el('div', { class: 'option-chip', style: `--accent:${meta.color}` }, [
    el('span', { class: 'option-glyph' }, meta.glyph),
    el('span', {}, meta.label),
  ]);
}

function hudItem(label: string, value: Node): HTMLElement {
  return el('div', { class: 'item' }, [el('span', { class: 'k' }, label), value]);
}
