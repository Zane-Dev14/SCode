#!/bin/bash

# Exit on error
set -e

# Print commands
set -x

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js and npm."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "npm is not installed. Please install npm."
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed. Please install Python 3."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm install
fi

# Install dev dependencies for Babel
npm install --save-dev @babel/core @babel/preset-env @babel/preset-react babel-loader style-loader css-loader

# Build the extension
echo "Building extension..."
npm run build

# Create .vscode directory if it doesn't exist
mkdir -p .vscode

# Create launch.json if it doesn't exist
if [ ! -f ".vscode/launch.json" ]; then
    echo "Creating launch.json..."
    cat > .vscode/launch.json << 'EOL'
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Run Extension",
            "type": "extensionHost",
            "request": "launch",
            "args": [
                "--extensionDevelopmentPath=${workspaceFolder}"
            ],
            "outFiles": [
                "${workspaceFolder}/dist/**/*.js"
            ],
            "preLaunchTask": "npm: build"
        }
    ]
}
EOL
fi

# Create tasks.json if it doesn't exist
if [ ! -f ".vscode/tasks.json" ]; then
    echo "Creating tasks.json..."
    cat > .vscode/tasks.json << 'EOL'
{
    "version": "2.0.0",
    "tasks": [
        {
            "type": "npm",
            "script": "build",
            "group": {
                "kind": "build",
                "isDefault": true
            },
            "problemMatcher": "$tsc-watch"
        },
        {
            "type": "npm",
            "script": "watch",
            "isBackground": true,
            "group": "build",
            "problemMatcher": "$tsc-watch"
        }
    ]
}
EOL
fi

# Provide instructions
echo ""
echo "Setup complete! To run the extension:"
echo "1. Open this folder in VSCode: code ."
echo "2. Press F5 to start debugging"
echo "3. In the new VSCode window that opens, open a project folder"
echo "4. Press Ctrl+Shift+P (or Cmd+Shift+P on Mac) and type 'Analyze Workspace'"
echo ""
echo "Alternatively, you can package the extension with:"
echo "npm install -g @vscode/vsce"
echo "vsce package"
echo "" 