// PsyMeter operator UI.
//
// Flow: identify with a persistent pseudonymous Ed25519 key (kept only in this
// browser) -> choose an intention -> POST /api/sessions (server pre-commits and
// returns the pre-commitment) -> SIGN the pre-commitment and submit it -> open a
// ONE-WAY WebSocket and render the live stream. There is deliberately no channel
// back to the generator (spec pillar 5): once signed, this page only receives.

import * as THREE from 'three';
import * as ed from 'https://esm.sh/@noble/ed25519@2';

const $ = (id) => document.getElementById(id);
const ENVELOPE_K = 3; // vertical scale = 3 sigma at end of session

// ---------- operator identity (D6) ----------
const KEY_STORAGE = 'psymeter.operatorKey';
let operatorPubKey = null;

function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
function fromHex(hex) {
  const a = new Uint8Array(hex.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(hex.substr(i * 2, 2), 16);
  return a;
}
function getPrivateKey() {
  let hex = localStorage.getItem(KEY_STORAGE);
  if (!hex || hex.length !== 64) {
    hex = toHex(ed.utils.randomPrivateKey());
    localStorage.setItem(KEY_STORAGE, hex);
  }
  return fromHex(hex);
}
async function ensureIdentity() {
  if (operatorPubKey) return operatorPubKey;
  const pub = await ed.getPublicKeyAsync(getPrivateKey());
  operatorPubKey = `ed25519:${toHex(pub)}`;
  $('who').textContent = `${toHex(pub).slice(0, 8)}…`;
  return operatorPubKey;
}
async function signPrecommit(precommit) {
  const sig = await ed.signAsync(new TextEncoder().encode(precommit), getPrivateKey());
  return `ed25519:${toHex(sig)}`;
}
ensureIdentity();

// ---------- intention picker ----------
let intention = 'HIGH';
$('intentions').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-i]');
  if (!btn) return;
  intention = btn.dataset.i;
  for (const b of $('intentions').children) b.classList.toggle('sel', b === btn);
});
$('startBtn').addEventListener('click', startSession);
$('againBtn').addEventListener('click', () => location.reload());

// ---------- three.js plot ----------
const canvas = $('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
camera.position.z = 1;

function resize() {
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
}
window.addEventListener('resize', resize);
resize();

const COOL = new THREE.Color(0x6ea8fe);
const WARN = new THREE.Color(0xffb454);

let devLine = null;
let devPositions = null;
let pointCount = 0;
let plot = null;

function buildPlot(params) {
  while (scene.children.length) scene.remove(scene.children[0]);

  const nBits = params.bitsPerSession;
  const maxSigma = Math.sqrt(nBits * 0.25);
  const yScale = 0.9 / (ENVELOPE_K * maxSigma);
  plot = { nBits, yScale };

  addLine(new Float32Array([-1, 0, 0, 1, 0, 0]), 0x2a3340); // zero axis

  for (const k of [1.96, ENVELOPE_K]) {
    const seg = 120;
    const up = new Float32Array((seg + 1) * 3);
    const dn = new Float32Array((seg + 1) * 3);
    for (let i = 0; i <= seg; i++) {
      const bits = (i / seg) * nBits;
      const y = k * Math.sqrt(bits * 0.25) * yScale;
      const x = (i / seg) * 2 - 1;
      up[i * 3] = x; up[i * 3 + 1] = y;
      dn[i * 3] = x; dn[i * 3 + 1] = -y;
    }
    const color = k < 2 ? 0x35506e : 0x4a3a22;
    addLine(up, color);
    addLine(dn, color);
  }

  const maxPoints = Math.ceil(params.trialsPerSession / params.checkpointEveryTrials) + 1;
  devPositions = new Float32Array(maxPoints * 3);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(devPositions, 3));
  geom.setDrawRange(0, 0);
  devLine = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: COOL.clone() }));
  scene.add(devLine);
  pointCount = 0;
}

function addLine(positions, color) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color })));
}

function pushCheckpoint(c) {
  const deviation = c.ones - c.total / 2;
  const x = (c.total / plot.nBits) * 2 - 1;
  const y = Math.max(-0.97, Math.min(0.97, deviation * plot.yScale));
  devPositions[pointCount * 3] = x;
  devPositions[pointCount * 3 + 1] = y;
  pointCount++;
  devLine.geometry.setDrawRange(0, pointCount);
  devLine.geometry.attributes.position.needsUpdate = true;

  const anomalous = Math.abs(c.zDisplay) > 2;
  devLine.material.color.copy(anomalous ? WARN : COOL);
  $('z').textContent = c.zDisplay.toFixed(2);
  $('z').style.color = anomalous ? '#ffb454' : '#fff';
}

renderer.setAnimationLoop(() => renderer.render(scene, camera));

// ---------- session lifecycle ----------
let timerHandle = null;

async function startSession() {
  $('startBtn').disabled = true;
  try {
    const pub = await ensureIdentity();
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ experimentId: 'binary-micropk', version: 1, intention, operatorPubKey: pub }),
    });
    if (!res.ok) throw new Error('session create failed');
    const info = await res.json();

    const operatorSig = await signPrecommit(info.precommit);
    const signRes = await fetch(info.signPath, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operatorSig }),
    });
    if (!signRes.ok) throw new Error('signature rejected by server');

    buildPlot(info.params);
    $('anchor').textContent = info.anchor;
    const grade = $('grade');
    grade.textContent = info.entropy.confirmatory ? `source: ${info.entropy.id}` : `NON-CONFIRMATORY · ${info.entropy.id}`;
    grade.classList.toggle('warn', !info.entropy.confirmatory);

    $('start').classList.add('hidden');
    $('hud').style.display = 'flex';
    startTimer(info.params.sessionSeconds);
    openStream(info);
  } catch (e) {
    alert(`could not start session: ${e.message}`);
    $('startBtn').disabled = false;
  }
}

function openStream(info) {
  const ws = new WebSocket(`ws://${location.host}${info.wsPath}`);
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type === 'checkpoint') pushCheckpoint(m);
    else if (m.type === 'seal') showSummary(info, m);
    else if (m.type === 'error') alert(m.message);
  };
}

function startTimer(seconds) {
  let remaining = seconds;
  const render = () => {
    const mm = Math.floor(remaining / 60);
    const ss = String(remaining % 60).padStart(2, '0');
    $('timer').textContent = `${mm}:${ss}`;
  };
  render();
  clearInterval(timerHandle);
  timerHandle = setInterval(() => {
    remaining = Math.max(0, remaining - 1);
    render();
    if (remaining === 0) clearInterval(timerHandle);
  }, 1000);
}

function showSummary(info, seal) {
  clearInterval(timerHandle);
  const z = (seal.ones - seal.nSamples / 2) / Math.sqrt(seal.nSamples * 0.25);
  $('s-anchor').textContent = seal.anchor;
  $('s-ones').textContent = `${seal.ones} / ${seal.nSamples}`;
  $('s-z').textContent = z.toFixed(3);
  $('s-commit').textContent = seal.outputCommitment;
  $('s-raw').textContent = seal.rawBlobRef || '—';
  $('summary').classList.remove('hidden');
}
