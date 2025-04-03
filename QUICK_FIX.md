# Quick Fix Guide for SCode Analyzer

This guide provides quick solutions for common errors you might encounter when using the SCode Analyzer extension.

## Fetch-Related Errors: "u is not a function" or "c is not a function"

These errors occur with the `node-fetch` package when there are version or environment compatibility issues.

### Solution 1: Use the built-in version of the extension

The latest version of the extension has replaced `node-fetch` with a built-in HTTP implementation to fix these issues.

1. **Update to the latest version**:
   ```bash
   git pull  # If using git
   npm run build
   ```

2. **Reload VS Code**:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
   - Type "Developer: Reload Window" and select it

### Solution 2: Manual fix (if updating isn't possible)

1. **Replace node-fetch with built-in http**:
   - Edit `src/extension.js` to use the built-in http module instead of node-fetch
   - Add a custom fetch implementation
   - See the QUICK_FIX_CUSTOM_FETCH.md file for details

2. **Rebuild the extension**:
   ```bash
   npm run build
   ```

3. **Reload VS Code**:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
   - Type "Developer: Reload Window" and select it

## "An instance of the VS Code API has already been acquired"

This error occurs when the VS Code API is acquired multiple times in the webview.

### Solution:

1. **Reload VS Code window**:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) 
   - Type "Developer: Reload Window" and select it

2. If the error persists after reloading:
   - Make sure the main.js file doesn't have `const vscode = acquireVsCodeApi();`
   - The VS Code API should only be acquired once in the HTML template as `window.vscode`
   - Use `window.vscode.postMessage()` instead of `vscode.postMessage()`

## "Failed to connect to Python server"

This error occurs when the extension can't start or connect to the Flask backend server.

### Solution:

1. **Check if port 5000 is already in use**:
   ```bash
   # Linux/macOS
   lsof -i :5000
   
   # Windows
   netstat -ano | findstr :5000
   ```

2. **Kill the process using port 5000** (if any):
   ```bash
   # Linux/macOS (replace PID with the actual process ID)
   kill -9 PID
   
   # Windows (replace PID with the actual process ID)
   taskkill /F /PID PID
   ```

3. **Manually set up the Python environment**:
   ```bash
   cd <extension-path>/backend
   python -m venv .venv
   
   # On Windows
   .venv\Scripts\pip install -r requirements.txt
   
   # On macOS/Linux
   .venv/bin/pip install -r requirements.txt
   ```

4. **Verify Flask is installed**:
   ```bash
   # On Windows
   .venv\Scripts\pip list | findstr Flask
   
   # On macOS/Linux
   .venv/bin/pip list | grep Flask
   ```

5. **Manually start the Flask server to test**:
   ```bash
   # On Windows
   .venv\Scripts\python api.py
   
   # On macOS/Linux
   .venv/bin/python api.py
   ```

## WebView Loading Issues

If the visualization doesn't appear or shows errors:

### Solution:

1. **Open Developer Tools**:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
   - Type "Developer: Toggle Developer Tools" and select it
   - Check the console for specific JavaScript errors

2. **Verify network requests**:
   - In Developer Tools, go to the Network tab
   - Check if requests to `http://localhost:5000` are succeeding

3. **Check extension logs**:
   - In VS Code, go to View > Output
   - Select "SCode Analyzer" from the dropdown
   - Look for specific error messages

## Node.js Dependency Issues

If you encounter errors related to Node.js dependencies:

### Solution:

1. **Clean install dependencies**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Check for compatibility issues**:
   ```bash
   npm ls
   ```
   Look for any errors or warnings in the dependency tree

3. **Update Node.js if needed**:
   Make sure you're using a recent LTS version of Node.js

## Complete Reset Procedure

If all else fails, try this complete reset procedure:

1. **Close VS Code**

2. **Delete the virtual environment**:
   ```bash
   rm -rf <extension-path>/backend/.venv
   ```

3. **Clean install dependencies**:
   ```bash
   cd <extension-path>
   rm -rf node_modules package-lock.json
   npm install
   npm install node-fetch@2.6.7 --save
   ```

4. **Rebuild the extension**:
   ```bash
   npm run build
   ```

5. **Restart VS Code and try again** 