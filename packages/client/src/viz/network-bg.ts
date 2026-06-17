// Ambient "network" background for the landing page (three.js).
//
// A field of softly drifting nodes with proximity links, plus occasional
// "activations" — motes of light that travel along an edge from one node to
// another and flash the destination. Purely decorative: it carries no data and
// is torn down on navigation (the home route returns this instance's dispose()).
// Honors prefers-reduced-motion by rendering a single static frame and never
// starting the animation loop.

import * as THREE from 'three';

const NODE = new THREE.Color(0x6ea8fe);       // calm cyan-blue (matches --accent)
const NODE_HOT = new THREE.Color(0xdcecff);   // flash colour when a mote lands
const LINE = new THREE.Color(0x6ea8fe);
const MOTE = new THREE.Color(0xcfe6ff);

const LINK_DIST = 0.46;       // connect nodes closer than this (aspect-space units)
const NODE_BASE = 0.55;       // resting node brightness (additive over dark bg)
const LINE_BASE = 0.20;       // brightest a link gets (at zero distance)
const SPAWN_MIN = 0.45;       // seconds between activations (randomised)
const SPAWN_MAX = 1.4;
const MOTE_SPEED = 1.1;       // edge fraction per second
const MOTE_POOL = 10;

interface Node { x: number; y: number; vx: number; vy: number; hot: number; }
interface Mote { active: boolean; from: number; to: number; t: number; }

/** Soft radial-gradient sprite used for both nodes and motes (white; tinted via vertex colours). */
function glowTexture(): THREE.Texture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.28, 'rgba(255,255,255,0.7)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

export class NetworkBackground {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  private readonly clock = new THREE.Clock();
  private readonly observer: ResizeObserver;
  private readonly tex: THREE.Texture;

  private readonly nodes: Node[] = [];
  private readonly motes: Mote[] = [];
  private aspect = 1;
  private spawnIn = 0.6;

  private readonly nodePos: Float32Array;
  private readonly nodeCol: Float32Array;
  private readonly nodePoints: THREE.Points;

  private readonly linePos: Float32Array;
  private readonly lineCol: Float32Array;
  private readonly lineSegs: THREE.LineSegments;

  private readonly motePos: Float32Array;
  private readonly moteCol: Float32Array;
  private readonly motePoints: THREE.Points;

  private readonly reduced: boolean;

  constructor(canvas: HTMLCanvasElement, count = 80) {
    this.reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.camera.position.z = 1;
    this.tex = glowTexture();

    this.aspect = Math.max(canvas.clientWidth, 1) / Math.max(canvas.clientHeight, 1);

    // Seed nodes across the (aspect-aware) view with a slow random drift.
    for (let i = 0; i < count; i++) {
      this.nodes.push({
        x: (Math.random() * 2 - 1) * this.aspect,
        y: Math.random() * 2 - 1,
        vx: (Math.random() * 2 - 1) * 0.03,
        vy: (Math.random() * 2 - 1) * 0.03,
        hot: 0,
      });
    }
    for (let i = 0; i < MOTE_POOL; i++) this.motes.push({ active: false, from: 0, to: 0, t: 0 });

    // Nodes (additive glow points, tinted per-vertex so we can flash them).
    this.nodePos = new Float32Array(count * 3);
    this.nodeCol = new Float32Array(count * 3);
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(this.nodePos, 3));
    ng.setAttribute('color', new THREE.BufferAttribute(this.nodeCol, 3));
    this.nodePoints = new THREE.Points(ng, new THREE.PointsMaterial({
      size: 16, map: this.tex, vertexColors: true, transparent: true,
      sizeAttenuation: false, blending: THREE.AdditiveBlending, depthTest: false,
    }));
    this.scene.add(this.nodePoints);

    // Links: a single LineSegments whose draw range we refill each frame.
    const maxSeg = (count * (count - 1)) / 2;
    this.linePos = new Float32Array(maxSeg * 2 * 3);
    this.lineCol = new Float32Array(maxSeg * 2 * 3);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(this.linePos, 3));
    lg.setAttribute('color', new THREE.BufferAttribute(this.lineCol, 3));
    this.lineSegs = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthTest: false,
    }));
    this.scene.add(this.lineSegs);

    // Travelling motes (a small pool; inactive ones are coloured black ⇒ invisible under additive).
    this.motePos = new Float32Array(MOTE_POOL * 3);
    this.moteCol = new Float32Array(MOTE_POOL * 3);
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(this.motePos, 3));
    mg.setAttribute('color', new THREE.BufferAttribute(this.moteCol, 3));
    this.motePoints = new THREE.Points(mg, new THREE.PointsMaterial({
      size: 26, map: this.tex, vertexColors: true, transparent: true,
      sizeAttenuation: false, blending: THREE.AdditiveBlending, depthTest: false,
    }));
    this.scene.add(this.motePoints);

    this.resize();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);

    if (this.reduced) {
      this.rebuildLinks();
      this.writeNodes();
      this.renderer.render(this.scene, this.camera);
    } else {
      this.renderer.setAnimationLoop(() => this.frame());
    }
  }

  private frame(): void {
    if (document.hidden) return; // pause work while the tab is backgrounded
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.stepNodes(dt);
    this.stepMotes(dt);
    this.rebuildLinks();
    this.writeNodes();
    this.renderer.render(this.scene, this.camera);
  }

  private stepNodes(dt: number): void {
    const ax = this.aspect;
    for (const n of this.nodes) {
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      if (n.x < -ax || n.x > ax) { n.vx *= -1; n.x = Math.max(-ax, Math.min(ax, n.x)); }
      if (n.y < -1 || n.y > 1) { n.vy *= -1; n.y = Math.max(-1, Math.min(1, n.y)); }
      if (n.hot > 0) n.hot = Math.max(0, n.hot - dt * 1.6);
    }
  }

  private stepMotes(dt: number): void {
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      this.spawnIn = SPAWN_MIN + Math.random() * (SPAWN_MAX - SPAWN_MIN);
      this.spawnMote();
    }
    for (let i = 0; i < this.motes.length; i++) {
      const m = this.motes[i]!;
      if (!m.active) { this.moteCol[i * 3] = this.moteCol[i * 3 + 1] = this.moteCol[i * 3 + 2] = 0; continue; }
      m.t += dt * MOTE_SPEED;
      if (m.t >= 1) {
        m.active = false;
        this.nodes[m.to]!.hot = 1; // flash the destination on arrival
        this.moteCol[i * 3] = this.moteCol[i * 3 + 1] = this.moteCol[i * 3 + 2] = 0;
        continue;
      }
      const a = this.nodes[m.from]!;
      const b = this.nodes[m.to]!;
      this.motePos[i * 3] = a.x + (b.x - a.x) * m.t;
      this.motePos[i * 3 + 1] = a.y + (b.y - a.y) * m.t;
      // fade in then out so the mote reads as a streak of light, brightest mid-edge
      const fade = Math.sin(m.t * Math.PI);
      this.moteCol[i * 3] = MOTE.r * fade;
      this.moteCol[i * 3 + 1] = MOTE.g * fade;
      this.moteCol[i * 3 + 2] = MOTE.b * fade;
    }
    (this.motePoints.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.motePoints.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  /** Pick a currently-connected edge at random and launch a mote along it. */
  private spawnMote(): void {
    const slot = this.motes.find((m) => !m.active);
    if (!slot) return;
    const a = Math.floor(Math.random() * this.nodes.length);
    const na = this.nodes[a]!;
    const near: number[] = [];
    for (let b = 0; b < this.nodes.length; b++) {
      if (b === a) continue;
      const nb = this.nodes[b]!;
      const dx = na.x - nb.x;
      const dy = na.y - nb.y;
      if (dx * dx + dy * dy < LINK_DIST * LINK_DIST) near.push(b);
    }
    if (!near.length) return;
    slot.active = true;
    slot.from = a;
    slot.to = near[Math.floor(Math.random() * near.length)]!;
    slot.t = 0;
  }

  private rebuildLinks(): void {
    let s = 0;
    const thr2 = LINK_DIST * LINK_DIST;
    for (let i = 0; i < this.nodes.length; i++) {
      const a = this.nodes[i]!;
      for (let j = i + 1; j < this.nodes.length; j++) {
        const b = this.nodes[j]!;
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= thr2) continue;
        const fade = (1 - Math.sqrt(d2) / LINK_DIST) * LINE_BASE;
        const p = s * 6;
        this.linePos[p] = a.x; this.linePos[p + 1] = a.y; this.linePos[p + 2] = 0;
        this.linePos[p + 3] = b.x; this.linePos[p + 4] = b.y; this.linePos[p + 5] = 0;
        for (let k = 0; k < 6; k += 3) {
          this.lineCol[p + k] = LINE.r * fade;
          this.lineCol[p + k + 1] = LINE.g * fade;
          this.lineCol[p + k + 2] = LINE.b * fade;
        }
        s++;
      }
    }
    this.lineSegs.geometry.setDrawRange(0, s * 2);
    (this.lineSegs.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.lineSegs.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  private writeNodes(): void {
    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i]!;
      this.nodePos[i * 3] = n.x;
      this.nodePos[i * 3 + 1] = n.y;
      this.nodePos[i * 3 + 2] = 0;
      const b = NODE_BASE + n.hot * 0.9;
      this.nodeCol[i * 3] = NODE.r * b + NODE_HOT.r * n.hot * 0.4;
      this.nodeCol[i * 3 + 1] = NODE.g * b + NODE_HOT.g * n.hot * 0.4;
      this.nodeCol[i * 3 + 2] = NODE.b * b + NODE_HOT.b * n.hot * 0.4;
    }
    (this.nodePoints.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.nodePoints.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
  }

  private resize(): void {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const newAspect = w / h;
    // keep node distribution isotropic: rescale x into the new aspect band
    if (this.aspect > 0 && newAspect !== this.aspect) {
      const k = newAspect / this.aspect;
      for (const n of this.nodes) n.x *= k;
    }
    this.aspect = newAspect;
    this.camera.left = -newAspect;
    this.camera.right = newAspect;
    this.camera.top = 1;
    this.camera.bottom = -1;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (this.reduced) {
      this.rebuildLinks();
      this.writeNodes();
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose(): void {
    this.observer.disconnect();
    this.renderer.setAnimationLoop(null);
    this.nodePoints.geometry.dispose();
    this.lineSegs.geometry.dispose();
    this.motePoints.geometry.dispose();
    (this.nodePoints.material as THREE.Material).dispose();
    (this.lineSegs.material as THREE.Material).dispose();
    (this.motePoints.material as THREE.Material).dispose();
    this.tex.dispose();
    this.renderer.dispose();
  }
}
