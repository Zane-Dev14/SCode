# SCode Analyzer - Running Instructions

## Quick Start

1. **Build the Extension**:
   ```bash
   npm install
   npm run build
   ```

2. **Run the Extension**:
   - Press F5 in VS Code
   - Or run with `code --extensionDevelopmentPath=/path/to/SCode`

3. **Use the Extension**:
   - Open a folder containing code you want to analyze
   - Run the "Analyze Workspace" command from the command palette (Ctrl+Shift+P)
   - Select an entry point file if prompted
   - Explore the analysis results

## Troubleshooting

### Common Issues

1. **Python Environment Setup**:
   If the extension hangs during Python setup, try:
   ```bash
   cd backend
   python3 -m venv .venv
   .venv/bin/pip install -r requirements.txt
   ```
   Then restart VS Code and try again.

2. **Extension Not Found**:
   Make sure the dist/extension.js file exists after building.

3. **Backend Server Issues**:
   Check the "SCode Analyzer" output panel for errors.

### Viewing Logs

- View extension logs: Output panel → SCode Analyzer
- View developer tools: Help → Toggle Developer Tools

## Manual Installation

To package and install the extension manually:

```bash
npm install -g @vscode/vsce
vsce package
```

Then install the .vsix file through VS Code's Extensions view.

## Development

- Use `npm run watch` to automatically rebuild as you make changes
- To work on frontend visualization only: modify files in the `media` folder
- To work on backend analysis: modify files in the `backend` folder 