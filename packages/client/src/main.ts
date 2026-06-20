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
import { renderHistory } from './pages/history';
import { renderVerify } from './pages/verify';

const shell = buildShell();
const app = document.getElementById('app');
if (!app) throw new Error('missing #app root');
app.replaceChildren(shell.root);

const routes: Record<string, Route> = {
  '/': renderHome,
  '/about': renderAbout,
  '/faq': renderFaq,
  '/guide': renderGuide,
  '/run': renderRun,
  '/experiments': renderExperiments,
  '/leaderboard': renderLeaderboard,
  '/history': renderHistory,
  '/verify': renderVerify,
};

initRouter({
  outlet: shell.outlet,
  routes,
  notFound: renderHome,
  onNavigate: (path) => shell.setActive(path),
});
