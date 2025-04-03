const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const http = require('http');
const pythonManager = require('./pythonSetup');

// Custom fetch implementation
function simpleFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
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

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const response = {
                        ok: res.statusCode >= 200 && res.statusCode < 300,
                        status: res.statusCode,
                        statusText: res.statusMessage,
                        headers: res.headers,
                        text: () => Promise.resolve(data),
                        json: () => Promise.resolve(JSON.parse(data))
                    };
                    resolve(response);
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        if (options.body) {
            const body = typeof options.body === 'string' 
                ? options.body 
                : JSON.stringify(options.body);
            req.write(body);
        }
        req.end();
    });
}

let panel = null;

function createOrShowPanel() {
    if (panel) {
        panel.reveal(vscode.ViewColumn.One);
        return;
    }

    panel = vscode.window.createWebviewPanel(
        'codeAnalyzer',
        'Code Analysis',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [
                vscode.Uri.file(path.join(__dirname, '..', 'media')),
                vscode.Uri.file(path.join(__dirname, '..', 'node_modules'))
            ]
        }
    );

    panel.webview.html = getWebviewContent();

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(async message => {
        console.log(`Received message from webview: ${JSON.stringify(message)}`);
        
        switch (message.command) {
            case 'requestAst':
                try {
                    console.log('Requesting AST data from backend');
                    const response = await simpleFetch('http://localhost:5000/ast', {
                        method: 'GET',
                        timeout: 10000
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Server responded with status: ${response.status}`);
                    }
                    
                    const astData = await response.json();
                    console.log('AST data received successfully');
                    panel.webview.postMessage({
                        command: 'astData',
                        data: astData
                    });
                } catch (error) {
                    console.error(`AST fetch error: ${error.message}`);
                    panel.webview.postMessage({
                        command: 'error',
                        message: `Failed to fetch AST: ${error.message}`
                    });
                }
                break;
                
            case 'selectEntrypoint':
                try {
                    const projectDir = message.projectDir;
                    const entrypoint = message.entrypoint;
                    
                    console.log(`Selected entrypoint: ${entrypoint}`);
                    console.log(`Analyzing with project directory: ${projectDir}`);
                    
                    const response = await simpleFetch('http://localhost:5000/analyze', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            project_dir: projectDir,
                            entrypoint: entrypoint
                        }),
                        timeout: 10000
                    });
                    
                    if (!response.ok) {
                        throw new Error(`Server responded with status: ${response.status}`);
                    }
                    
                    const result = await response.json();
                    console.log(`Analysis result: ${JSON.stringify(result).substring(0, 200)}...`);
                    
                    if (result.error) {
                        throw new Error(result.error);
                    }
                    
                    panel.webview.postMessage({
                        command: 'astData',
                        data: result.data
                    });
                } catch (error) {
                    console.error(`Analysis error: ${error.message}`);
                    panel.webview.postMessage({
                        command: 'error',
                        message: `Analysis failed: ${error.message}`
                    });
                }
                break;
                
            case 'openFile':
                try {
                    const filepath = message.file;
                    const line = message.line;
                    
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
                    console.error(`Error opening file: ${error.message}`);
                    vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
                }
                break;
                
            case 'error':
                const errorMsg = message.message || 'Unknown error';
                console.error(`Webview error: ${errorMsg}`);
                if (message.stack) {
                    console.error(`Stack: ${message.stack}`);
                }
                vscode.window.showErrorMessage(`Webview error: ${errorMsg}`);
                break;
        }
    });

    panel.onDidDispose(
        () => {
            panel = null;
            pythonManager.stopPythonServer();
        },
        null
    );
}

function getWebviewContent() {
    const mainJsUri = panel.webview.asWebviewUri(
        vscode.Uri.file(path.join(__dirname, '..', 'media', 'main.js'))
    );
    const mainCssUri = panel.webview.asWebviewUri(
        vscode.Uri.file(path.join(__dirname, '..', 'media', 'main.css'))
    );

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Code Analysis</title>
        <link rel="stylesheet" href="${mainCssUri}">
        <script>
            window.vscode = acquireVsCodeApi();
        </script>
    </head>
    <body>
        <div id="root"></div>
        <script src="${mainJsUri}"></script>
    </body>
    </html>`;
}

function activate(context) {
    let analyzeCommand = vscode.commands.registerCommand('scode.analyzeproject', async () => {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder found. Please open a folder first.');
            }
            
            const projectDir = workspaceFolder.uri.fsPath;
            console.log(`Preparing to analyze projectDir: ${projectDir}`);
            if (!fs.existsSync(projectDir)) {
                console.error(`Error: Directory does not exist: ${projectDir}`);
                throw new Error(`Project directory does not exist: ${projectDir}`);
            }
            console.log(`Confirmed directory exists. Contents: ${fs.readdirSync(projectDir).join(', ')}`);
    
            createOrShowPanel();
            
            panel.webview.postMessage({
                command: 'loading',
                message: 'Setting up Python environment...'
            });
            
            console.log('Setting up Python environment...');
            await pythonManager.setupPythonEnvironment(path.dirname(path.dirname(__dirname)))
                .catch(error => {
                    console.error(`Python setup error: ${error.message}`);
                    if (error.stack) {
                        console.error(error.stack);
                    }
                    throw error;
                });
            
            try {
                console.log('Checking server health...');
                const healthResponse = await simpleFetch('http://localhost:5000/health', {
                    method: 'GET',
                    timeout: 5000
                });
                
                if (!healthResponse.ok) {
                    throw new Error(`Server responded with status: ${healthResponse.status}`);
                }
                
                const healthData = await healthResponse.json();
                console.log(`Health check response: ${JSON.stringify(healthData)}`);
                
                if (healthData.status !== 'healthy') {
                    throw new Error('Python server is not healthy');
                }
            } catch (error) {
                console.error(`Health check failed: ${error.message}`);
                throw new Error(`Failed to connect to Python server: ${error.message}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log('Python server started successfully');
            panel.webview.postMessage({
                command: 'loading',
                message: 'Python server started. Analyzing code...'
            });
            
            console.log(`Sending analyze command with projectDir: ${projectDir}`);
            panel.webview.postMessage({
                command: 'analyze',
                projectDir: projectDir
            });
        } catch (error) {
            console.error(`Error: ${error.message}`);
            if (panel) {
                panel.webview.postMessage({
                    command: 'error',
                    message: `Failed to start analysis: ${error.message}`
                });
            } else {
                vscode.window.showErrorMessage(`Failed to start analysis: ${error.message}`);
            }
        }
    });

    context.subscriptions.push(analyzeCommand);
}

function deactivate() {
    pythonManager.stopPythonServer();
}

module.exports = {
    activate,
    deactivate
};