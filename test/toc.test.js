const fs = require('fs');
const path = require('path');

const scripts = Object.fromEntries(['outliner', 'toc'].map(name => [
  name, fs.readFileSync(path.join(__dirname, `../media/${name}.js`), 'utf8')
]));
const styles = fs.readFileSync(path.join(__dirname, '../media/outliner.css'), 'utf8');
const headingSelector = 'h1, h2, h3, h4, h5, h6';
let reducedMotion = false;

function execute(name) {
  const script = document.createElement('script');
  script.textContent = scripts[name];
  document.head.appendChild(script);
}

function setup(html, order = ['outliner', 'toc']) {
  window.markdownOutlinerToc?.dispose();
  delete window.markdownOutliner;
  document.body.innerHTML = `<div class="markdown-body">${html}</div>`;
  document.head.innerHTML = '';
  const style = document.createElement('style');
  style.textContent = styles;
  document.head.appendChild(style);
  document.querySelectorAll(headingSelector).forEach((heading, index) => {
    heading.dataset.top = String(index * 180);
  });
  for (const name of order) {
    execute(name);
    if (name === 'outliner') window.markdownOutliner.refresh();
    else window.markdownOutlinerToc.refresh();
  }
}

function items() { return Array.from(document.querySelectorAll('.outliner-toc-item')); }
function closeButton() { return document.querySelector('.outliner-toc-close'); }
function rail() { return document.querySelector('.outliner-toc-rail'); }
function sidebarButton() { return document.querySelector('.outliner-toc-sidebar-button'); }
function panel() { return document.querySelector('.outliner-toc-panel'); }
function resizeHandle() { return document.querySelector('.outliner-toc-resize'); }
function searchInput() { return document.querySelector('.outliner-toc-search input'); }
function visibleItems() { return items().filter(item => !item.hidden); }
function sidebarWidth() { return Number.parseFloat(document.body.style.getPropertyValue('--outliner-toc-sidebar-width')); }
function press(key, target = document.activeElement, options = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
  target.dispatchEvent(event);
  return event;
}
function filter(query) {
  searchInput().value = query;
  searchInput().dispatchEvent(new Event('input', { bubbles: true }));
}
function resizePointer(type, clientX, pointerId = 1) {
  const handle = resizeHandle();
  handle.setPointerCapture ||= jest.fn();
  handle.hasPointerCapture ||= jest.fn(() => true);
  handle.releasePointerCapture ||= jest.fn();
  const event = new MouseEvent(type, { clientX, button: 0, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  handle.dispatchEvent(event);
}
function pointer(type, pointerType = 'mouse') {
  const event = new Event(type);
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  document.querySelector('.outliner-toc').dispatchEvent(event);
}
function fold(id) {
  const section = document.getElementById(id);
  section.querySelector('.outliner-toggle').click();
}

async function flushUpdates() {
  // MutationObserver callbacks run in microtasks; rendering is batched per frame.
  await Promise.resolve();
  jest.advanceTimersByTime(32);
  await Promise.resolve();
  jest.advanceTimersByTime(32);
}

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  reducedMotion = false;
  jest.replaceProperty(window, 'innerWidth', 1200);
  window.MARKDOWN_OUTLINER_TEST_MODE = true;
  window.scrollTo = jest.fn();
  window.matchMedia = jest.fn(query => ({
    matches: query.includes('prefers-reduced-motion') && reducedMotion
  }));
  jest.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function () {
    return this.matches(headingSelector) && !this.closest('.outliner-hidden, [hidden]') ? [{}] : [];
  });
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    const top = Number(this.dataset.top || 0);
    return { top, bottom: top + 24, left: 0, right: 200, width: 200, height: 24, x: 0, y: top };
  });
});

afterEach(() => {
  window.markdownOutlinerToc?.dispose();
  delete window.markdownOutlinerToc;
  delete window.markdownOutliner;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('lists all heading levels in document order without folding controls or markup', () => {
  setup(`
    <h1>Project <em>guide</em></h1><p>Introduction</p>
    <h2>Getting started</h2><p>Instructions</p>
    <h3>Configuration</h3><h4>Options</h4><h5>Details</h5><h6>Notes</h6>
    <ul><li><h2>Heading in a list</h2><p>Details</p></li></ul>
    <h2><img alt="Diagram"> &lt;script&gt;literal text&lt;/script&gt;</h2>
  `);
  expect(items().map(item => item.textContent)).toEqual([
    'Project guide', 'Getting started', 'Configuration', 'Options', 'Details', 'Notes',
    'Heading in a list', 'Diagram <script>literal text</script>'
  ]);
  expect(items()[5].style.getPropertyValue('--toc-depth')).toBe('5');
  expect(document.querySelectorAll('.outliner-toc-mark')).toHaveLength(items().length);
  expect(document.querySelector('.outliner-toc script')).toBeNull();
  expect(document.querySelector('.outliner-toc .outliner-toggle')).toBeNull();
});

test('the rail opens with keyboard focus and Escape returns to the rail without saving a hover state', () => {
  const html = '<h1>Title</h1><p>Content</p>';
  setup(html);
  expect(panel().hidden).toBe(true);
  rail().click();
  expect(panel().hidden).toBe(false);
  expect(document.activeElement).toBe(items()[0]);
  expect(closeButton().hidden).toBe(true);
  expect(sidebarButton().closest('[hidden]')).toBeNull();
  expect(sidebarButton().getAttribute('aria-label')).toBe('Open in Sidebar');
  items()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(panel().hidden).toBe(true);
  expect(document.activeElement).toBe(rail());
  expect(rail().getAttribute('aria-expanded')).toBe('false');

  setup(html);
  expect(panel().hidden).toBe(true);
  rail().click();
  expect(panel().hidden).toBe(false);
  expect(document.activeElement).toBe(items()[0]);
  setup(html);
  expect(panel().hidden).toBe(true);
  rail().click();
  items()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(panel().hidden).toBe(true);
  expect(document.activeElement).toBe(rail());
  expect(localStorage.getItem('markdown-outliner-toc-mode')).toBeNull();
});

test('selecting a floating entry returns to the rail and scrolls to the section', () => {
  setup('<h1>Title</h1><p>Content</p><h2>Details</h2><p>More</p>');
  expect(panel().hidden).toBe(true);
  rail().click();
  expect(panel().hidden).toBe(false);
  items()[1].click();
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 156, behavior: 'smooth' });
  expect(panel().hidden).toBe(true);
  expect(document.activeElement).toBe(rail());
});

test('the sidebar remains open for navigation, pointer exit and reload, until explicitly closed', () => {
  setup('<h1>Title</h1><p>Content</p><h2>Details</h2>');
  rail().click();
  sidebarButton().click();
  expect(document.body.classList.contains('outliner-toc-sidebar')).toBe(true);
  expect(rail().hidden).toBe(true);
  items()[1].click();
  pointer('pointerleave');
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  jest.advanceTimersByTime(200);
  expect(panel().hidden).toBe(false);
  expect(localStorage.getItem('markdown-outliner-toc-mode')).toBe('sidebar');
  setup('<h1>Title</h1>');
  expect(panel().hidden).toBe(false);
  expect(sidebarButton().hidden).toBe(true);
  expect(panel().querySelector('.outliner-toc-footer')).toBeNull();
  expect(closeButton().hidden).toBe(false);
  closeButton().click();
  expect(panel().hidden).toBe(true);
  expect(document.body.classList.contains('outliner-toc-sidebar')).toBe(false);
  expect(document.activeElement).toBe(rail());
  expect(localStorage.getItem('markdown-outliner-toc-mode')).toBe('floating');
  rail().click();
  expect(closeButton().hidden).toBe(true);
  expect(sidebarButton().closest('[hidden]')).toBeNull();
  setup('<h1>Title</h1>');
  expect(panel().hidden).toBe(true);
});

test('hover opens an overlay, tolerates crossing into the panel, and closes after leaving', () => {
  setup('<h1>Title</h1><p>Content</p>');
  const previousFocus = document.activeElement;
  pointer('pointerenter');
  expect(panel().hidden).toBe(false);
  expect(document.activeElement).toBe(previousFocus);
  expect(document.body.classList.contains('outliner-toc-sidebar')).toBe(false);
  pointer('pointerleave');
  jest.advanceTimersByTime(100);
  expect(panel().hidden).toBe(false);
  pointer('pointerenter');
  jest.advanceTimersByTime(200);
  expect(panel().hidden).toBe(false);
  pointer('pointerleave');
  jest.advanceTimersByTime(200);
  expect(panel().hidden).toBe(true);
  expect(localStorage.getItem('markdown-outliner-toc-mode')).toBeNull();
});

test('dismissal suppresses reopening under the pointer until it leaves and returns', () => {
  setup('<h1>Title</h1>');
  const previousFocus = document.activeElement;
  pointer('pointerenter');
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(document.activeElement).toBe(previousFocus);
  pointer('pointerenter');
  expect(panel().hidden).toBe(true);
  pointer('pointerleave');
  pointer('pointerenter');
  expect(panel().hidden).toBe(false);
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  expect(panel().hidden).toBe(true);
});

test('keyboard interaction keeps the overlay open until focus leaves, and touch uses activation', () => {
  setup('<h1>Title</h1>');
  pointer('pointerenter', 'touch');
  expect(panel().hidden).toBe(true);
  rail().click();
  pointer('pointerleave');
  jest.advanceTimersByTime(200);
  expect(panel().hidden).toBe(false);
  const outside = document.createElement('button');
  document.body.appendChild(outside);
  outside.focus();
  jest.advanceTimersByTime(200);
  expect(panel().hidden).toBe(true);
});

test('the old open preference does not turn the new hover outline into a sidebar', () => {
  localStorage.setItem('markdown-outliner-toc-open', 'true');
  setup('<h1>Title</h1>');
  expect(panel().hidden).toBe(true);
  expect(document.body.classList.contains('outliner-toc-sidebar')).toBe(false);
});

test.each([
  ['folding first', ['outliner', 'toc']],
  ['TOC first', ['toc', 'outliner']]
])('navigation reveals only the selected branch with %s script loading', (_name, order) => {
  setup(`
    <h1 id="parent">Parent</h1><p>Introduction</p>
    <h2 id="target">Target</h2><p id="target-content">Target content</p>
    <h3 id="child">Child</h3><p id="child-content">Child content</p>
    <h2 id="sibling">Sibling</h2><p id="sibling-content">Sibling content</p>
    <h1 id="other">Other</h1><p id="other-content">Other content</p>
  `, order);
  window.markdownOutliner.collapseAll();
  rail().click();
  items().find(item => item.textContent === 'Target').click();
  for (const id of ['parent', 'target']) expect(document.getElementById(id).classList.contains('collapsed')).toBe(false);
  expect(document.getElementById('target-content').classList.contains('outliner-hidden')).toBe(false);
  for (const id of ['child', 'sibling', 'other']) expect(document.getElementById(id).classList.contains('collapsed')).toBe(true);
  for (const id of ['child-content', 'sibling-content', 'other-content']) {
    expect(document.getElementById(id).classList.contains('outliner-hidden')).toBe(true);
  }
  expect(document.querySelector('.outliner-toc').closest('.outliner-hidden')).toBeNull();
  expect(items().find(item => item.textContent === 'Target').getAttribute('aria-current')).toBe('location');
});

test('navigation reveals headings inside folded list items', () => {
  setup(`
    <h1 id="section">Section</h1>
    <ul><li id="list-parent">Parent<ul>
      <li id="list-child"><h2 id="target">Nested heading</h2><p id="details">Details</p></li>
      <li id="list-sibling">Sibling<p>Keep folded</p></li>
    </ul></li></ul>
  `);
  window.markdownOutliner.collapseAll();
  rail().click();
  items().find(item => item.textContent === 'Nested heading').click();
  expect(document.getElementById('target').closest('.outliner-hidden')).toBeNull();
  expect(document.getElementById('details').closest('.outliner-hidden')).toBeNull();
  expect(document.getElementById('list-sibling').classList.contains('collapsed')).toBe(true);
});

test('duplicate heading labels and missing IDs navigate to the correct elements', () => {
  reducedMotion = true;
  setup('<h2>Same</h2><p>First</p><h2>Same</h2><p>Second</p>');
  rail().click();
  items()[1].click();
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 156, behavior: 'instant' });
  rail().click();
  items()[0].click();
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'instant' });
  expect(document.querySelectorAll('.markdown-body [id]')).toHaveLength(0);
});

test('scroll tracking skips folded headings and updates the highlighted entry', async () => {
  setup('<h1 id="a">First</h1><h2 id="b">Nested</h2><p>Nested content</p><h1 id="c">Last</h1><p>Last content</p>');
  expect(items()[0].getAttribute('aria-current')).toBe('location');
  document.getElementById('a').dataset.top = '-100';
  document.getElementById('b').dataset.top = '40';
  window.dispatchEvent(new Event('scroll'));
  await flushUpdates();
  expect(items()[1].getAttribute('aria-current')).toBe('location');
  expect(document.querySelectorAll('.outliner-toc-mark.is-active')).toHaveLength(1);
  expect(document.querySelectorAll('.outliner-toc-mark')[1].classList.contains('is-active')).toBe(true);
  fold('a');
  await flushUpdates();
  expect(items()[0].getAttribute('aria-current')).toBe('location');
  expect(items()[1].hasAttribute('aria-current')).toBe(false);
});

test('heading edits, additions, removals, and preview replacement update the TOC', async () => {
  setup('<h1 id="title"><em>Before</em></h1><p>Content</p>');
  document.querySelector('#title em').firstChild.data = 'After';
  await flushUpdates();
  expect(items()[0].textContent).toBe('After');
  document.querySelector('.markdown-body').insertAdjacentHTML('beforeend', '<h2>Added</h2>');
  await flushUpdates();
  expect(items().map(item => item.textContent)).toEqual(['After', 'Added']);
  document.querySelector('h2').remove();
  await flushUpdates();
  expect(items()).toHaveLength(1);

  const replacement = document.createElement('div');
  replacement.className = 'markdown-body';
  replacement.innerHTML = '<h3>Replacement</h3>';
  document.querySelector('.markdown-body').replaceWith(replacement);
  window.dispatchEvent(new Event('vscode.markdown.updateContent'));
  await flushUpdates();
  expect(items().map(item => item.textContent)).toEqual(['Replacement']);
  expect(document.querySelectorAll('.outliner-toc')).toHaveLength(1);
});

test('folding does not rebuild the TOC or move keyboard focus', async () => {
  setup('<h1 id="title">Title</h1><p>Content</p>');
  rail().click();
  const button = items()[0];
  button.focus();
  fold('title');
  await flushUpdates();
  expect(items()[0]).toBe(button);
  expect(document.activeElement).toBe(button);
  expect(button.textContent).toBe('Title');
});

test('empty documents hide both controls, and adding a heading makes the TOC available', async () => {
  setup('<p>No headings</p>');
  expect(document.querySelector('.outliner-toc').hidden).toBe(true);
  document.querySelector('.markdown-body').innerHTML = '<h1>New heading</h1>';
  await flushUpdates();
  expect(document.querySelector('.outliner-toc').hidden).toBe(false);
  document.querySelector('h1').remove();
  await flushUpdates();
  expect(document.querySelector('.outliner-toc').hidden).toBe(true);
  expect(document.body.classList.contains('outliner-toc-sidebar')).toBe(false);
});

test('script reload and full body replacement keep a single working TOC', async () => {
  setup('<h1>First</h1><p>Content</p>');
  pointer('pointerenter');
  pointer('pointerleave');
  execute('toc');
  window.markdownOutlinerToc.refresh();
  expect(document.querySelectorAll('.outliner-toc')).toHaveLength(1);
  expect(panel().hidden).toBe(true);
  document.body.innerHTML = '<div class="markdown-body"><h1>New document</h1></div>';
  await flushUpdates();
  expect(document.querySelectorAll('.outliner-toc')).toHaveLength(1);
  rail().click();
  jest.advanceTimersByTime(200);
  expect(panel().hidden).toBe(false);
  items()[0].click();
  expect(window.scrollTo).toHaveBeenCalledTimes(1);
});

test('storage failures do not prevent opening, closing, or navigation', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable'); });
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable'); });
  setup('<h1>Title</h1>', ['toc']);
  rail().click();
  sidebarButton().click();
  items()[0].click();
  expect(panel().hidden).toBe(false);
  expect(window.scrollTo).toHaveBeenCalledTimes(1);
});

test('a document rendered directly in the body cannot fold the TOC or create an empty-section toggle', () => {
  setup('<h1 id="title">Title</h1><p>Content</p><h1 id="empty">Empty section</h1>', ['toc']);
  const markdown = document.querySelector('.markdown-body');
  markdown.replaceWith(...markdown.childNodes);
  execute('outliner');
  window.markdownOutliner.refresh();
  expect(document.getElementById('empty').querySelector('.outliner-toggle')).toBeNull();
  fold('title');
  expect(document.querySelector('.outliner-toc').classList.contains('outliner-hidden')).toBe(false);
});

test('dragging the pinned edge adjusts width in both directions and saves only on release', () => {
  setup('<h1>Title</h1><h2>Details</h2>');
  rail().click();
  expect(resizeHandle().hidden).toBe(true);
  sidebarButton().click();
  expect(resizeHandle().hidden).toBe(false);
  resizePointer('pointerdown', 900);
  resizePointer('pointermove', 800, 2);
  expect(sidebarWidth()).toBe(288);
  resizePointer('pointermove', 800);
  expect(sidebarWidth()).toBe(388);
  expect(localStorage.getItem('markdown-outliner-toc-width')).toBeNull();
  resizePointer('pointermove', 900);
  expect(sidebarWidth()).toBe(288);
  resizePointer('pointermove', 780);
  resizePointer('pointerup', 780);
  expect(sidebarWidth()).toBe(408);
  expect(localStorage.getItem('markdown-outliner-toc-width')).toBe('408');
  expect(document.body.classList.contains('outliner-toc-resizing')).toBe(false);
  expect(resizeHandle().getAttribute('aria-valuenow')).toBe('408');
  expect(resizeHandle().releasePointerCapture).toHaveBeenCalledWith(1);
  setup('<h1>Reloaded</h1>');
  expect(sidebarWidth()).toBe(408);
  expect(panel().hidden).toBe(false);
});

test('viewport resizing temporarily clamps the width without losing the saved preference', () => {
  localStorage.setItem('markdown-outliner-toc-mode', 'sidebar');
  localStorage.setItem('markdown-outliner-toc-width', '520');
  setup('<h1>Title</h1>');
  expect(sidebarWidth()).toBe(520);
  window.innerWidth = 320;
  window.dispatchEvent(new Event('resize'));
  expect(sidebarWidth()).toBe(288);
  // Simply clicking the edge is not a width change.
  resizePointer('pointerdown', 32);
  resizePointer('pointerup', 32);
  expect(localStorage.getItem('markdown-outliner-toc-width')).toBe('520');
  window.innerWidth = 1200;
  window.dispatchEvent(new Event('resize'));
  expect(sidebarWidth()).toBe(520);
});

test('dragging and keyboard resizing respect bounds and leave room for the document', () => {
  setup('<h1>Title</h1>');
  sidebarButton().click();
  resizePointer('pointerdown', 900);
  resizePointer('pointermove', 1700);
  resizePointer('pointerup', 1700);
  expect(sidebarWidth()).toBe(224);
  press('ArrowLeft', resizeHandle());
  expect(sidebarWidth()).toBe(240);
  press('ArrowLeft', resizeHandle(), { shiftKey: true });
  expect(sidebarWidth()).toBe(304);
  press('ArrowRight', resizeHandle());
  expect(sidebarWidth()).toBe(288);
  press('End', resizeHandle());
  expect(sidebarWidth()).toBe(560);
  window.innerWidth = 901;
  window.dispatchEvent(new Event('resize'));
  expect(sidebarWidth()).toBe(421);
  expect(resizeHandle().getAttribute('aria-valuemax')).toBe('421');
  press('Home', resizeHandle());
  expect(sidebarWidth()).toBe(224);
  expect(localStorage.getItem('markdown-outliner-toc-width')).toBe('224');
});

test.each(['pointercancel', 'lostpointercapture', 'blur', 'Escape', 'dispose'])(
  '%s during a drag cancels the change and removes resize state', action => {
    setup('<h1>Title</h1>');
    sidebarButton().click();
    resizePointer('pointerdown', 900);
    resizePointer('pointermove', 800);
    expect(sidebarWidth()).toBe(388);
    if (action === 'blur') window.dispatchEvent(new Event('blur'));
    else if (action === 'Escape') press('Escape', resizeHandle());
    else if (action === 'dispose') window.markdownOutlinerToc.dispose();
    else resizePointer(action, 800);
    expect(document.body.classList.contains('outliner-toc-resizing')).toBe(false);
    expect(localStorage.getItem('markdown-outliner-toc-width')).toBeNull();
    if (action !== 'dispose') {
      expect(sidebarWidth()).toBe(288);
      expect(panel().hidden).toBe(false);
    } else expect(document.body.style.getPropertyValue('--outliner-toc-sidebar-width')).toBe('');
  }
);

test.each(['not-a-width', 'Infinity', '-10', '0', ''])(
  'invalid saved width %j uses the default', value => {
    localStorage.setItem('markdown-outliner-toc-width', value);
    setup('<h1>Title</h1>');
    expect(sidebarWidth()).toBe(288);
  }
);

test('search opens only for an unmodified slash within the TOC and filters plain heading text', () => {
  setup('<h1>Guide</h1><h2>Advanced Configuration</h2><h2>Basic Configuration</h2><h3>Paths / URLs</h3>');
  expect(searchInput().closest('[hidden]')).not.toBeNull();
  expect(press('/', document.body).defaultPrevented).toBe(false);
  rail().focus();
  expect(press('/', rail(), { ctrlKey: true }).defaultPrevented).toBe(false);
  expect(panel().hidden).toBe(true);
  press('/');
  expect(panel().hidden).toBe(false);
  expect(document.activeElement).toBe(searchInput());
  filter(' CONFIG advanced ');
  expect(visibleItems().map(item => item.textContent)).toEqual(['Advanced Configuration']);
  expect(document.querySelectorAll('.markdown-body h1, .markdown-body h2, .markdown-body h3')).toHaveLength(4);
  expect(document.querySelectorAll('.outliner-toc-mark')).toHaveLength(4);
  expect(press('/').defaultPrevented).toBe(false);
  filter('/');
  expect(visibleItems().map(item => item.textContent)).toEqual(['Paths / URLs']);
  expect(localStorage.getItem('markdown-outliner-toc-mode')).toBeNull();
});

test.each([false, true])('Escape dismisses search first, then the outline (pinned: %s)', pinned => {
  setup('<h1>Title</h1><h2>Details</h2>');
  rail().click();
  if (pinned) sidebarButton().click();
  press('/');
  filter('Details');
  press('Escape');
  expect(searchInput().closest('[hidden]')).not.toBeNull();
  expect(searchInput().value).toBe('');
  expect(visibleItems()).toHaveLength(2);
  expect(panel().hidden).toBe(false);
  expect(document.activeElement).toBe(items()[0]);
  expect(document.body.classList.contains('outliner-toc-sidebar')).toBe(pinned);
  press('Escape');
  expect(panel().hidden).toBe(true);
  expect(document.activeElement).toBe(rail());
});

test.each([false, true])('Enter reveals a filtered folded heading and clears search (pinned: %s)', pinned => {
  setup('<h1 id="parent">Parent</h1><h2 id="target">Target</h2><p>Details</p><h1 id="other">Other</h1><p>Keep folded</p>');
  window.markdownOutliner.collapseAll();
  rail().click();
  if (pinned) sidebarButton().click();
  press('/');
  filter('target');
  press('Enter');
  expect(document.getElementById('target').closest('.outliner-hidden')).toBeNull();
  expect(document.getElementById('parent').classList.contains('collapsed')).toBe(false);
  expect(document.getElementById('other').classList.contains('collapsed')).toBe(true);
  expect(window.scrollTo).toHaveBeenLastCalledWith({ top: 156, behavior: 'smooth' });
  expect(searchInput().value).toBe('');
  expect(searchInput().closest('[hidden]')).not.toBeNull();
  expect(visibleItems()).toHaveLength(3);
  expect(panel().hidden).toBe(!pinned);
  expect(document.activeElement).toBe(pinned ? items()[1] : rail());
});

test('search supports keyboard result selection and a safe empty state', () => {
  setup('<h1>Title</h1><h2>First match</h2><h2>Other</h2><h2>Second match</h2>');
  rail().click();
  press('/');
  filter('match');
  press('ArrowDown');
  expect(document.activeElement).toBe(items()[1]);
  press('ArrowDown');
  expect(document.activeElement).toBe(items()[3]);
  press('ArrowUp');
  press('ArrowUp');
  expect(document.activeElement).toBe(searchInput());
  filter('<script>');
  expect(visibleItems()).toHaveLength(0);
  expect(document.querySelector('.outliner-toc-empty').hidden).toBe(false);
  press('Enter');
  press('ArrowDown');
  expect(window.scrollTo).not.toHaveBeenCalled();
  expect(document.activeElement).toBe(searchInput());
  expect(document.querySelector('.outliner-toc').hidden).toBe(false);
  expect(panel().hidden).toBe(false);
  filter('');
  expect(visibleItems()).toHaveLength(4);
  expect(document.querySelector('.outliner-toc-empty').hidden).toBe(true);
});

test('IME composition keys do not submit search or dismiss the floating outline', () => {
  setup('<h1>Title</h1><h2>Details</h2>');
  rail().click();
  press('/');
  filter('Details');
  expect(press('Enter', searchInput(), { isComposing: true }).defaultPrevented).toBe(false);
  expect(press('Escape', searchInput(), { isComposing: true }).defaultPrevented).toBe(false);
  expect(window.scrollTo).not.toHaveBeenCalled();
  expect(panel().hidden).toBe(false);
  expect(searchInput().closest('[hidden]')).toBeNull();
  expect(searchInput().value).toBe('Details');
});

test('choosing the already active search result reveals its position in the restored sidebar', () => {
  setup('<h1>Current section</h1><h2>Other section</h2>');
  sidebarButton().click();
  press('/');
  filter('Current section');
  const navigation = document.querySelector('.outliner-toc-items');
  items()[0].dataset.top = '600';
  navigation.scrollTop = 0;
  press('Enter');
  expect(searchInput().closest('[hidden]')).not.toBeNull();
  expect(navigation.scrollTop).toBeGreaterThan(0);
  expect(document.activeElement).toBe(items()[0]);
});

test('a live heading rebuild preserves the query and input focus, without following reading progress', async () => {
  setup('<h1 id="first">First</h1><h2 id="target">Target</h2>');
  rail().click();
  press('/');
  filter('target');
  const navigation = document.querySelector('.outliner-toc-items');
  navigation.scrollTop = 120;
  document.getElementById('target').dataset.top = '20';
  window.dispatchEvent(new Event('scroll'));
  await flushUpdates();
  expect(navigation.scrollTop).toBe(120);
  document.getElementById('target').lastChild.textContent = 'Renamed';
  await flushUpdates();
  expect(searchInput().value).toBe('target');
  expect(document.activeElement).toBe(searchInput());
  expect(visibleItems()).toHaveLength(0);
  document.querySelector('.markdown-body').insertAdjacentHTML('beforeend', '<h2>New Target</h2>');
  await flushUpdates();
  expect(visibleItems().map(item => item.textContent)).toEqual(['New Target']);
  expect(document.querySelector('.outliner-toc-empty').hidden).toBe(true);
  expect(document.activeElement).toBe(searchInput());
});

test('search retains focus when the pointer leaves, and resets when the outline is dismissed or reloaded', () => {
  setup('<h1>Title</h1><h2>Details</h2>');
  rail().click();
  press('/');
  filter('Details');
  searchInput().dispatchEvent(new Event('pointerdown', { bubbles: true }));
  pointer('pointerleave');
  jest.advanceTimersByTime(200);
  expect(panel().hidden).toBe(false);
  sidebarButton().click();
  expect(searchInput().value).toBe('Details');
  expect(document.activeElement).toBe(searchInput());
  execute('toc');
  window.markdownOutlinerToc.refresh();
  expect(document.querySelectorAll('.outliner-toc-search')).toHaveLength(1);
  expect(searchInput().closest('[hidden]')).not.toBeNull();
  expect(searchInput().value).toBe('');
  closeButton().click();
  rail().click();
  press('/');
  filter('Details');
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  expect(panel().hidden).toBe(true);
  rail().click();
  expect(visibleItems()).toHaveLength(2);
  expect(searchInput().value).toBe('');
});

test('width changes and search remain usable when browser storage is unavailable', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable'); });
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable'); });
  setup('<h1>Title</h1><h2>Details</h2>', ['toc']);
  sidebarButton().click();
  press('ArrowLeft', resizeHandle());
  expect(sidebarWidth()).toBe(304);
  press('/', items()[0]);
  filter('Details');
  press('Enter');
  expect(window.scrollTo).toHaveBeenCalledTimes(1);
  expect(panel().hidden).toBe(false);
});
