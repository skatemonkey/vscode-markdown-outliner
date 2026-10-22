// Shared expansion for wide tables and flow layouts; no controls in the document.
(function () {
  'use strict';
  window.markdownOutlinerBlocks?.dispose();

  const records = new Map();
  const widthProperty = '--outliner-block-width';
  const offsetProperty = '--outliner-block-offset';
  let expanded = false;
  let observer, resizeObserver, frame = null;
  let started = false, disposed = false, lastState = '';

  function setStyle(element, name, value) {
    if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
  }

  function getState() { return { expanded, available: records.size > 0 }; }

  function notifyState() {
    const state = `${expanded},${records.size > 0}`;
    if (state === lastState) return;
    lastState = state;
    window.dispatchEvent(new window.Event('markdown-outliner.blocksChanged'));
  }

  function readingArea() {
    const body = document.body;
    const rect = body.getBoundingClientRect();
    const style = getComputedStyle(body);
    const left = rect.left + (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.paddingLeft) || 0);
    const sidebar = parseFloat(style.getPropertyValue('--outliner-layout-sidebar-space')) || 0;
    const width = body.clientWidth - (parseFloat(style.paddingLeft) || 0) -
      (parseFloat(style.paddingRight) || 0) - sidebar;
    return { left, width: Math.max(0, width) };
  }

  function candidates() {
    const elements = Array.from(document.querySelectorAll('.markdown-body table, .markdown-body div, .markdown-body figure'))
      .filter(element => {
        if (element.closest('pre, code, [data-outliner-ui]') || element.matches('.outliner-code-row, .markdown-body')) return false;
        if (element.matches('table')) return true;
        const style = getComputedStyle(element);
        if (!/^(auto|scroll)$/.test(style.overflowX)) return false;
        if (element.querySelector('pre') && !element.querySelector('table')) return false;
        // Include scrolling table wrappers and horizontal flex/grid flows.
        // Ordinary content containers and code wrappers are not expansion targets.
        const isFlow = display => /^(inline-)?(flex|grid)$/.test(display);
        return !!element.querySelector('table') || isFlow(style.display) ||
          Array.from(element.children).some(child => !child.matches('pre, code, .outliner-code-row') && isFlow(getComputedStyle(child).display));
      });
    const set = new Set(elements);
    return elements.filter(element => {
      for (let parent = element.parentElement; parent && !parent.matches('.markdown-body'); parent = parent.parentElement) {
        if (set.has(parent)) return false;
      }
      return true;
    });
  }

  function clearExpansion(element) {
    if (element.classList.contains('outliner-block-expanded')) element.classList.remove('outliner-block-expanded');
    if (element.style.getPropertyValue(widthProperty)) element.style.removeProperty(widthProperty);
    if (element.style.getPropertyValue(offsetProperty)) element.style.removeProperty(offsetProperty);
  }

  function remove(element) {
    resizeObserver?.unobserve(element);
    clearExpansion(element);
    element.classList.remove('outliner-block');
    records.delete(element);
  }

  function refresh() {
    if (disposed) return;
    const found = new Set(candidates());
    let layoutChanged = false;
    records.forEach((record, element) => {
      if (!found.has(element)) {
        layoutChanged ||= record.expanded;
        remove(element);
      }
    });
    const area = readingArea();
    found.forEach(element => {
      let record = records.get(element);
      if (!record) {
        record = { expanded: false, geometry: '' };
        records.set(element, record);
        resizeObserver?.observe(element);
      }
      if (!element.classList.contains('outliner-block')) element.classList.add('outliner-block');
      if (!expanded) {
        layoutChanged ||= record.expanded;
        clearExpansion(element);
        record.expanded = false;
        record.geometry = '';
        return;
      }
      const rect = element.getBoundingClientRect();
      if (!rect.width) return; // A folded block will be measured when revealed.
      const needsRoom = element.scrollWidth > element.clientWidth + 1 && area.width > rect.width + 1;
      if (!record.expanded && !needsRoom) return;
      const margin = parseFloat(getComputedStyle(element).marginLeft) || 0;
      setStyle(element, offsetProperty, `${margin + area.left - rect.left}px`);
      setStyle(element, widthProperty, `${area.width}px`);
      if (!element.classList.contains('outliner-block-expanded')) element.classList.add('outliner-block-expanded');
      record.expanded = true;
      const resized = element.getBoundingClientRect();
      const geometry = `${resized.left},${resized.width},${resized.height}`;
      if (record.geometry !== geometry) {
        record.geometry = geometry;
        layoutChanged = true;
      }
    });
    notifyState();
    if (layoutChanged) window.dispatchEvent(new window.Event('markdown-outliner.layoutChanged'));
  }

  function setExpanded(value) {
    if (disposed) return;
    if (!started) init();
    expanded = !!value;
    refresh();
  }

  function schedule() {
    if (disposed || frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      refresh();
    });
  }

  function init() {
    if (started || disposed || !document.body) return;
    started = true;
    if (window.ResizeObserver) {
      resizeObserver = new window.ResizeObserver(schedule);
      resizeObserver.observe(document.body);
    }
    refresh();
    observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => !mutation.target.closest?.('[data-outliner-ui]'))) schedule();
    });
    observer.observe(document.body, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open']
    });
    window.addEventListener('resize', schedule);
    window.addEventListener('markdown-outliner.layoutChanged', schedule);
    window.addEventListener('vscode.markdown.updateContent', schedule);
    document.addEventListener('load', schedule, true);
  }

  function dispose() {
    disposed = true;
    observer?.disconnect();
    resizeObserver?.disconnect();
    if (frame !== null) cancelAnimationFrame(frame);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('markdown-outliner.layoutChanged', schedule);
    window.removeEventListener('vscode.markdown.updateContent', schedule);
    document.removeEventListener('load', schedule, true);
    document.removeEventListener('DOMContentLoaded', init);
    records.forEach((_, element) => remove(element));
    expanded = false;
    notifyState();
    window.dispatchEvent(new window.Event('markdown-outliner.layoutChanged'));
  }

  window.markdownOutlinerBlocks = { getState, setExpanded, refresh: () => started ? refresh() : init(), dispose };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
