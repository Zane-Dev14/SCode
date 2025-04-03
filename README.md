# SCode Analyzer Extension

A Visual Studio Code extension for analyzing code structure and visualizing Abstract Syntax Trees (ASTs).

## Features

- Analyzes your codebase structure
- Visualizes the AST (Abstract Syntax Tree) in an interactive view
- Shows module dependencies
- Identifies potential vulnerabilities
- Self-contained - no external dependencies required

## Requirements

- Visual Studio Code 1.60.0 or higher
- Python 3.7 or higher installed on your system

## Installation

### From VSCode Marketplace

Coming soon!

### Manual Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the extension
4. Copy the entire folder to your VSCode extensions folder:
   - Windows: `%USERPROFILE%\.vscode\extensions`
   - macOS/Linux: `~/.vscode/extensions`
   - Or package using: `npm install -g vsce && vsce package`
   - Then install the `.vsix` file: `code --install-extension scode-analyzer-0.0.2.vsix`

## Usage

1. Open a folder containing code you want to analyze
2. Open the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS)
3. Run the "Analyze Workspace" command (type "scode" to find it)
4. Wait for the analysis to complete

### Analysis Process

The extension will:
1. Setup a Python environment (only first time)
2. Start the Flask backend server
3. Analyze your codebase
4. Visualize the results

### Visualization Views

- **AST View**: Tree structure of your code
- **Module Dependencies**: Shows how your modules relate to each other
- **Vulnerabilities**: Potential issues found in your code

## Troubleshooting

### Python Environment

If you encounter issues with the Python environment setup:

1. Check the "SCode Analyzer" output panel for error messages
2. You can manually set up the Python environment:
   ```
   cd path/to/extension/backend
   python -m venv .venv
   # On Windows:
   .venv\Scripts\pip install -r requirements.txt
   # On macOS/Linux:
   .venv/bin/pip install -r requirements.txt
   ```

### Backend Server

If the backend server fails to start:

1. Check if another process is using port 5000
2. Verify that Flask and other dependencies are installed
3. Check the "SCode Analyzer" output panel for error messages

### Common Errors

#### "u is not a function" Error

This error is related to the `node-fetch` package. If you encounter this:

1. Ensure you're using node-fetch version 2.x (not version 3.x which requires ESM)
2. If you're developing the extension, run `npm install node-fetch@2.6.7` 
3. Delete node_modules and package-lock.json and run `npm install` again

#### "An instance of the VS Code API has already been acquired"

This error occurs when the VSCode API is acquired multiple times:

1. Reload VS Code window using the command palette: `Developer: Reload Window`
2. If the error persists after reloading, check for multiple occurrences of `acquireVsCodeApi()` in the code

### Visualization Issues

If the visualization doesn't appear or shows errors:

1. Check browser console (open DevTools in the visualization panel)
2. Ensure your codebase has valid files that can be analyzed
3. Try analyzing a different folder

## Development

### Building and Running

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the extension: `npm run build`
4. Press F5 to start debugging

### Project Structure

- `src/`: Extension source code (JavaScript)
- `media/`: Frontend visualization code
- `backend/`: Python backend for code analysis
- `dist/`: Built extension

## License

MIT
