import './styles.css';
import { buildShell } from './shell';
import { initRouter, type Route } from './router';
import { renderHome } from './pages/home';
import { renderAbout } from './pages/about';
import { renderFaq } from './pages/faq';
import { renderGuide } from './pages/guide';
import { renderRun } from './pages/run';
import { renderExperiments } from './pages/experiments';
import { renderLeaderboard } from './pages/leaderboard';
import { renderProfile } from './pages/profile';
import { renderVerify } from './pages/verify';
import { renderComingSoon } from './pages/coming-soon';
import { docsRoutes } from './pages/docs/index';
import { COMING_SOON } from './config';

const shell = buildShell();
const app = document.getElementById('app');
if (!app) throw new Error('missing #app root');
app.replaceChildren(shell.root);

// In the public "coming soon" build the server-backed routes are gated behind a
// launch notice (direct links still resolve to it, rather than failing fetches);
// the documentation and how-it-works pages ship in full.
const live = <T extends Route>(route: T): Route => (COMING_SOON ? renderComingSoon : route);

const routes: Record<string, Route> = {
  '/': renderHome,
  '/about': renderAbout,
  '/faq': renderFaq,
  '/guide': renderGuide,
  '/run': live(renderRun),
  '/experiments': live(renderExperiments),
  '/leaderboard': live(renderLeaderboard),
  '/profile': live(renderProfile),
  '/history': live(renderProfile), // legacy alias
  '/verify': live(renderVerify),
  ...docsRoutes(), // the documentation wiki (/docs and /docs/*)
};

initRouter({
  outlet: shell.outlet,
  routes,
  notFound: renderHome,
  onNavigate: (path) => shell.setActive(path),
});
