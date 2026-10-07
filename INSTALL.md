# Install locally

- Build from this repository's terminal:
  - First setup: `npm ci`.
  - Package: `npx --no-install vsce package --out markdown-outliner-local.vsix`.
- Install in your normal VS Code window:
  - **Ctrl+Shift+P** → **Extensions: Install from VSIX** → select `markdown-outliner-local.vsix`.
  - This replaces the existing Markdown Outliner.
  - **Ctrl+Shift+P** → **Developer: Reload Window**.
- Try it:
  - Open `test-sample.md` → **Ctrl+Shift+V** → hover over headings or parent list items.
- After future edits:
  - Package again, reinstall the VSIX, and reload VS Code.
