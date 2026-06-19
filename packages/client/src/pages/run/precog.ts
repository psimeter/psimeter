// The presentiment (forced-choice precognition) runner (spec §7.5, §10).
//
// Hypothesis: some people feel an event's emotional valence *before* it happens.
// Each trial the operator chooses which of two emotionally-loaded outcomes they
// sense is coming — BEFORE it exists. The choice is signed and bound to a future
// drand round; once that round publishes, the target is derived from it and the
// hit revealed. We hunt for individuals who beat chance *consistently* (H1).
//
// Two-way socket, but sound: the target is bound to a beacon round nobody can
// predict at choice time, so there is no channel to game.

import { el } from '../../ui';
import type { Disposer } from '../../router';
import { getOperatorPubKey, signPrecommit } from '../../identity';
import { trialCommit, hitRateZ } from '@psymeter/core';
import {
  createSession,
  submitSignature,
  openPrecogStream,
  type ExperimentInfo,
  type PrecogSocket,
  type PrecogReveal,
  type PrecogSeal,
} from '../../api';

interface Stimulus { label: string; cue: string; glyph: string; color: string; }

export function renderPrecogRunner(outlet: HTMLElement, info: ExperimentInfo): Disposer {
  const inner = el('div', { class: 'runner-inner' });
  outlet.append(el('section', { class: 'runner' }, inner));

  const stim = (info.stimuli ?? {}) as Record<string, Stimulus>;
  let socket: PrecogSocket | null = null;
  let pubKey = '';
  let sessionId = '';
  let currentChoice: string | null = null;
  let trialsPerSession = Number((info.params as Record<string, number>).trialsPerSession ?? 0);

  function teardown(): void {
    socket?.close();
    socket = null;
    document.body.classList.remove('focus');
  }

  function showSetup(error?: string): void {
    teardown();
    const startBtn = el('button', { class: 'btn primary lg', style: 'width:100%;margin-top:8px' }, 'Begin session');
    const status = el('p', { class: 'fineprint' },
      'Each round, before the outcome exists, choose the feeling you sense is coming. Your choice is signed and locked to a future public-randomness beacon, so it can never be back-fitted.');
    if (error) { status.textContent = error; status.style.color = 'var(--danger)'; }
    startBtn.addEventListener('click', () => { void begin(startBtn, status); });

    inner.replaceChildren(
      el('div', { class: 'setup card' }, [
        el('span', { class: 'eyebrow' }, info.title),
        el('h1', {}, 'Can you feel what’s coming?'),
        el('p', { class: 'sub' },
          `${trialsPerSession} quick trials. Each one, pick the emotion you sense before it is revealed — the target is decided by a future beacon round that does not exist yet.`),
        el('div', { class: 'option-preview' }, info.choices.map((c) => optionChip(stim[c], c))),
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
    const stage = el('div', { class: 'precog-stage' });

    inner.replaceChildren(
      el('div', { class: 'stage precog' }, [
        el('div', { class: 'hud' }, [
          hudItem('trial', progress),
          hudItem('hits', hitsVal),
          el('span', { class: 'live-dot' }, 'committed before reveal'),
        ]),
        stage,
        el('div', { class: 'viz-caption' }, `anchor ${anchor} · targets from a future public beacon · display only`),
      ]),
    );

    socket = openPrecogStream(wsPath, {
      onStarted: (m) => { trialsPerSession = m.trialsPerSession; progress.textContent = `0 / ${m.trialsPerSession}`; },
      onTrial: (m) => showChoice(stage, m.trialIndex),
      onPending: (m) => { void onPending(stage, m.trialIndex, m.targetRound, m.prevBeaconRound); },
      onReveal: (m) => { showReveal(stage, m); hitsVal.textContent = String(m.hits); progress.textContent = `${m.completed} / ${m.trialsPerSession}`; },
      onSeal: (m) => showSeal(anchor, m),
      onError: (message) => showSetup(`Session error: ${message}`),
    });
  }

  function showChoice(stage: HTMLElement, trialIndex: number): void {
    currentChoice = null;
    const buttons = info.choices.map((c) => {
      const s = stim[c];
      const b = el('button', {
        class: 'option-card',
        style: s ? `--accent:${s.color}` : '',
        onclick: () => {
          if (currentChoice) return;
          currentChoice = c;
          buttons.forEach((btn) => { btn.disabled = true; if (btn === b) btn.classList.add('chosen'); });
          socket?.sendChoice(trialIndex, c);
        },
      }, [
        el('span', { class: 'option-glyph' }, s?.glyph ?? '?'),
        el('span', { class: 'option-label' }, s?.label ?? c),
      ]);
      return b;
    });
    stage.replaceChildren(
      el('div', { class: 'precog-prompt' }, 'Which is coming? Choose on instinct.'),
      el('div', { class: 'options' }, buttons),
    );
  }

  async function onPending(stage: HTMLElement, trialIndex: number, targetRound: number, prevBeaconRound: number): Promise<void> {
    if (!currentChoice) return;
    stage.replaceChildren(el('div', { class: 'precog-waiting' }, [
      el('div', { class: 'pulse-ring' }),
      el('div', {}, 'Locked. Waiting for the moment to arrive…'),
    ]));
    const tc = trialCommit({ sessionId, trialIndex, choice: currentChoice, targetRound, prevBeaconRound, operatorPubKey: pubKey });
    const sig = await signPrecommit(tc);
    socket?.sendSign(trialIndex, sig);
  }

  function showReveal(stage: HTMLElement, m: PrecogReveal): void {
    const t = stim[m.targetChoice];
    const hit = m.hit === 1;
    stage.replaceChildren(
      el('div', { class: `precog-reveal ${hit ? 'hit' : 'miss'}`, style: t ? `--accent:${t.color}` : '' }, [
        el('div', { class: 'reveal-glyph' }, t?.glyph ?? '?'),
        el('div', { class: 'reveal-label' }, t?.label ?? m.targetChoice),
        el('div', { class: 'reveal-verdict' }, hit ? 'HIT — you felt it' : 'miss'),
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

  showSetup();
  return teardown;
}

function optionChip(s: Stimulus | undefined, id: string): HTMLElement {
  return el('div', { class: 'option-chip', style: s ? `--accent:${s.color}` : '' }, [
    el('span', { class: 'option-glyph' }, s?.glyph ?? '?'),
    el('span', {}, s?.label ?? id),
  ]);
}

function hudItem(label: string, value: Node): HTMLElement {
  return el('div', { class: 'item' }, [el('span', { class: 'k' }, label), value]);
}
