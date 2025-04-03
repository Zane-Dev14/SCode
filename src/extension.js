const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const http = require('http');
const pythonManager = require('./pythonSetup');

// Custom fetch implementation using Node's http module
function simpleFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
        try {
            const urlObj = new URL(url);
            const reqOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: options.headers || {}
            };

            if (options.timeout) {
                reqOptions.timeout = options.timeout;
            }

            // For debugging
            console.log(`Making ${reqOptions.method} request to ${url}`);
            
            const req = http.request(reqOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const response = {
                            ok: res.statusCode >= 200 && res.statusCode < 300,
                            status: res.statusCode,
                            statusText: res.statusMessage,
                            headers: res.headers,
                            text: () => Promise.resolve(data),
                            json: () => {
                                try {
                                    return Promise.resolve(JSON.parse(data));
                                } catch (e) {
                                    console.error('JSON parse error:', e, 'Raw data:', data);
                                    return Promise.reject(new Error(`Invalid JSON: ${e.message}`));
                                }
                            }
                        };
                        resolve(response);
                    } catch (error) {
                        console.error('Error in response processing:', error);
                        reject(error);
                    }
                });
            });

            req.on('error', (error) => {
                console.error('Request error:', error.message);
                reject(error);
            });
            
            req.on('timeout', () => {
                console.error('Request timeout');
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (options.body) {
                const body = typeof options.body === 'string' 
                    ? options.body 
                    : JSON.stringify(options.body);
                    
                // Ensure Content-Length is set correctly
                reqOptions.headers['Content-Length'] = Buffer.byteLength(body);
                // Set content type if not already set
                if (!reqOptions.headers['Content-Type'] && typeof options.body !== 'string') {
                    reqOptions.headers['Content-Type'] = 'application/json';
                }
                req.write(body);
            }
            
            req.end();
        } catch (error) {
            console.error('Error in fetch setup:', error);
            reject(error);
        }
    });
}

// Use our simple fetch implementation
const fetch = simpleFetch;

class CodeAnalyzer {
    constructor() {
        this.panel = null;
        this.disposables = [];
        this.extensionPath = path.dirname(__dirname);
        this.outputChannel = vscode.window.createOutputChannel('SCode Analyzer');
    }

    async activate(context) {
        // Log the detected paths for debugging
        this.outputChannel.appendLine(`Extension Path: ${this.extensionPath}`);
        this.outputChannel.appendLine(`Backend Path: ${path.join(this.extensionPath, 'backend')}`);
        
        // Show output channel for debugging
        this.outputChannel.show();
        
        // Register the analyze command
        let analyzeCommand = vscode.commands.registerCommand('scode.analyze', async () => {
            try {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    throw new Error('No workspace folder found. Please open a folder first.');
                }
                
                // Log and validate the project directory
                const projectDir = workspaceFolder.uri.fsPath;
                this.outputChannel.appendLine(`Preparing to analyze projectDir: ${projectDir}`);
                if (!fs.existsSync(projectDir)) {
                    this.outputChannel.appendLine(`Error: Directory does not exist: ${projectDir}`);
                    throw new Error(`Project directory does not exist: ${projectDir}`);
                }
                this.outputChannel.appendLine(`Confirmed directory exists. Contents: ${fs.readdirSync(projectDir).join(', ')}`);
        
                this.createOrShowPanel();
                
                this.panel.webview.postMessage({
                    command: 'loading',
                    message: 'Setting up Python environment...'
                });
                
                this.outputChannel.appendLine('Setting up Python environment...');
                await pythonManager.setupPythonEnvironment(this.extensionPath)
                    .catch(error => {
                        this.outputChannel.appendLine(`Python setup error: ${error.message}`);
                        if (error.stack) {
                            this.outputChannel.appendLine(error.stack);
                        }
                        throw error;
                    });
                
                // Check if server is running by making a health check
                try {
                    this.outputChannel.appendLine('Checking server health...');
                    // Use a direct try/catch for the fetch call without using .catch()
                    try {
                        const healthResponse = await fetch('http://localhost:5000/health', {
                            method: 'GET',
                            timeout: 5000
                        });
                        
                        if (!healthResponse.ok) {
                            throw new Error(`Server responded with status: ${healthResponse.status}`);
                        }
                        
                        const healthData = await healthResponse.json();
                        this.outputChannel.appendLine(`Health check response: ${JSON.stringify(healthData)}`);
                        
                        if (healthData.status !== 'healthy') {
                            throw new Error('Python server is not healthy');
                        }
                    } catch (fetchError) {
                        throw new Error(`Network error during health check: ${fetchError.message}`);
                    }
                } catch (error) {
                    this.outputChannel.appendLine(`Health check failed: ${error.message}`);
                    throw new Error(`Failed to connect to Python server: ${error.message}`);
                }
                
                // Add a small delay to ensure server is ready
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                this.outputChannel.appendLine('Python server started successfully');
                this.panel.webview.postMessage({
                    command: 'loading',
                    message: 'Python server started. Analyzing code...'
                });
                
                // Send the analyze command with validated projectDir
                this.outputChannel.appendLine(`Sending analyze command with projectDir: ${projectDir}`);
                this.panel.webview.postMessage({
                    command: 'analyze',
                    projectDir: projectDir
                });
            } catch (error) {
                this.outputChannel.appendLine(`Error: ${error.message}`);
                if (this.panel) {
                    this.panel.webview.postMessage({
                        command: 'error',
                        message: `Failed to start analysis: ${error.message}`
                    });
                } else {
                    vscode.window.showErrorMessage(`Failed to start analysis: ${error.message}`);
                }
            }
        });
        

        context.subscriptions.push(analyzeCommand);
        context.subscriptions.push(this.outputChannel);
    }

    createOrShowPanel() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'codeAnalyzer',
            'Code Analysis',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(this.extensionPath, 'media')),
                    vscode.Uri.file(path.join(this.extensionPath, 'node_modules'))
                ]
            }
        );

        // Set webview content
        this.panel.webview.html = this.getWebviewContent();

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            async message => {
                this.outputChannel.appendLine(`Received message from webview: ${JSON.stringify(message)}`);
                
                switch (message.command) {
                    case 'requestAst':
                        try {
                            this.outputChannel.appendLine('Requesting AST data from backend');
                            try {
                                const response = await fetch('http://localhost:5000/ast', {
                                    method: 'GET',
                                    timeout: 10000
                                });
                                
                                if (!response.ok) {
                                    throw new Error(`Server responded with status: ${response.status} - ${response.statusText}`);
                                }
                                
                                const astData = await response.json();
                                this.outputChannel.appendLine('AST data received successfully');
                                this.panel.webview.postMessage({
                                    command: 'astData',
                                    data: astData
                                });
                            } catch (fetchError) {
                                throw new Error(`Network error during AST fetch: ${fetchError.message}`);
                            }
                        } catch (error) {
                            this.outputChannel.appendLine(`AST fetch error: ${error.message}`);
                            this.panel.webview.postMessage({
                                command: 'error',
                                message: `Failed to fetch AST: ${error.message}`
                            });
                        }
                        break;
                        
                    case 'selectEntrypoint':
                        // User selected an entrypoint file
                        try {
                            const projectDir = message.projectDir;
                            const entrypoint = message.entrypoint;
                            
                            this.outputChannel.appendLine(`Selected entrypoint: ${entrypoint}`);
                            this.outputChannel.appendLine(`Analyzing with project directory: ${projectDir}`);
                            
                            // Send analyze request with selected entrypoint
                            this.outputChannel.appendLine('Sending analyze request to backend with entrypoint');
                            try {
                                const response = await fetch('http://localhost:5000/analyze', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ 
                                        project_dir: projectDir,
                                        entrypoint: entrypoint
                                    }),
                                    timeout: 10000
                                });
                                
                                if (!response.ok) {
                                    throw new Error(`Server responded with status: ${response.status} - ${response.statusText}`);
                                }
                                
                                const result = await response.json();
                                this.outputChannel.appendLine(`Analysis result: ${JSON.stringify(result).substring(0, 200)}...`);
                                
                                if (result.error) {
                                    throw new Error(result.error);
                                }
                                
                                // Forward result to webview
                                this.panel.webview.postMessage({
                                    command: 'astData',
                                    data: result.data
                                });
                            } catch (fetchError) {
                                throw new Error(`Network error during analysis: ${fetchError.message}`);
                            }
                        } catch (error) {
                            this.outputChannel.appendLine(`Analysis error: ${error.message}`);
                            this.panel.webview.postMessage({
                                command: 'error',
                                message: `Analysis failed: ${error.message}`
                            });
                        }
                        break;
                        
                    case 'openFile':
                        // Open a file at a specific line
                        try {
                            const filepath = message.file;
                            const line = message.line;
                            
                            // Check if path is absolute or relative
                            const fullPath = path.isAbsolute(filepath) 
                                ? filepath 
                                : path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, filepath);
                            
                            const document = await vscode.workspace.openTextDocument(fullPath);
                            const editor = await vscode.window.showTextDocument(document);
                            
                            if (line > 0) {
                                const position = new vscode.Position(line - 1, 0);
                                editor.selection = new vscode.Selection(position, position);
                                editor.revealRange(
                                    new vscode.Range(position, position),
                                    vscode.TextEditorRevealType.InCenter
                                );
                            }
                        } catch (error) {
                            this.outputChannel.appendLine(`Error opening file: ${error.message}`);
                            vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
                        }
                        break;
                        
                    case 'error':
                        const errorMsg = message.message || 'Unknown error';
                        this.outputChannel.appendLine(`Webview error: ${errorMsg}`);
                        if (message.stack) {
                            this.outputChannel.appendLine(`Stack: ${message.stack}`);
                        }
                        vscode.window.showErrorMessage(`Webview error: ${errorMsg}`);
                        break;
                }
            },
            undefined,
            this.disposables
        );

        // Clean up when panel is closed
        this.panel.onDidDispose(
            () => {
                this.panel = null;
                pythonManager.stopPythonServer();
            },
            null,
            this.disposables
        );
    }

    getWebviewContent() {
        const mainJsUri = this.panel.webview.asWebviewUri(
            vscode.Uri.file(path.join(this.extensionPath, 'media', 'main.js'))
        );
        const mainCssUri = this.panel.webview.asWebviewUri(
            vscode.Uri.file(path.join(this.extensionPath, 'media', 'main.css'))
        );
    
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Code Analysis</title>
            <link rel="stylesheet" href="${mainCssUri}">
            <script>
                // Attach vscode to window for the webview
                window.vscode = acquireVsCodeApi();
                
                // Log errors to help with debugging
                window.onerror = function(message, source, lineno, colno, error) {
                    window.vscode.postMessage({
                        command: 'error',
                        message: message,
                        source: source,
                        line: lineno,
                        column: colno,
                        stack: error ? error.stack : ''
                    });
                    return true; // Prevent default error handling
                };
                
                // Add unhandled promise rejection handler
                window.addEventListener('unhandledrejection', function(event) {
                    window.vscode.postMessage({
                        command: 'error',
                        message: 'Unhandled Promise Rejection: ' + event.reason,
                        stack: event.reason.stack || ''
                    });
                });
            </script>
            <script src="https://d3js.org/d3.v7.min.js"></script>
            <script src="https://unpkg.com/react@17/umd/react.production.min.js"></script>
            <script src="https://unpkg.com/react-dom@17/umd/react-dom.production.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.7.1/gsap.min.js"></script>
        </head>
        <body>
            <div id="root"></div>
            <script src="${mainJsUri}"></script>
        </body>
        </html>`;
    }

    dispose() {
        this.panel?.dispose();
        this.panel = null;
        pythonManager.stopPythonServer();
        this.disposables.forEach(d => d.dispose());
    }
}

function activate(context) {
    console.log('SCode Analyzer extension is now active!');
    const analyzer = new CodeAnalyzer();
    analyzer.activate(context);
    context.subscriptions.push(analyzer);
}

function deactivate() {
    // Clean up resources
    pythonManager.stopPythonServer();
}

module.exports = {
    activate,
    deactivate
};