# VSCode Markdown Outliner

A VSCode extension that adds collapsible sections to the markdown preview, making it easy to navigate and organize long documents.

**Repository**: https://github.com/timabell/vscode-markdown-outliner

**Marketplace**: https://marketplace.visualstudio.com/items?itemName=timabell.markdown-outliner

![screenshot of vscode with plugin in action](doc/screenshot.png)

## Features

- **Collapsible Headings**: Click the triangle icon next to any heading to collapse/expand all content under that heading
- **Collapsible Lists**: Fold content within list items, including nested lists, paragraphs, tables, quotes, and code
- **Context Menu**: Right-click any triangle icon for options to collapse/expand all sections
- **Persistent State**: Your collapse/expand preferences are saved and restored when you reopen files

## Usage

1. Open any markdown file in VSCode
2. Open the preview pane (Ctrl/Cmd + Shift + V)
3. Hover over a heading or parent list item to reveal its triangle icon (▶/▼), then click the icon to collapse/expand it. Toggles sit in the left margin, before heading text or the list's bullet or number, and stay visible while collapsed. You can also focus a toggle with Tab and use Enter or Space.
4. Right-click any triangle icon to access:
   - **Collapse All** - Collapse all nested sections under this heading/list
   - **Expand All** - Expand all nested sections under this heading/list
   - **Collapse All in Document** - Collapse all sections in the entire document
   - **Expand All in Document** - Expand all sections in the entire document

### Headings

When you collapse a heading, all content up to the next heading of the same or higher level will be hidden. Headings inside list items use the list item's folding control.

Example:
```markdown
## Section 1
Content here...
### Subsection 1.1
More content...
## Section 2
```

Clicking the triangle at the start of the "Section 1" heading will hide everything until "Section 2".

### Lists

List items with additional block content get collapse/expand controls. Folding keeps the opening text or block visible and hides subsequent content. Nested items retain their independent collapsed states.

For example:

```markdown
- Item 1
  - Sub-item 1.1
  - Sub-item 1.2
- Item 2
```

## Testing Locally

### Quick Start

1. **Install dependencies:**
   ```bash
   npm ci
   ```

2. **Compile the TypeScript:**
   ```bash
   npm run compile
   ```

3. **Run the extension:**
   - Open this folder in VSCode
   - Press `F5` (or Run → Start Debugging)
   - VSCode will compile the TypeScript and open a new window with `[Extension Development Host]` in the title bar
   - In that new window, open the included [test-sample.md](test-sample.md) file
   - Press `Ctrl/Cmd + Shift + V` to open the markdown preview
   - You should see triangle icons (▶/▼) next to headings and nested list items

4. **Test the features:**
   - Click the triangles to collapse/expand individual sections
   - Right-click any triangle to collapse/expand all children or all in document
   - Collapse state is automatically saved and restored
   - Check hover visibility, keyboard controls, native list markers, and independent nested folding

### Development Workflow

For active development with auto-recompilation:

```bash
npm run watch
```

This watches TypeScript files and recompiles the extension host code. The preview JavaScript and CSS are loaded directly. After making changes:
- In the Extension Development Host window, press `Ctrl/Cmd + R` to reload the window
- Or use the "Developer: Reload Window" command from the Command Palette

### Automated Checks

For behavior changes, add or update regression tests and run these commands from the repository root:

```bash
npm test -- --runInBand
npm run lint
```

The test command compiles TypeScript via `pretest`, then runs Jest with jsdom. Lint currently checks only TypeScript in `src/`; the preview JavaScript is outside lint coverage.

jsdom does not verify real browser geometry or VS Code preview updates, so use the [Quick Start](#quick-start) steps for manual preview checks. For documentation-only changes, review the diff and check links.

### Debugging

- Set breakpoints in [src/extension.ts](src/extension.ts)
- The preview scripts ([media/outliner.js](media/outliner.js)) run in the webview context
- To debug the preview scripts, open DevTools in the preview pane:
  1. Focus the markdown preview
  2. Run command: "Developer: Open Webview Developer Tools"
  3. Check the Console tab for any errors

## Installation

### From VSCode Marketplace

1. Open VSCode
2. Go to Extensions (Ctrl/Cmd + Shift + X)
3. Search for "Markdown Outliner"
4. Click Install

Or install from the command line:
```bash
code --install-extension timabell.markdown-outliner
```

### From VSIX (for development/testing)

To package and install the extension manually:

```bash
npm install -g @vscode/vsce
vsce package
code --install-extension markdown-outliner-0.1.0.vsix
```

## Requirements

- VSCode 1.109.0 or higher

## Known Issues

- The bidirectional sync between editor folding and preview folding is not yet implemented
- Saved state uses content-derived keys, so text changes may reset folds and repeated content can share a saved state

## Development

### Code Overview

There are two execution environments: the VS Code extension host and the preview webview (a browser page). VS Code renders the Markdown, then the extension adds controls to the resulting page without changing the source document. Most behavior lives in the preview; the host entry point is currently a stub with no registered commands.

| File | Responsibility |
| --- | --- |
| [package.json](package.json) | Registers preview scripts/styles and defines build, test, and packaging commands. |
| [src/extension.ts](src/extension.ts) | Extension host entry point; compiled into the ignored `out/` directory. |
| [media/outliner.js](media/outliner.js) | Preview initialization, heading/list folding, toggle controls, context menus, and saved state. Loaded directly, without bundling. |
| [media/outliner.css](media/outliner.css) | Toggle placement, hover/focus visibility, list spacing, hidden content, and menu appearance. |
| [test/outliner.test.js](test/outliner.test.js) | Jest/jsdom behavior and regression tests using the preview script and stylesheet. |
| [test-sample.md](test-sample.md) | Manual preview examples, including nested headings, lists, and mixed block content. |
| [INSTALL.md](INSTALL.md) | Packaging and installation instructions for a local VSIX. |
| [.github/workflows/](.github/workflows/) | Build/test automation and releases. |

### Preview Initialization and Saved State

Initialization adds controls and restores collapsed state. A `MutationObserver` processes changing preview content. Keep processing safe to repeat without adding duplicate controls.

Collapsed state is stored in `localStorage` under `markdown-outliner-state`. Element keys combine the tag, parent tag, and first 100 characters of text after removing toggles. They contain no explicit document ID.

Keep changes focused, preserve independent nested folding and native list markers, and update this README when the architecture or commands change.

### CI/CD Pipeline

This project uses GitHub Actions for automated testing, building, and releases. See [doc/pipeline.md](doc/pipeline.md) for details on:
- Semantic commit conventions
- Automated version bumping
- Release workflow
- Publishing to VS Code Marketplace

## Related

This extension addresses the feature request in [microsoft/vscode#115998](https://github.com/microsoft/vscode/issues/115998).

## License

A-GPL v3
