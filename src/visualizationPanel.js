import * as vscode from 'vscode';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class VisualizationPanel {
    constructor(context) {
        this.context = context;
        this.panel = null;
        this.disposables = [];
    }

    createOrShow() {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            return;
        }

        this.panel = vscode.window.createWebviewPanel(
            'scodeVisualization',
            'SCode Visualization',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(this.context.extensionPath, 'media'))
                ]
            }
        );

        this.panel.webview.html = this.getWebviewContent();

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'alert':
                        vscode.window.showErrorMessage(message.text);
                        return;
                    case 'openFile':
                        this.openFile(message.file, message.line);
                        return;
                    case 'error':
                        console.error('Webview error:', message.message);
                        vscode.window.showErrorMessage(`Webview error: ${message.message}`);
                        return;
                }
            },
            null,
            this.disposables
        );

        this.panel.onDidDispose(
            () => {
                this.panel = null;
                this.disposables.forEach(d => d.dispose());
                this.disposables = [];
            },
            null,
            this.disposables
        );
    }

    update() {
        // No longer needed as data comes from API
    }

    openFile(filePath, line) {
        vscode.workspace.openTextDocument(filePath).then(document => {
            vscode.window.showTextDocument(document).then(editor => {
                const range = new vscode.Range(line, 0, line, 0);
                editor.revealRange(range);
                editor.selection = new vscode.Selection(range.start, range.end);
            });
        });
    }

    getWebviewContent() {
        const mediaPath = path.join(this.context.extensionPath, 'media');
        const mainJsPath = vscode.Uri.file(path.join(mediaPath, 'main.js'))
            .with({ scheme: 'vscode-resource' });
        const mainCssPath = vscode.Uri.file(path.join(mediaPath, 'main.css'))
            .with({ scheme: 'vscode-resource' });
        const shadersPath = vscode.Uri.file(path.join(mediaPath, 'shaders'))
            .with({ scheme: 'vscode-resource' });

        // Use a nonce to only allow specific scripts to be run
        const nonce = this.getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>SCode Visualization</title>
                <link href="${mainCssPath}" rel="stylesheet">
                <script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
                <script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.0.0/d3.min.js"></script>
                <script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
                <script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
                <script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
                <script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/react-three-fiber/8.15.11/react-three-fiber.min.js"></script>
                <script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/@react-three/drei/9.88.0/drei.min.js"></script>
                <script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/@react-three/postprocessing/2.15.11/effect.min.js"></script>
                <script nonce="${nonce}" src="https://cdnjs.cloudflare.com/ajax/libs/framer-motion/10.16.4/framer-motion.min.js"></script>
            </head>
            <body>
                <div id="root">
                    <div class="loading-screen">
                        <div class="loading-content">
                            <div class="loading-spinner"></div>
                            
                        </div>
                    </div>
                    <div class="main-container">
                        <div class="sidebar">
                            <div class="sidebar-header">
                                <h2>SCode Analyzer</h2>
                            </div>
                            <div class="sidebar-content">
                                <div class="view-selector">
                                    <button class="view-button active" data-view="ast">AST Visualization</button>
                                    <button class="view-button" data-view="modules">Modules</button>
                                    <button class="view-button" data-view="vulnerabilities">Vulnerabilities</button>
                                </div>
                                <div class="stats-panel">
                                    <div class="stat-item">
                                        <span class="stat-label">Functions</span>
                                        <span class="stat-value">0</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">Modules</span>
                                        <span class="stat-value">0</span>
                                    </div>
                                    <div class="stat-item">
                                        <span class="stat-label">Vulnerabilities</span>
                                        <span class="stat-value">0</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="visualization-container">
                            <div id="canvas-container"></div>
                        </div>
                    </div>
                </div>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    const shadersPath = "${shadersPath}";
                    
                    // Fetch data from API
                    fetch('http://localhost:5000/ast')
                        .then(response => response.json())
                        .then(data => {
                            // Map API data to visualization format
                            const visualizationData = {
                                functions: data.functions?.map(func => ({
                                    id: func.id,
                                    name: func.name,
                                    file: func.file,
                                    line: func.line,
                                    parameters: func.parameters || [],
                                    depth: func.depth,
                                    calls: func.calls || [],
                                    expanded: false,
                                    nodeType: 'function',
                                    x: 0,
                                    y: 0,
                                    z: 0,
                                    children: func.children?.map(child => ({
                                        id: child.id,
                                        target: child.target,
                                        line: child.line,
                                        tooltip: child.tooltip,
                                        nodeType: 'call',
                                        expanded: false,
                                        x: 0,
                                        y: 0,
                                        z: 0,
                                        count: child.count || 1
                                    })) || []
                                })) || [],
                                modules: data.modules?.map(module => ({
                                    name: module,
                                    path: module
                                })) || [],
                                vulnerabilities: data.vulnerabilities?.map(vuln => ({
                                    id: vuln.id,
                                    description: vuln.description,
                                    node_id: vuln.node_id,
                                    file: vuln.file,
                                    line: vuln.line,
                                    depth: vuln.depth
                                })) || [],
                                variables: data.variables?.map(var => ({
                                    id: var.id,
                                    name: var.name,
                                    file: var.file,
                                    line: var.line,
                                    function: var.function,
                                    depth: var.depth
                                })) || [],
                                dataflow: data.dataflow || []
                            };

                            // Update stats
                            document.querySelector('.stat-item:nth-child(1) .stat-value').textContent = visualizationData.functions.length;
                            document.querySelector('.stat-item:nth-child(2) .stat-value').textContent = visualizationData.modules.length;
                            document.querySelector('.stat-item:nth-child(3) .stat-value').textContent = visualizationData.vulnerabilities.length;
                            
                            // Send mapped data to visualization
                            vscode.postMessage({
                                command: 'showAnalysis',
                                data: visualizationData
                            });
                        })
                        .catch(error => {
                            console.error('Failed to fetch data:', error);
                            vscode.postMessage({
                                command: 'error',
                                error: 'Failed to fetch data from API'
                            });
                        });
                </script>
                <script src="${mainJsPath}"></script>
            </body>
            </html>`;
    }

    getNonce() {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}

export default VisualizationPanel;