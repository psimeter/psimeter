// PsyMeter operator UI.
//
// Flow: choose an intention -> POST /api/sessions (the server pre-commits and
// returns the anchor) -> open a ONE-WAY WebSocket and render the live stream.
// There is deliberately no channel back to the generator (spec pillar 5): once
// the session is created, this page only ever *receives*.

import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const ENVELOPE_K = 3; // vertical scale = 3 sigma at end of session

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

let devLine = null; // cumulative-deviation polyline
let devPositions = null; // Float32Array
let pointCount = 0;
let plot = null; // { nBits, yScale }

function buildPlot(params) {
  // clear previous
  while (scene.children.length) scene.remove(scene.children[0]);

  const nBits = params.bitsPerSession;
  const maxSigma = Math.sqrt(nBits * 0.25);
  const yScale = 0.9 / (ENVELOPE_K * maxSigma); // value -> NDC y
  plot = { nBits, yScale };

  // zero axis
  addLine(new Float32Array([-1, 0, 0, 1, 0, 0]), 0x2a3340);

  // sigma envelopes (parabolic): y = k * sqrt(bits*0.25)
  for (const k of [1.96, ENVELOPE_K]) {
    const seg = 120;
    const up = new Float32Array((seg + 1) * 3);
    const dn = new Float32Array((seg + 1) * 3);
    for (let i = 0; i <= seg; i++) {
      const bits = (i / seg) * nBits;
      const y = k * Math.sqrt(bits * 0.25) * yScale;
      const x = (i / seg) * 2 - 1;
      up[i * 3] = x; up[i * 3 + 1] = y; up[i * 3 + 2] = 0;
      dn[i * 3] = x; dn[i * 3 + 1] = -y; dn[i * 3 + 2] = 0;
    }
    const color = k < 2 ? 0x35506e : 0x4a3a22;
    addLine(up, color);
    addLine(dn, color);
  }

  // deviation polyline (preallocated, grown via drawRange)
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
  devPositions[pointCount * 3 + 2] = 0;
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
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ experimentId: 'binary-micropk', version: 1, intention }),
  });
  if (!res.ok) {
    alert('could not create session');
    $('startBtn').disabled = false;
    return;
  }
  const info = await res.json();
  buildPlot(info.params);

  $('anchor').textContent = info.anchor;
  const grade = $('grade');
  grade.textContent = info.entropy.confirmatory ? `source: ${info.entropy.id}` : `NON-CONFIRMATORY · ${info.entropy.id}`;
  grade.classList.toggle('warn', !info.entropy.confirmatory);

  $('start').classList.add('hidden');
  $('hud').style.display = 'flex';

  startTimer(info.params.sessionSeconds);
  openStream(info);
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
  $('summary').classList.remove('hidden');
}
