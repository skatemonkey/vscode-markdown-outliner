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
