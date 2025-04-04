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

  panel.webview.html = getWebviewContent(panel.webview, bundleUri, stylesUri, projectDir);
  analyzeProject(panel).catch(error => {
    console.error('Analysis failed:', error);
  });
  panel.webview.onDidReceiveMessage(
    async (message) => {
      // console.log('Received message from webview:', message);
      switch (message.command) {
        // case 'startAnalysis':
        //   try {
        //     const analysisResult = await analyzeProject(panel);
        //     panel.webview.postMessage({
        //       type: 'fromExtension',
        //       command: 'showAnalysis',
        //       data: analysisResult,
        //     });
        //   } catch (error) {
        //     panel.webview.postMessage({
        //       type: 'fromExtension',
        //       command: 'error',
        //       error: error.message,
        //     });
        //   }
        //   break;
        // case 'getAnalysis':
        //   console.log('Sending analysis data to webview');
        //   panel.webview.postMessage({
        //     type: 'fromExtension',
        //     command: 'analysis',
        //     data: analysis,
        //   });
        //   break;
        case 'getShader':
          try {
            const shaderPath = path.join(__dirname, '..', 'media', message.path);
            // console.log('Loading shader from:', shaderPath);
            const shaderContent = fs.readFileSync(shaderPath, 'utf8');
            panel.webview.postMessage({
              command: 'shaderContent',
              path: message.path,
              content: shaderContent,
            });
          } catch (error) {
            console.error(`Error loading shader: ${error.message}`);
            // panel.webview.postMessage({
            //   command: 'shaderError',
            //   path: message.path,
            //   error: error.message,
            // });
          }
          break;
        // case 'log':
        //   console.log('Webview:', message.message);
        //   break;
        // case 'error':
        //   console.error('Webview error:', message.message);
        //   break;
      }
    },
    undefined,
    context.subscriptions
  );
}

async function analyzeProject(panel) {
  try {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      throw new Error('No active editor found');
    }
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder is open');
    }

    const rootPath = workspaceFolders[0].uri.fsPath;

    // Send progress updates
    panel.webview.postMessage({ type: 'fromExtension', command: 'updateProgress', progress: 10 });
    const result = await runAnalysis(rootPath, panel);
    panel.webview.postMessage({ type: 'fromExtension', command: 'updateProgress', progress: 100 });
    return result;
  } catch (error) {
    vscode.window.showErrorMessage(`Analysis failed: ${error.message}`);
    throw error;
  }
}

async function runAnalysis(rootPath, panel) {
  try {
    panel.webview.postMessage({ type: 'fromExtension', command: 'updateProgress', progress: 20 });
    const response = await fetch('http://localhost:5000/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project_dir: rootPath,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    panel.webview.postMessage({ type: 'fromExtension', command: 'updateProgress', progress: 80 });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching analysis:', error);
    throw error;
  }
}

function getWebviewContent(webview, bundleUri, stylesUri, projectDir) {
  return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src ${webview.cspSource} ws: wss:; img-src ${webview.cspSource} https: data:; script-src ${webview.cspSource} 'unsafe-eval' 'unsafe-inline' blob:; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; worker-src blob:;">
        <title>Code Visualization</title>
        <link href="${stylesUri}" rel="stylesheet">
        <style>
            body { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; background: #1e1e1e; color: white; font-family: monospace; }
            #root { width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
            .debug-info { position: fixed; top: 10px; left: 10px; color: white; font-family: monospace; z-index: 1000; }
            .data-display { position: fixed; top: 10px; left: 10px; background: rgba(0, 0, 0, 0.8); padding: 10px; border-radius: 5px; max-width: 80%; max-height: 80%; overflow: auto; z-index: 1000; }
            .data-display pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
        </style>
    </head>
    <body>
        <div id="root"></div>
        <div class="data-display">
            <h3>Project Directory:</h3>
            <pre>${projectDir}</pre>
        </div>
        <div class="debug-info"></div>
        <script>
            window.vscode = acquireVsCodeApi();
            const debugInfo = document.querySelector('.debug-info');
            const originalLog = console.log;
            const originalError = console.error;

            console.log = function(...args) {
                const safeArgs = args.map(arg => {
                    try {
                        return typeof arg === 'object' ? JSON.stringify(arg) : arg;
                    } catch (e) {
                        return '[Circular Structure]';
                    }
                });
                debugInfo.innerHTML += safeArgs.join(' ') + '<br>';
                window.vscode.postMessage({ type: 'log', message: safeArgs.join(' ') });
                originalLog.apply(console, args);
            };

            console.error = function(...args) {
                const safeArgs = args.map(arg => {
                    try {
                        return typeof arg === 'object' ? JSON.stringify(arg) : arg;
                    } catch (e) {
                        return '[Circular Structure]';
                    }
                });
                debugInfo.innerHTML += '<span style="color: red;">' + safeArgs.join(' ') + '</span><br>';
                window.vscode.postMessage({ type: 'error', message: safeArgs.join(' ') });
                originalError.apply(console, args);
            };

            window.addEventListener('error', function(event) {
                console.error('Error:', event.message, 'at', event.filename, ':', event.lineno);
            });

            const script = document.createElement('script');
            script.src = '${bundleUri}';
            script.onload = () => {
                console.log('Bundle loaded successfully');
                if (window.updateUI) window.updateUI();
            };
            script.onerror = (error) => {
                console.error('Failed to load bundle:', error);
            };
            document.body.appendChild(script);
        </script>
    </body>
    </html>`;
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