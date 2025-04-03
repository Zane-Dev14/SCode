# Troubleshooting SCode Analyzer

This guide helps address common issues when running the SCode Analyzer extension.

## Installation Issues

### Cannot find the extension after installation

**Solution:**
1. Check if the extension is installed in the correct location
2. Reload VS Code using the command palette: `Developer: Reload Window`
3. Check the Extensions view (`Ctrl+Shift+X`) to ensure the extension appears

## Python Environment Issues

### "Python not found" error

**Solution:**
1. Ensure Python 3.7+ is installed on your system
2. Verify Python is available in your PATH by running `python --version` or `python3 --version` in terminal
3. If using a custom Python installation, you may need to set the PATH manually

### Virtual environment creation fails

**Solution:**
1. Check the "SCode Analyzer" output panel for specific error messages
2. Ensure you have permissions to create directories in the extension folder
3. Manually create the virtual environment:
   ```
   cd /path/to/extension/backend
   python -m venv .venv
   ```
   
### Package installation fails

**Solution:**
1. Check internet connectivity
2. Manually install the required packages:
   ```
   cd /path/to/extension/backend
   # Windows
   .venv\Scripts\pip install -r requirements.txt
   # Linux/macOS
   .venv/bin/pip install -r requirements.txt
   ```

## Server Connection Issues

### "Failed to connect to Python server" error

**Solution:**
1. Check if port 5000 is already in use by another application:
   ```
   # Linux/macOS
   lsof -i :5000
   # Windows
   netstat -ano | findstr :5000
   ```
2. If port is in use, close the other application or change the port in `pythonSetup.js`
3. Check the "SCode Analyzer" output panel for specific Python errors
4. Restart VS Code and try again

### Network errors when fetching data

**Solution:**
1. Ensure your firewall isn't blocking local connections
2. Check if your anti-virus software is blocking connections to localhost
3. Try manually accessing the endpoint in a browser: http://localhost:5000/health

## Analysis Issues

### Analysis takes too long or times out

**Solution:**
1. For large codebases, the analysis may take longer - be patient
2. Check if the backend process is using excessive CPU or memory
3. Try analyzing a smaller codebase first to verify functionality

### "needs_entrypoint" keeps appearing

**Solution:**
1. Select a file that is a likely entry point (marked with "Likely Entry" tag)
2. If no suitable entry point is found, try manually specifying one in your codebase

## WebView Issues

### WebView shows an error or blank screen

**Solution:**
1. Check the developer console by opening the Command Palette and running "Developer: Toggle Developer Tools"
2. Look for JavaScript errors in the console
3. Verify that all required libraries are loading correctly
4. Restart VS Code and try again

### "An instance of the VS Code API has already been acquired" error

**Solution:**
1. This error is typically resolved by reloading VS Code
2. If the error persists, check the extension's code for multiple calls to `acquireVsCodeApi()`

## File Reading/Writing Issues

**Solution:**
1. Ensure you have permissions to read/write files in your workspace
2. Check if any files are locked by other processes
3. Try opening the workspace with administrator/elevated privileges

## Getting Additional Help

If you continue to experience issues:

1. Check the full logs in the "SCode Analyzer" output panel
2. Create a GitHub issue with:
   - Your operating system and version
   - VS Code version
   - Node.js version
   - Python version
   - Complete error message(s)
   - Steps to reproduce the issue
   
## Quick Restart Procedure

If all else fails, try this complete restart procedure:

1. Close VS Code
2. Delete the virtual environment folder: `/path/to/extension/backend/.venv`
3. Reopen VS Code
4. Reload the window: `Developer: Reload Window`
5. Try running the extension again 