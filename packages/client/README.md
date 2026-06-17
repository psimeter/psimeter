# @psymeter/client

The operator UI: anchor, countdown timer, and the live three.js visualization with
a real-time anomaly cue (spec §4).

**Phase 1 status:** live. Choosing an intention and pressing Start performs the
HTTP pre-commit, then the page subscribes to the server's **one-way** WebSocket
feed and plots the real cumulative deviation (with ±1.96σ / ±3σ envelopes and an
anomaly cue) via three.js, ending in a sealed-session summary. By design there is
no channel back to the generator (pillar 5).

The server serves this UI directly — just run `npm start` and open
`http://localhost:8787`. three.js is loaded via an import map (no bundler).
