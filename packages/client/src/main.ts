import './styles.css';
import { buildShell } from './shell';
import { initRouter, type Route } from './router';
import { renderHome } from './pages/home';
import { renderAbout } from './pages/about';
import { renderRun } from './pages/run';
import { renderExperiments, renderLeaderboard, renderHistory } from './pages/stub';

const shell = buildShell();
const app = document.getElementById('app');
if (!app) throw new Error('missing #app root');
app.replaceChildren(shell.root);

const routes: Record<string, Route> = {
  '/': renderHome,
  '/about': renderAbout,
  '/run': renderRun,
  '/experiments': renderExperiments,
  '/leaderboard': renderLeaderboard,
  '/history': renderHistory,
};

initRouter({
  outlet: shell.outlet,
  routes,
  notFound: renderHome,
  onNavigate: (path) => shell.setActive(path),
});
