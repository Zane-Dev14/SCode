#!/bin/bash

# Exit on error
set -e

# Script to copy shader files to the distribution folder
echo "Updating shader files in dist..."

# Create the target directory if it doesn't exist
mkdir -p dist/shaders

# Copy all shader files
cp -v media/shaders/*.glsl dist/shaders/

echo "Shader files updated successfully!"
echo "Note: You need to reload the extension for changes to take effect."
echo "Press F1 and select 'Developer: Reload Window' in VS Code." 