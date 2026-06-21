// The wiki chrome: a sticky sidebar table of contents (grouped, with the active
// chapter highlighted) + the content column with an eyebrow, title, body, and a
// prev/next footer. On mobile the sidebar collapses into a <details> dropdown.

import { el } from '../../ui';
import { DOC_CHAPTERS, DOC_GROUPS } from './index';

/** Build a fresh grouped link list (DOM nodes can't be shared, so this is a
 *  factory — called once for the desktop aside and once for the mobile dropdown). */
function buildNav(activeId: string): HTMLElement {
  const nav = el('nav', { class: 'docs-nav-list' });
  for (const group of DOC_GROUPS) {
    nav.append(el('div', { class: 'docs-group-label' }, group));
    for (const ch of DOC_CHAPTERS.filter((c) => c.group === group)) {
      nav.append(el('a', {
        href: ch.path,
        'data-link': true,
        class: ch.id === activeId ? 'docs-link active' : 'docs-link',
        title: ch.blurb,
      }, ch.title));
    }
  }
  return nav;
}

export function renderDocChapter(outlet: HTMLElement, chapterId: string): void {
  const i = DOC_CHAPTERS.findIndex((c) => c.id === chapterId);
  const ch = DOC_CHAPTERS[i];
  if (!ch) return;
  const prev = DOC_CHAPTERS[i - 1];
  const next = DOC_CHAPTERS[i + 1];

  // Mobile dropdown: a native <details> whose summary names the current chapter.
  const mobileToc = el('details', { class: 'docs-toc-mobile' }, [
    el('summary', {}, [el('span', { class: 'faint' }, 'Docs · '), ch.title]),
    buildNav(chapterId),
  ]);

  const sidebar = el('aside', { class: 'docs-sidebar' }, [
    el('a', { href: '/about', 'data-link': true, class: 'docs-back' }, '← Friendly intro'),
    buildNav(chapterId),
  ]);

  const navFoot = el('div', { class: 'docs-pager' }, [
    prev
      ? el('a', { href: prev.path, 'data-link': true, class: 'docs-pager-link prev' }, [
          el('span', { class: 'faint' }, '← Previous'), el('span', { class: 'docs-pager-title' }, prev.title)])
      : el('span'),
    next
      ? el('a', { href: next.path, 'data-link': true, class: 'docs-pager-link next' }, [
          el('span', { class: 'faint' }, 'Next →'), el('span', { class: 'docs-pager-title' }, next.title)])
      : el('span'),
  ]);

  const content = el('article', { class: 'docs-content prose' }, [
    el('span', { class: 'eyebrow' }, ch.group),
    el('h1', {}, ch.title),
    ...ch.render(),
    navFoot,
  ]);

  outlet.append(el('div', { class: 'page docs-wiki' }, [mobileToc, sidebar, content]));
}
