# SCode Analyzer(AST-Eroid)

A powerful code analysis and visualization tool for VS Code.

## Features

- 3D visualization of code structure
- AST analysis and visualization
- Module dependency analysis
- Vulnerability detection
- Interactive code navigation

## Requirements

- VS Code 1.60.0 or higher
- Node.js 14.0.0 or higher
- Python 3.7 or higher (for backend analysis)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Zane-Dev14/SCode
cd SCode
```

2. Install dependencies:
```bash
npm install
```

3. Build the extension:
```bash
npm run build
```

4. Install the extension in VS Code:
   - Press F5 in VS Code to start debugging
   - Or package the extension and install it manually

## Usage

1. Open a project in VS Code
2. Press Ctrl+Shift+P (Cmd+Shift+P on macOS)
3. Type "SCode: Analyze Project" and press Enter
4. Wait for the analysis to complete
5. The visualization will open in a new panel

## Development

- `npm run watch` - Start webpack in watch mode
- `npm run build` - Build the extension
- `npm test` - Run tests (when implemented)

## Project Structure

```
scode-analyzer/
├── src/                    # Extension source code
│   ├── extension.js        # Main extension file
│   ├── pythonSetup.js      # Python backend setup
│   ├── visualizationPanel.js # Visualization panel
│   └── analyzeCaller.js    # Analysis logic
├── media/                  # Webview resources
│   ├── components/         # React components
│   ├── shaders/           # GLSL shaders
│   ├── utils/             # Utility functions
│   ├── main.js            # Webview entry point
│   └── main.css           # Styles
├── backend/               # Python backend
│   ├── api.py            # API server
│   └── requirements.txt   # Python dependencies
└── dist/                 # Built extension
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT
