const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const pythonManager = require('./pythonSetup');


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
                // Get workspace folder
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (!workspaceFolder) {
                    throw new Error('No workspace folder found. Please open a folder first.');
                }
                
                // Create and show panel early to display loading state
                this.createOrShowPanel();
                
                // Display loading state
                this.panel.webview.postMessage({
                    command: 'loading',
                    message: 'Setting up Python environment...'
                });
                
                // 1. Setup Python environment and start backend
                this.outputChannel.appendLine('Setting up Python environment...');
                await pythonManager.setupPythonEnvironment(this.extensionPath)
                    .catch(error => {
                        this.outputChannel.appendLine(`Python setup error: ${error.message}`);
                        if (error.stack) {
                            this.outputChannel.appendLine(error.stack);
                        }
                        throw error;
                    });
                
                this.outputChannel.appendLine('Python server started successfully');
                this.panel.webview.postMessage({
                    command: 'loading',
                    message: 'Python server started. Analyzing code...'
                });
                
                // 2. Send analyze command to the panel
                this.panel.webview.postMessage({
                    command: 'analyze',
                    projectDir: workspaceFolder.uri.fsPath
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
                this.outputChannel.appendLine(`Received message: ${message.command}`);
                
                switch (message.command) {
                    case 'requestAst':
                        try {
                            const response = await fetch('http://localhost:5000/ast');
                            const astData = await response.json();
                            this.panel.webview.postMessage({
                                command: 'astData',
                                data: astData
                            });
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
                            
                            // Send analyze request with selected entrypoint
                            const response = await fetch('http://localhost:5000/analyze', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                    project_dir: projectDir,
                                    entrypoint: entrypoint
                                })
                            });
                            
                            const result = await response.json();
                            if (result.error) {
                                throw new Error(result.error);
                            }
                            
                            // Forward result to webview
                            this.panel.webview.postMessage({
                                command: 'astData',
                                data: result.data
                            });
                            
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
                // Safe way to get vscode API
                const vscode = acquireVsCodeApi();
                
                // Log errors to help with debugging
                window.onerror = function(message, source, lineno, colno, error) {
                    vscode.postMessage({
                        command: 'error',
                        message: message,
                        source: source,
                        line: lineno,
                        column: colno,
                        stack: error ? error.stack : ''
                    });
                    return false;
                };
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