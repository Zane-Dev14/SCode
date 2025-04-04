const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const PythonManager = require('./pythonSetup');

let pythonManager;

async function activate(context) {
  console.log('SCode Analyzer is now active!');

  pythonManager = new PythonManager();
  await pythonManager.initialize();

  let disposable = vscode.commands.registerCommand('scode-analyzer.analyzeCode', async () => {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('Please open a file to analyze');
        return;
      }
      // Show Webview immediately, analysis will be triggered later by main.js
      showVisualization(null, context);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to initialize analyzer: ${error.message}`);
    }
  });

  context.subscriptions.push(disposable);
}

function showVisualization(analysis, context) {
  const panel = vscode.window.createWebviewPanel(
    'scodeAnalyzer',
    'SCode Analyzer',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      enableCommandUris: true,
      retainContextWhenHidden: true,
      enableFindWidget: true,
      enableDevTools: true,
      localResourceRoots: [vscode.Uri.file(path.join(__dirname, '..', 'media'))],
    }
  );

  const mediaRoot = vscode.Uri.file(path.join(__dirname, '..', 'media'));
  const bundleUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'dist', 'bundle.js'));
  const stylesUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'styles.css'));

  const workspaceFolders = vscode.workspace.workspaceFolders;
  const projectDir = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.fsPath : 'No workspace folder';

  panel.webview.html = getWebviewContent(analysisData);

  // Start analysis immediately
  analyzeProject(panel).catch(error => {
    console.error('Analysis failed:', error);
  });

  panel.webview.onDidReceiveMessage(
    async (message) => {
      switch (message.command) {
        case 'getShader':
          try {
            const shaderPath = path.join(__dirname, '..', 'media', message.path);
            const shaderContent = fs.readFileSync(shaderPath, 'utf8');
            panel.webview.postMessage({
              command: 'shaderContent',
              path: message.path,
              content: shaderContent,
            });
          } catch (error) {
            console.error(`Error loading shader: ${error.message}`);
          }
          break;
      }
    },
    undefined,
    context.subscriptions
  );
}

async function analyzeProject(panel) {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder is open');
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    return await runAnalysis(rootPath, panel);
  } catch (error) {
    throw error;
  }
}

async function runAnalysis(projectDir, panel) {
  try {
    const response = await fetch('http://localhost:5000/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ project_dir: projectDir })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Update webview with analysis data
    panel.webview.html = getWebviewContent(data);
    
    return data;
  } catch (error) {
    console.error('Error during analysis:', error);
    throw error;
  }
}

function getWebviewContent(analysisData) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                .container {
                    padding: 20px;
                    font-family: Arial, sans-serif;
                }
                .section {
                    margin-bottom: 20px;
                    border: 1px solid #ccc;
                    padding: 15px;
                    border-radius: 5px;
                }
                .section-title {
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: #333;
                }
                .module-list, .function-list, .vulnerability-list {
                    list-style-type: none;
                    padding-left: 0;
                }
                .module-item, .function-item, .vulnerability-item {
                    padding: 8px;
                    margin: 5px 0;
                    background: #f5f5f5;
                    border-radius: 3px;
                }
                .vulnerability-item {
                    color: #d32f2f;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="section">
                    <div class="section-title">Modules Used</div>
                    <ul class="module-list">
                        ${analysisData.modules_used.map(module => `
                            <li class="module-item">${module}</li>
                        `).join('')}
                    </ul>
                </div>

                <div class="section">
                    <div class="section-title">Functions</div>
                    <ul class="function-list">
                        ${Object.entries(analysisData.function_map || {}).map(([name, func]) => `
                            <li class="function-item">
                                ${name} (${func.param_count} params)
                                ${func.vulnerabilities ? `
                                    <div style="color: #d32f2f;">
                                        Vulnerabilities: ${func.vulnerabilities.join(', ')}
                                    </div>
                                ` : ''}
                            </li>
                        `).join('')}
                    </ul>
                </div>

                <div class="section">
                    <div class="section-title">Vulnerabilities</div>
                    <ul class="vulnerability-list">
                        ${analysisData.vulnerabilities.map(vuln => `
                            <li class="vulnerability-item">${vuln}</li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        </body>
        </html>
    `;
}

function deactivate() {
  if (pythonManager) {
    pythonManager.cleanup();
  }
}

module.exports = {
  activate,
  deactivate,
};