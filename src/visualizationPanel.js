const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

class VisualizationPanel {
    static currentPanel = undefined;
    constructor(panel, extensionUri) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._disposables = [];

        // Set the webview's initial html content
        this._update({ status: 'loading' });

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'alert':
                        vscode.window.showErrorMessage(message.text);
                        return;
                    case 'openFile':
                        this._openFile(message.file, message.line);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    static createOrShow(extensionUri, analysisResult) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (VisualizationPanel.currentPanel) {
            VisualizationPanel.currentPanel._panel.reveal(column);
            VisualizationPanel.currentPanel._update(analysisResult);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'scodeVisualization',
            'SCode Analyzer Visualization',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media')
                ]
            }
        );

        VisualizationPanel.currentPanel = new VisualizationPanel(panel, extensionUri);
        VisualizationPanel.currentPanel._update(analysisResult);
    }

    _openFile(filePath, line) {
        vscode.workspace.openTextDocument(filePath).then(document => {
            vscode.window.showTextDocument(document).then(editor => {
                const range = new vscode.Range(line, 0, line, 0);
                editor.revealRange(range);
                editor.selection = new vscode.Selection(range.start, range.end);
            });
        });
    }

    dispose() {
        VisualizationPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    _update(analysisResult) {
        const webview = this._panel.webview;
        this._panel.title = 'SCode Analyzer Visualization';
        this._panel.webview.html = this._getHtmlForWebview(webview, analysisResult);
    }

    _getHtmlForWebview(webview, analysisResult) {
        // Local path to main script run in the webview
        const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js');
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);

        // Local path to css styles
        const stylePathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css');
        const styleUri = webview.asWebviewUri(stylePathOnDisk);

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        // Read the AST data if available
        let astData = null;
        if (analysisResult.ast_file && fs.existsSync(analysisResult.ast_file)) {
            try {
                astData = JSON.parse(fs.readFileSync(analysisResult.ast_file, 'utf8'));
            } catch (e) {
                console.error(`Error reading AST file: ${e}`);
            }
        }

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>SCode Analyzer Visualization</title>
            <link href="${styleUri}" rel="stylesheet">
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
                        <div class="loading-text">Initializing Visualization...</div>
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
                                    <span class="stat-value">${analysisResult.functions?.length || 0}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Modules</span>
                                    <span class="stat-value">${analysisResult.modules?.length || 0}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-label">Vulnerabilities</span>
                                    <span class="stat-value">${analysisResult.vulnerabilities?.length || 0}</span>
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
                const analysisData = ${JSON.stringify(analysisResult)};
                const astData = ${astData ? JSON.stringify(astData) : 'null'};
            </script>
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

module.exports = {
    VisualizationPanel
};