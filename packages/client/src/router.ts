// Minimal History-API router. Each route renders into the outlet and may return
// a disposer (the runner uses it to tear down its WebSocket, timer, and WebGL
// loop on navigation). Server-side SPA fallback (packages/server) makes deep
// links like /about work on reload.

export type Disposer = () => void;
export type Route = (outlet: HTMLElement, query: URLSearchParams) => void | Disposer;

interface RouterConfig {
  outlet: HTMLElement;
  routes: Record<string, Route>;
  notFound: Route;
  onNavigate?: (path: string) => void;
}

let cfg: RouterConfig | null = null;
let disposeCurrent: Disposer | undefined;

export function initRouter(config: RouterConfig): void {
  cfg = config;
  document.addEventListener('click', onClick);
  window.addEventListener('popstate', render);
  render();
}

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  if (path === location.pathname + location.search) return;
  history[opts.replace ? 'replaceState' : 'pushState'](null, '', path);
  render();
}

function onClick(e: MouseEvent): void {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const target = e.target as Element | null;
  const a = target?.closest('a[data-link]') as HTMLAnchorElement | null;
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href || !href.startsWith('/')) return;
  e.preventDefault();
  navigate(href);
}

function render(): void {
  if (!cfg) return;
  if (disposeCurrent) {
    try { disposeCurrent(); } catch { /* ignore teardown errors */ }
    disposeCurrent = undefined;
  }
  const route = cfg.routes[location.pathname] ?? cfg.notFound;
  cfg.outlet.replaceChildren();
  window.scrollTo(0, 0);
  const dispose = route(cfg.outlet, new URLSearchParams(location.search));
  disposeCurrent = dispose ?? undefined;
  cfg.onNavigate?.(location.pathname);
}
