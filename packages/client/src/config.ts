// Build-time switches. The default (unset) build is the full app the Node
// instrument serves; setting VITE_COMING_SOON=1 at build time produces the
// public "coming soon" static site (GitHub Pages) — the interactive,
// server-backed features (live runs, leaderboard, profile, verify) are gated
// behind a launch notice, while the documentation and how-it-works pages ship
// in full. Nothing here changes the protocol or any committed artifact.

export const COMING_SOON = import.meta.env.VITE_COMING_SOON === '1';
