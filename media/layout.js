// Document width is independent of folding and the table of contents.
(function () {
  'use strict';
  window.markdownOutlinerLayout?.dispose();

  const STORAGE_KEY = 'markdown-outliner-document-width';
  const DEFAULT_WIDTH = 800;
  const MIN_WIDTH = 480;
  const WIDTH_PROPERTY = '--outliner-document-width';
  let preferredWidth = readWidth();
  let root, button, popover, slider, value, observer;
  let started = false;
  let disposed = false;
  let frame = null;
  let displayedWidth = null;

  function readWidth() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'full') return saved;
      const width = Number(saved);
      if (Number.isFinite(width) && width >= MIN_WIDTH && width <= 10000) return Math.round(width);
    } catch (_) { /* Use the default when preview storage is unavailable. */ }
    return DEFAULT_WIDTH;
  }

  function widthBounds() {
    const style = getComputedStyle(document.body);
    const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const sidebar = parseFloat(style.getPropertyValue('--outliner-layout-sidebar-space')) || 0;
    const max = Math.max(0, Math.floor(document.body.clientWidth - padding - sidebar));
    return { min: Math.min(MIN_WIDTH, max), max };
  }

  function applyWidth() {
    const cssWidth = preferredWidth === 'full' ? '100%' : `${preferredWidth}px`;
    if (document.body.style.getPropertyValue(WIDTH_PROPERTY) !== cssWidth) {
      document.body.style.setProperty(WIDTH_PROPERTY, cssWidth);
    }
    const { min, max } = widthBounds();
    const width = preferredWidth === 'full' ? max : Math.min(preferredWidth, max);
    slider.min = String(min);
    slider.max = String(max);
    slider.value = String(width);
    slider.disabled = min === max;
    slider.setAttribute('aria-valuetext', preferredWidth === 'full' ? `Full width, ${width} pixels` : `${width} pixels`);
    const label = preferredWidth === 'full' ? 'Full' : `${width} px`;
    if (value.textContent !== label) value.textContent = label;

    // The narrow TOC is an overlay. Its close control restores access to the page.
    root.hidden = document.body.classList.contains('outliner-toc-sidebar') && window.innerWidth <= 900;
    if (root.hidden) closePopover();
    if (displayedWidth !== width) {
      displayedWidth = width;
      // Contributed scripts can load in either order; no direct TOC dependency.
      window.dispatchEvent(new window.Event('markdown-outliner.layoutChanged'));
    }
  }

  function onInput() {
    preferredWidth = Number(slider.value) === Number(slider.max) ? 'full' : Number(slider.value);
    applyWidth();
    try {
      localStorage.setItem(STORAGE_KEY, String(preferredWidth));
    } catch (_) { /* Keep this session's choice when storage is unavailable. */ }
  }

  function closePopover(restoreFocus = false) {
    if (!popover || popover.hidden) return;
    popover.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (restoreFocus) button.focus({ preventScroll: true });
  }

  function togglePopover() {
    if (!popover.hidden) {
      closePopover(true);
      return;
    }
    applyWidth();
    popover.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    (slider.disabled ? popover : slider).focus({ preventScroll: true });
  }

  function createShell() {
    root = document.createElement('div');
    root.className = 'outliner-layout';
    root.dataset.outlinerUi = 'layout';
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'outliner-layout-button';
    button.title = 'Page width';
    button.setAttribute('aria-label', 'Page width');
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'outliner-layout-popover');
    button.innerHTML = '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4v12M17 4v12M6 10h8M8 8l-2 2 2 2M12 8l2 2-2 2"/></svg>';
    button.addEventListener('click', togglePopover);

    popover = document.createElement('div');
    popover.id = 'outliner-layout-popover';
    popover.className = 'outliner-layout-popover';
    popover.hidden = true;
    popover.tabIndex = -1;
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'Page width');
    const header = document.createElement('div');
    header.className = 'outliner-layout-label';
    const label = document.createElement('label');
    label.htmlFor = 'outliner-layout-slider';
    label.textContent = 'Page width';
    value = document.createElement('span');
    value.className = 'outliner-layout-value';
    value.setAttribute('aria-hidden', 'true');
    header.append(label, value);
    slider = document.createElement('input');
    slider.id = 'outliner-layout-slider';
    slider.type = 'range';
    slider.step = '1';
    slider.addEventListener('input', onInput);
    popover.append(header, slider);
    root.append(button, popover);
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !event.isComposing && !popover.hidden) {
        event.preventDefault();
        event.stopPropagation();
        closePopover(true);
      }
    });
    root.addEventListener('focusout', event => {
      if (!root.contains(event.relatedTarget)) closePopover();
    });
    // Controls must not trigger VS Code's preview click-to-editor behavior.
    root.addEventListener('click', event => event.stopPropagation());
    document.body.appendChild(root);
  }

  function refresh() {
    if (disposed) return;
    if (!root?.isConnected) createShell();
    if (!document.body.classList.contains('outliner-layout-enabled')) {
      document.body.classList.add('outliner-layout-enabled');
    }
    applyWidth();
  }

  function schedule() {
    if (disposed || frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      refresh();
    });
  }

  function onOutsidePointerDown(event) {
    if (!root.contains(event.target)) closePopover();
  }

  function onWindowBlur() { closePopover(); }

  function init() {
    if (started || disposed || !document.body) return;
    started = true;
    refresh();
    // Only body attributes and direct children matter. Avoid observing slider
    // labels or Markdown text, which change frequently without changing bounds.
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, attributes: true, attributeFilter: ['class', 'style'] });
    window.addEventListener('resize', schedule);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('vscode.markdown.updateContent', schedule);
    document.addEventListener('pointerdown', onOutsidePointerDown);
  }

  function dispose() {
    disposed = true;
    observer?.disconnect();
    if (frame !== null) cancelAnimationFrame(frame);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('blur', onWindowBlur);
    window.removeEventListener('vscode.markdown.updateContent', schedule);
    document.removeEventListener('DOMContentLoaded', init);
    document.removeEventListener('pointerdown', onOutsidePointerDown);
    root?.remove();
    document.body?.classList.remove('outliner-layout-enabled');
    document.body?.style.removeProperty(WIDTH_PROPERTY);
    window.dispatchEvent(new window.Event('markdown-outliner.layoutChanged'));
  }

  window.markdownOutlinerLayout = { refresh: () => started ? refresh() : init(), dispose };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
