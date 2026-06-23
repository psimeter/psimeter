// ============================================================
// PsiMeter white paper — figures (CeTZ 0.4.2)
// ============================================================
#import "@preview/cetz:0.4.2"
#import cetz.draw: *

// ---- shared palette & helpers ------------------------------
#let _fill   = luma(247)
#let _fill2  = luma(236)
#let _accent = rgb("#22324f")
#let _ink    = luma(20)

// node geometry: name -> (cx, cy, w, h, label)
#let pt(geo, name, side) = {
  let g = geo.at(name)
  let (cx, cy, w, h, ..) = g
  let hw = w / 2
  let hh = h / 2
  if side == "e" { (cx + hw, cy) }
  else if side == "w" { (cx - hw, cy) }
  else if side == "n" { (cx, cy + hh) }
  else if side == "s" { (cx, cy - hh) }
  else if side == "ne" { (cx + hw, cy + hh) }
  else if side == "nw" { (cx - hw, cy + hh) }
  else if side == "se" { (cx + hw, cy - hh) }
  else if side == "sw" { (cx - hw, cy - hh) }
  else { (cx, cy) }
}

#let nodes(geo, fills: (:), size: 7.5pt) = {
  for (name, g) in geo {
    let (cx, cy, w, h, label) = g
    let f = fills.at(name, default: _fill)
    rect((cx - w/2, cy - h/2), (cx + w/2, cy + h/2), fill: f, stroke: 0.6pt + _ink)
    content((cx, cy), align(center, text(size, fill: _ink, label)))
  }
}

#let arrow(a, b, label: none, dash: none, lanchor: "south", loff: (0, 0.18), size: 6.5pt) = {
  line(a, b, mark: (end: ">", fill: _ink, scale: 0.7),
       stroke: (thickness: 0.6pt, paint: _ink, dash: dash))
  if label != none {
    let mx = (a.at(0) + b.at(0)) / 2 + loff.at(0)
    let my = (a.at(1) + b.at(1)) / 2 + loff.at(1)
    content((mx, my), text(size, fill: _ink, label), anchor: lanchor)
  }
}

// ============================================================
// Fig. 1 — Architecture & the two trust paths
// ============================================================
#let fig-architecture() = cetz.canvas(length: 1cm, {
  set-style(stroke: (thickness: 0.6pt, paint: _ink))
  let geo = (
    beacon:    (7.5,  6.1, 3.4, 0.95, [Public beacon — drand \ quicknet (BLS-verified)]),
    operator:  (1.6,  4.2, 2.9, 1.1,  [Operator / client \ (browser Ed25519 key)]),
    server:    (6.4,  4.2, 2.7, 1.1,  [Server / \ orchestrator #text(6.5pt)[(untrusted)]]),
    ledger:    (12.0, 4.2, 3.0, 1.1,  [Append-only \ hash-chained ledger]),
    entropy:   (1.6,  1.7, 2.9, 1.1,  [Physical entropy source \ (TRNG / RDSEED)]),
    generator: (6.4,  1.7, 2.7, 1.1,  [Generator \ (one-way isolated)]),
    witness:   (12.0, 1.7, 3.0, 1.1,  [Independent live witness \ (+ RFC 3161 TSA)]),
    verifier:  (6.8, -0.7, 11.2, 0.9, [*Independent verifier / auditor* — recomputes every result from public artifacts only]),
  )
  nodes(geo, fills: (server: _fill2, verifier: rgb("#eef1f6"), beacon: _fill2))

  arrow(pt(geo,"operator","e"), pt(geo,"server","w"), label: [intention; \ sign precommit], loff: (0,0.0), lanchor: "south")
  arrow(pt(geo,"beacon","s"), pt(geo,"server","n"), label: [bind \ pulse], lanchor: "west", loff: (0.1,0))
  arrow(pt(geo,"entropy","e"), pt(geo,"generator","w"), label: [raw bits])
  arrow(pt(geo,"generator","n"), pt(geo,"server","s"), label: [streaming \ Merkle], lanchor: "west", loff: (0.1,0))
  arrow(pt(geo,"generator","nw"), pt(geo,"operator","se"), dash: "dashed", label: [one-way feedback], lanchor: "east", loff: (-0.1,-0.1))
  arrow(pt(geo,"server","e"), pt(geo,"ledger","w"), label: [append \ open / seal], loff: (0,0.0))
  arrow(pt(geo,"generator","e"), pt(geo,"witness","w"), label: [co-sign \ checkpoints, seal])
  arrow(pt(geo,"witness","n"), pt(geo,"ledger","s"), label: [cross- \ anchor], lanchor: "west", loff: (0.1,0))
  // ledger -> verifier, routed clear of the witness box on the far right
  line(pt(geo,"ledger","e"), (14.6, 4.2), (14.6, -0.7), pt(geo,"verifier","e"),
       mark: (end: ">", fill: _ink, scale: 0.7), stroke: (thickness: 0.6pt, paint: _ink))
  content((14.78, 1.75), anchor: "west", text(6.5pt, fill: _ink)[public \ artifacts])

  // legend
  content((0.0, -1.9), anchor: "west", text(6.5pt, fill: _ink)[#box(baseline: -0.15em, std.line(length: 0.5cm, stroke: 0.6pt))~ commit / data flow#h(0.8em)#box(baseline: -0.15em, std.line(length: 0.5cm, stroke: (thickness: 0.6pt, dash: "dashed")))~ one-way feedback / offline re-verification])
})

// ============================================================
// Fig. 2 — Provenance spine (session lifecycle, micro-PK)
// ============================================================
#let fig-lifecycle() = cetz.canvas(length: 1cm, {
  set-style(stroke: (thickness: 0.6pt, paint: _ink))
  // phase bands
  rect((-0.35, 2.0), (9.7, 4.0), fill: rgb("#eef1f6"), stroke: none)
  rect((9.9, 2.0), (12.6, 4.0), fill: luma(241), stroke: none)
  rect((12.8, 2.0), (16.5, 4.0), fill: rgb("#eef1f6"), stroke: none)
  content((4.67, 4.25), text(7pt, style: "italic", fill: _accent)[Phase A — pre-commitment (no randomness exists yet)])
  content((11.25, 4.25), text(7pt, style: "italic", fill: _accent)[Phase B — generation])
  content((14.65, 4.25), text(7pt, style: "italic", fill: _accent)[Phase C — reveal & seal])

  let y = 3.0
  let geo = (
    s1: (0.95, y, 2.2, 1.25, [#text(6pt)[1]~ Declare \ intention \ #text(6pt)[HIGH/LOW/BASE]]),
    s2: (3.30, y, 2.0, 1.25, [#text(6pt)[2]~ Bind beacon \ pulse \ #text(6pt)[(BLS-verify)]]),
    s3: (5.65, y, 2.1, 1.25, [#text(6pt)[3]~ Precommit \ + anchor]),
    s4: (7.95, y, 1.9, 1.25, [#text(6pt)[4]~ Operator \ signs \ #text(6pt)[(Ed25519)]]),
    s5: (11.25, y, 2.3, 1.25, [#text(6pt)[5]~ Isolated gen + \ streaming Merkle \ #text(6pt)[(witnessed)]]),
    s6: (14.0, y, 2.0, 1.25, [#text(6pt)[6]~ Seal: output \ commitment, \ raw blob]),
    s7: (16.0, y, 1.7, 1.25, [#text(6pt)[7]~ External \ anchor \ #text(6pt)[TSA/OTS]]),
  )
  // verify bar
  rect((-0.35, 0.1), (16.85, 0.95), fill: luma(248), stroke: 0.6pt + _ink)
  content((8.25, 0.52), text(7.5pt, fill: _ink)[*Verification (anyone, later)* — recompute hashes & signatures · re-derive Merkle root from raw blob · walk the chain · re-run analysis])

  nodes(geo, size: 7pt)
  let order = ("s1","s2","s3","s4","s5","s6","s7")
  for i in range(order.len() - 1) {
    arrow(pt(geo, order.at(i), "e"), pt(geo, order.at(i+1), "w"))
  }
  // ledger append callouts under open/seal
  content((9.6, 1.55), text(6pt, fill: _accent)[#sym.arrow.b ledger: session.open])
  content((14.0, 1.55), text(6pt, fill: _accent)[#sym.arrow.b ledger: session.seal])
  // up arrows from verify bar
  for x in (0.95, 5.65, 11.25, 14.0, 16.0) {
    line((x, 0.95), (x, 1.25), mark: (end: ">", fill: _ink, scale: 0.6), stroke: (thickness: 0.5pt, dash: "dashed", paint: _accent))
  }
})

// ============================================================
// Fig. 3 — Merkle output commitment with domain separation
// ============================================================
#let fig-merkle() = cetz.canvas(length: 1cm, {
  set-style(stroke: (thickness: 0.6pt, paint: _ink))
  let yd = 0.0      // data windows
  let yl = 1.6      // leaves
  let yn = 3.2      // internal
  let yr = 4.8      // root
  let xs = (0.9, 3.0, 5.1, 7.2)

  // data windows
  for (i, x) in xs.enumerate() {
    rect((x - 0.7, yd - 0.35), (x + 0.7, yd + 0.35), fill: luma(240), stroke: 0.5pt)
    content((x, yd), text(7pt)[$d_#i$])
  }
  // leaves
  for (i, x) in xs.enumerate() {
    rect((x - 0.78, yl - 0.42), (x + 0.78, yl + 0.42), fill: _fill, stroke: 0.6pt)
    content((x, yl), text(7pt)[leaf#sub[#i]])
    arrow((x, yd + 0.35), (x, yl - 0.42))
  }
  // internal nodes
  let xn = ((xs.at(0)+xs.at(1))/2, (xs.at(2)+xs.at(3))/2)
  for (j, x) in xn.enumerate() {
    rect((x - 0.85, yn - 0.42), (x + 0.85, yn + 0.42), fill: _fill, stroke: 0.6pt)
    content((x, yn), text(7pt)[node#sub[#j]])
  }
  arrow((xs.at(0), yl + 0.42), (xn.at(0) - 0.3, yn - 0.42))
  arrow((xs.at(1), yl + 0.42), (xn.at(0) + 0.3, yn - 0.42))
  arrow((xs.at(2), yl + 0.42), (xn.at(1) - 0.3, yn - 0.42))
  arrow((xs.at(3), yl + 0.42), (xn.at(1) + 0.3, yn - 0.42))
  // root
  let xr = (xn.at(0) + xn.at(1)) / 2
  rect((xr - 1.5, yr - 0.42), (xr + 1.5, yr + 0.42), fill: _fill2, stroke: 0.7pt)
  content((xr, yr), text(7pt)[*root* = outputCommitment])
  arrow((xn.at(0), yn + 0.42), (xr - 0.4, yr - 0.42))
  arrow((xn.at(1), yn + 0.42), (xr + 0.4, yr - 0.42))

  // domain-separation notes (below the tree, keeps the figure column-width)
  let xc = (xs.at(0) + xs.at(3)) / 2
  content((xc, yd - 1.2), text(7pt)[$"leaf"(d) = H(mono("0x00") ∥ d) #h(1.4em) "node"(l, r) = H(mono("0x01") ∥ l ∥ r)$])
  content((xc, yd - 1.75), text(6.5pt, fill: _accent)[an odd final node is promoted unchanged — no Bitcoin-style last-node duplication])
})

// ============================================================
// Fig. 4 — Precognition timeline (choice precedes the target round)
// ============================================================
#let fig-precog() = cetz.canvas(length: 1cm, {
  set-style(stroke: (thickness: 0.6pt, paint: _ink))
  let y = 0.0
  // axis
  line((-0.2, y), (12.2, y), mark: (end: ">", fill: _ink, scale: 0.7))
  content((12.2, y - 0.45), anchor: "east", text(6.5pt, style: "italic")[drand rounds (3 s period)])
  // ticks
  let ticks = ((1.5, $R_0$), (5.0, $R_0+1$), (8.5, [$R = R_0+2$ #text(6pt)[(target)]]))
  for (x, lab) in ticks {
    line((x, y - 0.12), (x, y + 0.12))
    content((x, y - 0.42), text(7pt, lab))
  }
  // choice event
  let xc = 2.7
  line((xc, y), (xc, y + 1.05))
  content((xc, y + 1.45), text(7pt)[operator predicts \ valence #text(6.5pt)[(calm / aversive)]])
  content((xc, y + 0.55), anchor: "west", text(6pt, fill: _accent)[ sign trialCommit · \ witness co-signs])
  // target event
  line((8.5, y), (8.5, y + 1.05))
  content((8.5, y + 1.45), text(7pt)[$B_R$ published #sym.arrow.r \ derive valence + image])
  // reveal
  let xr = 10.6
  line((xr, y), (xr, y + 0.7))
  content((xr, y + 1.0), text(7pt)[reveal image; \ score hit])
  // brace for "future at commit time"
  line((xc, y + 2.05), (8.5, y + 2.05), stroke: (thickness: 0.5pt, dash: "dashed", paint: _accent))
  line((xc, y + 1.95), (xc, y + 2.15), stroke: (thickness: 0.5pt, paint: _accent))
  line((8.5, y + 1.95), (8.5, y + 2.15), stroke: (thickness: 0.5pt, paint: _accent))
  content(((xc + 8.5)/2, y + 2.3), text(6.5pt, fill: _accent)[witnessRound < targetRound  →  choice provably precedes the target])
})

// ============================================================
// Fig. 5 — The psi score as an anytime-valid test martingale
// ============================================================
#let fig-evalue() = cetz.canvas(length: 1cm, {
  set-style(stroke: (thickness: 0.6pt, paint: _ink))
  let W = 6.4
  let H = 4.2
  let nmax = 30
  let lmin = -1
  let lmax = 4
  let mapx = x => x / nmax * W
  let mapy = l => (l - lmin) / (lmax - lmin) * H
  // axes
  line((0, 0), (0, H + 0.2), mark: (end: ">", fill: _ink, scale: 0.6))
  line((0, mapy(0)), (W + 0.2, mapy(0)), mark: (end: ">", fill: _ink, scale: 0.6))
  // y ticks (log decades)
  let ylabs = ((0, $1$), (1, $10$), (2, $10^2$), (3, $10^3$), (4, $10^4$))
  for (l, lab) in ylabs {
    line((-0.1, mapy(l)), (0.0, mapy(l)))
    content((-0.25, mapy(l)), anchor: "east", text(6.5pt, lab))
  }
  // x ticks
  for n in (0, 10, 20, 30) {
    line((mapx(n), mapy(0) - 0.1), (mapx(n), mapy(0)))
    content((mapx(n), mapy(0) - 0.32), text(6.5pt)[#n])
  }
  content((W/2, mapy(0) - 0.75), text(7pt, style: "italic")[scored sessions $n$])
  content((-0.95, H/2), text(7pt, style: "italic")[evidence $W$ (log)], angle: 90deg)

  // candidate threshold (log10 W = 3)
  line((0, mapy(3)), (W, mapy(3)), stroke: (thickness: 0.7pt, dash: "dashed", paint: _accent))
  content((W, mapy(3) + 0.02), anchor: "south-east", text(6.5pt, fill: _accent)[candidate: $W >= 10^3$])

  let plot(pts, stroke) = {
    line(..pts.map(p => (mapx(p.at(0)), mapy(p.at(1)))), stroke: stroke)
  }
  // H0 wanderers
  plot(((0,0),(3,0.2),(6,-0.1),(9,0.3),(12,0.1),(15,0.5),(18,0.2),(21,0.55),(24,0.3),(27,0.15),(30,0.4)),
       (thickness: 0.7pt, paint: luma(160)))
  plot(((0,0),(3,-0.25),(6,0.1),(9,-0.3),(12,0.05),(15,0.45),(18,1.0),(21,0.65),(24,0.9),(27,0.5),(30,0.55)),
       (thickness: 0.7pt, paint: luma(160)))
  // H1 climber
  plot(((0,0),(3,0.5),(6,1.0),(9,1.5),(12,1.95),(15,2.45),(18,2.95),(21,3.35),(24,3.6),(27,3.82),(30,4.0)),
       (thickness: 1.3pt, paint: _accent))
  content((mapx(30), mapy(4.0) + 0.05), anchor: "south-east", text(6.5pt, fill: _accent)[H1 operator])
  content((mapx(24), mapy(0.9) + 0.15), anchor: "south", text(6.5pt, fill: luma(120))[H0 (chance)])
})
