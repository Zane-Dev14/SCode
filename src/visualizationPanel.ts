import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class VisualizationPanel {
    public static currentPanel: VisualizationPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, analysisResult: any) {
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

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

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

    private _openFile(filePath: string, line: number) {
        vscode.workspace.openTextDocument(filePath).then(document => {
            vscode.window.showTextDocument(document).then(editor => {
                const range = new vscode.Range(line, 0, line, 0);
                editor.revealRange(range);
                editor.selection = new vscode.Selection(range.start, range.end);
            });
        });
    }

    public dispose() {
        VisualizationPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update(analysisResult: any) {
        const webview = this._panel.webview;
        this._panel.title = 'SCode Analyzer Visualization';
        this._panel.webview.html = this._getHtmlForWebview(webview, analysisResult);
    }

    private _getHtmlForWebview(webview: vscode.Webview, analysisResult: any) {
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
        </head>
        <body>
            <div class="container">
                <h1>SCode Analyzer Results</h1>
                
                <div class="stats">
                    <div class="stat-item">
                        <span class="stat-label">Files Analyzed:</span>
                        <span class="stat-value">${analysisResult.files_analyzed || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Vulnerabilities Found:</span>
                        <span class="stat-value">${analysisResult.vulnerabilities?.length || 0}</span>
                    </div>
                </div>

                <div class="tabs">
                    <button class="tab-button active" data-tab="visualization">3D Visualization</button>
                    <button class="tab-button" data-tab="vulnerabilities">Vulnerabilities</button>
                </div>

                <div class="tab-content active" id="visualization">
                    <div id="3d-container"></div>
                </div>

                <div class="tab-content" id="vulnerabilities">
                    <table class="vulnerabilities-table">
                        <thead>
                            <tr>
                                <th>File</th>
                                <th>Vulnerability</th>
                                <th>Description</th>
                                <th>Severity</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${analysisResult.vulnerabilities?.map(vuln => `
                                <tr class="vulnerability-row severity-${vuln.severity}">
                                    <td class="file-cell">
                                        <a href="#" class="file-link" data-file="${vuln.file}">${path.basename(vuln.file)}</a>
                                    </td>
                                    <td>${vuln.vulnerability}</td>
                                    <td>${vuln.description}</td>
                                    <td>${vuln.severity}</td>
                                </tr>
                            `).join('') || '<tr><td colspan="4">No vulnerabilities found</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                const vulnerabilitiesData = ${JSON.stringify(analysisResult.vulnerabilities || [])};
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