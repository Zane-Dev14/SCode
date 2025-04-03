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

      const document = editor.document;
      const text = document.getText();
      const fileName = path.basename(document.fileName);

      const analysis = await pythonManager.analyzeCode(text, fileName);
      
      if (analysis.error) {
        vscode.window.showErrorMessage(`Analysis failed: ${analysis.error}`);
        return;
      }

      showVisualization(analysis, context);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to analyze code: ${error.message}`);
    }
  });

  context.subscriptions.push(disposable);
}

function showVisualization(analysis, context) {
    // Create and show webview panel
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
        localResourceRoots: [
          vscode.Uri.file(path.join(__dirname, '..', 'media'))
        ]
      }
    );

  // Get paths to resources
  const mediaRoot = vscode.Uri.file(path.join(__dirname, '..', 'media'));
  const bundleUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'dist', 'bundle.js'));
  const stylesUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'styles.css'));

  // Set webview content
  panel.webview.html = getWebviewContent(panel.webview, bundleUri, stylesUri);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
      message => {
      console.log('Received message from webview:', message);
      
        switch (message.command) {
          case 'getAnalysis':
          console.log('Sending analysis data to webview');
            panel.webview.postMessage({ 
            type: 'fromExtension',
              command: 'analysis', 
              data: analysis 
            });
            break;
        case 'getShader':
          try {
            const shaderPath = path.join(__dirname, '..', 'media', message.path);
            console.log('Loading shader from:', shaderPath);
            const shaderContent = fs.readFileSync(shaderPath, 'utf8');
            panel.webview.postMessage({
              command: 'shaderContent',
              path: message.path,
              content: shaderContent
            });
          } catch (error) {
            console.error(`Error loading shader: ${error.message}`);
            panel.webview.postMessage({
              command: 'shaderError',
              path: message.path,
              error: error.message
            });
          }
          break;
        case 'log':
          console.log('Webview:', message.message);
          break;
        case 'error':
          console.error('Webview error:', message.message);
          break;
        }
      },
      undefined,
      context.subscriptions
    );
}

function getWebviewContent(webview, bundleUri, stylesUri) {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src ${webview.cspSource} ws: wss:; img-src ${webview.cspSource} https: data:; script-src ${webview.cspSource} 'unsafe-eval' 'unsafe-inline' blob:; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; worker-src blob:;">
        <title>Code Visualization</title>
        <link href="${stylesUri}" rel="stylesheet">
        <style>
            body {
                margin: 0;
                padding: 0;
                width: 100vw;
                height: 100vh;
                overflow: hidden;
                background: #1e1e1e;
            }
            #root {
                width: 100%;
                height: 100%;
                position: absolute;
                top: 0;
                left: 0;
            }
            .debug-info {
                position: fixed;
                top: 10px;
                left: 10px;
                color: white;
                font-family: monospace;
                z-index: 1000;
            }
        </style>
    </head>
    <body>
        <div id="root"></div>
        <div class="debug-info"></div>
        <script>
            // Initialize VS Code API
            window.vscode = acquireVsCodeApi();
            
            // Setup logging
            const debugInfo = document.querySelector('.debug-info');
            const originalLog = console.log;
            const originalError = console.error;
            
            console.log = function(...args) {
                const safeArgs = args.map(arg => {
                    try {
                        if (typeof arg === 'object') {
                            const seen = new WeakSet();
                            return JSON.stringify(arg, function(key, value) {
                                if (key === 'stateNode' || key === '__reactContainer$' || key === 'containerInfo') {
                                    return '[Internal]';
                                }
                                if (value instanceof Element) {
                                    return '[' + value.tagName + ']';
                                }
                                if (typeof value === 'function') {
                                    return '[Function]';
                                }
                                if (typeof value === 'object' && value !== null) {
                                    if (seen.has(value)) {
                                        return '[Circular]';
                                    }
                                    seen.add(value);
                                }
                                return value;
                            });
                        }
                        return arg;
                    } catch (e) {
                        return '[Circular Structure]';
                    }
                });
                debugInfo.innerHTML += safeArgs.join(' ') + '<br>';
                window.vscode.postMessage({
                    type: 'log',
                    message: safeArgs.join(' ')
                });
                originalLog.apply(console, args);
            };
            
            console.error = function(...args) {
                const safeArgs = args.map(arg => {
                    try {
                        if (typeof arg === 'object') {
                            const seen = new WeakSet();
                            return JSON.stringify(arg, function(key, value) {
                                if (key === 'stateNode' || key === '__reactContainer$' || key === 'containerInfo') {
                                    return '[Internal]';
                                }
                                if (value instanceof Element) {
                                    return '[' + value.tagName + ']';
                                }
                                if (typeof value === 'function') {
                                    return '[Function]';
                                }
                                if (typeof value === 'object' && value !== null) {
                                    if (seen.has(value)) {
                                        return '[Circular]';
                                    }
                                    seen.add(value);
                                }
                                return value;
                            });
                        }
                        return arg;
                    } catch (e) {
                        return '[Circular Structure]';
                    }
                });
                debugInfo.innerHTML += '<span style="color: red;">' + safeArgs.join(' ') + '</span><br>';
                window.vscode.postMessage({
                    type: 'error',
                    message: safeArgs.join(' ')
                });
                originalError.apply(console, args);
            };
            
            // Error handling
            window.addEventListener('error', function(event) {
                console.error('Error:', event.message, 'at', event.filename, ':', event.lineno);
            });
            
            // Load bundle
            const script = document.createElement('script');
            script.src = '${bundleUri}';
            script.onload = () => {
                console.log('Bundle loaded successfully');
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
  deactivate
};