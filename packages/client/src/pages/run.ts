// Experiment runner entry point (spec §10). Reads ?experiment=<id>&v=<n> from
// the URL, loads that experiment's definition, and dispatches to the runner for
// its kind. Defaults to the binary micro-PK experiment so a bare /run still works.

import { el } from '../ui';
import type { Disposer } from '../router';
import { fetchExperiments, type ExperimentInfo } from '../api';
import { loading, errorBox } from '../widgets';
import { renderMicroPkRunner } from './run/microPk';
import { renderPrecogRunner } from './run/precog';

export function renderRun(outlet: HTMLElement, query: URLSearchParams): Disposer {
  const id = query.get('experiment') ?? 'binary-micropk';
  const version = Number(query.get('v') ?? '1');

  let disposed = false;
  let dispose: Disposer | undefined;
  const host = el('div', { class: 'run-host' }, loading());
  outlet.append(host);

  void fetchExperiments()
    .then((exps) => {
      if (disposed) return;
      const info =
        exps.find((e) => e.id === id && e.version === version) ?? exps.find((e) => e.id === id);
      host.replaceChildren();
      if (!info) {
        host.append(errorBox(new Error(`Unknown experiment "${id}". See the experiments list.`)));
        return;
      }
      dispose = dispatch(host, info);
    })
    .catch((e) => { if (!disposed) host.replaceChildren(errorBox(e)); });

  return () => { disposed = true; dispose?.(); };
}

function dispatch(outlet: HTMLElement, info: ExperimentInfo): Disposer {
  switch (info.kind) {
    case 'micro-pk-binary':
      return renderMicroPkRunner(outlet, info);
    case 'precognition-presentiment':
      return renderPrecogRunner(outlet, info);
    default:
      outlet.append(
        el('div', { class: 'page' }, [
          el('div', { class: 'card center-card' }, [
            el('h2', {}, info.title),
            el('p', { class: 'dim' }, `This experiment kind ("${info.kind}") isn't runnable yet.`),
            el('a', { class: 'btn ghost', href: '/experiments', 'data-link': true }, 'Back to experiments'),
          ]),
        ]),
      );
      return () => {};
  }
}
