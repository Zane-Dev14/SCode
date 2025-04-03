# SCode Analyzer

A stunning 3D visualization tool for code analysis, built as a VS Code extension.

## Features

- **3D Force-Directed Graph** - Visualize code structure with an interactive 3D graph
- **Particle Effects** - Dynamic particle animations for code flow
- **Shader-Based Rendering** - Custom GLSL shaders for beautiful visual effects
- **AST Visualization** - Explore Abstract Syntax Tree relationships
- **Module Dependencies** - Visualize module imports and exports
- **Vulnerability Detection** - Highlight potential security issues in the codebase

## Setup & Development

### Prerequisites

- VS Code
- Node.js (v14+)
- Python 3.7+ (for the backend analyzer)

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/scode-analyzer.git
cd scode-analyzer
```

2. Install dependencies
```bash
npm install
cd media
npm install
```

3. Set up Python environment (for the backend)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Building the UI

The UI uses React, Three.js, and custom shaders. To build the UI components:

```bash
cd media
npm run build
```

Or to watch for changes during development:

```bash
cd media
npm run watch
```

### Running the Extension

1. Open the project in VS Code
2. Press F5 to start the extension in debug mode
3. In the new VS Code window that opens, use the Command Palette (Ctrl+Shift+P) to run "SCode: Analyze Code"

## Architecture

The extension consists of two main parts:

1. **Python Backend** - Analyzes code and generates AST data
2. **JavaScript Frontend** - Renders the 3D visualization using:
   - React for UI components
   - Three.js for 3D rendering
   - Custom GLSL shaders for visual effects
   - D3.js for force-directed graph calculations

## UI Components

- **LoadingScreen** - Animated loading screen with particle effects
- **EntrypointSelector** - 3D file selection interface
- **CodeVisualizer** - Main 3D visualization of code structure
- **NodeMesh** - Custom 3D representation of code elements
- **EdgeMesh** - Animated connections between nodes

## Customization

You can customize the visualization by modifying:

- **Colors** - Edit the color schemes in the components
- **Shaders** - Modify GLSL shaders in the `media/shaders` directory
- **Physics** - Adjust force simulation parameters in `forceSimulation.js`
- **UI** - Modify React components in the `media/components` directory

## License

MIT
