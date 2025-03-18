#!/bin/bash

# Define the root directory
ROOT_DIR="/mnt/shared/Projects/miniproject/SCode"

# Check if root directory exists, create it if it doesn't
if [ ! -d "$ROOT_DIR" ]; then
    mkdir -p "$ROOT_DIR"
    echo "Created root directory: $ROOT_DIR"
else
    echo "Root directory already exists: $ROOT_DIR"
fi

# Change to the root directory
cd "$ROOT_DIR" || exit 1

# Create directory structure and empty files
# .vscode/
mkdir -p .vscode
touch .vscode/launch.json
touch .vscode/tasks.json

# src/
mkdir -p src
touch src/extension.ts
touch src/analyzeCaller.ts
touch src/visualizationPanel.ts

# backend/
mkdir -p backend
touch backend/analyzer.py
touch backend/project_mapper.py
touch backend/language_detector.py
touch backend/ast_generator.py
touch backend/vulnerability_scanner.py

# backend/tree-sitter-langs/
mkdir -p backend/tree-sitter-langs/build
mkdir -p backend/tree-sitter-langs/tree-sitter-python
mkdir -p backend/tree-sitter-langs/tree-sitter-javascript
mkdir -p backend/tree-sitter-langs/tree-sitter-typescript
mkdir -p backend/tree-sitter-langs/tree-sitter-java
mkdir -p backend/tree-sitter-langs/tree-sitter-cpp
mkdir -p backend/tree-sitter-langs/tree-sitter-go
mkdir -p backend/tree-sitter-langs/tree-sitter-rust
mkdir -p backend/tree-sitter-langs/tree-sitter-ruby
mkdir -p backend/tree-sitter-langs/tree-sitter-php
mkdir -p backend/tree-sitter-langs/tree-sitter-c-sharp
touch backend/vulnerabilities.db

# media/
mkdir -p media/icons
touch media/main.js
touch media/main.css

# Root-level files and directories
mkdir -p node_modules  # Typically populated by npm, left empty here
touch package.json
touch tsconfig.json
touch .vscodeignore
touch webpack.config.js
touch Dockerfile
touch .dockerignore
touch README.md

# Verify creation
echo "Verifying directory structure..."
tree "$ROOT_DIR" || echo "Tree command not installed, skipping visual verification."

echo "SCode project structure initialized successfully at $ROOT_DIR"