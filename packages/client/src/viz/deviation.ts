// Cumulative-deviation feedback (three.js, per spec D8/§8.6).
//
// Plots the running deviation of the stream from a fair coin against trial
// progress, with ±1.96σ / ±3σ guide envelopes. This is an AMBIENT companion to
// the anchor, not the hero — and it is DISPLAY ONLY: the authoritative score is
// recomputed later in analysis/ over the published raw data (spec §8.1). The
// frame rate is decoupled from the sampling regime, so animation jitter can
// never affect the statistics (§8.6).

import * as THREE from 'three';
import type { MicroPkParams } from '../api';

const ENVELOPE_K = 3; // vertical extent = ±3σ at end of session

const COOL = new THREE.Color(0x6ea8fe); // nominal
const WARN = new THREE.Color(0xffb454); // anomaly cue (|z| > 2)

export interface VizPoint {
  ones: number;
  total: number;
  zDisplay: number;
}

export class DeviationViz {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
  private readonly observer: ResizeObserver;

  private line: THREE.Line | null = null;
  private positions: Float32Array | null = null;
  private count = 0;
  private nBits = 1;
  private yScale = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.camera.position.z = 1;
    this.resize();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.renderer.setAnimationLoop(() => this.renderer.render(this.scene, this.camera));
  }

  /** Lay out axes + envelopes for a given experiment's parameters. */
  build(params: MicroPkParams): void {
    this.clearScene();
    this.nBits = params.bitsPerSession;
    const maxSigma = Math.sqrt(this.nBits * 0.25);
    this.yScale = 0.9 / (ENVELOPE_K * maxSigma);

    this.addLine(new Float32Array([-1, 0, 0, 1, 0, 0]), 0x223044); // zero axis

    for (const k of [1.96, ENVELOPE_K]) {
      const seg = 120;
      const up = new Float32Array((seg + 1) * 3);
      const dn = new Float32Array((seg + 1) * 3);
      for (let i = 0; i <= seg; i++) {
        const bits = (i / seg) * this.nBits;
        const y = k * Math.sqrt(bits * 0.25) * this.yScale;
        const x = (i / seg) * 2 - 1;
        up[i * 3] = x; up[i * 3 + 1] = y;
        dn[i * 3] = x; dn[i * 3 + 1] = -y;
      }
      const color = k < 2 ? 0x2a3a52 : 0x3c3320;
      this.addLine(up, color);
      this.addLine(dn, color);
    }

    const maxPoints = Math.ceil(params.trialsPerSession / params.checkpointEveryTrials) + 1;
    this.positions = new Float32Array(maxPoints * 3);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geom.setDrawRange(0, 0);
    this.line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: COOL.clone() }));
    this.scene.add(this.line);
    this.count = 0;
  }

  /** Append one checkpoint to the live trace. */
  push(p: VizPoint): void {
    if (!this.line || !this.positions) return;
    const deviation = p.ones - p.total / 2;
    const x = (p.total / this.nBits) * 2 - 1;
    const y = Math.max(-0.97, Math.min(0.97, deviation * this.yScale));
    this.positions[this.count * 3] = x;
    this.positions[this.count * 3 + 1] = y;
    this.count++;
    this.line.geometry.setDrawRange(0, this.count);
    const attr = this.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.needsUpdate = true;
    (this.line.material as THREE.LineBasicMaterial).color.copy(Math.abs(p.zDisplay) > 2 ? WARN : COOL);
  }

  resize(): void {
    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
  }

  dispose(): void {
    this.observer.disconnect();
    this.renderer.setAnimationLoop(null);
    this.clearScene();
    this.renderer.dispose();
  }

  private addLine(positions: Float32Array, color: number): void {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color })));
  }

  private clearScene(): void {
    while (this.scene.children.length) {
      const child = this.scene.children[0];
      if (child) this.scene.remove(child);
    }
    this.line = null;
    this.positions = null;
  }
}
