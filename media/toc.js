// Floating table of contents. Folding remains owned by outliner.js.
(function () {
  'use strict';

  // Preview scripts may be executed again after a Markdown update.
  window.markdownOutlinerToc?.dispose();

  const STORAGE_KEY = 'markdown-outliner-toc-mode';
  const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';
  const UI_SELECTOR = '[data-outliner-ui]';
  let root, panel, navigation, rail, marks, closeButton, footer;
  let entries = [];
  let activeHeading = null;
  let observer = null;
  let frame = null;
  let needsRefresh = false;
  let started = false;
  let disposed = false;
  let pinned = readPreference();
  let floatingOpen = false;
  let pointerInside = false;
  let keyboardInteraction = false;
  let suppressHover = false;
  let closeTimer = null;

  function readPreference() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'sidebar';
    } catch (_) {
      // The TOC still works when browser storage is unavailable.
    }
    return false;
  }

  function cancelClose() {
    window.clearTimeout(closeTimer);
    closeTimer = null;
  }

  function focusActiveEntry() {
    const target = entries.find(entry => entry.heading === activeHeading)?.button ||
      entries[0]?.button || (pinned ? closeButton : rail);
    target.focus({ preventScroll: true });
  }

  function openFloating(moveFocus = false) {
    cancelClose();
    floatingOpen = !pinned;
    updateVisibility();
    revealActiveEntry();
    if (moveFocus) focusActiveEntry();
  }

  function closeFloating(moveFocus = false) {
    cancelClose();
    floatingOpen = false;
    // A click or Escape must not immediately reopen the panel under the pointer.
    suppressHover = pointerInside;
    if (moveFocus || panel.contains(document.activeElement)) rail.focus({ preventScroll: true });
    keyboardInteraction = false;
    updateVisibility();
  }

  function scheduleClose() {
    cancelClose();
    // A short grace period makes crossing from the rail into the panel forgiving.
    closeTimer = window.setTimeout(() => {
      closeTimer = null;
      if (!pinned && !pointerInside && !(keyboardInteraction && root.contains(document.activeElement))) {
        closeFloating();
      }
    }, 160);
  }

  function setPinned(value) {
    cancelClose();
    pinned = value;
    floatingOpen = false;
    suppressHover = pointerInside;
    try {
      localStorage.setItem(STORAGE_KEY, pinned ? 'sidebar' : 'floating');
    } catch (_) { /* Keep this session's preference in memory. */ }
    updateVisibility();
    if (pinned) {
      revealActiveEntry();
      focusActiveEntry();
    } else rail.focus({ preventScroll: true });
    schedule(false);
  }

  function dismiss() {
    if (pinned) setPinned(false);
    else closeFloating(true);
  }

  function updateVisibility() {
    root.hidden = entries.length === 0;
    panel.hidden = !(pinned || floatingOpen);
    rail.hidden = pinned;
    rail.setAttribute('aria-expanded', String(pinned || floatingOpen));
    root.classList.toggle('is-sidebar', pinned);
    closeButton.hidden = !pinned;
    footer.hidden = pinned;
    // Only an explicit sidebar choice reserves space in the reading column.
    document.body.classList.toggle('outliner-toc-sidebar', pinned && entries.length > 0);
  }

  function createShell() {
    cancelClose();
    floatingOpen = pointerInside = keyboardInteraction = suppressHover = false;
    root = document.createElement('aside');
    root.className = 'outliner-toc';
    root.dataset.outlinerUi = 'toc';
    root.setAttribute('aria-label', 'Document outline');

    panel = document.createElement('section');
    panel.id = 'outliner-toc-panel';
    panel.className = 'outliner-toc-panel';
    panel.setAttribute('aria-label', 'Table of contents');

    closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'outliner-toc-close';
    closeButton.setAttribute('aria-label', 'Close Sidebar');
    closeButton.title = 'Close sidebar (Escape)';
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => setPinned(false));

    navigation = document.createElement('nav');
    navigation.className = 'outliner-toc-items';
    navigation.setAttribute('aria-label', 'Table of contents');
    footer = document.createElement('div');
    footer.className = 'outliner-toc-footer';
    const sidebarButton = document.createElement('button');
    sidebarButton.type = 'button';
    sidebarButton.className = 'outliner-toc-sidebar-button';
    const icon = document.createElement('span');
    icon.className = 'outliner-toc-sidebar-icon';
    icon.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = 'Open in Sidebar';
    sidebarButton.append(icon, label);
    sidebarButton.addEventListener('click', () => setPinned(true));
    footer.appendChild(sidebarButton);
    panel.append(closeButton, navigation, footer);

    rail = document.createElement('button');
    rail.type = 'button';
    rail.className = 'outliner-toc-rail';
    rail.setAttribute('aria-label', 'Open table of contents');
    rail.setAttribute('aria-controls', panel.id);
    rail.addEventListener('click', event => {
      keyboardInteraction = event.detail === 0;
      openFloating(true);
    });
    marks = document.createElement('span');
    marks.className = 'outliner-toc-marks';
    marks.setAttribute('aria-hidden', 'true');
    rail.appendChild(marks);

    root.append(panel, rail);
    root.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch') return;
      pointerInside = true;
      cancelClose();
      if (!pinned && !suppressHover) openFloating();
    });
    root.addEventListener('pointerleave', event => {
      if (event.pointerType === 'touch') return;
      pointerInside = suppressHover = false;
      scheduleClose();
    });
    root.addEventListener('pointerdown', () => { keyboardInteraction = false; });
    root.addEventListener('focusout', event => {
      if (!root.contains(event.relatedTarget)) {
        keyboardInteraction = false;
        scheduleClose();
      }
    });
    // Keep preview click-to-editor behavior from treating the TOC as Markdown.
    root.addEventListener('click', event => event.stopPropagation());
    root.addEventListener('keydown', event => {
      keyboardInteraction = true;
      if (event.key === 'Escape' && (pinned || floatingOpen)) {
        event.preventDefault();
        event.stopPropagation();
        dismiss();
      }
    });
    document.body.appendChild(root);
  }

  function headingText(heading) {
    const copy = heading.cloneNode(true);
    copy.querySelectorAll('.outliner-toggle, .outliner-heading-gutter, .outliner-list-gutter')
      .forEach(control => control.remove());
    copy.querySelectorAll('img').forEach(image => image.replaceWith(image.alt));
    return copy.textContent.replace(/\s+/g, ' ').trim() || 'Untitled section';
  }

  function refresh() {
    if (disposed) return;
    if (!root?.isConnected) createShell();
    const headings = Array.from(document.querySelectorAll(HEADING_SELECTOR))
      .filter(heading => !heading.closest(UI_SELECTOR));
    const next = headings.map(heading => ({
      heading,
      label: headingText(heading),
      level: Number(heading.tagName[1])
    }));

    // Folding changes controls and classes, not the outline. Preserve focus and
    // the TOC's scroll position unless headings actually changed.
    const unchanged = next.length === entries.length && next.every((entry, index) =>
      entry.heading === entries[index].heading && entry.label === entries[index].label &&
      entry.level === entries[index].level && entries[index].button.isConnected && entries[index].mark.isConnected);
    if (!unchanged) {
      const focusedHeading = entries.find(entry => entry.button === document.activeElement)?.heading;
      const scrollTop = navigation.scrollTop;
      const baseLevel = next.reduce((level, entry) => Math.min(level, entry.level), 6);
      const fragment = document.createDocumentFragment();
      const railFragment = document.createDocumentFragment();
      entries = next.map(entry => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'outliner-toc-item';
        button.style.setProperty('--toc-depth', String(entry.level - baseLevel));
        button.textContent = entry.label;
        button.title = entry.label;
        button.addEventListener('click', () => navigate(entry.heading));
        fragment.appendChild(button);
        const mark = document.createElement('span');
        mark.className = 'outliner-toc-mark';
        mark.style.setProperty('--toc-depth', String(entry.level - baseLevel));
        railFragment.appendChild(mark);
        return { ...entry, button, mark };
      });
      navigation.replaceChildren(fragment);
      marks.replaceChildren(railFragment);
      marks.style.setProperty('--toc-count', String(entries.length));
      navigation.scrollTop = scrollTop;
      entries.find(entry => entry.heading === focusedHeading)?.button.focus({ preventScroll: true });
      activeHeading = null;
    }
    updateVisibility();
    updateActiveHeading();
  }

  function navigate(heading) {
    if (!heading.isConnected) {
      refresh();
      return;
    }
    // Resolve at click time: VS Code loads contributed scripts asynchronously.
    window.markdownOutliner?.revealHeading(heading);
    if (!pinned) closeFloating(true);
    const top = Math.max(0, window.scrollY + heading.getBoundingClientRect().top - 24);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top, behavior: reducedMotion ? 'instant' : 'smooth' });
    setActiveHeading(heading);
  }

  function setActiveHeading(heading) {
    if (activeHeading === heading) return;
    activeHeading = heading;
    entries.forEach(entry => {
      if (entry.heading === heading) entry.button.setAttribute('aria-current', 'location');
      else entry.button.removeAttribute('aria-current');
      entry.mark.classList.toggle('is-active', entry.heading === heading);
    });
    revealActiveEntry();
  }

  function revealActiveEntry() {
    const button = entries.find(entry => entry.heading === activeHeading)?.button;
    if (!button || !(pinned || floatingOpen)) return;
    // Scroll only the TOC, never the document, to keep its active entry visible.
    const itemRect = button.getBoundingClientRect();
    const listRect = navigation.getBoundingClientRect();
    if (itemRect.top < listRect.top) navigation.scrollTop += itemRect.top - listRect.top - 8;
    else if (itemRect.bottom > listRect.bottom) navigation.scrollTop += itemRect.bottom - listRect.bottom + 8;
  }

  function updateActiveHeading() {
    if (!entries.length) return;
    let current = null;
    const atBottom = document.documentElement.scrollHeight > window.innerHeight &&
      window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    for (const entry of entries) {
      if (!entry.heading.getClientRects().length) continue;
      const top = entry.heading.getBoundingClientRect().top;
      if (!current || top <= 96 || atBottom) current = entry.heading;
      else break;
    }
    setActiveHeading(current);
  }

  function schedule(refreshHeadings) {
    if (disposed) return;
    needsRefresh = needsRefresh || refreshHeadings;
    if (frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      const rebuild = needsRefresh;
      needsRefresh = false;
      if (rebuild) refresh();
      else updateActiveHeading();
    });
  }

  function onLayoutChange() { schedule(false); }
  function onPreviewUpdate() { schedule(true); }
  function onOutsidePointerDown(event) {
    if (floatingOpen && !root.contains(event.target)) closeFloating();
  }
  function onDocumentKeyDown(event) {
    // Hover does not move focus, so Escape must also work from the document.
    if (event.key === 'Escape' && floatingOpen) {
      event.preventDefault();
      event.stopPropagation();
      closeFloating();
    }
  }

  function onMutations(records) {
    for (const record of records) {
      const element = record.target.nodeType === Node.ELEMENT_NODE
        ? record.target : record.target.parentElement;
      if (element?.closest(UI_SELECTOR)) continue;
      if (element?.closest('.outliner-heading-gutter, .outliner-list-gutter')) continue;
      schedule(record.type !== 'attributes');
    }
  }

  function init() {
    if (started || disposed || !document.body) return;
    started = true;
    refresh();
    observer = new MutationObserver(onMutations);
    observer.observe(document.body, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['class', 'hidden', 'open']
    });
    window.addEventListener('scroll', onLayoutChange, { passive: true });
    window.addEventListener('resize', onLayoutChange);
    window.addEventListener('vscode.markdown.updateContent', onPreviewUpdate);
    document.addEventListener('load', onLayoutChange, true);
    document.addEventListener('pointerdown', onOutsidePointerDown);
    document.addEventListener('keydown', onDocumentKeyDown);
  }

  function dispose() {
    disposed = true;
    cancelClose();
    observer?.disconnect();
    if (frame !== null) cancelAnimationFrame(frame);
    window.removeEventListener('scroll', onLayoutChange);
    window.removeEventListener('resize', onLayoutChange);
    window.removeEventListener('vscode.markdown.updateContent', onPreviewUpdate);
    document.removeEventListener('DOMContentLoaded', init);
    document.removeEventListener('load', onLayoutChange, true);
    document.removeEventListener('pointerdown', onOutsidePointerDown);
    document.removeEventListener('keydown', onDocumentKeyDown);
    root?.remove();
    document.body?.classList.remove('outliner-toc-sidebar');
  }

  window.markdownOutlinerToc = {
    refresh: () => started ? refresh() : init(),
    dispose
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
