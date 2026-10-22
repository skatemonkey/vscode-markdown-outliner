const fs = require('fs');
const path = require('path');
const sources = Object.fromEntries(['blocks', 'layout', 'outliner'].map(name => [name,
  fs.readFileSync(path.join(__dirname, `../media/${name}.js`), 'utf8')]));
const globals = { blocks: 'markdownOutlinerBlocks', layout: 'markdownOutlinerLayout', outliner: 'markdownOutliner' };
const block = () => document.querySelector('#wide');
const control = () => document.querySelector('.outliner-layout-blocks');

function execute(name = 'blocks') {
  const script = document.createElement('script');
  script.textContent = sources[name];
  document.head.appendChild(script);
  window[globals[name]].refresh();
}

// jsdom does not lay out CSS; real geometry is covered by the browser checks.
function measure(element, { wide = true } = {}) {
  Object.defineProperties(element, {
    clientWidth: { configurable: true, get: () => 800 },
    scrollWidth: { configurable: true, get: () => wide ? 1400 : 800 }
  });
  element.getBoundingClientRect = () => {
    const hidden = element.closest('.outliner-hidden');
    return { top: 120, bottom: 220, left: 200, right: 1000, width: hidden ? 0 : 800, height: hidden ? 0 : 100 };
  };
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
  document.head.innerHTML = '<style>.outliner-hidden { display: none }</style>';
  document.body.innerHTML = '<div class="markdown-body"><h1>Title</h1><p id="intro">Keep this text centered.</p><table id="wide" data-line="3"><tbody><tr><td>Wide table</td></tr></tbody></table><table id="small"><tbody><tr><td>Small table</td></tr></tbody></table><pre><code>Unchanged code</code><button class="code-block-copy-button">Copy</button></pre></div>';
  document.body.className = '';
  document.body.style.cssText = 'padding: 0 26px; --outliner-layout-sidebar-space: 0px;';
  document.body.getBoundingClientRect = () => ({ left: 34, right: 1166, width: 1132 });
  jest.spyOn(document.body, 'clientWidth', 'get').mockReturnValue(1132);
  window.MARKDOWN_OUTLINER_TEST_MODE = true;
  measure(block());
  measure(document.querySelector('#small'), { wide: false });
});

afterEach(() => {
  window.markdownOutlinerLayout?.dispose();
  window.markdownOutlinerBlocks?.dispose();
  delete window.markdownOutlinerBlocks;
  delete window.markdownOutlinerLayout;
  delete window.markdownOutliner;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test.each([['blocks', 'layout'], ['layout', 'blocks']])('one toolbar action expands/restores all wide tables in load order %s, %s', (first, second) => {
  const element = block(), parent = element.parentElement, cell = element.querySelector('td');
  const intro = document.querySelector('#intro').outerHTML;
  const flow = document.createElement('div');
  flow.style.overflowX = 'auto';
  flow.innerHTML = '<table><tbody><tr><td>Flow</td></tr></tbody></table>';
  document.querySelector('.markdown-body').appendChild(flow);
  measure(flow);
  execute(first);
  execute(second);
  expect(control().getAttribute('aria-label')).toBe('Expand all');
  expect(control().disabled).toBe(false);
  const widthButton = document.querySelector('.outliner-layout-button');
  const popover = document.querySelector('.outliner-layout-popover');
  expect(control().previousElementSibling).toBe(widthButton);
  expect(popover.contains(control())).toBe(false);
  expect(popover.hidden).toBe(true);
  expect(document.querySelector('.markdown-body button:not(.code-block-copy-button)')).toBeNull();
  const editorClick = jest.fn();
  document.body.addEventListener('click', editorClick);
  control().click();
  expect(control().getAttribute('aria-label')).toBe('Restore all');
  expect(popover.hidden).toBe(true);
  expect(element.classList.contains('outliner-block-expanded')).toBe(true);
  expect(flow.classList.contains('outliner-block-expanded')).toBe(true);
  expect(flow.querySelector('.outliner-block')).toBeNull();
  expect(document.querySelector('#small').classList.contains('outliner-block-expanded')).toBe(false);
  expect(element.style.getPropertyValue('--outliner-block-width')).toBe('1080px');
  expect(element.style.getPropertyValue('--outliner-block-offset')).toBe('-140px');
  expect(editorClick).not.toHaveBeenCalled();
  expect(element.parentElement).toBe(parent);
  expect(element.querySelector('td')).toBe(cell);
  expect(element.dataset.line).toBe('3');
  expect(document.querySelector('#intro').outerHTML).toBe(intro);
  widthButton.click();
  expect(popover.hidden).toBe(false);
  control().click();
  expect(popover.hidden).toBe(true);
  expect(control().getAttribute('aria-label')).toBe('Expand all');
  expect(document.querySelector('.outliner-block-expanded')).toBeNull();
  expect(element.style.getPropertyValue('--outliner-block-width')).toBe('');
  document.body.removeEventListener('click', editorClick);
});

test('code blocks and their wrappers are untouched, including wrapped code and native copy buttons', () => {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display: flex; overflow-x: auto;';
  wrapper.innerHTML = '<pre style="white-space:pre-wrap"><code><div>Long code</div></code><button class="code-block-copy-button">Copy</button></pre>';
  document.querySelector('.markdown-body').appendChild(wrapper);
  measure(wrapper);
  measure(wrapper.querySelector('pre'));
  const originals = Array.from(document.querySelectorAll('pre')).map(element => element.outerHTML);
  const originalWrapper = wrapper.outerHTML;
  execute();
  execute('layout');
  control().click();
  expect(Array.from(document.querySelectorAll('pre')).map(element => element.outerHTML)).toEqual(originals);
  expect(wrapper.outerHTML).toBe(originalWrapper);
  control().click();
  expect(Array.from(document.querySelectorAll('pre')).map(element => element.outerHTML)).toEqual(originals);
});

test('horizontal flex flows are targets without decorating their children', () => {
  const flow = document.createElement('div');
  flow.style.overflowX = 'auto';
  flow.innerHTML = '<div style="display:flex"><div>First</div><div>Next</div></div>';
  document.querySelector('.markdown-body').appendChild(flow);
  measure(flow);
  execute();
  window.markdownOutlinerBlocks.setExpanded(true);
  expect(flow.classList.contains('outliner-block-expanded')).toBe(true);
  expect(flow.querySelector('.outliner-block')).toBeNull();
});

test('sidebar and viewport changes update expansion without overwriting page width', async () => {
  execute();
  execute('layout');
  control().click();
  const preference = document.body.style.getPropertyValue('--outliner-document-width');
  document.body.style.setProperty('--outliner-layout-sidebar-space', '288px');
  window.dispatchEvent(new Event('markdown-outliner.layoutChanged'));
  await flush();
  expect(block().style.getPropertyValue('--outliner-block-width')).toBe('792px');
  expect(document.body.style.getPropertyValue('--outliner-document-width')).toBe(preference);
  document.body.style.setProperty('--outliner-layout-sidebar-space', '0px');
  await flush();
  expect(block().style.getPropertyValue('--outliner-block-width')).toBe('1080px');
});

test('global expansion applies when folded tables are revealed and restore also works while folded', async () => {
  execute('outliner');
  execute();
  execute('layout');
  document.querySelector('h1 .outliner-toggle').click();
  await flush();
  control().click();
  expect(block().classList.contains('outliner-block-expanded')).toBe(false);
  document.querySelector('h1 .outliner-toggle').click();
  await flush();
  expect(block().classList.contains('outliner-block-expanded')).toBe(true);
  document.querySelector('h1 .outliner-toggle').click();
  await flush();
  control().click();
  document.querySelector('h1 .outliner-toggle').click();
  await flush();
  expect(block().classList.contains('outliner-block-expanded')).toBe(false);
});

test('existing list folding and saved keys survive expansion without new nodes or controls', () => {
  document.querySelector('.markdown-body').insertAdjacentHTML('beforeend', '<ul><li>Label<table id="nested"><tbody><tr><td>Nested table</td></tr></tbody></table></li></ul>');
  const table = document.querySelector('#nested');
  measure(table);
  execute('outliner');
  const item = document.querySelector('li');
  const { getListContent, getElementKey } = window.markdownOutliner._test;
  const key = getElementKey(item);
  execute();
  window.markdownOutlinerBlocks.setExpanded(true);
  expect(getListContent(item)).toEqual([table]);
  expect(getElementKey(item)).toBe(key);
  expect(item.querySelectorAll('.outliner-list-toggle')).toHaveLength(1);
  expect(table.parentElement).toBe(item);
});

test('live preview replacement inherits the mode and newly added tables expand too', async () => {
  execute();
  execute('layout');
  control().click();
  const old = block();
  const replacement = old.cloneNode(true);
  replacement.className = '';
  replacement.removeAttribute('style');
  measure(replacement);
  old.replaceWith(replacement);
  window.dispatchEvent(new Event('vscode.markdown.updateContent'));
  await flush();
  expect(old.classList.contains('outliner-block')).toBe(false);
  expect(replacement.classList.contains('outliner-block-expanded')).toBe(true);
  expect(control().getAttribute('aria-label')).toBe('Restore all');
  const added = replacement.cloneNode(true);
  added.removeAttribute('id');
  added.className = '';
  added.removeAttribute('style');
  measure(added);
  replacement.after(added);
  await flush();
  expect(added.classList.contains('outliner-block-expanded')).toBe(true);
  expect(document.querySelectorAll('.outliner-layout-blocks')).toHaveLength(1);
});

test('documents without tables disable the action and it becomes available after an edit', async () => {
  document.querySelectorAll('table').forEach(element => element.remove());
  execute('layout');
  execute();
  expect(control().disabled).toBe(true);
  expect(control().title).toBe('No tables or flow layouts in this document');
  const table = document.createElement('table');
  table.innerHTML = '<tbody><tr><td>Added</td></tr></tbody>';
  measure(table);
  document.querySelector('.markdown-body').appendChild(table);
  await flush();
  expect(control().disabled).toBe(false);
  control().click();
  table.remove();
  await flush();
  expect(control().disabled).toBe(false); // The current mode can still be restored.
  control().click();
  expect(control().disabled).toBe(true);
});

test('observers settle, layout reload retains the mode, and block reload/disposal restores source styles', async () => {
  block().style.width = '90%';
  execute();
  execute('layout');
  control().click();
  await flush();
  const changes = jest.fn();
  const watch = new MutationObserver(changes);
  watch.observe(document.body, { subtree: true, attributes: true, childList: true });
  await flush();
  await flush();
  expect(changes).not.toHaveBeenCalled();
  watch.disconnect();
  execute('layout');
  expect(control().getAttribute('aria-label')).toBe('Restore all');
  expect(document.querySelectorAll('.outliner-layout-blocks')).toHaveLength(1);
  execute();
  expect(control().getAttribute('aria-label')).toBe('Expand all');
  expect(document.querySelector('.outliner-block-expanded')).toBeNull();
  window.markdownOutlinerBlocks.dispose();
  expect(block().className).toBe('');
  expect(block().style.width).toBe('90%');
  expect(control().disabled).toBe(true);
  window.dispatchEvent(new Event('resize'));
  await flush();
  expect(document.querySelector('.outliner-block')).toBeNull();
});
