// Floating table of contents. Folding remains owned by outliner.js.
(function () {
  'use strict';

  // Preview scripts may be executed again after a Markdown update.
  window.markdownOutlinerToc?.dispose();

  const STORAGE_KEY = 'markdown-outliner-toc-mode';
  const WIDTH_STORAGE_KEY = 'markdown-outliner-toc-width';
  const DEFAULT_WIDTH = 288;
  const MIN_WIDTH = 224;
  const MAX_WIDTH = 560;
  const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';
  const UI_SELECTOR = '[data-outliner-ui]';
  const DESTINATION_CLASS = 'outliner-toc-destination';
  let root, panel, navigation, rail, marks, closeButton, sidebarButton;
  let resizeHandle, searchRow, searchInput, emptyResults;
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
  let sidebarWidth = readSidebarWidth();
  let resizeDrag = null;
  let searchOpen = false;
  let destinationHeading = null;
  let destinationTimer = null;
  let destinationPending = false;

  function readPreference() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'sidebar';
    } catch (_) {
      // The TOC still works when browser storage is unavailable.
    }
    return false;
  }

  // Sidebar sizing is independent of the floating panel and its saved mode.
  function readSidebarWidth() {
    try {
      const width = Number(localStorage.getItem(WIDTH_STORAGE_KEY));
      if (Number.isFinite(width) && width > 0) return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
    } catch (_) { /* Use the default when browser storage is unavailable. */ }
    return DEFAULT_WIDTH;
  }

  function widthBounds() {
    // Keep a readable document column on wide previews; narrow ones use an overlay.
    const available = Math.max(0, window.innerWidth - (window.innerWidth > 900 ? 480 : 32));
    return { min: Math.min(MIN_WIDTH, available), max: Math.min(MAX_WIDTH, available) };
  }

  function clampWidth(width) {
    const { min, max } = widthBounds();
    return Math.round(Math.max(min, Math.min(max, width)));
  }

  function applySidebarWidth() {
    const width = clampWidth(sidebarWidth);
    document.body.style.setProperty('--outliner-toc-sidebar-width', `${width}px`);
    const { min, max } = widthBounds();
    resizeHandle.setAttribute('aria-valuemin', String(min));
    resizeHandle.setAttribute('aria-valuemax', String(max));
    resizeHandle.setAttribute('aria-valuenow', String(width));
    resizeHandle.setAttribute('aria-valuetext', `${width} pixels`);
    schedule(false);
  }

  function saveSidebarWidth() {
    try {
      localStorage.setItem(WIDTH_STORAGE_KEY, String(sidebarWidth));
    } catch (_) { /* Keep this session's width in memory. */ }
  }

  function finishResize(cancel = false) {
    if (!resizeDrag) return;
    const drag = resizeDrag;
    resizeDrag = null;
    if (cancel) sidebarWidth = drag.preferredWidth;
    else if (drag.moved) saveSidebarWidth();
    document.body.classList.remove('outliner-toc-resizing');
    if (resizeHandle.hasPointerCapture(drag.pointerId)) resizeHandle.releasePointerCapture(drag.pointerId);
    applySidebarWidth();
  }

  function createResizeHandle() {
    const handle = document.createElement('div');
    handle.className = 'outliner-toc-resize';
    handle.tabIndex = 0;
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-label', 'Resize table of contents');
    handle.setAttribute('aria-controls', panel.id);
    handle.title = 'Drag to resize. Left and Right arrows adjust the width.';
    handle.addEventListener('pointerdown', event => {
      if (!pinned || resizeDrag || event.button !== 0 || event.isPrimary === false) return;
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      resizeDrag = {
        pointerId: event.pointerId, startX: event.clientX,
        startWidth: clampWidth(sidebarWidth), preferredWidth: sidebarWidth, moved: false
      };
      handle.focus({ preventScroll: true });
      document.body.classList.add('outliner-toc-resizing');
    });
    handle.addEventListener('pointermove', event => {
      if (!resizeDrag || event.pointerId !== resizeDrag.pointerId ||
          (!resizeDrag.moved && event.clientX === resizeDrag.startX)) return;
      resizeDrag.moved = true;
      sidebarWidth = clampWidth(resizeDrag.startWidth + resizeDrag.startX - event.clientX);
      applySidebarWidth();
    });
    handle.addEventListener('pointerup', event => {
      if (event.pointerId === resizeDrag?.pointerId) finishResize();
    });
    const cancel = event => {
      if (event.pointerId === resizeDrag?.pointerId) finishResize(true);
    };
    handle.addEventListener('pointercancel', cancel);
    handle.addEventListener('lostpointercapture', cancel);
    handle.addEventListener('keydown', event => {
      if (event.key === 'Escape' && resizeDrag) {
        event.preventDefault();
        event.stopPropagation();
        finishResize(true);
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey || resizeDrag) return;
      const step = event.shiftKey ? 64 : 16;
      const { min, max } = widthBounds();
      const width = {
        ArrowLeft: clampWidth(sidebarWidth) + step, ArrowRight: clampWidth(sidebarWidth) - step,
        Home: min, End: max
      }[event.key];
      if (width === undefined) return;
      event.preventDefault();
      event.stopPropagation();
      sidebarWidth = clampWidth(width);
      applySidebarWidth();
      saveSidebarWidth();
    });
    return handle;
  }

  // Search filters only outline entries; the document and heading rail stay intact.
  function visibleEntries() {
    return entries.filter(entry => !entry.button.hidden);
  }

  function searchContexts(headings) {
    const ancestors = [];
    const groups = new Map();
    const contexts = new Map();
    for (const entry of headings) {
      while (ancestors.length && ancestors[ancestors.length - 1].level >= entry.level) ancestors.pop();
      const key = entry.label.toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ ...entry, parents: ancestors.map(parent => parent.label) });
      ancestors.push(entry);
    }
    const parentPath = (entry, depth) => entry.parents.slice(-depth).join(' › ') || 'Top level';
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const sharedContexts = new Map();
      for (const entry of group) {
        let depth = 1;
        // Usually the immediate parent suffices. Expand the path only for ambiguity.
        while (depth < entry.parents.length && group.some(other => other !== entry &&
            parentPath(other, depth).toLowerCase() === parentPath(entry, depth).toLowerCase())) depth++;
        const context = parentPath(entry, depth);
        contexts.set(entry.heading, context);
        const key = context.toLowerCase();
        if (!sharedContexts.has(key)) sharedContexts.set(key, []);
        sharedContexts.get(key).push(entry);
      }
      // Repeated siblings or top-level titles have no distinct ancestor to name.
      for (const siblings of sharedContexts.values()) {
        if (siblings.length < 2) continue;
        siblings.forEach((entry, index) => {
          contexts.set(entry.heading, `${contexts.get(entry.heading)} · ${index + 1} of ${siblings.length}`);
        });
      }
    }
    return contexts;
  }

  function searchRanges(label, patterns) {
    const ranges = [];
    for (const pattern of patterns) {
      const matches = Array.from(label.matchAll(pattern));
      if (!matches.length) return null;
      matches.forEach(match => ranges.push({ start: match.index, end: match.index + match[0].length }));
    }
    ranges.sort((a, b) => a.start - b.start || b.end - a.end);
    const merged = [];
    for (const range of ranges) {
      const previous = merged[merged.length - 1];
      if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
      else merged.push(range);
    }
    return merged;
  }

  function renderSearchEntry(entry, ranges, context) {
    const fragment = document.createDocumentFragment();
    let offset = 0;
    for (const { start, end } of ranges || []) {
      fragment.append(entry.label.slice(offset, start));
      const match = document.createElement('mark');
      match.className = 'outliner-toc-match';
      match.textContent = entry.label.slice(start, end);
      fragment.appendChild(match);
      offset = end;
    }
    fragment.append(entry.label.slice(offset));
    if (context) {
      const parent = document.createElement('span');
      parent.className = 'outliner-toc-context';
      parent.textContent = context;
      fragment.appendChild(parent);
    }
    // Plain text nodes keep Markdown labels and queries from becoming HTML.
    entry.button.replaceChildren(fragment);
    entry.button.setAttribute('aria-label', context ? `${entry.label}, ${context}` : entry.label);
    entry.button.title = context ? `${entry.label}\n${context}` : entry.label;
  }

  function filterEntries(resetScroll = false) {
    const words = searchOpen ? searchInput.value.trim().split(/\s+/).filter(Boolean) : [];
    const patterns = [...new Set(words)].map(word =>
      new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu'));
    entries.forEach(entry => {
      const ranges = searchRanges(entry.label, patterns);
      entry.button.hidden = ranges === null;
      renderSearchEntry(entry, ranges, ranges?.length ? entry.context : '');
    });
    emptyResults.hidden = !searchOpen || visibleEntries().length > 0;
    if (resetScroll) navigation.scrollTop = 0;
  }

  function openSearch() {
    if (!pinned && !floatingOpen) openFloating();
    cancelClose();
    searchOpen = true;
    searchRow.hidden = false;
    root.classList.add('is-searching');
    filterEntries();
    searchInput.focus({ preventScroll: true });
    searchInput.select();
  }

  function closeSearch(moveFocus = false) {
    searchOpen = false;
    searchInput.value = '';
    searchRow.hidden = true;
    root.classList.remove('is-searching');
    filterEntries();
    if (moveFocus) {
      focusActiveEntry();
      revealActiveEntry();
    }
  }

  function onTocKeyDown(event) {
    keyboardInteraction = true;
    if (event.isComposing) return;
    const editing = event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
    if (event.key === '/' && !editing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      event.stopPropagation();
      openSearch();
    } else if (event.key === 'Escape' && (pinned || floatingOpen)) {
      event.preventDefault();
      event.stopPropagation();
      if (searchOpen) closeSearch(true);
      else dismiss();
    } else if (searchOpen && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const matches = visibleEntries();
      if (event.key === 'Enter' && event.target === searchInput) {
        event.preventDefault();
        event.stopPropagation();
        if (matches.length) navigate(matches[0].heading);
      } else if (['ArrowDown', 'ArrowUp'].includes(event.key) &&
          (event.target === searchInput || event.target.classList.contains('outliner-toc-item'))) {
        event.preventDefault();
        event.stopPropagation();
        const index = matches.findIndex(entry => entry.button === event.target);
        const next = event.target === searchInput
          ? (event.key === 'ArrowDown' ? 0 : matches.length - 1)
          : index + (event.key === 'ArrowDown' ? 1 : -1);
        const target = next < 0 ? searchInput : matches[Math.min(next, matches.length - 1)]?.button;
        target?.focus({ preventScroll: true });
        if (target && target !== searchInput) revealEntry(target);
      }
    }
  }

  function cancelClose() {
    window.clearTimeout(closeTimer);
    closeTimer = null;
  }

  function focusActiveEntry() {
    const matches = visibleEntries();
    const target = matches.find(entry => entry.heading === activeHeading)?.button ||
      matches[0]?.button || (searchOpen ? searchInput : pinned ? closeButton : rail);
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
    closeSearch();
    keyboardInteraction = false;
    updateVisibility();
  }

  function scheduleClose() {
    cancelClose();
    // A short grace period makes crossing from the rail into the panel forgiving.
    closeTimer = window.setTimeout(() => {
      closeTimer = null;
      if (!pinned && !pointerInside && !((keyboardInteraction || searchOpen) && root.contains(document.activeElement))) {
        closeFloating();
      }
    }, 160);
  }

  function setPinned(value) {
    cancelClose();
    finishResize(true);
    pinned = value;
    floatingOpen = false;
    suppressHover = pointerInside;
    try {
      localStorage.setItem(STORAGE_KEY, pinned ? 'sidebar' : 'floating');
    } catch (_) { /* Keep this session's preference in memory. */ }
    updateVisibility();
    if (pinned) {
      revealActiveEntry();
      if (searchOpen) searchInput.focus({ preventScroll: true });
      else focusActiveEntry();
    } else {
      closeSearch();
      rail.focus({ preventScroll: true });
    }
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
    sidebarButton.hidden = pinned;
    resizeHandle.hidden = !pinned;
    if (!entries.length) finishResize(true);
    // Only an explicit sidebar choice reserves space in the reading column.
    document.body.classList.toggle('outliner-toc-sidebar', pinned && entries.length > 0);
  }

  function createShell() {
    cancelClose();
    finishResize(true);
    floatingOpen = pointerInside = keyboardInteraction = suppressHover = false;
    searchOpen = false;
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
    closeButton.className = 'outliner-toc-mode-button outliner-toc-close';
    closeButton.setAttribute('aria-label', 'Close Sidebar');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => setPinned(false));

    navigation = document.createElement('nav');
    navigation.id = 'outliner-toc-items';
    navigation.className = 'outliner-toc-items';
    navigation.setAttribute('aria-label', 'Table of contents');
    searchRow = document.createElement('div');
    searchRow.className = 'outliner-toc-search';
    searchRow.hidden = true;
    searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Find a heading…';
    searchInput.autocomplete = 'off';
    searchInput.spellcheck = false;
    searchInput.setAttribute('aria-label', 'Search table of contents');
    searchInput.setAttribute('aria-controls', navigation.id);
    searchInput.addEventListener('input', () => filterEntries(true));
    searchRow.appendChild(searchInput);
    emptyResults = document.createElement('p');
    emptyResults.className = 'outliner-toc-empty';
    emptyResults.setAttribute('role', 'status');
    emptyResults.textContent = 'No matching headings';
    emptyResults.hidden = true;
    sidebarButton = document.createElement('button');
    sidebarButton.type = 'button';
    sidebarButton.className = 'outliner-toc-mode-button outliner-toc-sidebar-button';
    sidebarButton.setAttribute('aria-label', 'Open in Sidebar');
    const icon = document.createElement('span');
    icon.className = 'outliner-toc-sidebar-icon';
    icon.setAttribute('aria-hidden', 'true');
    sidebarButton.appendChild(icon);
    sidebarButton.addEventListener('click', () => setPinned(true));
    panel.append(closeButton, sidebarButton, searchRow, navigation);

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

    resizeHandle = createResizeHandle();
    root.append(resizeHandle, panel, rail);
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
    root.addEventListener('keydown', onTocKeyDown);
    document.body.appendChild(root);
    applySidebarWidth();
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
    if (destinationHeading && !destinationHeading.isConnected) clearDestinationHighlight();
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
      const contexts = searchContexts(next);
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
        return { ...entry, button, mark, context: contexts.get(entry.heading) || '' };
      });
      navigation.replaceChildren(fragment, emptyResults);
      marks.replaceChildren(railFragment);
      marks.style.setProperty('--toc-count', String(entries.length));
      navigation.scrollTop = scrollTop;
      filterEntries();
      const focusedEntry = entries.find(entry => entry.heading === focusedHeading && !entry.button.hidden);
      if (focusedEntry) focusedEntry.button.focus({ preventScroll: true });
      else if (focusedHeading && searchOpen) searchInput.focus({ preventScroll: true });
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
    if (pinned && searchOpen) {
      closeSearch();
      entries.find(entry => entry.heading === heading)?.button.focus({ preventScroll: true });
    }
    if (!pinned) closeFloating(true);
    const top = Math.max(0, window.scrollY + heading.getBoundingClientRect().top - 24);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top, behavior: reducedMotion ? 'instant' : 'smooth' });
    highlightDestination(heading, reducedMotion);
    setActiveHeading(heading);
    // Restoring the full outline can move an entry even if it is already active.
    revealActiveEntry();
  }

  // Keep the landing cue separate from the outline's persistent active section.
  function clearDestinationHighlight() {
    window.clearTimeout(destinationTimer);
    destinationTimer = null;
    destinationPending = false;
    destinationHeading?.classList.remove(DESTINATION_CLASS);
    destinationHeading = null;
  }

  function showDestinationHighlight() {
    window.clearTimeout(destinationTimer);
    if (!destinationHeading?.isConnected || !destinationHeading.getClientRects().length) {
      clearDestinationHighlight();
      return;
    }
    destinationPending = false;
    destinationHeading.classList.add(DESTINATION_CLASS);
    // Remove temporary styling after the 1.4s fade, including when animations are disabled.
    destinationTimer = window.setTimeout(clearDestinationHighlight, 1500);
  }

  function queueDestinationHighlight() {
    window.clearTimeout(destinationTimer);
    // Restart this short delay while scrolling so long jumps get a full landing cue.
    destinationTimer = window.setTimeout(showDestinationHighlight, 120);
  }

  function highlightDestination(heading, reducedMotion) {
    clearDestinationHighlight();
    destinationHeading = heading;
    destinationPending = !reducedMotion;
    if (reducedMotion) showDestinationHighlight();
    else queueDestinationHighlight();
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
    // Reading progress must not move the result list while a query is being used.
    if (!button || button.hidden || searchOpen || !(pinned || floatingOpen)) return;
    revealEntry(button);
  }

  function revealEntry(button) {
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

  function onLayoutChange(event) {
    if (destinationPending && event.type === 'scroll') queueDestinationHighlight();
    schedule(false);
  }
  function onWindowResize() { applySidebarWidth(); }
  function onWindowBlur() { finishResize(true); }
  function onPreviewUpdate() { schedule(true); }
  function onOutsidePointerDown(event) {
    if (floatingOpen && !root.contains(event.target)) closeFloating();
  }
  function onDocumentKeyDown(event) {
    // Hover does not move focus, so Escape must also work from the document.
    if (event.key === 'Escape' && !event.isComposing && floatingOpen) {
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
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('vscode.markdown.updateContent', onPreviewUpdate);
    document.addEventListener('load', onLayoutChange, true);
    document.addEventListener('pointerdown', onOutsidePointerDown);
    document.addEventListener('keydown', onDocumentKeyDown);
  }

  function dispose() {
    disposed = true;
    cancelClose();
    observer?.disconnect();
    clearDestinationHighlight();
    finishResize(true);
    if (frame !== null) cancelAnimationFrame(frame);
    window.removeEventListener('scroll', onLayoutChange);
    window.removeEventListener('resize', onWindowResize);
    window.removeEventListener('blur', onWindowBlur);
    window.removeEventListener('vscode.markdown.updateContent', onPreviewUpdate);
    document.removeEventListener('DOMContentLoaded', init);
    document.removeEventListener('load', onLayoutChange, true);
    document.removeEventListener('pointerdown', onOutsidePointerDown);
    document.removeEventListener('keydown', onDocumentKeyDown);
    root?.remove();
    document.body?.classList.remove('outliner-toc-sidebar');
    document.body?.style.removeProperty('--outliner-toc-sidebar-width');
  }

  window.markdownOutlinerToc = {
    refresh: () => started ? refresh() : init(),
    dispose
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
