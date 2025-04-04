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

    // Send initial loading state
    panel.webview.postMessage({ 
      type: 'fromExtension', 
      command: 'load' 
    });

    // Run analysis
    const result = await runAnalysis(rootPath, panel);
    
    // Send analysis data
    panel.webview.postMessage({ 
      type: 'fromExtension', 
      command: 'showAnalysis', 
      data: result 
    });
    
    return result;
  } catch (error) {
    panel.webview.postMessage({ 
      type: 'fromExtension', 
      command: 'error', 
      error: error.message 
    });
    throw error;
  }
}

async function runAnalysis(rootPath, panel) {
  try {
    // Send progress update
    panel.webview.postMessage({ 
      type: 'fromExtension', 
      command: 'updateProgress', 
      progress: 20 
    });

    // Mock data for testing
    const mockData = {
      modules: [
        { name: 'Module 1', path: '/path/to/module1' },
        { name: 'Module 2', path: '/path/to/module2' }
      ],
      functions: [
        { name: 'function1', path: '/path/to/file1.js', line: 10 },
        { name: 'function2', path: '/path/to/file2.js', line: 20 }
      ],
      vulnerabilities: [
        { name: 'XSS', path: '/path/to/file1.js', line: 15, severity: 'high' },
        { name: 'SQL Injection', path: '/path/to/file2.js', line: 25, severity: 'critical' }
      ],
      variables: [
        { name: 'var1', type: 'string', value: 'test' },
        { name: 'var2', type: 'number', value: '42' }
      ]
    };

    // Send mock data
    panel.webview.postMessage({ 
      type: 'fromExtension', 
      command: 'showAnalysis', 
      data: mockData 
    });
    
    return mockData;
  } catch (error) {
    console.error('Error in analysis:', error);
    throw error;
  }
}

function getWebviewContent(webview, bundleUri, stylesUri, projectDir) {
  return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src ${webview.cspSource} ws: wss:; img-src ${webview.cspSource} https: data:; script-src ${webview.cspSource} 'unsafe-eval' 'unsafe-inline' https://cdnjs.cloudflare.com blob:; style-src ${webview.cspSource} 'unsafe-inline' https://cdnjs.cloudflare.com; font-src ${webview.cspSource} https://cdnjs.cloudflare.com; worker-src blob:;">
        <title>SCode Analyzer</title>
        <link href="${stylesUri}" rel="stylesheet">
        <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.0.0/d3.min.js"></script>
        <style>
            body { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; background: #1e1e1e; color: white; font-family: system-ui, -apple-system, sans-serif; }
            #root { width: 100%; height: 100%; position: absolute; top: 0; left: 0; }
            .debug-info { display: none; }
        </style>
    </head>
    <body>
        <div id="root"></div>
        <script>
            window.vscode = acquireVsCodeApi();
            window.projectDir = "${projectDir}";
        </script>
        <script src="${bundleUri}"></script>
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