const fs = require('fs');
const path = require('path');

const scripts = Object.fromEntries(['layout', 'toc', 'outliner'].map(name => [
  name, fs.readFileSync(path.join(__dirname, `../media/${name}.js`), 'utf8')
]));
const storageKey = 'markdown-outliner-document-width';
const widthProperty = '--outliner-document-width';
const button = () => document.querySelector('.outliner-layout-button');
const popover = () => document.querySelector('.outliner-layout-popover');
const slider = () => document.querySelector('.outliner-layout input');
const value = () => document.querySelector('.outliner-layout-value').textContent;

function execute(name = 'layout') {
  const script = document.createElement('script');
  script.textContent = scripts[name];
  document.head.appendChild(script);
  window[{ layout: 'markdownOutlinerLayout', toc: 'markdownOutlinerToc', outliner: 'markdownOutliner' }[name]].refresh();
}

function setWidth(width) {
  slider().value = String(width);
  slider().dispatchEvent(new Event('input', { bubbles: true }));
}

function press(key, target = document.activeElement, options = {}) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }));
}

async function flush() {
  await Promise.resolve();
  jest.advanceTimersByTime(32);
  await Promise.resolve();
  jest.advanceTimersByTime(32);
}

beforeEach(() => {
  jest.useFakeTimers();
  localStorage.clear();
  document.head.innerHTML = '';
  document.body.innerHTML = '<div class="markdown-body"><h1>Title</h1><p>Content</p><h2>Details</h2><p>More</p></div>';
  document.body.className = '';
  document.body.removeAttribute('style');
  window.MARKDOWN_OUTLINER_TEST_MODE = true;
  window.scrollTo = jest.fn();
  jest.replaceProperty(window, 'innerWidth', 1200);
  // jsdom has no layout engine. Model VS Code's padding and the existing TOC
  // reservation; actual centering and native slider gestures need browser QA.
  jest.spyOn(document.body, 'clientWidth', 'get').mockImplementation(() => window.innerWidth - 68);
  const originalStyle = window.getComputedStyle;
  jest.spyOn(window, 'getComputedStyle').mockImplementation(element => {
    if (element !== document.body) return originalStyle(element);
    return {
      paddingLeft: '26px', paddingRight: '26px',
      getPropertyValue: name => name === '--outliner-layout-sidebar-space' &&
        document.body.classList.contains('outliner-toc-sidebar') && window.innerWidth > 900
        ? document.body.style.getPropertyValue('--outliner-toc-sidebar-width') || '288px' : '0px'
    };
  });
});

afterEach(() => {
  window.markdownOutlinerLayout?.dispose();
  window.markdownOutlinerToc?.dispose();
  delete window.markdownOutlinerLayout;
  delete window.markdownOutlinerToc;
  delete window.markdownOutliner;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('opens one accessible slider on demand, returns focus on Escape, and does not forward clicks to the editor', () => {
  execute();
  expect(document.body.style.getPropertyValue(widthProperty)).toBe('800px');
  expect(popover().hidden).toBe(true);
  expect(button().getAttribute('aria-haspopup')).toBe('dialog');
  const pageClick = jest.fn();
  document.body.addEventListener('click', pageClick, { once: true });
  button().click();
  expect(pageClick).not.toHaveBeenCalled();
  document.body.removeEventListener('click', pageClick);
  expect(popover().hidden).toBe(false);
  expect(document.activeElement).toBe(slider());
  expect(button().getAttribute('aria-expanded')).toBe('true');
  expect(slider().labels[0].textContent).toBe('Page width');
  press('Escape', slider(), { isComposing: true });
  expect(popover().hidden).toBe(false);
  press('Escape');
  expect(popover().hidden).toBe(true);
  expect(document.activeElement).toBe(button());
  expect(button().getAttribute('aria-expanded')).toBe('false');
  expect(localStorage.getItem(storageKey)).toBeNull();
});

test('sliding changes width immediately, saves the preference, and restores it after script reload', () => {
  execute();
  button().click();
  setWidth(640);
  expect(document.body.style.getPropertyValue(widthProperty)).toBe('640px');
  expect(value()).toBe('640 px');
  expect(slider().getAttribute('aria-valuetext')).toBe('640 pixels');
  expect(localStorage.getItem(storageKey)).toBe('640');
  execute();
  expect(document.querySelectorAll('.outliner-layout')).toHaveLength(1);
  expect(popover().hidden).toBe(true);
  expect(slider().value).toBe('640');
});

test('the right endpoint follows the full available width after viewport changes and reloads', async () => {
  execute();
  setWidth(slider().max);
  expect(localStorage.getItem(storageKey)).toBe('full');
  expect(document.body.style.getPropertyValue(widthProperty)).toBe('100%');
  expect(value()).toBe('Full');
  jest.replaceProperty(window, 'innerWidth', 1600);
  window.dispatchEvent(new Event('resize'));
  await flush();
  expect(slider().value).toBe('1480');
  expect(slider().getAttribute('aria-valuetext')).toBe('Full width, 1480 pixels');
  execute();
  expect(value()).toBe('Full');
  setWidth(1000);
  expect(localStorage.getItem(storageKey)).toBe('1000');
});

test('small previews fit the document without overwriting its preferred width', async () => {
  localStorage.setItem(storageKey, '950');
  execute();
  jest.replaceProperty(window, 'innerWidth', 390);
  window.dispatchEvent(new Event('resize'));
  await flush();
  expect(slider().value).toBe('270');
  expect(slider().disabled).toBe(true);
  expect(value()).toBe('270 px');
  button().click();
  expect(document.activeElement).toBe(popover());
  press('Escape');
  expect(document.activeElement).toBe(button());
  expect(localStorage.getItem(storageKey)).toBe('950');
  jest.replaceProperty(window, 'innerWidth', 1200);
  window.dispatchEvent(new Event('resize'));
  await flush();
  expect(slider().value).toBe('950');
  expect(slider().disabled).toBe(false);
});

test('outside clicks, leaving keyboard focus, window blur, and the same icon dismiss without undoing the choice', () => {
  execute();
  button().click();
  setWidth(700);
  document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  expect(popover().hidden).toBe(true);
  button().click();
  const link = document.createElement('a');
  link.href = '#';
  document.body.appendChild(link);
  link.focus();
  expect(popover().hidden).toBe(true);
  expect(document.activeElement).toBe(link);
  button().click();
  window.dispatchEvent(new Event('blur'));
  expect(popover().hidden).toBe(true);
  button().click();
  button().click();
  expect(popover().hidden).toBe(true);
  expect(localStorage.getItem(storageKey)).toBe('700');
});

test.each(['invalid', '-1', '0', '479', '10001', 'Infinity', ''])('invalid stored width %j falls back safely', saved => {
  localStorage.setItem(storageKey, saved);
  execute();
  expect(slider().value).toBe('800');
});

test('blocked storage still allows live resizing', () => {
  jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable'); });
  jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable'); });
  execute();
  setWidth(610);
  expect(slider().value).toBe('610');
  expect(document.body.style.getPropertyValue(widthProperty)).toBe('610px');
});

test.each([['layout', 'outliner', 'toc'], ['toc', 'outliner', 'layout']])('works with async load order %j and keeps TOC width independent', async (...order) => {
  order.forEach(execute);
  const change = jest.fn();
  window.addEventListener('markdown-outliner.layoutChanged', change);
  document.querySelector('.outliner-toc-rail').click();
  document.querySelector('.outliner-toc-sidebar-button').click();
  await flush();
  expect(slider().max).toBe('792');
  expect(slider().value).toBe('792');
  setWidth(600);
  expect(document.body.style.getPropertyValue('--outliner-toc-sidebar-width')).toBe('288px');
  expect(localStorage.getItem(storageKey)).toBe('600');
  expect(change).toHaveBeenCalled();
  document.body.style.setProperty('--outliner-toc-sidebar-width', '500px');
  await flush();
  expect(slider().max).toBe('580');
  expect(localStorage.getItem(storageKey)).toBe('600');
  window.markdownOutliner.collapseAll();
  expect(document.querySelector('.outliner-layout').closest('.outliner-hidden')).toBeNull();
  expect(document.querySelector('.outliner-layout .outliner-toggle')).toBeNull();
  button().click();
  jest.replaceProperty(window, 'innerWidth', 600);
  window.dispatchEvent(new Event('resize'));
  await flush();
  expect(document.querySelector('.outliner-layout').hidden).toBe(true);
  expect(popover().hidden).toBe(true);
  document.querySelector('.outliner-toc-close').click();
  await flush();
  expect(document.querySelector('.outliner-layout').hidden).toBe(false);
  window.removeEventListener('markdown-outliner.layoutChanged', change);
});

test('preview replacement restores the control, remains idle after settling, and disposal cleans up', async () => {
  execute();
  setWidth(650);
  document.body.innerHTML = '<div class="markdown-body"><p>Page without headings</p></div>';
  window.dispatchEvent(new Event('vscode.markdown.updateContent'));
  await flush();
  expect(document.querySelectorAll('.outliner-layout')).toHaveLength(1);
  expect(slider().value).toBe('650');
  const listener = jest.fn();
  window.addEventListener('markdown-outliner.layoutChanged', listener);
  await flush();
  expect(listener).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
  window.markdownOutlinerLayout.dispose();
  expect(document.querySelector('.outliner-layout')).toBeNull();
  expect(document.body.classList.contains('outliner-layout-enabled')).toBe(false);
  expect(document.body.style.getPropertyValue(widthProperty)).toBe('');
  window.dispatchEvent(new Event('resize'));
  window.dispatchEvent(new Event('vscode.markdown.updateContent'));
  await flush();
  expect(document.querySelector('.outliner-layout')).toBeNull();
  window.removeEventListener('markdown-outliner.layoutChanged', listener);
});
